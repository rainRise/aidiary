"""
AI分析相关的API端点
"""
import logging
from typing import Optional
from datetime import timedelta, date
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc

from app.db import get_db
from app.schemas.ai import (
    AnalysisRequest,
    AnalysisResponse,
    TitleSuggestionRequest,
    TitleSuggestionResponse,
    ComprehensiveAnalysisRequest,
    ComprehensiveAnalysisResponse,
    IcebergAnalysisResponse,
    DailyGuidanceResponse,
    SocialStyleSamplesRequest,
    SocialStyleSamplesResponse,
)
from app.agents.orchestrator import agent_orchestrator
from app.agents.llm import deepseek_client
from app.core.deps import get_current_active_user
from app.models.database import User
from app.models.diary import Diary, TimelineEvent, AIAnalysis, SocialPostSample
from app.schemas.diary import TimelineEventCreate
from app.services.diary_service import diary_service, timeline_service
from app.services.rag_service import diary_rag_service
from app.services.qdrant_memory_service import qdrant_diary_memory_service

router = APIRouter(prefix="/ai", tags=["AI分析"])
logger = logging.getLogger(__name__)


def _build_compact_evidence_text(evidence: list[dict], limit: int = 10) -> str:
    compact_lines = []
    for i, item in enumerate((evidence or [])[:limit], start=1):
        snippet = " ".join(str(item.get("snippet") or "").split())
        if len(snippet) > 120:
            snippet = snippet[:120].rstrip() + "..."
        compact_lines.append(
            f"[{i}] 日期:{item.get('diary_date')} 标题:{item.get('title') or '无标题'} "
            f"用途:{item.get('reason') or '综合'} 片段:{snippet}"
        )
    return "\n".join(compact_lines)


def _safe_parse_json(raw: str) -> dict:
    import json
    import re

    text = (raw or "").strip()
    if not text:
        raise ValueError("模型返回为空")
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if match:
        try:
            parsed = json.loads(match.group(1).strip())
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    dec = json.JSONDecoder()
    start = text.find("{")
    if start != -1:
        parsed, _ = dec.raw_decode(text[start:])
        if isinstance(parsed, dict):
            return parsed

    raise ValueError("无法解析模型JSON输出")


def _normalize_samples(samples: list[str], limit: int = 50) -> list[str]:
    normalized = []
    seen = set()
    for s in samples or []:
        text = " ".join((s or "").strip().split())
        if len(text) < 6:
            continue
        if len(text) > 300:
            text = text[:300]
        if text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized[:limit]


def _deepseek_error_detail(error: Exception) -> str:
    if isinstance(error, httpx.HTTPStatusError):
        status_code = error.response.status_code
        body = error.response.text or ""
        if status_code == 402 or "Insufficient Balance" in body:
            return "DeepSeek 账户余额不足，请充值或更换 API Key"
        if status_code in (401, 403):
            return "DeepSeek API Key 无效或权限不足，请检查后端 .env 配置"
        if status_code == 404:
            return "DeepSeek 接口地址或模型名称不可用，请检查 DEEPSEEK_BASE_URL / DEEPSEEK_MODEL"
        return f"DeepSeek 请求失败（HTTP {status_code}）"
    if isinstance(error, httpx.ConnectError):
        return "无法连接 DeepSeek API，请检查服务器网络或代理配置"
    return str(error)


