"""
日记相关API端点
"""
import os
import uuid
import asyncio
import json
from typing import Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc

from app.db import get_db, async_session_maker, set_rls_service_context

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads", "diary_images")
from app.schemas.diary import (
    DiaryCreate,
    DiaryUpdate,
    DiaryResponse,
    DiaryListResponse,
    TimelineEventResponse
)
from app.services.diary_service import diary_service, timeline_service
from app.services.speech_service import speech_service
from app.agents.llm import deepseek_client
from app.core.deps import get_current_active_user
from app.core.security import decode_access_token
from app.models.database import User
from app.models.diary import Diary, TimelineEvent, GrowthDailyInsight

router = APIRouter(prefix="/diaries", tags=["日记"])


async def _ai_refine_event_task(user_id: int, diary_id: int):
    try:
        async with async_session_maker() as session:
            await set_rls_service_context(session)
            await timeline_service.refine_event_from_diary_with_ai(
                db=session,
                user_id=user_id,
                diary_id=diary_id,
            )
    except Exception as e:
        print(f"[Timeline AI Refine] warning user={user_id} diary={diary_id}: {e}")


def _schedule_ai_refine(user_id: int, diary_id: int):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_ai_refine_event_task(user_id, diary_id))
    except RuntimeError:
        # 兜底：若当前无运行中的event loop，则忽略异步精炼
        pass


# ==================== 日记CRUD ====================

