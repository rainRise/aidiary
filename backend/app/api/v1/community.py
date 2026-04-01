"""
社区相关API端点
"""
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.community import (
    PostCreate, PostUpdate, PostResponse, PostListResponse,
    CommentCreate, CommentResponse, CommentListResponse,
    CircleInfo, ViewHistoryItem, ViewHistoryResponse,
)
from app.services.community_service import community_service
from app.core.deps import get_current_active_user
from app.models.database import User

router = APIRouter(prefix="/community", tags=["社区"])

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads", "community_images"
)


# ==================== 圈子 ====================

@router.get("/circles", response_model=list[CircleInfo], summary="获取所有圈子")
async def get_circles(db: AsyncSession = Depends(get_db)):
    """获取所有情绪圈子及帖子数量"""
    circles = await community_service.get_circles(db)
    return circles


# ==================== 帖子 ====================

@router.post("/posts", response_model=PostResponse, summary="创建帖子")
async def create_post(
    data: PostCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """创建社区帖子，支持匿名发布"""
    try:
        post = await community_service.create_post(
            db, current_user.id,
            data.circle_id, data.content,
            data.images, data.is_anonymous
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    resp = await community_service.build_post_response(db, post, current_user.id)
    return PostResponse(**resp)


@router.get("/posts", response_model=PostListResponse, summary="获取帖子列表")
async def list_posts(
    circle_id: Optional[str] = Query(None, description="圈子ID过滤"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取帖子列表（分页），可按圈子筛选"""
    posts, total = await community_service.list_posts(db, circle_id, page, page_size)
    total_pages = (total + page_size - 1) // page_size

    items = []
    for post in posts:
        resp = await community_service.build_post_response(db, post, current_user.id)
        items.append(PostResponse(**resp))

    return PostListResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages
    )


@router.get("/posts/mine", response_model=PostListResponse, summary="获取我的帖子")
async def list_my_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户发布的帖子"""
    posts, total = await community_service.list_user_posts(db, current_user.id, page, page_size)
    total_pages = (total + page_size - 1) // page_size

    items = []
    for post in posts:
        resp = await community_service.build_post_response(db, post, current_user.id)
        items.append(PostResponse(**resp))

    return PostListResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages
    )


@router.get("/posts/{post_id}", response_model=PostResponse, summary="获取帖子详情")
async def get_post(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取帖子详情并记录浏览"""
    post = await community_service.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="帖子不存在")

    # 记录浏览
    await community_service.record_view(db, post_id, current_user.id)

    resp = await community_service.build_post_response(db, post, current_user.id)
    return PostResponse(**resp)


@router.put("/posts/{post_id}", response_model=PostResponse, summary="更新帖子")
async def update_post(
    post_id: int,
    data: PostUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """更新帖子（匿名帖不可编辑）"""
    try:
        post = await community_service.update_post(
            db, post_id, current_user.id,
            data.content, data.images
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="帖子不存在或无权限")

    resp = await community_service.build_post_response(db, post, current_user.id)
    return PostResponse(**resp)


@router.delete("/posts/{post_id}", summary="删除帖子")
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """删除帖子"""
    success = await community_service.delete_post(db, post_id, current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="帖子不存在或无权限")
    return {"success": True, "message": "帖子已删除"}


# ==================== 图片上传 ====================

@router.post("/upload-image", summary="上传社区图片")
async def upload_community_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """上传社区帖子图片"""
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

    return {"url": f"/uploads/community_images/{filename}"}


# ==================== 评论 ====================

@router.post("/posts/{post_id}/comments", response_model=CommentResponse, summary="发表评论")
async def create_comment(
    post_id: int,
    data: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """对帖子发表评论"""
    try:
        comment = await community_service.create_comment(
            db, post_id, current_user.id,
            data.content, data.parent_id, data.is_anonymous
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    resp = await community_service.build_comment_response(db, comment)
    return CommentResponse(**resp)


@router.get("/posts/{post_id}/comments", response_model=CommentListResponse, summary="获取评论列表")
async def list_comments(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取帖子的所有评论"""
    comments, total = await community_service.list_comments(db, post_id)

    items = []
    for comment in comments:
        resp = await community_service.build_comment_response(db, comment)
        items.append(CommentResponse(**resp))

    return CommentListResponse(items=items, total=total)


@router.delete("/comments/{comment_id}", summary="删除评论")
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """删除自己的评论"""
    success = await community_service.delete_comment(db, comment_id, current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="评论不存在或无权限")
    return {"success": True, "message": "评论已删除"}


# ==================== 点赞 ====================

@router.post("/posts/{post_id}/like", summary="切换点赞")
async def toggle_like(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """点赞/取消点赞"""
    try:
        liked = await community_service.toggle_like(db, post_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"liked": liked}


# ==================== 收藏 ====================

@router.post("/posts/{post_id}/collect", summary="切换收藏")
async def toggle_collect(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """收藏/取消收藏"""
    try:
        collected = await community_service.toggle_collect(db, post_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"collected": collected}


@router.get("/collections", response_model=PostListResponse, summary="获取收藏列表")
async def list_collections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户的收藏列表"""
    posts, total = await community_service.list_collected_posts(db, current_user.id, page, page_size)
    total_pages = (total + page_size - 1) // page_size

    items = []
    for post in posts:
        resp = await community_service.build_post_response(db, post, current_user.id)
        items.append(PostResponse(**resp))

    return PostListResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages
    )


# ==================== 浏览记录 ====================

@router.get("/history", response_model=ViewHistoryResponse, summary="获取浏览记录")
async def list_view_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取浏览记录（去重，每个帖子只显示最后一次浏览）"""
    items_raw, total = await community_service.list_view_history(
        db, current_user.id, page, page_size
    )
    total_pages = (total + page_size - 1) // page_size

    items = []
    for item in items_raw:
        post_resp = await community_service.build_post_response(db, item["post"], current_user.id)
        items.append(ViewHistoryItem(
            post=PostResponse(**post_resp),
            viewed_at=item["viewed_at"]
        ))

    return ViewHistoryResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages
    )