@router.post("/generate-title", response_model=TitleSuggestionResponse, summary="AI生成日记标题")
async def generate_title(
    request: TitleSuggestionRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    根据日记内容生成简洁、有画面感的中文标题
    """
    content = (request.content or "").strip()
    if len(content) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="内容太短，请至少输入10个字后再生成标题"
        )

    system_prompt = (
        "你是资深中文编辑。请为日记生成1个有品位的标题。"
        "要求：10字以内；简洁自然；避免鸡汤口号；避免引号和表情；只返回标题本身。"
    )
    user_prompt = (
        f"当前标题（可为空）：{request.current_title or '无'}\n"
        f"日记内容：\n{content[:2000]}"
    )

    try:
        raw = await deepseek_client.chat_with_system(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
        )
        title = (raw or "").strip().replace("\n", " ")
        if "：" in title:
            title = title.split("：", 1)[-1].strip()
        if len(title) > 20:
            title = title[:20].strip()
        if not title:
            title = "今日片段"
        return TitleSuggestionResponse(title=title)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"标题生成失败：{_deepseek_error_detail(e)}"
        )


@router.get("/daily-guidance", response_model=DailyGuidanceResponse, summary="获取每日个性化引导问题")
async def get_daily_guidance(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    基于用户近期日记上下文，生成当天可直接写作的个性化引导问题。
    """
    fallback_questions = [
        "今天有哪个瞬间让你停下来想了很久？",
        "今天最想留住的一个感受是什么？",
        "你今天在哪件小事上看见了自己的变化？",
        "今天有没有一个没说出口但想记录的念头？",
        "如果给今天写一句旁白，你会写什么？",
    ]

    end_date = date.today()
    start_date = end_date - timedelta(days=30)
    diaries_result = await db.execute(
        select(Diary).where(
            and_(
                Diary.user_id == current_user.id,
                Diary.diary_date >= start_date,
                Diary.diary_date <= end_date,
            )
        ).order_by(desc(Diary.diary_date), desc(Diary.created_at)).limit(12)
    )
    diaries = list(diaries_result.scalars().all())
    recent_context = "\n".join(
        [
            f"- {d.diary_date} | 标题:{d.title or '无标题'} | 情绪:{', '.join(d.emotion_tags or []) or '无'} | 摘要:{(d.content or '')[:90]}"
            for d in diaries
        ]
    ) or "暂无历史记录"

    system_prompt = (
        "你是一个温和、具体、不过度鸡汤的中文写作引导助手。"
        "目标是给用户一个当下就能开写的问题。"
        "只输出JSON，不要解释。"
    )
    user_prompt = (
        f"用户信息：用户名={current_user.username or '用户'}，社交风格={current_user.social_style or '未设置'}，"
        f"当前状态={current_user.current_state or '未设置'}\n"
        f"近期记录：\n{recent_context}\n\n"
        "请生成1个问题，要求：\n"
        "1) 16-30字，必须以问号结尾\n"
        "2) 具体、可回答，不空泛\n"
        "3) 避免“你要/应该/必须”等说教语气\n\n"
        "输出JSON：{\"question\":\"...\"}"
    )

    try:
        raw = await deepseek_client.chat_with_system(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.75,
            response_format="json",
        )
        parsed = _safe_parse_json(raw)
        question = (parsed.get("question") or "").strip()
        if not question:
            raise ValueError("问题为空")
        if not question.endswith(("？", "?")):
            question += "？"
        return DailyGuidanceResponse(
            question=question,
            source="ai",
            metadata={
                "recent_diary_count": len(diaries),
                "period": {"start_date": str(start_date), "end_date": str(end_date)},
            },
        )
    except Exception:
        q = fallback_questions[date.today().day % len(fallback_questions)]
        return DailyGuidanceResponse(
            question=q,
            source="fallback",
            metadata={"recent_diary_count": len(diaries)},
        )


@router.get("/social-style-samples", response_model=SocialStyleSamplesResponse, summary="获取朋友圈风格样本")
async def get_social_style_samples(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(
            select(SocialPostSample).where(
                SocialPostSample.user_id == current_user.id
            ).order_by(desc(SocialPostSample.created_at)).limit(200)
        )
        rows = list(result.scalars().all())
        samples = [r.content for r in rows]
        return SocialStyleSamplesResponse(
            total=len(samples),
            samples=samples,
            metadata={"max_recommended": 50},
        )
    except Exception as e:
        return SocialStyleSamplesResponse(
            total=0,
            samples=[],
            metadata={
                "max_recommended": 50,
                "degraded": True,
                "reason": f"load_failed:{type(e).__name__}",
            },
        )


@router.put("/social-style-samples", response_model=SocialStyleSamplesResponse, summary="上传朋友圈风格样本")
async def upsert_social_style_samples(
    payload: SocialStyleSamplesRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    incoming = _normalize_samples(payload.samples, limit=80)
    if not incoming:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="有效样本为空，请至少提供1条（每条不少于6字）"
        )

    try:
        existing_result = await db.execute(
            select(SocialPostSample).where(SocialPostSample.user_id == current_user.id).order_by(desc(SocialPostSample.created_at))
        )
        existing_rows = list(existing_result.scalars().all())
        existing = [r.content for r in existing_rows]

        if payload.replace:
            for row in existing_rows:
                await db.delete(row)
            merged = incoming[:50]
        else:
            merged = _normalize_samples(existing + incoming, limit=50)
            for row in existing_rows:
                await db.delete(row)

        for content in merged:
            db.add(SocialPostSample(user_id=current_user.id, content=content))

        await db.commit()
        return SocialStyleSamplesResponse(
            total=len(merged),
            samples=merged,
            metadata={"replace_mode": payload.replace},
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"风格样本保存失败: {type(e).__name__}"
        ) from e


@router.post("/comprehensive-analysis", response_model=IcebergAnalysisResponse, summary="冰山综合分析（多智能体）")
async def comprehensive_analysis(
    request: ComprehensiveAnalysisRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    使用 RAG 检索 + 多智能体萨提亚冰山分析。
    Phase 1: RAG 证据收集
    Phase 2: 五层冰山逐层分析（行为→情绪→认知→信念→渴望）
    Phase 3: 生成「致你的一封信」
    """
    from datetime import date, timedelta
    from sqlalchemy import and_, desc

    end_date = date.today()
    start_date = end_date - timedelta(days=request.window_days - 1)

    diaries_result = await db.execute(
        select(Diary).where(
            and_(
                Diary.user_id == current_user.id,
                Diary.diary_date >= start_date,
                Diary.diary_date <= end_date,
            )
        ).order_by(desc(Diary.diary_date), desc(Diary.created_at)).limit(request.max_diaries)
    )
    diaries = list(diaries_result.scalars().all())

    if not diaries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="暂无可分析内容，请先写几篇日记"
        )

    # ── Phase 1: RAG 证据收集 ──
    diaries_sorted = list(sorted(diaries, key=lambda d: (d.diary_date, d.created_at)))
    raw_docs = [
        {
            "id": d.id,
            "diary_date": str(d.diary_date),
            "title": d.title or "无标题",
            "content": d.content or "",
            "importance_score": d.importance_score or 5,
            "emotion_tags": d.emotion_tags or [],
        }
        for d in diaries_sorted
    ]
    chunks = diary_rag_service.build_chunks(raw_docs)

    queries = [
        ("情绪趋势", "最近情绪变化 波动 反复 焦虑 平静 开心 低落"),
        ("连续事件", "连续 多天 重复 出现 的 困扰 问题"),
        ("关键转折", "关键 转折 决定 变化 契机"),
        ("成长线索", "成长 进步 反思 改变"),
        ("关系主题", "朋友 家人 同事 导师 关系 冲突 支持"),
    ]

    candidates = []
    for reason, q in queries:
        raw_hits = diary_rag_service.retrieve(chunks, q, top_k=8, source_types={"raw"})
        summary_hits = diary_rag_service.retrieve(chunks, q, top_k=4, source_types={"summary"})
        candidates.extend([{**item, "reason": reason} for item in (raw_hits + summary_hits)])

    evidence = diary_rag_service.deduplicate_evidence(
        candidates,
        max_total=18,
        max_per_diary=2,
        per_reason_limit=3,
        similarity_threshold=0.72,
    )
    if not evidence:
        fallback_hits = diary_rag_service.retrieve(chunks, "最近的重要事件和情绪变化", top_k=10)
        evidence = [{**item, "reason": "综合回退"} for item in fallback_hits]

    evidence_text = _build_compact_evidence_text(evidence, limit=10)

    # ── Phase 2 + 3: 多智能体冰山分析 ──
    period = f"{start_date} 至 {end_date}"
    username = current_user.username or "用户"

    try:
        iceberg = await agent_orchestrator.analyze_iceberg(
            username=username,
            period=period,
            diary_count=len(diaries_sorted),
            evidence_text=evidence_text,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"冰山分析失败: {str(e)}"
        )

    return IcebergAnalysisResponse(
        behavior_layer=iceberg.get("behavior_layer", {}),
        emotion_layer=iceberg.get("emotion_layer", {}),
        cognition_layer=iceberg.get("cognition_layer", {}),
        belief_layer=iceberg.get("belief_layer", {}),
        yearning_layer=iceberg.get("yearning_layer", {}),
        letter=iceberg.get("letter", ""),
        evidence=evidence,
        metadata={
            "analysis_scope": "iceberg_multi_agent",
            "window_days": request.window_days,
            "analyzed_diary_count": len(diaries_sorted),
            "retrieved_chunk_count": len(evidence),
            "processing_time": iceberg.get("processing_time", 0),
            "agent_runs": iceberg.get("agent_runs", []),
            "period": {"start_date": str(start_date), "end_date": str(end_date)},
        },
    )


@router.post("/analyze", response_model=AnalysisResponse, summary="分析日记（异步）")
async def analyze_diary(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    对用户多篇日记进行整合AI分析（用户级）

    分析流程：
    1. 聚合分析窗口内的多篇日记
    2. 收集用户上下文与时间轴
    3. 萨提亚冰山五层分析
    4. 生成疗愈回复
    5. 生成朋友圈文案
    """
    anchor_diary = None
    if request.diary_id is not None:
        anchor_diary = await diary_service.get_diary(db, request.diary_id, current_user.id)
        if not anchor_diary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="锚点日记不存在"
            )

    anchor_date = anchor_diary.diary_date if anchor_diary else date.today()
    start_date = anchor_date - timedelta(days=request.window_days - 1)

    diaries_result = await db.execute(
        select(Diary).where(
            and_(
                Diary.user_id == current_user.id,
                Diary.diary_date >= start_date,
                Diary.diary_date <= anchor_date,
            )
        ).order_by(desc(Diary.diary_date), desc(Diary.created_at)).limit(request.max_diaries)
    )
    diaries = list(diaries_result.scalars().all())

    # 如果窗口内没有数据，退化为取最近N篇
    if not diaries:
        fallback_result = await db.execute(
            select(Diary).where(
                Diary.user_id == current_user.id
            ).order_by(desc(Diary.diary_date), desc(Diary.created_at)).limit(request.max_diaries)
        )
        diaries = list(fallback_result.scalars().all())

    if not diaries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="暂无可分析的日记，请先写至少一篇日记"
        )

    # 按时间正序组织，构建用户级整合语料
    diaries_sorted = list(sorted(diaries, key=lambda d: (d.diary_date, d.created_at)))
    combined_sections = []
    for d in diaries_sorted:
        content = (d.content or "").strip()
        if len(content) > 1200:
            content = content[:1200] + "..."
        combined_sections.append(
            f"【日期】{d.diary_date}\n"
            f"【标题】{d.title or '无标题'}\n"
            f"【情绪标签】{', '.join(d.emotion_tags or []) or '无'}\n"
            f"【重要性】{d.importance_score}/10\n"
            f"【正文】\n{content}"
        )
    integrated_content = "\n\n---\n\n".join(combined_sections)

    # 获取用户画像（简化版，实际应该从user_profiles表获取）
    emotion_counter = {}
    importance_sum = 0
    for d in diaries_sorted:
        importance_sum += d.importance_score or 5
        for tag in (d.emotion_tags or []):
            emotion_counter[tag] = emotion_counter.get(tag, 0) + 1
    top_emotions = [k for k, _ in sorted(emotion_counter.items(), key=lambda x: x[1], reverse=True)[:3]]
    avg_importance = round(importance_sum / max(len(diaries_sorted), 1), 2)

    user_profile = {
        "username": current_user.username or "用户",
        "identity_tag": "通用",
        "current_state": "正常",
        "personality_type": "INFP",
        "social_style": "真实",
        "catchphrases": [],
        "analysis_scope": "user_integrated",
        "diary_count": len(diaries_sorted),
        "top_emotions": top_emotions,
        "avg_importance": avg_importance,
        "window_start": str(diaries_sorted[0].diary_date),
        "window_end": str(diaries_sorted[-1].diary_date),
    }

    # 获取时间轴上下文（与分析窗口保持一致）
    timeline_events = await timeline_service.get_timeline(
        db,
        current_user.id,
        start_date=start_date,
        end_date=anchor_date,
        limit=min(max(request.max_diaries, 20), 200)
    )

    timeline_context = [
        {
            "date": str(event.event_date),
            "summary": event.event_summary,
            "emotion": event.emotion_tag or "未分类"
        }
        for event in timeline_events
    ]

    # RAG 检索：从 Qdrant 获取相关历史记忆
    related_memories = []
    try:
        # 用当前日记的关键内容作为查询，检索相关历史日记
        query_text = integrated_content[:500]  # 取前500字作为检索 query
        related_memories = await qdrant_diary_memory_service.retrieve_context(
            db=db,
            user_id=current_user.id,
            query=query_text,
            top_k=4,
        )
        if related_memories:
            print(f"[RAG] 检索到 {len(related_memories)} 条相关历史记忆")
        else:
            print("[RAG] 未检索到相关历史记忆（Qdrant 可能未配置）")
    except Exception as e:
        print(f"[RAG] Qdrant 检索失败（降级为无记忆模式）: {e}")

    # 执行分析
    try:
        state = await agent_orchestrator.analyze_diary(
            user_id=current_user.id,
            diary_id=anchor_diary.id if anchor_diary else diaries_sorted[-1].id,
            diary_content=integrated_content,
            diary_date=anchor_date,
            user_profile=user_profile,
            timeline_context=timeline_context,
            related_memories=related_memories,
        )

        # 格式化结果
        result = agent_orchestrator.format_result(state)

        # LLM 个别节点失败时保留降级结果，避免一次模型空返回把整次分析打成 500。
        if state.get("error"):
            result.setdefault("metadata", {})
            result["metadata"]["analysis_warning"] = state["error"]
            result["metadata"]["degraded"] = True

        # 持久化分析结果：更新/创建时间轴事件 + 标记日记已分析
        try:
            timeline_event = state.get("timeline_event") or {}
            summary = (timeline_event.get("event_summary") or "").strip()
            if summary:
                # 用户级整合分析：将事件挂到锚点日记（有锚点）或最新日记（无锚点）
                target_diary = anchor_diary or diaries_sorted[-1]
                existing_event_result = await db.execute(
                    select(TimelineEvent).where(
                        TimelineEvent.diary_id == target_diary.id,
                        TimelineEvent.user_id == current_user.id
                    ).limit(1)
                )
                existing_event = existing_event_result.scalar_one_or_none()

                if existing_event:
                    related_entities = timeline_event.get("related_entities") or {}
                    related_entities["source"] = "ai_analysis"
                    related_entities["source_label"] = "AI提炼事件"
                    existing_event.event_date = target_diary.diary_date
                    existing_event.event_summary = summary
                    existing_event.emotion_tag = timeline_event.get("emotion_tag")
                    existing_event.importance_score = int(timeline_event.get("importance_score") or 5)
                    existing_event.event_type = timeline_event.get("event_type")
                    existing_event.related_entities = related_entities
                else:
                    related_entities = timeline_event.get("related_entities") or {}
                    related_entities["source"] = "ai_analysis"
                    related_entities["source_label"] = "AI提炼事件"
                    event_data = TimelineEventCreate(
                        diary_id=target_diary.id,
                        event_date=target_diary.diary_date,
                        event_summary=summary,
                        emotion_tag=timeline_event.get("emotion_tag"),
                        importance_score=int(timeline_event.get("importance_score") or 5),
                        event_type=timeline_event.get("event_type"),
                        related_entities=related_entities,
                    )
                    await timeline_service.create_event(db, current_user.id, event_data)

            # 将窗口内日记都标记为已分析，体现“整合分析”语义
            for d in diaries_sorted:
                d.is_analyzed = True
            await db.commit()
            if anchor_diary:
                await db.refresh(anchor_diary)
        except Exception as persist_err:
            # 不阻断主分析结果返回，但把告警写入metadata
            await db.rollback()
            result.setdefault("metadata", {})
            result["metadata"]["persist_warning"] = str(persist_err)

        result.setdefault("metadata", {})
        result["metadata"]["analysis_scope"] = "user_integrated"
        result["metadata"]["analyzed_diary_count"] = len(diaries_sorted)
        result["metadata"]["analyzed_period"] = {
            "start_date": str(diaries_sorted[0].diary_date),
            "end_date": str(diaries_sorted[-1].diary_date),
            "anchor_date": str(anchor_date),
            "window_days": request.window_days,
        }
        result["metadata"]["analyzed_diary_ids"] = [d.id for d in diaries_sorted]

        # 持久化分析结果（供“查看分析结果”直接读取，避免重复运行）
        try:
            target_diary = anchor_diary or diaries_sorted[-1]
            analysis_result_for_save = jsonable_encoder(result)
            analysis_result_for_save.setdefault("metadata", {})
            analysis_result_for_save["metadata"]["saved_for_diary_id"] = target_diary.id

            existing_analysis_result = await db.execute(
                select(AIAnalysis).where(
                    AIAnalysis.user_id == current_user.id,
                    AIAnalysis.diary_id == target_diary.id
                ).limit(1)
            )
            existing_analysis = existing_analysis_result.scalar_one_or_none()
            if existing_analysis:
                existing_analysis.result_json = analysis_result_for_save
            else:
                db.add(AIAnalysis(
                    user_id=current_user.id,
                    diary_id=target_diary.id,
                    result_json=analysis_result_for_save
                ))
            await db.commit()
        except Exception as save_result_err:
            await db.rollback()
            result.setdefault("metadata", {})
            result["metadata"]["result_save_warning"] = str(save_result_err)

        return jsonable_encoder(result)

    except HTTPException:
        raise
    except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.TransportError) as e:
        logger.exception("AI provider request failed during /ai/analyze")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI服务暂时不可用，请稍后重试: {str(e)}"
        )
    except Exception as e:
        logger.exception("Unexpected error during /ai/analyze")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分析失败: {str(e)}"
        )