@router.post("/", response_model=DiaryResponse, summary="创建日记")
async def create_diary(
    diary_data: DiaryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    创建新日记

    - **title**: 日记标题（可选）
    - **content**: 日记内容（必填）
    - **diary_date**: 日记日期（默认今天）
    - **emotion_tags**: 情绪标签列表
    - **importance_score**: 重要性评分（1-10，默认5）
    - **images**: 图片URL列表
    """
    diary = await diary_service.create_diary(db, current_user.id, diary_data)
    # 时间轴事件生成和AI分析集中到每日0点定时任务处理
    return DiaryResponse.model_validate(diary)


@router.get("/", response_model=DiaryListResponse, summary="获取日记列表")
async def list_diaries(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页大小"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    emotion_tag: Optional[str] = Query(None, description="情绪标签过滤"),
    keyword: Optional[str] = Query(None, description="关键词搜索（标题+内容）"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取日记列表（分页）

    支持按日期范围、情绪标签和关键词过滤
    """
    diaries, total = await diary_service.list_diaries(
        db,
        current_user.id,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        emotion_tag=emotion_tag,
        keyword=keyword,
    )

    total_pages = (total + page_size - 1) // page_size

    return DiaryListResponse(
        items=[DiaryResponse.model_validate(d) for d in diaries],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


NEGATIVE_DASHBOARD_EMOTIONS = {
    "焦虑", "压力", "低落", "消沉", "疲惫", "难过", "紧张", "担忧",
    "烦躁", "崩溃", "痛苦", "失落", "孤独", "无助", "恐惧", "悲伤",
}


def _normalize_dashboard_emotion(tag: str | None) -> str:
    return (tag or "").strip().lower()


def _dashboard_preview(text: str | None, max_len: int = 96) -> str:
    normalized = " ".join((text or "").split())
    if not normalized:
        return "这篇日记还没有正文摘要。"
    return normalized[:max_len] + ("..." if len(normalized) > max_len else "")


def _dashboard_emotion_label(tag: str) -> str:
    labels = {
        "achievement": "成就感",
        "satisfied": "满足",
        "happy": "开心",
        "calm": "平静",
        "anxious": "焦虑",
        "worried": "担忧",
        "tired": "疲惫",
        "sad": "低落",
    }
    return labels.get(tag, tag or "平稳")


@router.get("/care/progress", summary="获取连续照顾与心灯护盾进度")
async def get_care_progress(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    基于真实日记日期计算轻记录进度。

    当前版本不把“心灯护盾”当心理分数，只作为连续照顾的漏记保护展示：
    - ACTIVE：当天有日记/轻记录
    - SHIELDED：当天没有记录，但可由护盾保护连续照顾
    - MISSED：当天没有记录且没有护盾可用，连续照顾中断

    护盾获取/消耗的持久化表后续再接入；这里先用后端统一返回的可替换余额。
    """
    today = date.today()
    lookback_start = today - timedelta(days=365)
    week_start = today - timedelta(days=today.weekday())
    weekly_goal = 3
    base_shield_balance = 2

    result = await db.execute(
        select(Diary.diary_date)
        .where(
            and_(
                Diary.user_id == current_user.id,
                Diary.diary_date >= lookback_start,
                Diary.diary_date <= today,
            )
        )
        .order_by(desc(Diary.diary_date))
    )
    active_dates = {row[0] for row in result.all() if row[0] is not None}

    if not active_dates:
        return {
            "active_days": 0,
            "protected_streak": 0,
            "shield_balance": base_shield_balance,
            "shielded_days": 0,
            "weekly_goal": weekly_goal,
            "weekly_active_count": 0,
            "weekly_completed": False,
            "week_start": str(week_start),
            "today_status": "PENDING",
            "recent_statuses": [{"date": str(today), "status": "PENDING"}],
            "message": "先点亮第一盏心灯就好，5 秒也算一次照顾。",
        }

    shield_remaining = base_shield_balance
    protected_streak = 0
    shielded_days = 0
    cursor = today if today in active_dates else today - timedelta(days=1)
    day_statuses = []

    while cursor >= lookback_start:
        if cursor in active_dates:
            protected_streak += 1
            day_statuses.append({"date": str(cursor), "status": "ACTIVE"})
        elif shield_remaining > 0:
            protected_streak += 1
            shielded_days += 1
            shield_remaining -= 1
            day_statuses.append({"date": str(cursor), "status": "SHIELDED"})
        else:
            day_statuses.append({"date": str(cursor), "status": "MISSED"})
            break
        cursor -= timedelta(days=1)

    weekly_active_count = len([d for d in active_dates if d >= week_start])
    active_days = len(active_dates)

    if active_days == 0:
        message = "先点亮第一盏心灯就好，5 秒也算一次照顾。"
    elif shielded_days > 0:
        message = f"已用 {shielded_days} 个心灯护盾保护连续照顾，偶尔停一下也没关系。"
    else:
        message = "这段连续照顾都来自真实记录，保持轻轻地回来就好。"

    return {
        "active_days": active_days,
        "protected_streak": protected_streak,
        "shield_balance": shield_remaining,
        "shielded_days": shielded_days,
        "weekly_goal": weekly_goal,
        "weekly_active_count": weekly_active_count,
        "weekly_completed": weekly_active_count >= weekly_goal,
        "week_start": str(week_start),
        "today_status": "ACTIVE" if today in active_dates else "PENDING",
        "recent_statuses": day_statuses[:14],
        "message": message,
    }


@router.post("/care/rest", summary="记录今天不想写")
async def create_rest_care_record(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    记录一次“今天不想写”的有效照顾行为。

    心理日记里，主动承认今天不想表达也属于状态采样。这里用一条轻量日记落库，
    避免前端只做提示、后端连续照顾统计却没有真实依据。
    """
    today = date.today()
    result = await db.execute(
        select(Diary)
        .where(
            and_(
                Diary.user_id == current_user.id,
                Diary.diary_date == today,
            )
        )
        .order_by(desc(Diary.created_at))
    )
    existing_diary = result.scalars().first()
    if existing_diary:
        return {
            "created": False,
            "diary_id": existing_diary.id,
            "message": "今天已经有记录了，这也算一次有效照顾。",
        }

    rest_content = "今天不想写，也是一种照顾自己。"
    diary = await diary_service.create_diary(
        db,
        current_user.id,
        DiaryCreate(
            title="今天不想写",
            content=rest_content,
            content_html=f"<p>{rest_content}</p>",
            diary_date=today,
            emotion_tags=["rest"],
            importance_score=5,
        ),
    )
    return {
        "created": True,
        "diary_id": diary.id,
        "message": "已记录“今天不想写”。你可以到这里为止。",
    }


@router.get("/dashboard/insights", summary="获取首页仪表盘洞察")
async def get_dashboard_insights(
    days: int = Query(30, ge=7, le=180, description="统计窗口天数"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    为首页仪表盘提供结构化洞察数据。

    该接口不在每次加载时调用大模型，而是基于用户真实日记数据生成可解释的
    首页观察：记录趋势、主要情绪、风险提示、情绪分布、最近日记分析入口。
    单篇深度分析仍复用 /api/v1/ai/analyze，可结合指定日记与历史窗口完成。
    """
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    recent_start = today - timedelta(days=(days // 2) - 1)
    previous_start = start_date
    previous_end = recent_start - timedelta(days=1)

    result = await db.execute(
        select(Diary)
        .where(
            and_(
                Diary.user_id == current_user.id,
                Diary.diary_date >= start_date,
                Diary.diary_date <= today,
            )
        )
        .order_by(desc(Diary.diary_date), desc(Diary.created_at))
        .limit(100)
    )
    diaries = list(result.scalars().all())

    this_month = len([
        d for d in diaries
        if d.diary_date and d.diary_date.year == today.year and d.diary_date.month == today.month
    ])
    recent_half = len([d for d in diaries if d.diary_date and d.diary_date >= recent_start])
    previous_half = len([
        d for d in diaries
        if d.diary_date and previous_start <= d.diary_date <= previous_end
    ])
    if previous_half == 0:
        trend_delta = 100 if recent_half > 0 else 0
    else:
        trend_delta = round((recent_half - previous_half) / previous_half * 100)

    if trend_delta > 12:
        trend = "ascending"
        trend_label = "整体回升"
    elif trend_delta < -12:
        trend = "descending"
        trend_label = "略有回落"
    else:
        trend = "stable"
        trend_label = "比较稳定"

    emotion_counts: dict[str, int] = {}
    for diary in diaries:
        for tag in diary.emotion_tags or []:
            normalized = _normalize_dashboard_emotion(tag)
            if not normalized:
                continue
            emotion_counts[normalized] = emotion_counts.get(normalized, 0) + 1

    total_emotion_tags = sum(emotion_counts.values())
    sorted_emotions = sorted(emotion_counts.items(), key=lambda item: item[1], reverse=True)
    top_emotion, top_emotion_count = sorted_emotions[0] if sorted_emotions else ("暂无", 0)
    negative_count = sum(
        count for tag, count in emotion_counts.items()
        if any(key in tag for key in NEGATIVE_DASHBOARD_EMOTIONS)
    )
    negative_ratio = negative_count / total_emotion_tags if total_emotion_tags else 0

    if negative_ratio > 0.35:
        risk_label = "需要关注"
        risk_desc = "负向情绪占比偏高，建议留意压力来源与睡眠节奏"
    elif trend == "descending":
        risk_label = "轻度波动"
        risk_desc = "近期记录节奏略有下降，可以用一句话日记先接住状态"
    else:
        risk_label = "状态平稳"
        risk_desc = "继续保持记录与睡眠节奏"

    emotion_stats = [
        {
            "tag": tag,
            "label": _dashboard_emotion_label(tag),
            "count": count,
            "percentage": round(count / total_emotion_tags * 100) if total_emotion_tags else 0,
        }
        for tag, count in sorted_emotions
    ]

    top_label = _dashboard_emotion_label(top_emotion)
    second_label = _dashboard_emotion_label(sorted_emotions[1][0]) if len(sorted_emotions) > 1 else ""
    if not diaries:
        observation_summary = "你还没有留下近期记录。可以从一句话开始，让今天的情绪有一个安放的位置。"
        encouragement = "第一篇日记不需要完整，只要真实就很好。"
    elif top_emotion == "暂无":
        observation_summary = "最近的记录正在积累中，情绪模式还需要更多样本才能更清晰。"
        encouragement = "继续记录几天后，映记会更准确地看见你的变化。"
    else:
        paired = f"和「{second_label}」" if second_label else ""
        observation_summary = f"你近期的情绪以「{top_label}」{paired}为主，整体状态{('有些起伏' if trend == 'descending' else '较为稳定')}。"
        encouragement = f"{risk_desc}，继续记录，情绪会越来越有迹可循。"

    insights = [
        f"近期情绪以「{top_label if top_emotion != '暂无' else '平稳'}」为主，记录了 {len(diaries)} 篇日记。",
        "记录频率在近期有所回升，说明你正在重新建立和自己对话的节奏。"
        if trend == "ascending"
        else "近期记录节奏略有下降，可以先用一句话完成轻量回顾。"
        if trend == "descending"
        else "记录节奏比较稳定，适合继续观察重复出现的情绪主题。",
        "负向情绪占比偏高，建议关注压力来源、睡眠和可求助资源。"
        if negative_ratio > 0.35
        else "你的情绪恢复能力较好，能够从轻微压力中慢慢调整回来。",
        "建议保持规律记录与睡眠节奏，让成长轨迹持续变得清晰。",
    ]

    recent_diaries = [
        {
            "id": diary.id,
            "title": diary.title or "无标题",
            "diary_date": diary.diary_date.isoformat() if diary.diary_date else "",
            "emotion_tags": diary.emotion_tags or [],
            "summary": _dashboard_preview(diary.content),
            "word_count": diary.word_count or 0,
            "importance_score": diary.importance_score or 5,
            "is_analyzed": bool(diary.is_analyzed),
            "analysis_path": f"/analysis/{diary.id}",
        }
        for diary in diaries[:6]
    ]

    return {
        "window_days": days,
        "generated_at": today.isoformat(),
        "stats": {
            "total_diaries": len(diaries),
            "last_days_count": len(diaries),
            "this_month_count": this_month,
            "top_emotion": top_emotion,
            "top_emotion_label": top_label if top_emotion != "暂无" else "待记录",
            "top_emotion_count": top_emotion_count,
            "trend": trend,
            "trend_label": trend_label,
            "trend_delta": trend_delta,
            "risk_label": risk_label,
            "risk_desc": risk_desc,
            "negative_ratio": round(negative_ratio, 3),
        },
        "ai_observation": {
            "title": "AI 今日观察",
            "summary": observation_summary,
            "encouragement": encouragement,
            "source": "rule_based_dashboard_insight",
        },
        "emotion_stats": emotion_stats,
        "insights": insights,
        "recent_diaries": recent_diaries,
        "analysis_entry": {
            "overall_path": "/analysis",
            "single_diary_path_template": "/analysis/{diary_id}",
            "description": "单篇日记分析会以该日记为锚点，并结合用户历史记录窗口进行综合分析。",
        },
    }


@router.get("/{diary_id}", response_model=DiaryResponse, summary="获取日记详情")
async def get_diary(
    diary_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定日记的详情
    """
    diary = await diary_service.get_diary(db, diary_id, current_user.id)

    if not diary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日记不存在"
        )

    return DiaryResponse.model_validate(diary)


@router.put("/{diary_id}", response_model=DiaryResponse, summary="更新日记")
async def update_diary(
    diary_id: int,
    diary_data: DiaryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    更新日记

    只需要提供要更新的字段
    """
    diary = await diary_service.update_diary(
        db,
        diary_id,
        current_user.id,
        diary_data
    )

    if not diary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日记不存在"
        )

    # 时间轴事件生成和AI分析集中到每日0点定时任务处理
    return DiaryResponse.model_validate(diary)


@router.delete("/{diary_id}", summary="删除日记")
async def delete_diary(
    diary_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    删除指定日记
    """
    success = await diary_service.delete_diary(
        db,
        diary_id,
        current_user.id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日记不存在"
        )

    return {"success": True, "message": "日记已删除"}


@router.get("/date/{target_date}", response_model=list[DiaryResponse], summary="获取指定日期的日记")
async def get_diaries_by_date(
    target_date: date,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定日期的所有日记
    """
    diaries = await diary_service.get_diaries_by_date(
        db,
        current_user.id,
        target_date
    )

    return [DiaryResponse.model_validate(d) for d in diaries]


# ==================== 图片上传 ====================

@router.post("/upload-image", summary="上传日记图片")
async def upload_diary_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    上传日记图片，返回图片URL

    - 支持 jpg/jpeg/png/gif/webp 格式
    - 最大 10MB
    """
    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只支持 jpg/png/gif/webp 格式的图片"
        )

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="图片大小不能超过 10MB"
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex[:12]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/diary_images/{filename}"}


@router.post("/speech-to-text", summary="语音转文字")
async def speech_to_text(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    """
    上传 16kHz 单声道 WAV 音频并返回识别文本
    """
    _ = current_user.id  # 保留鉴权依赖，避免未使用变量告警

    if not speech_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="语音识别服务未配置，请联系管理员",
        )

    allowed_types = {
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/vnd.wave",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅支持 WAV 音频文件",
        )

    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="音频大小不能超过 8MB",
        )

    try:
        text = await speech_service.transcribe_wav(contents)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="语音识别服务调用失败")

    return {"text": text}


@router.websocket("/speech-to-text/stream")
async def speech_to_text_stream(websocket: WebSocket):
    """
    流式语音听写。

    前端发送 16kHz / 16bit / mono PCM 二进制片段，发送 {"type":"end"} 结束。
    后端实时转发到讯飞 IAT WebSocket，并把 partial/final 文本推回前端。
    """
    await websocket.accept()

    token = websocket.cookies.get("access_token")
    payload = decode_access_token(token) if token else None
    if not payload or payload.get("type") not in (None, "access") or not payload.get("sub"):
        await websocket.send_json({"type": "error", "message": "请先登录后再使用语音输入"})
        await websocket.close(code=1008)
        return

    if not speech_service.is_configured():
        await websocket.send_json({"type": "error", "message": "语音识别服务未配置，请联系管理员"})
        await websocket.close(code=1011)
        return

    pcm_queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue(maxsize=80)
    last_text = ""

    async def on_text(text: str, is_final: bool) -> None:
        nonlocal last_text
        last_text = text
        await websocket.send_json({
            "type": "final" if is_final else "partial",
            "text": text,
        })

    async def receive_client_audio() -> None:
        while True:
            message = await websocket.receive()
            if "bytes" in message and message["bytes"] is not None:
                try:
                    pcm_queue.put_nowait(message["bytes"])
                except asyncio.QueueFull:
                    # 网络或上游短暂拥堵时丢弃最旧片段，避免无限堆积导致“越录越卡”。
                    try:
                        _ = pcm_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                    await pcm_queue.put(message["bytes"])
                continue

            text = message.get("text")
            if text:
                try:
                    data = json.loads(text)
                except json.JSONDecodeError:
                    data = {}
                if data.get("type") == "end":
                    await pcm_queue.put(None)
                    return

            if message.get("type") == "websocket.disconnect":
                await pcm_queue.put(None)
                return

    try:
        await websocket.send_json({"type": "ready"})
        receiver_task = asyncio.create_task(receive_client_audio())
        transcribe_task = asyncio.create_task(speech_service.stream_pcm(pcm_queue, on_text))
        done, pending = await asyncio.wait(
            {receiver_task, transcribe_task},
            return_when=asyncio.FIRST_EXCEPTION,
        )
        try:
            for task in done:
                if task.cancelled():
                    continue
                exc = task.exception()
                if exc:
                    raise exc

            if receiver_task.done() and not transcribe_task.done():
                final_text = await transcribe_task
            elif transcribe_task.done():
                final_text = transcribe_task.result()
                if not receiver_task.done():
                    receiver_task.cancel()
            else:
                final_text = last_text

            await websocket.send_json({"type": "final", "text": final_text})
            await websocket.close(code=1000)
        finally:
            for task in pending:
                if not task.done():
                    task.cancel()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[Speech Stream] error user={payload.get('sub') if payload else '?'}: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e) or "语音识别失败"})
            await websocket.close(code=1011)
        except Exception:
            pass


