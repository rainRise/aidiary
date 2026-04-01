"""
情绪地形图服务
将时间轴事件聚合为地形数据，检测峰谷，生成洞察
"""
from datetime import date, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from collections import defaultdict

from app.models.diary import TimelineEvent, Diary


# ==================== 情绪 → 愉悦度映射 ====================

EMOTION_VALENCE: Dict[str, float] = {
    # 正面高能量
    "开心": 0.9, "兴奋": 0.85, "激动": 0.85, "快乐": 0.9,
    "喜悦": 0.88, "欣喜": 0.85, "幸福": 0.92, "愉快": 0.8,
    # 正面中能量
    "感恩": 0.75, "满足": 0.7, "自豪": 0.78, "成就感": 0.82,
    "充实": 0.72, "踏实": 0.65, "欣慰": 0.68,
    # 中性偏正
    "平静": 0.4, "释然": 0.5, "期待": 0.55, "好奇": 0.5,
    "淡然": 0.35, "坦然": 0.4, "放松": 0.55,
    # 中性
    "平淡": 0.0, "一般": 0.0, "普通": 0.0, "正常": 0.0,
    # 负面轻度
    "困惑": -0.25, "纠结": -0.3, "犹豫": -0.2, "迷茫": -0.35,
    "无聊": -0.15, "疲惫": -0.3, "倦怠": -0.35,
    # 负面中度
    "担忧": -0.5, "焦虑": -0.6, "紧张": -0.55, "不安": -0.5,
    "烦躁": -0.55, "郁闷": -0.5, "压力": -0.5,
    # 负面重度
    "失落": -0.7, "难过": -0.75, "委屈": -0.65, "沮丧": -0.7,
    "孤独": -0.6, "无助": -0.7, "心酸": -0.65,
    # 负面高强度
    "愤怒": -0.8, "崩溃": -0.9, "绝望": -0.9, "恐惧": -0.85,
    "痛苦": -0.85, "悲伤": -0.8, "懊悔": -0.7,
}


def get_valence(emotion_tag: Optional[str]) -> float:
    """将情绪标签映射为愉悦度 (-1.0 ~ 1.0)"""
    if not emotion_tag:
        return 0.0
    tag = emotion_tag.strip()
    if tag in EMOTION_VALENCE:
        return EMOTION_VALENCE[tag]
    # 模糊匹配：看 tag 是否包含已知关键词
    for key, val in EMOTION_VALENCE.items():
        if key in tag or tag in key:
            return val
    return 0.0


# ==================== 峰谷检测 ====================

def detect_peaks_and_valleys(
    points: List[Dict],
    value_key: str = "energy",
    peak_threshold: float = 7.5,
    valley_threshold: float = 3.5,
) -> Tuple[List[Dict], List[Dict]]:
    """
    检测峰值和谷值
    峰：局部极大值且超过阈值
    谷：连续低值区域
    """
    if len(points) < 2:
        return [], []

    peaks = []
    valleys = []
    # 允许空值（无数据日），后续比较时跳过
    values = [p.get(value_key) for p in points]
    n = len(values)

    # 检测峰值（局部极大值）
    for i in range(n):
        v = values[i]
        if v is None:
            continue
        if v < peak_threshold:
            continue
        is_peak = True
        left = values[i - 1] if i > 0 else None
        right = values[i + 1] if i < n - 1 else None
        if left is not None and left >= v:
            is_peak = False
        if right is not None and right > v:
            is_peak = False
        if is_peak:
            peaks.append({
                "date": points[i]["date"],
                "value": v,
                "label": "能量高峰",
                "summary": _peak_summary(points[i]),
            })

    # 检测谷值（连续低值区域）
    i = 0
    while i < n:
        if values[i] is not None and values[i] <= valley_threshold:
            start = i
            while i < n and values[i] is not None and values[i] <= valley_threshold:
                i += 1
            end = i - 1
            # 至少有 1 天
            valley_points = points[start:end + 1]
            segment_values = [x for x in values[start:end + 1] if x is not None]
            min_val = min(segment_values) if segment_values else valley_threshold
            valleys.append({
                "date_range": [points[start]["date"], points[end]["date"]],
                "min_value": min_val,
                "days": end - start + 1,
                "label": "低谷期" if end - start >= 1 else "低落时刻",
                "summary": _valley_summary(valley_points),
            })
        else:
            i += 1

    return peaks, valleys


def _peak_summary(point: Dict) -> str:
    events = point.get("events", [])
    if events:
        best = max(events, key=lambda e: e.get("importance_score", 0))
        return best.get("summary", "能量高峰日")
    return "能量高峰日"


def _valley_summary(points: List[Dict]) -> str:
    if len(points) == 1:
        events = points[0].get("events", [])
        if events:
            return events[0].get("summary", "能量较低的一天")
        return "能量较低的一天"
    return f"持续{len(points)}天的低能量期"


# ==================== 趋势判断 ====================

def detect_trend(values: List[float]) -> Tuple[str, str]:
    """简单线性趋势判断"""
    if len(values) < 3:
        return "stable", "数据点较少，暂无法判断趋势"

    n = len(values)
    half = n // 2
    first_half_avg = sum(values[:half]) / half if half > 0 else 0
    second_half_avg = sum(values[half:]) / (n - half) if (n - half) > 0 else 0
    diff = second_half_avg - first_half_avg

    if diff > 1.0:
        return "ascending", f"近期能量整体呈上升趋势，后半段比前半段平均高 {diff:.1f} 分"
    elif diff < -1.0:
        return "descending", f"近期能量呈下降趋势，请多关注自己的状态"
    else:
        return "stable", "近期能量保持稳定"


