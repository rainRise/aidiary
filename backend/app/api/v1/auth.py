"""
认证相关API端点
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.auth import (
    SendCodeRequest,
    VerifyCodeRequest,
    RegisterRequest,
    LoginRequest,
    PasswordLoginRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse
)
from app.services.auth_service import auth_service
from app.core.config import settings
from app.core.deps import get_current_active_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.models.database import User
from app.core.rate_limit import send_code_limiter, auth_limiter
from app.services.captcha_service import captcha_service

router = APIRouter(prefix="/auth", tags=["认证"])


def _set_auth_cookies(response: JSONResponse, access_token: str, refresh_token: str) -> None:
    """将 token 设置到 httpOnly cookie 中"""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,       # 生产环境应改为 True（需要 HTTPS）
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,       # 生产环境应改为 True
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",  # 放宽路径，避免某些代理/路由场景拿不到 refresh cookie
    )


def _clear_auth_cookies(response: JSONResponse) -> None:
    """清除认证 cookie"""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")


def _verify_captcha_from_request(request: SendCodeRequest):
    """从 SendCodeRequest 中校验滑动验证码"""
    if not request.captcha_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先完成人机验证"
        )
    success, message = captcha_service.verify(
        request.captcha_token,
        request.captcha_x or 0,
        request.captcha_duration or 0,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )


@router.get("/captcha", summary="获取滑动验证码")
async def get_captcha():
    """
    获取滑动拼图验证码参数。
    前端用 target_x/target_y 绘制缺口，用户滑动后提交 token + slide_x 校验。
    """
    return captcha_service.generate()


@router.post("/captcha/verify", summary="校验滑动验证码")
async def verify_captcha(
    data: dict,
):
    """
    校验滑动拼图结果。

    - **token**: 从 /captcha 获取的 token
    - **slide_x**: 用户滑动后拼图块的 x 坐标
    - **duration**: 滑动耗时（毫秒）
    """
    token = data.get("token", "")
    slide_x = data.get("slide_x", 0)
    duration = data.get("duration", 0)

    success, message = captcha_service.verify(token, slide_x, duration)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return {"success": True, "message": message}


@router.post("/register/send-code", summary="发送注册验证码")
async def send_register_code(
    request: SendCodeRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    发送注册验证码

    - **email**: 邮箱地址
    - **type**: 可选，传入时必须为 "register"
    """
    send_code_limiter.check(raw_request)
    _verify_captcha_from_request(request)
    if request.type and request.type != "register":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="类型必须为register"
        )

    success, message = await auth_service.send_verification_code(
        db, request.email, "register"
    )

    if not success:
        status_code = status.HTTP_429_TOO_MANY_REQUESTS if "请求过于频繁" in message else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=message
        )

    return {"success": True, "message": message}


