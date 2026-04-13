"""
安全相关功能
包括JWT令牌生成/验证、密码哈希等
"""
from datetime import datetime, timedelta
import hashlib
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# Token 过期时间
# access token 使用配置项，避免过短导致用户在长耗时分析中途掉线
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = 7     # 长期 refresh token：7 天
_BCRYPT_SHA256_PREFIX = "bcrypt_sha256$"


def _password_bytes(password: str) -> bytes:
    """统一使用 UTF-8 编码密码。"""
    return password.encode("utf-8")


def _bcrypt_sha256_digest(password: str) -> bytes:
    """
    先做 SHA-256 再 bcrypt，规避 bcrypt 72 字节输入限制。

    新生成的密码统一使用该格式，旧的原生 bcrypt 哈希仍继续兼容验证。
    """
    return hashlib.sha256(_password_bytes(password)).digest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码

    Args:
        plain_password: 明文密码
        hashed_password: 哈希密码

    Returns:
        bool: 密码是否匹配
    """
    try:
        if hashed_password.startswith(_BCRYPT_SHA256_PREFIX):
            stored_hash = hashed_password[len(_BCRYPT_SHA256_PREFIX):].encode("utf-8")
            return bcrypt.checkpw(_bcrypt_sha256_digest(plain_password), stored_hash)

        # 兼容历史原生 bcrypt 哈希
        if hashed_password.startswith("$2"):
            return bcrypt.checkpw(_password_bytes(plain_password), hashed_password.encode("utf-8"))

        return False
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    """
    生成密码哈希

    Args:
        password: 明文密码

    Returns:
        str: 哈希后的密码
    """
    password_hash = bcrypt.hashpw(
        _bcrypt_sha256_digest(password),
        bcrypt.gensalt()
    ).decode("utf-8")
    return f"{_BCRYPT_SHA256_PREFIX}{password_hash}"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建短期 JWT 访问令牌（默认 30 分钟）
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建长期 JWT 刷新令牌（默认 7 天）
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    """
    解码JWT访问令牌

    Args:
        token: JWT令牌

    Returns:
        Optional[dict]: 解码后的数据，失败返回None
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        return payload
    except JWTError:
        return None
