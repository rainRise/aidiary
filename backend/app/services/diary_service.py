"""
日记业务逻辑服务
"""
from typing import Optional, List, Tuple, Dict, Any
from datetime import date, datetime
import json
import re
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.diary import Diary, TimelineEvent
from app.schemas.diary import DiaryCreate, DiaryUpdate, TimelineEventCreate
from app.agents.llm import deepseek_client


EVENT_TYPE_KEYWORDS: Dict[str, List[str]] = {
    "work": ["工作", "项目", "开发", "上线", "代码", "会议", "复盘", "学习", "创业", "任务"],
    "relationship": ["朋友", "家人", "同事", "导师", "沟通", "聊天", "关系", "争执", "支持"],
    "health": ["运动", "睡眠", "失眠", "身体", "生病", "健康", "饮食", "跑步", "疲惫", "嗓子"],
    "achievement": ["完成", "达成", "突破", "进步", "成功", "成果", "通过", "获奖", "签约"],
}


def _infer_event_type(text: str) -> str:
    for event_type, keywords in EVENT_TYPE_KEYWORDS.items():
        if any(k in text for k in keywords):
            return event_type
    return "other"


def _safe_text(text: Optional[str]) -> str:
    return (text or "").strip()


def _safe_parse_json(raw: str) -> Dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        raise ValueError("empty llm response")

    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        try:
            obj = json.loads(fenced.group(1).strip())
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass

    dec = json.JSONDecoder()
    first = text.find("{")
    if first != -1:
        obj, _ = dec.raw_decode(text[first:])
        if isinstance(obj, dict):
            return obj

    raise ValueError("cannot parse llm json")


