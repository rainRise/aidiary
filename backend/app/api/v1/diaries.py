"""
日记相关API端点
"""
import os
import uuid
from typing import Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads", "diary_images")
from app.schemas.diary import (
    DiaryCreate,
    DiaryUpdate,
    DiaryResponse,
    DiaryListResponse,
    TimelineEventResponse
)
from app.services.diary_service import diary_service, timeline_service
from app.core.deps import get_current_active_user
from app.models.database import User

router = APIRouter(prefix="/diaries", tags=["日记"])


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
    try:
        await timeline_service.upsert_event_from_diary(db, current_user.id, diary)
    except Exception as e:
        # 不阻断主流程，避免因为时间轴失败导致日记无法保存
        print(f"[Timeline Auto Upsert] create_diary warning: {e}")
    return DiaryResponse.model_validate(diary)


@router.get("/", response_model=DiaryListResponse, summary="获取日记列表")
async def list_diaries(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页大小"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    emotion_tag: Optional[str] = Query(None, description="情绪标签过滤"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取日记列表（分页）

    支持按日期范围和情绪标签过滤
    """
    diaries, total = await diary_service.list_diaries(
        db,
        current_user.id,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        emotion_tag=emotion_tag
    )

    total_pages = (total + page_size - 1) // page_size

    return DiaryListResponse(
        items=[DiaryResponse.model_validate(d) for d in diaries],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


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

    try:
        await timeline_service.upsert_event_from_diary(db, current_user.id, diary)
    except Exception as e:
        print(f"[Timeline Auto Upsert] update_diary warning: {e}")

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
