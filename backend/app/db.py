"""
数据库连接配置
支持SQLite和PostgreSQL
"""
from typing import AsyncGenerator
from sqlalchemy import BigInteger, Integer, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# 创建异步引擎
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,  # 调试模式打印SQL
    future=True
)

# 创建异步会话工厂
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    """所有模型的基类"""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取数据库会话（依赖注入）

    Yields:
        AsyncSession: 数据库会话
    """
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """
    初始化数据库
    创建所有表
    """
    async with engine.begin() as conn:
        # 导入所有模型以确保它们被注册到 Base.metadata
        from app.models.database import User, VerificationCode, CounselorApplication, CounselorBinding
        from app.models.diary import Diary, TimelineEvent, AIAnalysis, SocialPostSample, GrowthDailyInsight
        from app.models.community import CommunityPost, PostComment, PostLike, PostCollect, PostView
        from app.models.assistant import AssistantProfile, AssistantSession, AssistantMessage
        from app.models.integration import ExternalIntegrationToken

        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)

        # SQLite -> PostgreSQL 迁移后，部分表可能只有主键约束却没有默认序列。
        # 启动时做一次轻量自检，确保整数主键具备 nextval 默认值。
        if conn.dialect.name == "postgresql":
            for table in Base.metadata.sorted_tables:
                pk_columns = [column for column in table.columns if column.primary_key]
                if len(pk_columns) != 1:
                    continue

                pk_column = pk_columns[0]
                if not isinstance(pk_column.type, (Integer, BigInteger)):
                    continue

                default_query = text(
                    """
                    SELECT column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = :table_name
                      AND column_name = :column_name
                    """
                )
                default_value = await conn.scalar(
                    default_query,
                    {
                        "table_name": table.name,
                        "column_name": pk_column.name,
                    },
                )
                if default_value:
                    continue

                sequence_name = f"{table.name}_{pk_column.name}_seq"
                qualified_table = f'"{table.name}"'
                qualified_column = f'"{pk_column.name}"'
                qualified_sequence = f'"{sequence_name}"'

                await conn.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {qualified_sequence}"))
                await conn.execute(
                    text(
                        f"""
                        SELECT setval(
                            '{sequence_name}',
                            COALESCE((SELECT MAX({qualified_column}) FROM {qualified_table}), 0) + 1,
                            false
                        )
                        """
                    )
                )
                await conn.execute(
                    text(
                        f"""
                        ALTER TABLE {qualified_table}
                        ALTER COLUMN {qualified_column}
                        SET DEFAULT nextval('{sequence_name}')
                        """
                    )
                )
                await conn.execute(
                    text(
                        f"""
                        ALTER SEQUENCE {qualified_sequence}
                        OWNED BY {qualified_table}.{qualified_column}
                        """
                    )
                )