class DiaryService:
    """日记服务类"""

    async def create_diary(
        self,
        db: AsyncSession,
        user_id: int,
        diary_data: DiaryCreate
    ) -> Diary:
        """
        创建日记

        Args:
            db: 数据库会话
            user_id: 用户ID
            diary_data: 日记数据

        Returns:
            Diary: 创建的日记对象
        """
        # 计算字数
        word_count = len(diary_data.content)

        # 创建日记对象
        diary = Diary(
            user_id=user_id,
            title=diary_data.title,
            content=diary_data.content,
            content_html=getattr(diary_data, 'content_html', None),
            diary_date=diary_data.diary_date or date.today(),
            emotion_tags=diary_data.emotion_tags,
            importance_score=diary_data.importance_score,
            images=diary_data.images,
            word_count=word_count
        )

        db.add(diary)
        await db.commit()
        await db.refresh(diary)

        return diary

    async def get_diary(
        self,
        db: AsyncSession,
        diary_id: int,
        user_id: int
    ) -> Optional[Diary]:
        """
        获取日记详情

        Args:
            db: 数据库会话
            diary_id: 日记ID
            user_id: 用户ID

        Returns:
            Optional[Diary]: 日记对象或None
        """
        result = await db.execute(
            select(Diary).where(
                and_(
                    Diary.id == diary_id,
                    Diary.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_diaries(
        self,
        db: AsyncSession,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        emotion_tag: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> Tuple[List[Diary], int]:
        """
        获取日记列表

        Args:
            db: 数据库会话
            user_id: 用户ID
            page: 页码（从1开始）
            page_size: 每页大小
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            emotion_tag: 情绪标签过滤（可选）
            keyword: 关键词搜索（标题+内容，可选）

        Returns:
            Tuple[List[Diary], int]: (日记列表, 总数)
        """
        # 构建查询条件
        conditions = [Diary.user_id == user_id]

        if start_date:
            conditions.append(Diary.diary_date >= start_date)
        if end_date:
            conditions.append(Diary.diary_date <= end_date)
        if emotion_tag:
            conditions.append(Diary.emotion_tags.contains([emotion_tag]))
        if keyword:
            kw = f"%{keyword}%"
            conditions.append(or_(Diary.title.ilike(kw), Diary.content.ilike(kw)))

        # 查询总数
        count_query = select(func.count(Diary.id)).where(and_(*conditions))
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # 查询日记列表
        query = (
            select(Diary)
            .where(and_(*conditions))
            .order_by(desc(Diary.diary_date), desc(Diary.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        result = await db.execute(query)
        diaries = result.scalars().all()

        return list(diaries), total

    async def update_diary(
        self,
        db: AsyncSession,
        diary_id: int,
        user_id: int,
        diary_data: DiaryUpdate
    ) -> Optional[Diary]:
        """
        更新日记

        Args:
            db: 数据库会话
            diary_id: 日记ID
            user_id: 用户ID
            diary_data: 更新数据

        Returns:
            Optional[Diary]: 更新后的日记对象或None
        """
        # 获取日记
        diary = await self.get_diary(db, diary_id, user_id)
        if not diary:
            return None

        # 更新字段
        update_data = diary_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(diary, field, value)

        # 如果内容有更新，重新计算字数
        if diary_data.content:
            diary.word_count = len(diary_data.content)

        await db.commit()
        await db.refresh(diary)

        return diary

    async def delete_diary(
        self,
        db: AsyncSession,
        diary_id: int,
        user_id: int
    ) -> bool:
        """
        删除日记

        Args:
            db: 数据库会话
            diary_id: 日记ID
            user_id: 用户ID

        Returns:
            bool: 是否删除成功
        """
        # 获取日记
        diary = await self.get_diary(db, diary_id, user_id)
        if not diary:
            return False

        await db.delete(diary)
        await db.commit()

        return True

    async def get_diaries_by_date(
        self,
        db: AsyncSession,
        user_id: int,
        target_date: date
    ) -> List[Diary]:
        """
        获取指定日期的所有日记

        Args:
            db: 数据库会话
            user_id: 用户ID
            target_date: 目标日期

        Returns:
            List[Diary]: 日记列表
        """
        result = await db.execute(
            select(Diary).where(
                and_(
                    Diary.user_id == user_id,
                    Diary.diary_date == target_date
                )
            ).order_by(desc(Diary.created_at))
        )
        return list(result.scalars().all())


class TimelineService:
    """时间轴服务类"""

    async def create_event(
        self,
        db: AsyncSession,
        user_id: int,
        event_data: TimelineEventCreate
    ) -> TimelineEvent:
        """
        创建时间轴事件

        Args:
            db: 数据库会话
            user_id: 用户ID
            event_data: 事件数据

        Returns:
            TimelineEvent: 创建的事件对象
        """
        # 防御性校验：若绑定了 diary_id，必须属于当前用户，避免跨用户脏数据
        if event_data.diary_id is not None:
            diary_result = await db.execute(
                select(Diary.id).where(
                    and_(
                        Diary.id == event_data.diary_id,
                        Diary.user_id == user_id
                    )
                ).limit(1)
            )
            diary_exists = diary_result.scalar_one_or_none()
            if diary_exists is None:
                raise ValueError("diary_id 不属于当前用户，拒绝创建时间轴事件")

        event = TimelineEvent(
            user_id=user_id,
            diary_id=event_data.diary_id,
            event_date=event_data.event_date,
            event_summary=event_data.event_summary,
            emotion_tag=event_data.emotion_tag,
            importance_score=event_data.importance_score,
            event_type=event_data.event_type,
            related_entities=event_data.related_entities
        )

        db.add(event)
        await db.commit()
        await db.refresh(event)

        return event

    def _build_event_payload_from_diary(self, diary: Diary) -> Dict:
        title = _safe_text(diary.title)
        content = _safe_text(diary.content)
        emotion_tag = (diary.emotion_tags or [None])[0]
        text_for_type = f"{title} {content[:120]}"

        if title and content:
            summary = f"{title}：{content[:56]}{'...' if len(content) > 56 else ''}"
        elif title:
            summary = title
        else:
            summary = f"{content[:72]}{'...' if len(content) > 72 else ''}" if content else "日记记录"

        return {
            "event_date": diary.diary_date,
            "event_summary": summary,
            "emotion_tag": emotion_tag,
            "importance_score": int(diary.importance_score or 5),
            "event_type": _infer_event_type(text_for_type),
            "related_entities": {
                "source": "diary_auto",
                "source_label": "日记自动摘要",
                "word_count": int(diary.word_count or 0),
            },
        }

    async def upsert_event_from_diary(
        self,
        db: AsyncSession,
        user_id: int,
        diary: Diary,
        force_overwrite_ai: bool = False
    ) -> TimelineEvent:
        """
        根据日记自动创建/更新时间轴事件（幂等，按 diary_id 唯一）。
        """
        payload = self._build_event_payload_from_diary(diary)
        existing_result = await db.execute(
            select(TimelineEvent).where(
                and_(
                    TimelineEvent.user_id == user_id,
                    TimelineEvent.diary_id == diary.id
                )
            ).limit(1)
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            current_source = ((existing.related_entities or {}).get("source") or "").strip()
            # AI提炼结果优先：默认不被规则重建覆盖
            if current_source == "ai_analysis" and not force_overwrite_ai:
                if existing.event_date != payload["event_date"]:
                    existing.event_date = payload["event_date"]
                    await db.commit()
                    await db.refresh(existing)
                return existing

            existing.event_date = payload["event_date"]
            existing.event_summary = payload["event_summary"]
            existing.emotion_tag = payload["emotion_tag"]
            existing.importance_score = payload["importance_score"]
            existing.event_type = payload["event_type"]
            existing.related_entities = payload["related_entities"]
            await db.commit()
            await db.refresh(existing)
            return existing

        event_data = TimelineEventCreate(
            diary_id=diary.id,
            event_date=payload["event_date"],
            event_summary=payload["event_summary"],
            emotion_tag=payload["emotion_tag"],
            importance_score=payload["importance_score"],
            event_type=payload["event_type"],
            related_entities=payload["related_entities"],
        )
        return await self.create_event(db, user_id, event_data)

    async def refine_event_from_diary_with_ai(
        self,
        db: AsyncSession,
        user_id: int,
        diary_id: int
    ) -> Optional[TimelineEvent]:
        """
        异步AI精炼单篇日记对应事件（生成更自然摘要与更准类型）。
        """
        diary_result = await db.execute(
            select(Diary).where(
                and_(
                    Diary.id == diary_id,
                    Diary.user_id == user_id
                )
            ).limit(1)
        )
        diary = diary_result.scalar_one_or_none()
        if not diary:
            return None

        # 确保先有基础事件（规则法）
        event = await self.upsert_event_from_diary(db, user_id, diary)

        title = _safe_text(diary.title) or "无标题"
        content = _safe_text(diary.content)
        prompt = (
            f"标题：{title}\n"
            f"日期：{diary.diary_date}\n"
            f"情绪标签：{', '.join(diary.emotion_tags or []) or '无'}\n"
            f"重要性：{int(diary.importance_score or 5)}/10\n"
            f"内容：\n{content[:1800]}\n\n"
            "请输出JSON：\n"
            "{\n"
            '  "event_summary":"50字以内中文事件摘要，具体不空泛",\n'
            '  "emotion_tag":"一个情绪标签（可为空）",\n'
            '  "importance_score":1-10整数,\n'
            '  "event_type":"work|relationship|health|achievement|other"\n'
            "}\n"
            "要求：不编造，不写“作者”，不使用模板腔。"
        )

        try:
            raw = await deepseek_client.chat_with_system(
                system_prompt="你是日记时间轴提炼助手，只输出JSON。",
                user_prompt=prompt,
                temperature=0.3,
                response_format="json",
            )
            parsed = _safe_parse_json(raw)
        except Exception:
            return event

        summary = _safe_text(parsed.get("event_summary"))[:120]
        emotion_tag = _safe_text(parsed.get("emotion_tag")) or None
        event_type = _safe_text(parsed.get("event_type")) or "other"
        if event_type not in {"work", "relationship", "health", "achievement", "other"}:
            event_type = "other"
        try:
            importance_score = int(parsed.get("importance_score") or event.importance_score or 5)
        except Exception:
            importance_score = int(event.importance_score or 5)
        importance_score = max(1, min(10, importance_score))

        if summary:
            event.event_summary = summary
        event.emotion_tag = emotion_tag or event.emotion_tag
        event.event_type = event_type
        event.importance_score = importance_score

        entities = event.related_entities or {}
        entities["source"] = "ai_analysis"
        entities["source_label"] = "AI提炼事件"
        entities["ai_refined_at"] = datetime.utcnow().isoformat()
        event.related_entities = entities

        await db.commit()
        await db.refresh(event)
        return event

    async def rebuild_events_for_user(
        self,
        db: AsyncSession,
        user_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 500
    ) -> Dict:
        """
        基于用户已有日记重建时间轴事件（不会跨用户，不会重复创建）。
        """
        conditions = [Diary.user_id == user_id]
        if start_date:
            conditions.append(Diary.diary_date >= start_date)
        if end_date:
            conditions.append(Diary.diary_date <= end_date)

        diaries_result = await db.execute(
            select(Diary).where(and_(*conditions)).order_by(desc(Diary.diary_date), desc(Diary.created_at)).limit(limit)
        )
        diaries = list(diaries_result.scalars().all())

        created_or_updated = 0
        for d in diaries:
            await self.upsert_event_from_diary(db, user_id, d)
            created_or_updated += 1

        return {
            "processed_diaries": len(diaries),
            "created_or_updated": created_or_updated,
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
        }

    async def get_timeline(
        self,
        db: AsyncSession,
        user_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 100
    ) -> List[TimelineEvent]:
        """
        获取时间轴事件列表

        Args:
            db: 数据库会话
            user_id: 用户ID
            start_date: 开始日期
            end_date: 结束日期
            limit: 返回数量限制

        Returns:
            List[TimelineEvent]: 事件列表
        """
        # 双重隔离：
        # 1) timeline_events.user_id 必须匹配
        # 2) 若事件关联 diary_id，则 diary 也必须属于当前用户
        diary_owner_subquery = select(Diary.id).where(Diary.user_id == user_id)
        conditions = [
            TimelineEvent.user_id == user_id,
            or_(
                TimelineEvent.diary_id.is_(None),
                TimelineEvent.diary_id.in_(diary_owner_subquery),
            ),
        ]

        if start_date:
            conditions.append(TimelineEvent.event_date >= start_date)
        if end_date:
            conditions.append(TimelineEvent.event_date <= end_date)

        result = await db.execute(
            select(TimelineEvent)
            .where(and_(*conditions))
            .order_by(desc(TimelineEvent.event_date), desc(TimelineEvent.importance_score))
            .limit(limit)
        )

        return list(result.scalars().all())

    async def get_events_by_date(
        self,
        db: AsyncSession,
        user_id: int,
        target_date: date
    ) -> List[TimelineEvent]:
        """
        获取指定日期的事件

        Args:
            db: 数据库会话
            user_id: 用户ID
            target_date: 目标日期

        Returns:
            List[TimelineEvent]: 事件列表
        """
        result = await db.execute(
            select(TimelineEvent).where(
                and_(
                    TimelineEvent.user_id == user_id,
                    TimelineEvent.event_date == target_date,
                    or_(
                        TimelineEvent.diary_id.is_(None),
                        TimelineEvent.diary_id.in_(
                            select(Diary.id).where(Diary.user_id == user_id)
                        ),
                    ),
                )
            ).order_by(desc(TimelineEvent.importance_score))
        )

        return list(result.scalars().all())

    async def get_recent_events(
        self,
        db: AsyncSession,
        user_id: int,
        days: int = 7
    ) -> List[TimelineEvent]:
        """
        获取最近N天的事件

        Args:
            db: 数据库会话
            user_id: 用户ID
            days: 天数

        Returns:
            List[TimelineEvent]: 事件列表
        """
        from datetime import timedelta

        start_date = date.today() - timedelta(days=days)

        return await self.get_timeline(
            db,
            user_id,
            start_date=start_date,
            limit=100
        )


# 创建全局实例
diary_service = DiaryService()
timeline_service = TimelineService()
