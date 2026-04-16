"""
管理后台 Pydantic Schemas
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BindingBrief(BaseModel):
    """绑定范围简要信息"""
    id: int
    scope_type: str
    scope_name: str

    class Config:
        from_attributes = True


# ==================== 用户管理 ====================

class AdminUserResponse(BaseModel):
    """管理员-用户详情响应"""
    id: int
    email: str
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    department: Optional[str] = None
    class_name: Optional[str] = None
    role: str
    counselor_info: Optional[dict] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    bindings: list[BindingBrief] = []

    class Config:
        from_attributes = True
class AdminUserListResponse(BaseModel):
    """用户列表响应（分页）"""
    items: list[AdminUserResponse]
    total: int
    page: int
    page_size: int


class AdminUserUpdateRequest(BaseModel):
    """管理员修改用户请求"""
    role: Optional[str] = Field(
        None,
        pattern="^(student|counselor|psychologist|admin)$",
        description="用户角色",
    )
    department: Optional[str] = Field(None, max_length=100, description="所属院系")
    class_name: Optional[str] = Field(None, max_length=100, description="所属班级")
    is_active: Optional[bool] = Field(None, description="是否激活")
    is_verified: Optional[bool] = Field(None, description="是否已验证")


# ==================== 帖子管理 ====================

class AdminPostResponse(BaseModel):
    """管理员-帖子详情响应（含匿名真实身份）"""
    id: int
    circle_id: int
    user_id: int
    content: str
    images: list[str] = []
    is_anonymous: bool
    is_hidden: bool = False
    likes_count: int = 0
    comments_count: int = 0
    created_at: datetime
    updated_at: datetime
    # 管理员专属：匿名帖子追溯
    author_email: Optional[str] = Field(
        None, description="真实发帖人邮箱（管理员可见）"
    )
    author_username: Optional[str] = Field(
        None, description="真实发帖人用户名（管理员可见）"
    )
    author_role: Optional[str] = Field(
        None, description="发帖人角色（管理员可见）"
    )

    class Config:
        from_attributes = True


class AdminPostListResponse(BaseModel):
    """帖子列表响应（分页）"""
    items: list[AdminPostResponse]
    total: int
    page: int
    page_size: int


class AdminPostUpdateRequest(BaseModel):
    """管理员帖子管理请求"""
    is_hidden: Optional[bool] = Field(None, description="是否隐藏")


# ==================== 系统看板 ====================

class AdminDashboardResponse(BaseModel):
    """系统概览数据"""
    total_users: int = Field(0, description="总用户数")
    active_users: int = Field(0, description="活跃用户数")
    counselor_count: int = Field(0, description="辅导员数量")
    psychologist_count: int = Field(0, description="心理老师数量")
    total_diaries: int = Field(0, description="总日记数")
    total_posts: int = Field(0, description="总帖子数")
    anonymous_posts: int = Field(0, description="匿名帖子数")
    pending_applications: int = Field(0, description="待审核申请数")
