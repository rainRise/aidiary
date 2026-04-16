"""
认证相关的 Pydantic Schemas
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SendCodeRequest(BaseModel):
    """发送验证码请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    type: Optional[str] = Field(
        None,
        pattern="^(register|login|reset)$",
        description="验证码类型：register、login或reset（兼容字段，可不传）"
    )
    captcha_token: Optional[str] = Field(None, description="滑动验证码 token（通过人机验证后获得）")
    captcha_x: Optional[float] = Field(None, description="滑动验证码用户滑动 x 坐标")
    captcha_duration: Optional[int] = Field(None, description="滑动验证码耗时（ms）")


class VerifyCodeRequest(BaseModel):
    """验证码验证请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")
    type: Optional[str] = Field(
        None,
        pattern="^(register|login|reset)$",
        description="验证码类型：register、login或reset（兼容字段，可不传）"
    )


class RegisterRequest(BaseModel):
    """注册请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")
    password: str = Field(..., min_length=6, max_length=50, description="密码")
    username: Optional[str] = Field(None, max_length=50, description="用户名（可选）")


class LoginRequest(BaseModel):
    """登录请求（验证码登录）"""
    email: EmailStr = Field(..., description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")


class PasswordLoginRequest(BaseModel):
    """密码登录请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=6, max_length=50, description="密码")


class UserResponse(BaseModel):
    """用户信息响应"""
    id: int
    email: str
    username: Optional[str]
    avatar_url: Optional[str] = None
    mbti: Optional[str] = None
    social_style: Optional[str] = None
    current_state: Optional[str] = None
    catchphrases: Optional[list] = None
    department: Optional[str] = None
    class_name: Optional[str] = None
    role: str = "student"
    counselor_info: Optional[dict] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """令牌响应"""
    access_token: str = Field(..., description="访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    user: UserResponse = Field(..., description="用户信息")


class ProfileUpdateRequest(BaseModel):
    """用户画像更新请求"""
    username: Optional[str] = Field(None, max_length=50, description="用户名")
    mbti: Optional[str] = Field(None, max_length=10, description="MBTI类型")
    social_style: Optional[str] = Field(None, max_length=20, description="社交风格")
    current_state: Optional[str] = Field(None, max_length=20, description="当前状态")
    catchphrases: Optional[list] = Field(None, description="口头禅列表")
    department: Optional[str] = Field(None, max_length=100, description="所属院系")
    class_name: Optional[str] = Field(None, max_length=100, description="所属班级")


class UserUpdateRequest(BaseModel):
    """用户信息更新请求"""
    username: Optional[str] = Field(None, max_length=50, description="用户名")


class ResetPasswordRequest(BaseModel):
    """重置密码请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")
    new_password: str = Field(..., min_length=6, max_length=50, description="新密码")


class ErrorResponse(BaseModel):
    """错误响应"""
    error: str = Field(..., description="错误消息")
    detail: Optional[str] = Field(None, description="详细错误信息")
