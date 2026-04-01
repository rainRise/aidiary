"""
日记相关的数据模型
"""
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, DateTime, Date, JSON, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db import Base


class StringListJSON(TypeDecorator):
    """存储列表为JSON的列类型"""
    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return value if isinstance(value, list) else [value]

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return value if isinstance(value, list) else []


class Diary(Base):
    """日记表"""
    __tablename__ = "diaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title: Mapped[Optional[str]] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_html: Mapped[Optional[str]] = mapped_column(Text)
    diary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    emotion_tags: Mapped[Optional[list]] = mapped_column(StringListJSON)
    importance_score: Mapped[int] = mapped_column(
        Integer,
        default=5,
        nullable=False
    )
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    images: Mapped[Optional[list]] = mapped_column(StringListJSON)
    is_analyzed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<Diary(id={self.id}, title={self.title}, date={self.diary_date})>"


class TimelineEvent(Base):
    """时间轴事件表"""
    __tablename__ = "timeline_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    diary_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("diaries.id", ondelete="SET NULL"),
        nullable=True
    )
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    event_summary: Mapped[str] = mapped_column(String(500), nullable=False)
    emotion_tag: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    importance_score: Mapped[int] = mapped_column(
        Integer,
        default=5,
        nullable=False
    )
    event_type: Mapped[Optional[str]] = mapped_column(String(50))  # work/relationship/health/achievement
    related_entities: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<TimelineEvent(id={self.id}, summary={self.event_summary}, date={self.event_date})>"


class AIAnalysis(Base):
    """AI分析结果表（按日记维度保存最近一次结果）"""
    __tablename__ = "ai_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    diary_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("diaries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True
    )
    result_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<AIAnalysis(id={self.id}, diary_id={self.diary_id})>"


class SocialPostSample(Base):
    """用户历史朋友圈样本（用于Few-shot风格学习）"""
    __tablename__ = "social_post_samples"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<SocialPostSample(id={self.id}, user_id={self.user_id})>"