# ==================== 核心服务 ====================

class TerrainService:
    """情绪地形图服务"""

    async def get_terrain_data(
        self,
        db: AsyncSession,
        user_id: int,
        days: int = 30,
        end_date: Optional[date] = None,
    ) -> Dict:
        """
        获取情绪地形图数据

        Args:
            db: 数据库会话
            user_id: 用户ID
            days: 天数范围
            end_date: 结束日期（默认今天）

        Returns:
            包含 points, insights, meta 的字典
        """
        if end_date is None:
            end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)

        # 1. 获取时间轴事件
        events = await self._fetch_events(db, user_id, start_date, end_date)

        # 2. 获取日记数据（用于补充没有时间轴事件的天数）
        diaries = await self._fetch_diaries(db, user_id, start_date, end_date)

        # 3. 按天聚合
        points = self._aggregate_by_day(events, diaries, start_date, end_date)

        # 4. 检测峰谷
        peaks, valleys = detect_peaks_and_valleys(points)

        # 5. 趋势判断
        energy_values = [p["energy"] for p in points if p["energy"] is not None]
        trend, trend_desc = detect_trend(energy_values)

        # 6. 统计
        total_events = sum(len(p.get("events", [])) for p in points)
        days_with_data = sum(1 for p in points if p.get("events"))

        return {
            "points": points,
            "insights": {
                "peaks": peaks,
                "valleys": valleys,
                "trend": trend,
                "trend_description": trend_desc,
            },
            "meta": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_events": total_events,
                "days_with_data": days_with_data,
                "total_days": days,
            },
        }

    async def _fetch_events(
        self, db: AsyncSession, user_id: int,
        start_date: date, end_date: date
    ) -> List[TimelineEvent]:
        """获取时间范围内的时间轴事件"""
        diary_owner_subquery = select(Diary.id).where(Diary.user_id == user_id)
        result = await db.execute(
            select(TimelineEvent)
            .where(and_(
                TimelineEvent.user_id == user_id,
                TimelineEvent.event_date >= start_date,
                TimelineEvent.event_date <= end_date,
                or_(
                    TimelineEvent.diary_id.is_(None),
                    TimelineEvent.diary_id.in_(diary_owner_subquery),
                ),
            ))
            .order_by(TimelineEvent.event_date)
        )
        return list(result.scalars().all())

    async def _fetch_diaries(
        self, db: AsyncSession, user_id: int,
        start_date: date, end_date: date
    ) -> List[Diary]:
        """获取时间范围内的日记"""
        result = await db.execute(
            select(Diary)
            .where(and_(
                Diary.user_id == user_id,
                Diary.diary_date >= start_date,
                Diary.diary_date <= end_date,
            ))
            .order_by(Diary.diary_date)
        )
        return list(result.scalars().all())

    def _aggregate_by_day(
        self,
        events: List[TimelineEvent],
        diaries: List[Diary],
        start_date: date,
        end_date: date,
    ) -> List[Dict]:
        """按天聚合数据"""
        # 按天分组事件
        events_by_day: Dict[str, List[TimelineEvent]] = defaultdict(list)
        for ev in events:
            key = ev.event_date.isoformat()
            events_by_day[key].append(ev)

        # 按天分组日记
        diaries_by_day: Dict[str, List[Diary]] = defaultdict(list)
        for d in diaries:
            key = d.diary_date.isoformat()
            diaries_by_day[key].append(d)

        points = []
        current = start_date
        while current <= end_date:
            key = current.isoformat()
            day_events = events_by_day.get(key, [])
            day_diaries = diaries_by_day.get(key, [])

            if day_events:
                # 有时间轴事件 → 用事件数据
                energy = max(ev.importance_score for ev in day_events)
                valence_values = [get_valence(ev.emotion_tag) for ev in day_events]
                valence = sum(valence_values) / len(valence_values) if valence_values else 0
                density = len(day_events)

                event_list = [
                    {
                        "id": ev.id,
                        "diary_id": ev.diary_id,
                        "summary": ev.event_summary,
                        "emotion_tag": ev.emotion_tag,
                        "importance_score": ev.importance_score,
                        "event_type": ev.event_type,
                        "source_label": (
                            (ev.related_entities or {}).get("source_label")
                            or ("AI提炼事件" if ev.diary_id else "系统记录")
                        ),
                    }
                    for ev in day_events
                ]
            elif day_diaries:
                # 只有日记，没有时间轴事件 → 从日记推断
                scores = [d.importance_score for d in day_diaries]
                energy = max(scores) if scores else 5
                tags = []
                for d in day_diaries:
                    if d.emotion_tags:
                        tags.extend(d.emotion_tags)
                valence_values = [get_valence(t) for t in tags] if tags else [0]
                valence = sum(valence_values) / len(valence_values)
                density = len(day_diaries)

                event_list = [
                    {
                        "id": None,
                        "diary_id": d.id,
                        "summary": d.title or (d.content[:60] + "..." if len(d.content) > 60 else d.content),
                        "emotion_tag": d.emotion_tags[0] if d.emotion_tags else None,
                        "importance_score": d.importance_score,
                        "event_type": None,
                        "source_label": "日记自动摘要",
                    }
                    for d in day_diaries
                ]
            else:
                # 无数据 → None（前端可平滑插值或跳过）
                energy = None
                valence = None
                density = 0
                event_list = []

            points.append({
                "date": key,
                "energy": energy,
                "valence": round(valence, 2) if valence is not None else None,
                "density": density,
                "events": event_list,
            })
            current += timedelta(days=1)

        return points


# 全局实例
terrain_service = TerrainService()
