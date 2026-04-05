"""
外部接入 API
支持通过外部代理/助手（如 OpenClaw 小龙虾）写入日记。
"""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import date, datetime
from typing import Literal, Optional
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user
from app.db import get_db
from app.models.database import User
from app.models.diary import Diary
from app.models.integration import ExternalIntegrationToken
from app.schemas.diary import DiaryCreate
from app.services.diary_service import diary_service

router = APIRouter(prefix="/integrations", tags=["外部接入"])
external_bearer = HTTPBearer(auto_error=False)

OPENCLAW_PROVIDER = "openclaw"


class IntegrationStatusResponse(BaseModel):
    provider: str
    connected: bool
    token_hint: Optional[str] = None
    created_at: Optional[str] = None
    last_used_at: Optional[str] = None
    ingest_url: str
    suggested_mode: str = "append_today"


class IntegrationTokenCreateResponse(IntegrationStatusResponse):
    token: str


class ExternalDiaryIngestRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000, description="要记录的正文")
    title: Optional[str] = Field(default=None, max_length=200, description="可选标题")
    diary_date: Optional[date] = Field(default=None, description="日记日期，默认今天")
    emotion_tags: Optional[list[str]] = Field(default=None, description="可选情绪标签")
    importance_score: int = Field(default=5, ge=1, le=10, description="重要性评分")
    images: Optional[list[str]] = Field(default=None, description="图片地址")
    mode: Literal["create", "append_today"] = Field(default="append_today", description="创建模式")


class ExternalDiaryIngestResponse(BaseModel):
    ok: bool = True
    action: Literal["created", "appended"]
    diary_id: int
    diary_date: str
    title: Optional[str] = None
    word_count: int


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _make_token() -> tuple[str, str]:
    raw = f"yji_oc_{secrets.token_urlsafe(24)}"
    return raw, f"{raw[:8]}...{raw[-4:]}"


