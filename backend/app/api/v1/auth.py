"""
认证相关API端点
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.auth import (
    SendCodeRequest,
    VerifyCodeRequest,
    RegisterRequest,
    LoginRequest,
    PasswordLoginRequest,
    TokenResponse,
    UserResponse
)
from app.services.auth_service import auth_service
from app.core.deps import get_current_active_user
from app.models.database import User

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/register/send-code", summary="发送注册验证码")
async def send_register_code(
    request: SendCodeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    发送注册验证码

    - **email**: 邮箱地址
    - **type**: 必须为 "register"
    """
    if request.type != "register":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="类型必须为register"
        )

    success, message = await auth_service.send_verification_code(
        db, request.email, request.type
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return {"success": True, "message": message}


@router.post("/register/verify", summary="验证注册验证码")
async def verify_register_code(
    request: VerifyCodeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    验证注册验证码（仅验证，不注册）

    - **email**: 邮箱地址
    - **code**: 6位验证码
    - **type**: 必须为 "register"
    """
    if request.type != "register":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="类型必须为register"
        )

    success, message = await auth_service.verify_code(
        db, request.email, request.code, request.type
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return {"success": True, "message": message}


@router.post("/register", summary="用户注册")
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    用户注册

    - **email**: 邮箱地址
    - **code**: 6位验证码
    - **password**: 密码（至少6位）
    - **username**: 用户名（可选）

    返回访问令牌和用户信息
    """
    success, message, user = await auth_service.register(
        db,
        request.email,
        request.password,
        request.code,
        request.username
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    # 创建访问令牌
    access_token = auth_service.create_token(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/login/send-code", summary="发送登录验证码")
async def send_login_code(
    request: SendCodeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    发送登录验证码

    - **email**: 邮箱地址
    - **type**: 必须为 "login"
    """
    if request.type != "login":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="类型必须为login"
        )

    success, message = await auth_service.send_verification_code(
        db, request.email, request.type
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return {"success": True, "message": message}


@router.post("/login", summary="用户登录")
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    用户登录（使用验证码登录）

    - **email**: 邮箱地址
    - **code**: 6位验证码

    返回访问令牌和用户信息
    """
    success, message, user = await auth_service.login(
        db, request.email, request.code
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    # 创建访问令牌
    access_token = auth_service.create_token(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/login/password", summary="密码登录")
async def login_with_password(
    request: PasswordLoginRequest,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    用户密码登录

    - **email**: 邮箱地址
    - **password**: 密码

    返回访问令牌和用户信息
    """
    success, message, user = await auth_service.login_with_password(
        db, request.email, request.password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    access_token = auth_service.create_token(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/logout", summary="用户登出")
async def logout(current_user: User = Depends(get_current_active_user)):
    """
    用户登出

    （客户端删除令牌即可）
    """
    return {"success": True, "message": "登出成功"}


@router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
) -> UserResponse:
    """
    获取当前登录用户的信息
    """
    return UserResponse.model_validate(current_user)


@router.get("/test-email", summary="测试邮件发送")
async def test_email(email: str):
    """
    测试邮件发送功能（仅开发环境）

    - **email**: 测试邮箱地址
    """
    from app.services.email_service import email_service

    success = await email_service.send_test_email(email)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="发送测试邮件失败"
        )

    return {"success": True, "message": f"测试邮件已发送到 {email}"}
