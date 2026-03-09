"""
认证相关的 Pydantic Schemas
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class SendCodeRequest(BaseModel):
    """发送验证码请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    type: str = Field(..., pattern="^(register|login)$", description="验证码类型：register或login")


class VerifyCodeRequest(BaseModel):
    """验证码验证请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")
    type: str = Field(..., pattern="^(register|login)$", description="验证码类型：register或login")


class RegisterRequest(BaseModel):
    """注册请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")
    password: str = Field(..., min_length=6, max_length=50, description="密码")
    username: Optional[str] = Field(None, max_length=50, description="用户名（可选）")


class LoginRequest(BaseModel):
    """登录请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")


class TokenResponse(BaseModel):
    """令牌响应"""
    access_token: str = Field(..., description="访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    user: "UserResponse" = Field(..., description="用户信息")


class UserResponse(BaseModel):
    """用户信息响应"""
    id: int
    email: str
    username: Optional[str]
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    """用户信息更新请求"""
    username: Optional[str] = Field(None, max_length=50, description="用户名")


class ErrorResponse(BaseModel):
    """错误响应"""
    error: str = Field(..., description="错误消息")
    detail: Optional[str] = Field(None, description="详细错误信息")


# 重建模型以解决前向引用问题
TokenResponse.model_rebuild()
