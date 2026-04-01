"""
社区相关的 Pydantic Schemas
"""
from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


# ==================== 帖子 ====================

class PostCreate(BaseModel):
    """创建帖子"""
    circle_id: str = Field(..., description="圈子ID: anxiety/sadness/growth/peace/confusion")
    content: str = Field(..., min_length=1, max_length=5000, description="帖子内容")
    images: Optional[List[str]] = Field(default=[], description="图片URL列表")
    is_anonymous: bool = Field(default=False, description="是否匿名")


class PostUpdate(BaseModel):
    """更新帖子（匿名帖不可编辑）"""
    content: Optional[str] = Field(None, min_length=1, max_length=5000)
    images: Optional[List[str]] = None


class PostAuthor(BaseModel):
    """帖子作者信息"""
    id: int
    username: Optional[str] = None
    avatar_url: Optional[str] = None


class PostResponse(BaseModel):
    """帖子响应"""
    id: int
    circle_id: str
    content: str
    images: Optional[List[str]] = []
    is_anonymous: bool
    author: Optional[PostAuthor] = None  # 匿名时为None
    like_count: int = 0
    comment_count: int = 0
    collect_count: int = 0
    is_liked: bool = False  # 当前用户是否点赞
    is_collected: bool = False  # 当前用户是否收藏
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PostListResponse(BaseModel):
    """帖子列表响应"""
    items: List[PostResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==================== 评论 ====================

class CommentCreate(BaseModel):
    """创建评论"""
    content: str = Field(..., min_length=1, max_length=2000, description="评论内容")
    parent_id: Optional[int] = Field(None, description="回复的评论ID")
    is_anonymous: bool = Field(default=False, description="是否匿名")


class CommentAuthor(BaseModel):
    """评论作者信息"""
    id: int
    username: Optional[str] = None
    avatar_url: Optional[str] = None


class CommentResponse(BaseModel):
    """评论响应"""
    id: int
    post_id: int
    content: str
    is_anonymous: bool
    author: Optional[CommentAuthor] = None
    parent_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    """评论列表响应"""
    items: List[CommentResponse]
    total: int


# ==================== 圈子 ====================

class CircleInfo(BaseModel):
    """圈子信息"""
    id: str
    name: str
    label: str
    color: str
    post_count: int = 0


# ==================== 浏览记录 / 收藏 ====================

class ViewHistoryItem(BaseModel):
    """浏览记录项"""
    post: PostResponse
    viewed_at: datetime


class ViewHistoryResponse(BaseModel):
    """浏览记录响应"""
    items: List[ViewHistoryItem]
    total: int
    page: int
    page_size: int
    total_pages: int
