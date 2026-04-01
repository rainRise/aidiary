"""
按用户重建 timeline_events（幂等）。

用法：
  python3 scripts/rebuild_timeline_events.py --user-id 1 --days 365
  python3 scripts/rebuild_timeline_events.py --all --days 180
"""
import argparse
import asyncio
from datetime import date, timedelta

from sqlalchemy import select

from app.db import async_session_maker
from app.models.database import User
from app.services.diary_service import timeline_service


async def rebuild_for_user(user_id: int, days: int) -> dict:
    end = date.today()
    start = end - timedelta(days=max(days - 1, 0))
    async with async_session_maker() as db:
        stats = await timeline_service.rebuild_events_for_user(
            db=db,
            user_id=user_id,
            start_date=start,
            end_date=end,
            limit=max(days * 3, 500),
        )
        return stats


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", type=int, default=None, help="指定用户ID")
    parser.add_argument("--all", action="store_true", help="重建全部用户")
    parser.add_argument("--days", type=int, default=365, help="回溯天数")
    args = parser.parse_args()

    if not args.user_id and not args.all:
        raise SystemExit("请提供 --user-id 或 --all")

    if args.user_id:
        stats = await rebuild_for_user(args.user_id, args.days)
        print(f"[user={args.user_id}] {stats}")
        return

    async with async_session_maker() as db:
        result = await db.execute(select(User.id).where(User.is_active == True))  # noqa: E712
        user_ids = [row[0] for row in result.all()]

    for uid in user_ids:
        stats = await rebuild_for_user(uid, args.days)
        print(f"[user={uid}] {stats}")


if __name__ == "__main__":
    asyncio.run(main())
