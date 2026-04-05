"""
映记精灵（AI助手）API
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm import deepseek_client
from app.core.deps import get_current_active_user
from app.db import get_db
from app.models.assistant import AssistantMessage, AssistantProfile, AssistantSession
from app.models.database import User
from app.services.qdrant_memory_service import qdrant_diary_memory_service
from app.services.rag_service import diary_rag_service
from app.models.diary import Diary

router = APIRouter(prefix="/assistant", tags=["映记精灵"])


class AssistantProfileResponse(BaseModel):
    nickname: Optional[str] = None
    proactive_greeting_enabled: bool = False
    is_muted: bool = False
    initialized: bool = False


class AssistantProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = Field(default=None, max_length=50)
    proactive_greeting_enabled: Optional[bool] = None
    is_muted: Optional[bool] = None


class AssistantSessionResponse(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str


class AssistantMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


class CreateSessionRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)


class ChatStreamRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[int] = None


def _fmt_dt(value: datetime | None) -> str:
    return (value or datetime.utcnow()).isoformat()


async def _get_or_create_profile(db: AsyncSession, user_id: int) -> AssistantProfile:
    result = await db.execute(select(AssistantProfile).where(AssistantProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile:
        return profile
    profile = AssistantProfile(user_id=user_id, proactive_greeting_enabled=False, is_muted=False)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


def _safe_json_sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _build_rag_context(db: AsyncSession, user: User, query: str) -> list[dict]:
    # 优先 Qdrant 语义检索
    qdrant_hits = await qdrant_diary_memory_service.retrieve_context(
        db=db,
        user_id=user.id,
        query=query,
        top_k=4,
    )
    if qdrant_hits:
        return qdrant_hits

    # 回退：本地轻量 RAG
    diaries_result = await db.execute(
        select(Diary)
        .where(Diary.user_id == user.id)
        .order_by(desc(Diary.diary_date), desc(Diary.created_at))
        .limit(80)
    )
    diaries = list(diaries_result.scalars().all())
    if not diaries:
        return []
    raw_docs = [
        {
            "id": d.id,
            "diary_date": str(d.diary_date),
            "title": d.title or "无标题",
            "content": d.content or "",
            "emotion_tags": d.emotion_tags or [],
            "importance_score": int(d.importance_score or 5),
        }
        for d in diaries
    ]
    chunks = diary_rag_service.build_chunks(raw_docs)
    hits = diary_rag_service.retrieve(chunks, query, top_k=4)
    return hits


@router.get("/profile", response_model=AssistantProfileResponse, summary="获取精灵配置")
async def get_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_profile(db, current_user.id)
    return AssistantProfileResponse(
        nickname=profile.nickname,
        proactive_greeting_enabled=False,  # 按产品要求禁用主动问候
        is_muted=profile.is_muted,
        initialized=bool((profile.nickname or "").strip()),
    )


@router.put("/profile", response_model=AssistantProfileResponse, summary="更新精灵配置")
async def update_profile(
    payload: AssistantProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_profile(db, current_user.id)
    if payload.nickname is not None:
        profile.nickname = payload.nickname.strip() or None
    if payload.proactive_greeting_enabled is not None:
        # 产品明确不需要主动问候，这里固定为 False，防止误开启
        profile.proactive_greeting_enabled = False
    if payload.is_muted is not None:
        profile.is_muted = bool(payload.is_muted)
    await db.commit()
    await db.refresh(profile)
    return AssistantProfileResponse(
        nickname=profile.nickname,
        proactive_greeting_enabled=False,
        is_muted=profile.is_muted,
        initialized=bool((profile.nickname or "").strip()),
    )


@router.get("/sessions", response_model=list[AssistantSessionResponse], summary="获取会话列表")
async def list_sessions(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssistantSession)
        .where(and_(AssistantSession.user_id == current_user.id, AssistantSession.is_archived == False))
        .order_by(desc(AssistantSession.updated_at))
        .limit(limit)
    )
    rows = list(result.scalars().all())
    return [
        AssistantSessionResponse(
            id=r.id,
            title=(r.title or "新对话"),
            created_at=_fmt_dt(r.created_at),
            updated_at=_fmt_dt(r.updated_at),
        )
        for r in rows
    ]


@router.post("/sessions", response_model=AssistantSessionResponse, summary="创建新会话")
async def create_session(
    payload: CreateSessionRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    row = AssistantSession(user_id=current_user.id, title=(payload.title or "新对话").strip()[:120])
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return AssistantSessionResponse(
        id=row.id,
        title=row.title or "新对话",
        created_at=_fmt_dt(row.created_at),
        updated_at=_fmt_dt(row.updated_at),
    )


@router.delete("/sessions/{session_id}", summary="归档会话")
async def archive_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssistantSession).where(
            and_(AssistantSession.id == session_id, AssistantSession.user_id == current_user.id)
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="会话不存在")
    row.is_archived = True
    await db.commit()
    return {"ok": True}


@router.get("/sessions/{session_id}/messages", response_model=list[AssistantMessageResponse], summary="获取会话消息")
async def list_messages(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    session_result = await db.execute(
        select(AssistantSession).where(
            and_(AssistantSession.id == session_id, AssistantSession.user_id == current_user.id)
        )
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="会话不存在")

    result = await db.execute(
        select(AssistantMessage)
        .where(and_(AssistantMessage.user_id == current_user.id, AssistantMessage.session_id == session_id))
        .order_by(AssistantMessage.created_at.asc(), AssistantMessage.id.asc())
    )
    rows = list(result.scalars().all())
    return [
        AssistantMessageResponse(
            id=r.id,
            role=r.role,
            content=r.content,
            created_at=_fmt_dt(r.created_at),
        )
        for r in rows
    ]


@router.post("/sessions/{session_id}/clear", summary="清空会话消息")
async def clear_session_messages(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    session_result = await db.execute(
        select(AssistantSession).where(
            and_(AssistantSession.id == session_id, AssistantSession.user_id == current_user.id)
        )
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="会话不存在")

    rows_result = await db.execute(
        select(AssistantMessage).where(
            and_(AssistantMessage.user_id == current_user.id, AssistantMessage.session_id == session_id)
        )
    )
    for row in list(rows_result.scalars().all()):
        await db.delete(row)
    await db.commit()
    return {"ok": True}


def _needs_diary_search(message: str) -> bool:
    """判断用户消息是否包含日记查找意图"""
    msg = (message or "").lower()
    # 明确的查找/回忆日记的关键词
    search_keywords = [
        "找", "查", "搜", "检索", "翻",
        "写过", "记过", "提到过", "说过", "聊过",
        "哪篇", "哪天", "什么时候写",
        "有没有写", "有没有记", "有关于",
        "之前的日记", "以前的日记", "上次写",
        "帮我找", "帮我查", "帮我搜",
        "回忆", "回顾", "翻翻日记",
        "日记里", "日记中",
    ]
    return any(kw in msg for kw in search_keywords)


@router.post("/chat/stream", summary="流式对话")
async def chat_stream(
    payload: ChatStreamRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="消息不能为空")

    session_id = payload.session_id
    if session_id is None:
        new_session = AssistantSession(user_id=current_user.id, title=message[:20] or "新对话")
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        session_id = new_session.id
    else:
        session_check = await db.execute(
            select(AssistantSession).where(
                and_(AssistantSession.id == session_id, AssistantSession.user_id == current_user.id)
            )
        )
        if not session_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="会话不存在")

    user_msg = AssistantMessage(user_id=current_user.id, session_id=session_id, role="user", content=message)
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    profile = await _get_or_create_profile(db, current_user.id)
    nickname = (profile.nickname or current_user.username or "你").strip()

    # 仅当用户明确要求查找日记时才触发 RAG 检索
    rag_hits: list[dict] = []
    if _needs_diary_search(message):
        rag_hits = await _build_rag_context(db, current_user, message)

    history_result = await db.execute(
        select(AssistantMessage)
        .where(and_(AssistantMessage.user_id == current_user.id, AssistantMessage.session_id == session_id))
        .order_by(desc(AssistantMessage.created_at), desc(AssistantMessage.id))
        .limit(10)
    )
    history_rows = list(history_result.scalars().all())[::-1]
    history_text = "\n".join([f"{r.role}: {r.content[:200]}" for r in history_rows])

    # 构建日记链接映射 — 供AI在回复中引用
    diary_links_map: list[dict] = []
    rag_lines: list[str] = []
    for it in rag_hits:
        did = it.get("diary_id")
        title = it.get("title") or "无标题"
        diary_date = it.get("diary_date") or ""
        snippet = it.get("snippet") or ""
        if did:
            diary_links_map.append({"diary_id": did, "title": title, "date": diary_date})
            rag_lines.append(
                f"- [{diary_date} {title}]（日记ID={did}） 片段：{snippet}"
            )
        else:
            rag_lines.append(f"- {diary_date} | {title} | {snippet}")
    rag_text = "\n".join(rag_lines) or "暂无检索到的相关日记片段。"

    system_prompt = (
        "你是映记精灵，是一只温暖、不评判、有洞察力的小狐狸伙伴。"
        "你擅长用轻柔、具体的方式陪伴用户，避免说教。"
        "如果用户表达明显的痛苦情绪，先共情再给一个可执行的小步骤。"
        "回答使用简体中文，语气自然真诚，不要过度营销化。"
    )
    # 仅在触发日记查找时追加日记相关指令
    if rag_hits:
        system_prompt += (
            "\n\n【日记查找能力】\n"
            "系统已经帮你检索了用户相关的日记片段。"
            "当你引用某篇日记时，请使用这个格式：[[diary:日记ID|显示文字]]，例如 [[diary:42|那天关于旅行的日记]]。"
            "这样用户就可以直接点击链接跳转到那篇日记。"
            "请基于检索结果回答用户的查找请求，并附上日记链接。"
            "如果检索结果里没有相关的日记，就诚实地说没有找到。"
        )

    user_prompt = (
        f"用户昵称：{nickname}\n"
        f"用户MBTI：{current_user.mbti or '未知'}\n"
        f"最近对话：\n{history_text or '无'}\n\n"
    )
    if rag_hits:
        user_prompt += f"检索到的用户相关日记片段：\n{rag_text}\n\n"
    user_prompt += (
        f"用户当前问题：{message}\n\n"
        "请直接回复用户，不要输出JSON。"
    )
    if rag_hits:
        user_prompt += "如果要引用日记请用 [[diary:ID|标题]] 格式。"

    async def event_gen() -> AsyncGenerator[str, None]:
        yield _safe_json_sse("meta", {"session_id": session_id, "user_message_id": user_msg.id})
        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            full_answer_parts: list[str] = []
            async for token in deepseek_client.stream_chat(messages, temperature=0.75):
                full_answer_parts.append(token)
                yield _safe_json_sse("chunk", {"text": token})

            answer = "".join(full_answer_parts).strip() or "我在呢。你愿意再多说一点点吗？"

            ai_msg = AssistantMessage(
                user_id=current_user.id,
                session_id=session_id,
                role="assistant",
                content=answer,
            )
            db.add(ai_msg)
            session_result = await db.execute(
                select(AssistantSession).where(
                    and_(AssistantSession.id == session_id, AssistantSession.user_id == current_user.id)
                )
            )
            session_row = session_result.scalar_one_or_none()
            if session_row and (not session_row.title or session_row.title == "新对话"):
                session_row.title = (message[:20] or "新对话")
            await db.commit()
            await db.refresh(ai_msg)

            yield _safe_json_sse(
                "done",
                {
                    "session_id": session_id,
                    "assistant_message_id": ai_msg.id,
                    "rag_hits": rag_hits,
                    "diary_links": diary_links_map,
                },
            )
        except Exception as e:
            yield _safe_json_sse("error", {"message": f"回复失败：{str(e)}"})

    return StreamingResponse(event_gen(), media_type="text/event-stream")

