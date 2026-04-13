"""
数据库模型定义
使用SQLAlchemy ORM
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, Integer, Text, func, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db import Base


class UserRole(str, enum.Enum):
    """用户角色枚举"""
    student = "student"
    counselor = "counselor"
    psychologist = "psychologist"
    admin = "admin"


class ApplicationStatus(str, enum.Enum):
    """认证申请状态"""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(50))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    mbti: Mapped[Optional[str]] = mapped_column(String(10))
    social_style: Mapped[Optional[str]] = mapped_column(String(20))
    current_state: Mapped[Optional[str]] = mapped_column(String(20))
    catchphrases: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    role: Mapped[str] = mapped_column(
        String(20),
        default=UserRole.student.value,
        server_default=UserRole.student.value,
        nullable=False,
    )
    counselor_info: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # 关系
    counselor_application: Mapped[Optional["CounselorApplication"]] = relationship(
        back_populates="user", foreign_keys="CounselorApplication.user_id", uselist=False
    )
    counselor_bindings: Mapped[List["CounselorBinding"]] = relationship(
        back_populates="user", foreign_keys="CounselorBinding.user_id"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


class VerificationCode(Base):
    """验证码表"""
    __tablename__ = "verification_codes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    type: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # 'register' or 'login'
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<VerificationCode(id={self.id}, email={self.email}, type={self.type})>"


class CounselorApplication(Base):
    """辅导员/心理老师认证申请表"""
    __tablename__ = "counselor_applications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="申请的目标角色: counselor 或 psychologist",
    )
    real_name: Mapped[str] = mapped_column(String(50), nullable=False, comment="真实姓名")
    department: Mapped[str] = mapped_column(String(100), nullable=False, comment="所属院系/单位")
    employee_id: Mapped[Optional[str]] = mapped_column(String(50), comment="工号")
    phone: Mapped[Optional[str]] = mapped_column(String(20), comment="联系电话")
    qualification_images: Mapped[Optional[list]] = mapped_column(
        JSON, default=list, comment="资质证明照片URL列表"
    )
    introduction: Mapped[Optional[str]] = mapped_column(Text, comment="个人简介/申请说明")
    status: Mapped[str] = mapped_column(
        String(20),
        default=ApplicationStatus.pending.value,
        server_default=ApplicationStatus.pending.value,
        nullable=False,
        index=True,
    )
    reviewed_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        comment="审核管理员ID",
    )
    review_comment: Mapped[Optional[str]] = mapped_column(Text, comment="审核意见")
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 关系
    user: Mapped["User"] = relationship(
        back_populates="counselor_application", foreign_keys=[user_id]
    )
    reviewer: Mapped[Optional["User"]] = relationship(foreign_keys=[reviewed_by])

    def __repr__(self) -> str:
        return f"<CounselorApplication(id={self.id}, user_id={self.user_id}, target_role={self.target_role}, status={self.status})>"


class CounselorBinding(Base):
    """辅导员/心理老师-班级/学院绑定关系表"""
    __tablename__ = "counselor_bindings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scope_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="范围类型: department(院系) 或 class(班级)",
    )
    scope_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="范围名称，如: 计算机学院、软件工程2班",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 关系
    user: Mapped["User"] = relationship(
        back_populates="counselor_bindings", foreign_keys=[user_id]
    )

    def __repr__(self) -> str:
        return f"<CounselorBinding(id={self.id}, user_id={self.user_id}, scope={self.scope_type}:{self.scope_name})>"