def _fmt_dt(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _resolve_ingest_url(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/v1/integrations/openclaw/ingest"


def _infer_title(content: str, fallback_date: date) -> str:
    text = (content or "").strip().replace("\r", " ").replace("\n", " ")
    short = text[:24].strip(" ，。！？、；：,.!?;:")
    if short:
        return short
    return f"{fallback_date.isoformat()} 速记"


async def _get_provider_token(
    db: AsyncSession,
    user_id: int,
    provider: str = OPENCLAW_PROVIDER,
) -> Optional[ExternalIntegrationToken]:
    result = await db.execute(
        select(ExternalIntegrationToken).where(
            and_(
                ExternalIntegrationToken.user_id == user_id,
                ExternalIntegrationToken.provider == provider,
                ExternalIntegrationToken.is_active == True,
            )
        )
    )
    return result.scalar_one_or_none()


async def _get_user_by_external_token(
    db: AsyncSession,
    raw_token: str,
    provider: str = OPENCLAW_PROVIDER,
) -> tuple[User, ExternalIntegrationToken]:
    hashed = _hash_token(raw_token)
    token_result = await db.execute(
        select(ExternalIntegrationToken).where(
            and_(
                ExternalIntegrationToken.token_hash == hashed,
                ExternalIntegrationToken.provider == provider,
                ExternalIntegrationToken.is_active == True,
            )
        )
    )
    token_row = token_result.scalar_one_or_none()
    if not token_row:
        raise HTTPException(status_code=401, detail="外部接入令牌无效")

    user_result = await db.execute(select(User).where(User.id == token_row.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="用户不可用")
    return user, token_row


async def _resolve_external_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(external_bearer),
    x_yinji_integration_token: Optional[str] = Header(default=None, alias="X-Yinji-Integration-Token"),
) -> str:
    token = (x_yinji_integration_token or "").strip()
    if token:
        return token
    if credentials and credentials.credentials:
        return credentials.credentials.strip()
    raise HTTPException(status_code=401, detail="缺少外部接入令牌")


async def _parse_ingest_payload(
    request: Request,
    mode_query: Optional[str] = None,
) -> ExternalDiaryIngestRequest:
    """
    尽量兼容外部代理的多种发送方式：
    1. application/json
    2. text/plain（整段正文）
    3. x-www-form-urlencoded
    4. query string fallback
    """
    body_bytes = await request.body()
    raw_text = body_bytes.decode("utf-8", errors="ignore").strip()
    content_type = (request.headers.get("content-type") or "").lower()
    payload: dict = {}

    if raw_text:
        if "application/json" in content_type:
            try:
                payload = json.loads(raw_text)
            except Exception:
                # 有些代理会传近似 JSON 或未转义正文，继续回退
                payload = {}
        if not payload and ("application/x-www-form-urlencoded" in content_type or "=" in raw_text):
            try:
                parsed = parse_qs(raw_text, keep_blank_values=True)
                payload = {k: (v[-1] if isinstance(v, list) and v else v) for k, v in parsed.items()}
            except Exception:
                payload = {}
        if not payload:
            payload = {"content": raw_text}

    # query 参数兜底
    query_content = request.query_params.get("content")
    query_title = request.query_params.get("title")
    query_mode = request.query_params.get("mode") or mode_query
    query_date = request.query_params.get("diary_date")

    if query_content and not payload.get("content"):
        payload["content"] = query_content
    if query_title and not payload.get("title"):
        payload["title"] = query_title
    if query_mode and not payload.get("mode"):
        payload["mode"] = query_mode
    if query_date and not payload.get("diary_date"):
        payload["diary_date"] = query_date

    if isinstance(payload.get("emotion_tags"), str):
        payload["emotion_tags"] = [t.strip() for t in payload["emotion_tags"].split(",") if t.strip()]
    if isinstance(payload.get("images"), str):
        payload["images"] = [t.strip() for t in payload["images"].split(",") if t.strip()]

    if not payload.get("content"):
        raise HTTPException(status_code=400, detail="缺少日记内容 content")

    try:
        return ExternalDiaryIngestRequest.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"外部接入参数格式不正确：{exc}") from exc


@router.get("/openclaw/status", response_model=IntegrationStatusResponse, summary="查看 OpenClaw 接入状态")
async def get_openclaw_status(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    token_row = await _get_provider_token(db, current_user.id)
    return IntegrationStatusResponse(
        provider=OPENCLAW_PROVIDER,
        connected=token_row is not None,
        token_hint=token_row.token_hint if token_row else None,
        created_at=_fmt_dt(token_row.created_at) if token_row else None,
        last_used_at=_fmt_dt(token_row.last_used_at) if token_row else None,
        ingest_url=_resolve_ingest_url(request),
    )


@router.post("/openclaw/token", response_model=IntegrationTokenCreateResponse, summary="生成或重置 OpenClaw 接入令牌")
async def create_openclaw_token(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    token_row = await _get_provider_token(db, current_user.id)
    raw_token, token_hint = _make_token()
    hashed = _hash_token(raw_token)

    if token_row:
        token_row.token_hash = hashed
        token_row.token_hint = token_hint
        token_row.last_used_at = None
    else:
        token_row = ExternalIntegrationToken(
            user_id=current_user.id,
            provider=OPENCLAW_PROVIDER,
            token_hash=hashed,
            token_hint=token_hint,
            is_active=True,
        )
        db.add(token_row)

    await db.commit()
    await db.refresh(token_row)

    return IntegrationTokenCreateResponse(
        provider=OPENCLAW_PROVIDER,
        connected=True,
        token=raw_token,
        token_hint=token_row.token_hint,
        created_at=_fmt_dt(token_row.created_at),
        last_used_at=_fmt_dt(token_row.last_used_at),
        ingest_url=_resolve_ingest_url(request),
    )


@router.delete("/openclaw/token", summary="关闭 OpenClaw 接入")
async def revoke_openclaw_token(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    token_row = await _get_provider_token(db, current_user.id)
    if token_row:
        token_row.is_active = False
        await db.commit()
    return {"ok": True}


@router.post("/openclaw/ingest", response_model=ExternalDiaryIngestResponse, summary="通过 OpenClaw 写入日记")
async def ingest_openclaw_diary(
    request: Request,
    raw_token: str = Depends(_resolve_external_token),
    mode: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    payload = await _parse_ingest_payload(request, mode_query=mode)
    user, token_row = await _get_user_by_external_token(db, raw_token)
    target_date = payload.diary_date or date.today()

    if payload.mode == "append_today":
        existing_result = await db.execute(
            select(Diary)
            .where(and_(Diary.user_id == user.id, Diary.diary_date == target_date))
            .order_by(Diary.created_at.desc(), Diary.id.desc())
            .limit(1)
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            append_text = (payload.content or "").strip()
            existing.content = f"{existing.content.rstrip()}\n\n{append_text}".strip()
            if not (existing.title or "").strip():
                existing.title = payload.title or _infer_title(append_text, target_date)
            existing.word_count = len(existing.content)
            if payload.emotion_tags:
                merged = list(dict.fromkeys([*(existing.emotion_tags or []), *payload.emotion_tags]))
                existing.emotion_tags = merged
            if payload.images:
                merged_images = list(dict.fromkeys([*(existing.images or []), *payload.images]))
                existing.images = merged_images
            existing.importance_score = max(existing.importance_score, payload.importance_score)
            token_row.last_used_at = datetime.utcnow()
            await db.commit()
            await db.refresh(existing)
            return ExternalDiaryIngestResponse(
                action="appended",
                diary_id=existing.id,
                diary_date=str(existing.diary_date),
                title=existing.title,
                word_count=existing.word_count,
            )

    created = await diary_service.create_diary(
        db=db,
        user_id=user.id,
        diary_data=DiaryCreate(
            title=payload.title or _infer_title(payload.content, target_date),
            content=payload.content,
            diary_date=target_date,
            emotion_tags=payload.emotion_tags,
            importance_score=payload.importance_score,
            images=payload.images,
        ),
    )
    token_row.last_used_at = datetime.utcnow()
    await db.commit()
    await db.refresh(created)
    return ExternalDiaryIngestResponse(
        action="created",
        diary_id=created.id,
        diary_date=str(created.diary_date),
        title=created.title,
        word_count=created.word_count,
    )