# ==================== 时间轴 ====================

@router.get("/timeline/recent", response_model=list[TimelineEventResponse], summary="获取最近时间轴")
async def get_recent_timeline(
    days: int = Query(7, ge=1, le=30, description="天数"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取最近N天的时间轴事件
    """
    events = await timeline_service.get_recent_events(
        db,
        current_user.id,
        days=days
    )

    return [TimelineEventResponse.model_validate(e) for e in events]


@router.get("/timeline/range", response_model=list[TimelineEventResponse], summary="获取日期范围时间轴")
async def get_timeline_by_range(
    start_date: date = Query(..., description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    limit: int = Query(100, ge=1, le=500, description="返回数量限制"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定日期范围的时间轴事件
    """
    events = await timeline_service.get_timeline(
        db,
        current_user.id,
        start_date=start_date,
        end_date=end_date,
        limit=limit
    )

    return [TimelineEventResponse.model_validate(e) for e in events]


@router.get("/timeline/date/{target_date}", response_model=list[TimelineEventResponse], summary="获取指定日期时间轴")
async def get_timeline_by_date(
    target_date: date,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定日期的所有时间轴事件
    """
    events = await timeline_service.get_events_by_date(
        db,
        current_user.id,
        target_date
    )

    return [TimelineEventResponse.model_validate(e) for e in events]


@router.post("/timeline/rebuild", summary="重建我的时间轴事件")
async def rebuild_my_timeline(
    days: int = Query(180, ge=7, le=3650, description="回溯天数"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    根据用户历史日记重建时间轴事件（幂等）。
    """
    end = date.today()
    start = end - timedelta(days=days - 1)
    stats = await timeline_service.rebuild_events_for_user(
        db,
        user_id=current_user.id,
        start_date=start,
        end_date=end,
        limit=max(days * 3, 500),
    )
    return {
        "success": True,
        "message": "时间轴重建完成",
        "stats": stats,
    }


# ==================== 情绪地形图 ====================

from app.services.terrain_service import terrain_service as _terrain_service

@router.get("/timeline/terrain", summary="获取情绪地形图数据")
async def get_terrain_data(
    days: int = Query(30, ge=7, le=365, description="天数范围"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取情绪地形图数据：按天聚合的能量/愉悦度/事件密度 + 峰谷洞察
    """
    data = await _terrain_service.get_terrain_data(
        db, current_user.id, days=days
    )
    return data


def _trim_cn_text(text: str, max_len: int = 20) -> str:
    txt = " ".join((text or "").split())
    if not txt:
        return "这一天有新的记录"
    return txt[:max_len]


def _guess_primary_emotion(events: list[TimelineEvent], diaries: list[Diary]) -> str:
    for ev in events:
        if ev.emotion_tag:
            return ev.emotion_tag.strip()
    for d in diaries:
        if d.emotion_tags:
            for tag in d.emotion_tags:
                if (tag or "").strip():
                    return tag.strip()
    return "平静"


def _fallback_daily_summary(events: list[TimelineEvent], diaries: list[Diary]) -> str:
    if events:
        best = max(events, key=lambda x: x.importance_score or 0)
        return _trim_cn_text(best.event_summary or "这一天有新的记录")
    if diaries:
        best_d = max(diaries, key=lambda x: x.importance_score or 0)
        if (best_d.title or "").strip():
            return _trim_cn_text(best_d.title)
        return _trim_cn_text(best_d.content or "这一天有新的记录")
    return "这一天有新的记录"


@router.get("/growth/daily-insight", summary="获取某日成长悬浮洞察（首次生成后缓存）")
async def get_growth_daily_insight(
    target_date: date = Query(..., description="目标日期"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    仅当某日有内容（日记或事件）时，首次 hover 触发生成并缓存洞察。
    后续直接读取数据库缓存，不重复生成。
    """
    existing_result = await db.execute(
        select(GrowthDailyInsight).where(
            and_(
                GrowthDailyInsight.user_id == current_user.id,
                GrowthDailyInsight.insight_date == target_date,
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return {
            "date": target_date.isoformat(),
            "primary_emotion": existing.primary_emotion or "平静",
            "summary": existing.summary,
            "has_content": True,
            "cached": True,
            "source": existing.source,
        }

    events_result = await db.execute(
        select(TimelineEvent).where(
            and_(
                TimelineEvent.user_id == current_user.id,
                TimelineEvent.event_date == target_date,
            )
        ).order_by(desc(TimelineEvent.importance_score), desc(TimelineEvent.created_at))
    )
    events = list(events_result.scalars().all())

    diaries_result = await db.execute(
        select(Diary).where(
            and_(
                Diary.user_id == current_user.id,
                Diary.diary_date == target_date,
            )
        ).order_by(desc(Diary.importance_score), desc(Diary.created_at))
    )
    diaries = list(diaries_result.scalars().all())

    if not events and not diaries:
        return {
            "date": target_date.isoformat(),
            "has_content": False,
            "cached": False,
            "message": "当日无记录",
        }

    primary_emotion = _guess_primary_emotion(events, diaries)
    fallback_summary = _fallback_daily_summary(events, diaries)

    diary_context = "\n".join(
        [
            f"- 标题：{d.title or '无标题'}；内容：{(d.content or '')[:180]}"
            for d in diaries[:3]
        ]
    ) or "无"
    event_context = "\n".join(
        [
            f"- 事件：{e.event_summary}；情绪：{e.emotion_tag or '未标注'}；重要性：{e.importance_score}/10"
            for e in events[:3]
        ]
    ) or "无"

    summary = fallback_summary
    source = "fallback"
    try:
        raw = await deepseek_client.chat_with_system(
            system_prompt=(
                "你是映记精灵。请输出一句自然、温暖、具体的当日总结，长度不超过20个中文字符。"
                "不要加引号，不要分段，不要解释。"
            ),
            user_prompt=(
                f"日期：{target_date.isoformat()}\n"
                f"主要情绪：{primary_emotion}\n"
                f"日记上下文：\n{diary_context}\n"
                f"事件上下文：\n{event_context}\n"
                "请输出1句总结。"
            ),
            temperature=0.65,
        )
        ai_summary = _trim_cn_text((raw or "").replace("\n", " ").strip(), 20)
        if ai_summary:
            summary = ai_summary
            source = "ai"
    except Exception:
        pass

    row = GrowthDailyInsight(
        user_id=current_user.id,
        insight_date=target_date,
        primary_emotion=primary_emotion,
        summary=summary,
        source=source,
    )
    db.add(row)
    await db.commit()

    return {
        "date": target_date.isoformat(),
        "primary_emotion": primary_emotion,
        "summary": summary,
        "has_content": True,
        "cached": False,
        "source": source,
    }


# ==================== RESTful 别名路由（v1兼容） ====================


@router.post("/diary-images", summary="上传日记图片（REST别名）")
async def upload_diary_image_rest(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    return await upload_diary_image(file=file, current_user=current_user)


@router.post("/timeline-events/rebuild", summary="重建时间轴事件（REST别名）")
async def rebuild_timeline_events_rest(
    days: int = Query(180, ge=7, le=3650, description="回溯天数"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await rebuild_my_timeline(days=days, current_user=current_user, db=db)