@router.post("/analyze-async", summary="异步分析日记（后台任务）")
async def analyze_diary_async(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    异步分析日记（后台任务模式）

    返回任务ID，可通过GET /ai/analyze/{taskId}查询结果
    """
    # 简化实现：直接同步执行
    # 在生产环境中，应该使用Celery或类似的后台任务系统

    result = await analyze_diary(request, background_tasks, current_user, db)

    return result


@router.get("/analyses", summary="获取历史分析记录")
async def get_analyses(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取用户的历史分析记录
    """
    result = await db.execute(
        select(AIAnalysis).where(
            AIAnalysis.user_id == current_user.id
        ).order_by(AIAnalysis.updated_at.desc()).limit(100)
    )
    rows = list(result.scalars().all())
    return {
        "analyses": [
            {
                "id": row.id,
                "diary_id": row.diary_id,
                "updated_at": row.updated_at,
                "metadata": (row.result_json or {}).get("metadata", {})
            }
            for row in rows
        ],
        "total": len(rows)
    }


@router.get("/result/{diary_id}", response_model=AnalysisResponse, summary="获取指定日记最近一次分析结果")
async def get_analysis_result(
    diary_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定日记最近一次已保存的分析结果
    """
    result = await db.execute(
        select(AIAnalysis).where(
            AIAnalysis.user_id == current_user.id,
            AIAnalysis.diary_id == diary_id
        ).limit(1)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该日记暂无已保存分析结果"
        )
    return row.result_json


@router.post("/satir-analysis", summary="萨提亚冰山分析")
async def satir_analysis(
    request: AnalysisRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    仅执行萨提亚冰山模型分析

    不包含时间轴提取和社交文案生成
    """
    # 获取日记
    diary = await diary_service.get_diary(db, request.diary_id, current_user.id)

    if not diary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日记不存在"
        )

    # 简化实现：返回模拟分析
    return {
        "diary_id": diary.id,
        "satir_analysis": {
            "behavior_layer": {
                "event": diary.content[:100] + "..."
            },
            "emotion_layer": {
                "surface_emotion": "待分析",
                "underlying_emotion": "待分析",
                "emotion_intensity": 5,
                "emotion_analysis": "请使用完整分析功能"
            },
            "cognitive_layer": {
                "irrational_beliefs": [],
                "automatic_thoughts": []
            },
            "belief_layer": {
                "core_beliefs": [],
                "life_rules": [],
                "belief_analysis": ""
            },
            "core_self_layer": {
                "yearnings": [],
                "life_energy": "未知",
                "deepest_desire": "未识别",
                "existence_insight": "请使用完整分析功能"
            }
        },
        "therapeutic_response": "这是简化版分析。请使用 /ai/analyze 获取完整分析。",
        "metadata": {
            "analysis_type": "satir_only",
            "processing_time": 0
        }
    }


@router.post("/social-posts", summary="生成朋友圈文案")
async def generate_social_posts(
    request: AnalysisRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    仅生成朋友圈文案

    不包含萨提亚分析
    """
    # 获取日记
    diary = await diary_service.get_diary(db, request.diary_id, current_user.id)

    if not diary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日记不存在"
        )

    samples_result = await db.execute(
        select(SocialPostSample).where(
            SocialPostSample.user_id == current_user.id
        ).order_by(desc(SocialPostSample.created_at)).limit(50)
    )
    sample_rows = list(samples_result.scalars().all())
    style_samples = [r.content for r in sample_rows]

    fewshot_text = "\n".join(
        [f"{idx + 1}. {text[:180]}" for idx, text in enumerate(style_samples[:20])]
    ) or "（暂无样本）"

    catchphrases = ", ".join((current_user.catchphrases or [])[:8]) or "无"
    system_prompt = (
        "你是中文朋友圈内容策划与改写助手。"
        "你的目标是帮助用户稳定打造个人品牌，同时保持真实、有人味、有边界。"
        "核心原则："
        "1) 先人后事：先让读者感受到'你这个人'，再讲事件，不要像广告。"
        "2) 真实可感：优先使用具体场景、具体动作、具体感受，拒绝空话。"
        "3) 去AI腔：避免模板金句、过度上价值、鸡汤口号、工业化排比。"
        "4) 轻传播性：语句短一些，断句自然，便于手机端阅读。"
        "5) 有边界：不泄露隐私，不编造事实，不夸大战果。"
        "写作策略："
        "A版偏简洁克制，B版偏情绪共鸣，C版偏生活感和行动感。"
        "只输出JSON，不要解释。"
    )
    user_prompt = (
        f"用户画像：社交风格={current_user.social_style or '真实自然'}；当前状态={current_user.current_state or '未设置'}；"
        f"常用表达={catchphrases}\n\n"
        "用户历史真实文案样本（用于模仿语气与断句，不可照抄）：\n"
        f"{fewshot_text}\n\n"
        f"本次日记标题：{diary.title or '无标题'}\n"
        f"本次日记内容：\n{(diary.content or '')[:2200]}\n\n"
        "请生成3条朋友圈文案，输出JSON：\n"
        "{\n"
        '  "social_posts": [\n'
        '    {"version":"A","style":"简洁叙事版","content":"..."},\n'
        '    {"version":"B","style":"共鸣表达版","content":"..."},\n'
        '    {"version":"C","style":"生活行动版","content":"..."}\n'
        "  ]\n"
        "}\n"
        "要求：\n"
        "1) 每条60-150字；\n"
        "2) 开头尽量落在具体场景/状态，不要空泛开场；\n"
        "3) 至少1条包含轻微自我暴露（小困惑/小失误/小感受），增强真实感；\n"
        "4) 至少1条包含明确行动线索（做了什么/接下来做什么）；\n"
        "5) 可口语化，但不油腻，不网文腔；\n"
        "6) 不要使用这些高频AI套话：'治愈自己'、'与自己和解'、'向内求'、'答案在路上'；\n"
        "7) 不使用夸张符号堆叠（如连续感叹号/过量emoji）。"
    )

    social_posts = []
    try:
        raw = await deepseek_client.chat_with_system(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.75,
            response_format="json",
        )
        parsed = _safe_parse_json(raw)
        items = parsed.get("social_posts") or []
        if isinstance(items, list):
            for idx, item in enumerate(items[:3]):
                content = str((item or {}).get("content") or "").strip()
                if not content:
                    continue
                social_posts.append({
                    "version": str((item or {}).get("version") or chr(ord("A") + idx)),
                    "style": str((item or {}).get("style") or "自然版"),
                    "content": content,
                })
    except Exception:
        social_posts = []

    if len(social_posts) < 3:
        content_preview = diary.content[:120] + "..." if len(diary.content) > 120 else diary.content
        fallback = [
            {"version": "A", "style": "简洁版", "content": content_preview},
            {"version": "B", "style": "情感版", "content": f"{content_preview}\n今天先记到这里。"},
            {"version": "C", "style": "生活感版", "content": f"关于{diary.title or '今天'}，慢慢来，也挺好。"},
        ]
        for item in fallback:
            if len(social_posts) >= 3:
                break
            social_posts.append(item)

    return {
        "diary_id": diary.id,
        "social_posts": social_posts[:3],
        "metadata": {
            "generation_type": "social_only_fewshot",
            "style_sample_count": len(style_samples),
        },
    }


@router.get("/models", summary="获取AI模型信息")
async def get_ai_models():
    """
    获取可用的AI模型信息

    用于前端展示AI能力
    """
    return {
        "available_models": [
            {
                "name": "DeepSeek V3",
                "provider": "DeepSeek",
                "type": "LLM",
                "features": ["萨提亚分析", "文案生成", "情感分析"]
            }
        ],
        "agent_system": {
            "name": "Multi-Agent System",
            "version": "1.0",
            "agents": [
                {"id": 0, "name": "Context Collector", "description": "上下文收集器"},
                {"id": 1, "name": "Timeline Manager", "description": "时间线管家"},
                {"id": 2, "name": "Satir Therapist", "description": "萨提亚分析师"},
                {"id": 3, "name": "Social Content Creator", "description": "社交内容生成"}
            ]
        }
    }
