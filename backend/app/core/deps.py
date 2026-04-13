"""
FastAPI依赖项
常用的依赖注入函数
"""
from typing import Optional, List
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db import get_db
from app.models.database import User, UserRole

# HTTP Bearer认证（设为可选，cookie 优先）
security = HTTPBearer(auto_error=False)


def _extract_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    """
    按优先级提取 access token：
    1. httpOnly cookie "access_token"
    2. Authorization: Bearer <token> 请求头
    """
    # 优先从 cookie 读取
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token
    # 回退到 Bearer header
    if credentials:
        return credentials.credentials
    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    获取当前登录用户
    优先从 httpOnly cookie 读取 token，回退到 Authorization header。
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = _extract_token(request, credentials)
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    # 确保是 access token（非 refresh token）
    if payload.get("type") not in (None, "access"):
        raise credentials_exception

    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    获取当前活跃用户

    Args:
        current_user: 当前用户

    Returns:
        User: 活跃用户对象

    Raises:
        HTTPException: 用户未激活时抛出400
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户未激活"
        )
    return current_user


def require_role(*allowed_roles: str):
    """
    角色权限守卫工厂函数

    用法:
        current_user: User = Depends(require_role("admin", "counselor"))

    Args:
        allowed_roles: 允许访问的角色列表

    Returns:
        依赖注入函数
    """
    async def _check_role(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="权限不足，无法访问此资源",
            )
        return current_user
    return _check_role


# 常用守卫快捷方式
require_admin = require_role(UserRole.admin.value)
require_counselor = require_role(UserRole.counselor.value, UserRole.psychologist.value)
require_counselor_or_admin = require_role(
    UserRole.counselor.value, UserRole.psychologist.value, UserRole.admin.value
)


def get_trace_id(x_trace_id: Optional[str] = Header(None)) -> str:
    """
    获取追踪ID（用于日志关联）

    Args:
        x_trace_id: 请求头中的追踪ID

    Returns:
        str: 追踪ID
    """
    return x_trace_id or "unknown"
