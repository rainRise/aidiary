"""
迁移脚本：给 external_integration_tokens 表添加 expires_at 字段
"""
import asyncio
from sqlalchemy import text
from app.db import engine


async def migrate():
    async with engine.begin() as conn:
        # 检查字段是否已存在
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='external_integration_tokens' AND column_name='expires_at'"
        ))
        if result.fetchone():
            print("[migrate] expires_at 字段已存在，跳过")
            return

        await conn.execute(text(
            "ALTER TABLE external_integration_tokens ADD COLUMN expires_at TIMESTAMPTZ"
        ))
        print("[migrate] 已添加 expires_at 字段")


if __name__ == "__main__":
    asyncio.run(migrate())
