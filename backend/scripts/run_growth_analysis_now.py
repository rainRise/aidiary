"""
立即执行一次成长分析，跳过午夜定时等待。

用法：
  python scripts/run_growth_analysis_now.py --user-id 1 --days 180
  python scripts/run_growth_analysis_now.py --all --days 365
  python scripts/run_growth_analysis_now.py --user-id 1 --start-date 2026-01-01 --end-date 2026-04-22
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path
from datetime import date, timedelta

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.db import init_db
from app.services.scheduler_service import run_growth_analysis_for_range


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="立即执行一次成长分析")
    parser.add_argument("--user-id", type=int, default=None, help="指定用户 ID")
    parser.add_argument("--all", action="store_true", help="分析所有用户")
    parser.add_argument("--days", type=int, default=180, help="回溯天数，默认 180 天")
    parser.add_argument("--start-date", type=str, default=None, help="开始日期，格式 YYYY-MM-DD")
    parser.add_argument("--end-date", type=str, default=None, help="结束日期，格式 YYYY-MM-DD")
    return parser.parse_args()


def resolve_date_range(args: argparse.Namespace) -> tuple[date, date]:
    if args.start_date or args.end_date:
        if not (args.start_date and args.end_date):
            raise SystemExit("使用 --start-date / --end-date 时必须同时提供这两个参数")
        return date.fromisoformat(args.start_date), date.fromisoformat(args.end_date)

    end = date.today()
    start = end - timedelta(days=max(args.days - 1, 0))
    return start, end


async def main() -> None:
    args = parse_args()
    if not args.user_id and not args.all:
        raise SystemExit("请提供 --user-id 或 --all")

    start_date, end_date = resolve_date_range(args)

    await init_db()
    stats = await run_growth_analysis_for_range(
        start_date=start_date,
        end_date=end_date,
        user_id=args.user_id,
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
