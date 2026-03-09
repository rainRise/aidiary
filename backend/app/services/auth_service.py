"""
认证服务
处理用户注册、登录、验证码等业务逻辑
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import User, VerificationCode
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.services.email_service import email_service


class AuthService:
    """认证服务类"""

    async def send_verification_code(
        self,
        db: AsyncSession,
        email: str,
        code_type: str
    ) -> Tuple[bool, str]:
        """
        发送验证码

        Args:
            db: 数据库会话
            email: 邮箱地址
            code_type: 验证码类型（register/login）

        Returns:
            Tuple[bool, str]: (是否成功, 消息)
        """
        # 检查频率限制：5分钟内最多3次
        five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
        result = await db.execute(
            select(VerificationCode).where(
                and_(
                    VerificationCode.email == email,
                    VerificationCode.type == code_type,
                    VerificationCode.created_at >= five_minutes_ago,
                    VerificationCode.used == False
                )
            )
        )
        recent_codes = result.scalars().all()

        if len(recent_codes) >= settings.max_code_requests_per_5min:
            return False, "请求过于频繁，请稍后再试"

        # 如果是注册，检查邮箱是否已存在
        if code_type == "register":
            existing_user = await db.execute(
                select(User).where(User.email == email)
            )
            if existing_user.scalar_one_or_none():
                return False, "该邮箱已注册"

        # 生成验证码
        code = email_service.generate_code()

        # 计算过期时间
        expires_at = datetime.utcnow() + timedelta(
            minutes=settings.verification_code_expire_minutes
        )

        # 保存验证码到数据库
        verification_code = VerificationCode(
            email=email,
            code=code,
            type=code_type,
            expires_at=expires_at
        )
        db.add(verification_code)
        await db.commit()

        # 发送邮件
        email_sent = await email_service.send_verification_email(
            email, code, code_type
        )

        if not email_sent:
            return False, "发送邮件失败，请稍后重试"

        return True, "验证码已发送到您的邮箱"

    async def verify_code(
        self,
        db: AsyncSession,
        email: str,
        code: str,
        code_type: str
    ) -> Tuple[bool, str]:
        """
        验证验证码

        Args:
            db: 数据库会话
            email: 邮箱地址
            code: 验证码
            code_type: 验证码类型

        Returns:
            Tuple[bool, str]: (是否成功, 消息)
        """
        # 查询最新的未使用验证码
        result = await db.execute(
            select(VerificationCode).where(
                and_(
                    VerificationCode.email == email,
                    VerificationCode.code == code,
                    VerificationCode.type == code_type,
                    VerificationCode.used == False
                )
            ).order_by(VerificationCode.created_at.desc())
        )
        verification_code = result.scalar_one_or_none()

        # 验证码不存在
        if not verification_code:
            return False, "验证码错误"

        # 验证码已过期
        if verification_code.expires_at < datetime.utcnow():
            return False, "验证码已过期"

        # 验证码有效
        return True, "验证码正确"

    async def register(
        self,
        db: AsyncSession,
        email: str,
        password: str,
        code: str,
        username: Optional[str] = None
    ) -> Tuple[bool, str, Optional[User]]:
        """
        用户注册

        Args:
            db: 数据库会话
            email: 邮箱地址
            password: 密码
            code: 验证码
            username: 用户名（可选）

        Returns:
            Tuple[bool, str, Optional[User]]: (是否成功, 消息, 用户对象)
        """
        # 验证验证码
        success, message = await self.verify_code(db, email, code, "register")
        if not success:
            return False, message, None

        # 检查邮箱是否已存在
        existing_user = await db.execute(
            select(User).where(User.email == email)
        )
        if existing_user.scalar_one_or_none():
            return False, "该邮箱已注册", None

        # 创建用户
        user = User(
            email=email,
            password_hash=get_password_hash(password),
            username=username
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # 标记验证码为已使用
        result = await db.execute(
            select(VerificationCode).where(
                and_(
                    VerificationCode.email == email,
                    VerificationCode.code == code,
                    VerificationCode.type == "register"
                )
            )
        )
        verification_code = result.scalar_one_or_none()
        if verification_code:
            verification_code.used = True
            await db.commit()

        return True, "注册成功", user

    async def login(
        self,
        db: AsyncSession,
        email: str,
        code: str
    ) -> Tuple[bool, str, Optional[User]]:
        """
        用户登录（使用验证码）

        Args:
            db: 数据库会话
            email: 邮箱地址
            code: 验证码

        Returns:
            Tuple[bool, str, Optional[User]]: (是否成功, 消息, 用户对象)
        """
        # 验证验证码
        success, message = await self.verify_code(db, email, code, "login")
        if not success:
            return False, message, None

        # 查找用户
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            return False, "用户不存在", None

        if not user.is_active:
            return False, "用户已被禁用", None

        # 标记验证码为已使用
        verification_code_result = await db.execute(
            select(VerificationCode).where(
                and_(
                    VerificationCode.email == email,
                    VerificationCode.code == code,
                    VerificationCode.type == "login"
                )
            )
        )
        verification_code = verification_code_result.scalar_one_or_none()
        if verification_code:
            verification_code.used = True
            await db.commit()

        return True, "登录成功", user

    async def login_with_password(
        self,
        db: AsyncSession,
        email: str,
        password: str
    ) -> Tuple[bool, str, Optional[User]]:
        """
        用户密码登录

        Args:
            db: 数据库会话
            email: 邮箱地址
            password: 密码

        Returns:
            Tuple[bool, str, Optional[User]]: (是否成功, 消息, 用户对象)
        """
        # 查找用户
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            return False, "邮箱或密码错误", None

        if not user.is_active:
            return False, "用户已被禁用", None

        # 验证密码
        if not verify_password(password, user.password_hash):
            return False, "邮箱或密码错误", None

        return True, "登录成功", user

    def create_token(self, user: User) -> str:
        """
        创建访问令牌

        Args:
            user: 用户对象

        Returns:
            str: JWT令牌
        """
        token_data = {"sub": str(user.id), "email": user.email}
        return create_access_token(token_data)


# 创建全局实例
auth_service = AuthService()
