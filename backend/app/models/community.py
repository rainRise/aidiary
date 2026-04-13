"""
社区相关的数据模型
帖子、评论、点赞、收藏、浏览记录
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, func, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


# 6个情绪圈子
CIRCLES = [
    {"id": "anxiety", "name": "焦虑", "label": "我们都在焦虑的事", "color": "#e88f7b"},
    {"id": "sadness", "name": "失落", "label": "那些低落的时刻", "color": "#a09ab8"},
    {"id": "growth", "name": "成长", "label": "突破自我的瞬间", "color": "#6abf8a"},
    {"id": "peace", "name": "平静", "label": "享受当下的时光", "color": "#7bc5d3"},
    {"id": "confusion", "name": "困惑", "label": "想不明白的时候", "color": "#d4a75b"},
]


class CommunityPost(Base):
    """社区帖子表"""
    __tablename__ = "community_posts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    circle_id: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True
    )  # anxiety / sadness / growth / peace / confusion
    content: Mapped[str] = mapped_column(Text, nullable=False)
    images: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    collect_count: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hidden: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0",
        comment="管理员隐藏标记",
    )
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
        return f"<CommunityPost(id={self.id}, circle={self.circle_id}, anon={self.is_anonymous})>"


class PostComment(Base):
    """帖子评论表"""
    __tablename__ = "post_comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("post_comments.id", ondelete="CASCADE"),
        nullable=True
    )  # 回复某条评论
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<PostComment(id={self.id}, post_id={self.post_id})>"


class PostLike(Base):
    """帖子点赞表"""
    __tablename__ = "post_likes"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_user_post_like"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    post_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<PostLike(user_id={self.user_id}, post_id={self.post_id})>"


class PostCollect(Base):
    """帖子收藏表"""
    __tablename__ = "post_collects"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_user_post_collect"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    post_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<PostCollect(user_id={self.user_id}, post_id={self.post_id})>"


class PostView(Base):
    """帖子浏览记录表（只有点开详情才记录）"""
    __tablename__ = "post_views"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    post_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<PostView(user_id={self.user_id}, post_id={self.post_id})>"