@router.post("/register/verify", summary="验证注册验证码")
async def verify_register_code(
    request: VerifyCodeRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    验证注册验证码（仅验证，不注册）

    - **email**: 邮箱地址
    - **code**: 6位验证码
    - **type**: 可选，传入时必须为 "register"
    """
    auth_limiter.check(raw_request)
    if request.type and request.type != "register":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="类型必须为register"
        )

    success, message = await auth_service.verify_code(
        db, request.email, request.code, "register"
    )

    if not success:
        status_code = status.HTTP_429_TOO_MANY_REQUESTS if "请求过于频繁" in message else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=message
        )

    return {"success": True, "message": message}


@router.post("/register", summary="用户注册")
async def register(
    request: RegisterRequest,
    raw_request: Request,
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
    auth_limiter.check(raw_request)
    success, message, user = await auth_service.register(
        db,
        request.email,
        request.password,
        request.code,
        request.username
    )

    if not success:
        status_code = status.HTTP_429_TOO_MANY_REQUESTS if "请求过于频繁" in message else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=message
        )

    # 创建双 token
    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    body = TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )
    response = JSONResponse(content=body.model_dump(mode="json"))
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.post("/login/send-code", summary="发送登录验证码")
async def send_login_code(
    request: SendCodeRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    发送登录验证码

    - **email**: 邮箱地址
    - **type**: 可选，传入时必须为 "login"
    """
    send_code_limiter.check(raw_request)
    _verify_captcha_from_request(request)
    if request.type and request.type != "login":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="类型必须为login"
        )

    success, message = await auth_service.send_verification_code(
        db, request.email, "login"
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
    raw_request: Request,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    用户登录（使用验证码登录）

    - **email**: 邮箱地址
    - **code**: 6位验证码

    返回访问令牌和用户信息
    """
    auth_limiter.check(raw_request)
    success, message, user = await auth_service.login(
        db, request.email, request.code
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    # 创建双 token
    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    body = TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )
    response = JSONResponse(content=body.model_dump(mode="json"))
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.post("/login/password", summary="密码登录")
async def login_with_password(
    request: PasswordLoginRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    用户密码登录

    - **email**: 邮箱地址
    - **password**: 密码

    返回访问令牌和用户信息
    """
    auth_limiter.check(raw_request)
    success, message, user = await auth_service.login_with_password(
        db, request.email, request.password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    body = TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )
    response = JSONResponse(content=body.model_dump(mode="json"))
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.post("/reset-password/send-code", summary="发送重置密码验证码")
async def send_reset_password_code(
    request: SendCodeRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    发送重置密码验证码

    - **email**: 邮箱地址
    - **type**: 可选，传入时必须为 "reset"
    """
    send_code_limiter.check(raw_request)
    _verify_captcha_from_request(request)
    if request.type and request.type != "reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="类型必须为reset"
        )

    success, message = await auth_service.send_verification_code(
        db, request.email, "reset"
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return {"success": True, "message": message}


@router.post("/reset-password", summary="重置密码")
async def reset_password(
    request: ResetPasswordRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    重置密码

    - **email**: 邮箱地址
    - **code**: 6位验证码
    - **new_password**: 新密码（至少6位）
    """
    auth_limiter.check(raw_request)
    success, message = await auth_service.reset_password(
        db, request.email, request.code, request.new_password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return {"success": True, "message": message}


@router.post("/logout", summary="用户登出")
async def logout(current_user: User = Depends(get_current_active_user)):
    """
    用户登出，清除 httpOnly cookie
    """
    response = JSONResponse(content={"success": True, "message": "登出成功"})
    _clear_auth_cookies(response)
    return response


@router.post("/refresh", summary="刷新 Access Token")
async def refresh_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    使用 refresh_token cookie 签发新的 access_token。
    前端在收到 401 时自动调用此接口。
    """
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少 refresh token")

    payload = decode_access_token(rt)
    if payload is None or payload.get("type") != "refresh":
        response = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "refresh token 无效或已过期"}
        )
        _clear_auth_cookies(response)
        return response

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 数据异常")

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用")

    # 签发新的 access token（refresh token 不轮换，保持原来的）
    new_access = create_access_token({"sub": str(user.id)})
    response = JSONResponse(content={
        "access_token": new_access,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
    })
    # 只更新 access_token cookie
    response.set_cookie(
        key="access_token",
        value=new_access,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return response


@router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
) -> UserResponse:
    """
    获取当前登录用户的信息
    """
    return UserResponse.model_validate(current_user)


@router.get("/test-email", summary="测试邮件发送")
async def test_email(
    email: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    测试邮件发送功能（仅开发环境，需登录）

    - **email**: 测试邮箱地址
    """
    if not settings.debug:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此接口仅在开发环境可用"
        )

    from app.services.email_service import email_service

    success = await email_service.send_test_email(email)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="发送测试邮件失败"
        )

    return {"success": True, "message": f"测试邮件已发送到 {email}"}


# ==================== RESTful 别名路由（v1兼容） ====================
# 说明：保留历史动作式路径，新增资源化路径，便于前后端逐步迁移。


@router.post("/registration-codes", summary="发送注册验证码（REST别名）")
async def create_registration_code(
    request: SendCodeRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await send_register_code(request=request, raw_request=raw_request, db=db)


@router.post("/registration-verifications", summary="验证注册验证码（REST别名）")
async def create_registration_verification(
    request: VerifyCodeRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await verify_register_code(request=request, raw_request=raw_request, db=db)


@router.post("/login-codes", summary="发送登录验证码（REST别名）")
async def create_login_code(
    request: SendCodeRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await send_login_code(request=request, raw_request=raw_request, db=db)


@router.post("/password-sessions", summary="密码登录创建会话（REST别名）")
async def create_password_session(
    request: PasswordLoginRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await login_with_password(request=request, raw_request=raw_request, db=db)


@router.post("/verification-sessions", summary="验证码登录创建会话（REST别名）")
async def create_verification_session(
    request: LoginRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await login(request=request, raw_request=raw_request, db=db)


@router.post("/password-reset-codes", summary="发送重置密码验证码（REST别名）")
async def create_password_reset_code(
    request: SendCodeRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await send_reset_password_code(request=request, raw_request=raw_request, db=db)


@router.post("/password-resets", summary="重置密码（REST别名）")
async def create_password_reset(
    request: ResetPasswordRequest,
    raw_request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await reset_password(request=request, raw_request=raw_request, db=db)


@router.post("/token-refreshes", summary="刷新访问令牌（REST别名）")
async def create_token_refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await refresh_access_token(request=request, db=db)
