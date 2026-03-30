"""
AI分析相关的API端点
"""
from typing import Optional
from datetime import timedelta, date
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc

from app.db import get_db
from app.schemas.ai import (
    AnalysisRequest,
    AnalysisResponse,
    TitleSuggestionRequest,
    TitleSuggestionResponse,
)
from app.agents.orchestrator import agent_orchestrator
from app.agents.llm import deepseek_client
from app.core.deps import get_current_active_user
from app.models.database import User
from app.models.diary import Diary, TimelineEvent, AIAnalysis
from app.schemas.diary import TimelineEventCreate
from app.services.diary_service import diary_service, timeline_service

router = APIRouter(prefix="/ai", tags=["AI分析"])


@router.post("/generate-title", response_model=TitleSuggestionResponse, summary="AI生成日记标题")
async def generate_title(
    request: TitleSuggestionRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    根据日记内容生成简洁、有画面感的中文标题
    """
    content = (request.content or "").strip()
    if len(content) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="内容太短，请至少输入10个字后再生成标题"
        )

    system_prompt = (
        "你是资深中文编辑。请为日记生成1个有品位的标题。"
        "要求：10字以内；简洁自然；避免鸡汤口号；避免引号和表情；只返回标题本身。"
    )
    user_prompt = (
        f"当前标题（可为空）：{request.current_title or '无'}\n"
        f"日记内容：\n{content[:2000]}"
    )

    try:
        raw = await deepseek_client.chat_with_system(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
        )
        title = (raw or "").strip().replace("\n", " ")
        if "：" in title:
            title = title.split("：", 1)[-1].strip()
        if len(title) > 20:
            title = title[:20].strip()
        if not title:
            title = "今日片段"
        return TitleSuggestionResponse(title=title)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"标题生成失败: {str(e)}"
        )


@router.post("/analyze", response_model=AnalysisResponse, summary="分析日记（异步）")
async def analyze_diary(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    对用户多篇日记进行整合AI分析（用户级）

    分析流程：
    1. 聚合分析窗口内的多篇日记
    2. 收集用户上下文与时间轴
    3. 萨提亚冰山五层分析
    4. 生成疗愈回复
    5. 生成朋友圈文案
    """
    anchor_diary = None
    if request.diary_id is not None:
        anchor_diary = await diary_service.get_diary(db, request.diary_id, current_user.id)
        if not anchor_diary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="锚点日记不存在"
            )

    anchor_date = anchor_diary.diary_date if anchor_diary else date.today()
    start_date = anchor_date - timedelta(days=request.window_days - 1)

    diaries_result = await db.execute(
        select(Diary).where(
            and_(
                Diary.user_id == current_user.id,
                Diary.diary_date >= start_date,
                Diary.diary_date <= anchor_date,
            )
        ).order_by(desc(Diary.diary_date), desc(Diary.created_at)).limit(request.max_diaries)
    )
    diaries = list(diaries_result.scalars().all())

    # 如果窗口内没有数据，退化为取最近N篇
    if not diaries:
        fallback_result = await db.execute(
            select(Diary).where(
                Diary.user_id == current_user.id
            ).order_by(desc(Diary.diary_date), desc(Diary.created_at)).limit(request.max_diaries)
        )
        diaries = list(fallback_result.scalars().all())

    if not diaries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="暂无可分析的日记，请先写至少一篇日记"
        )

    # 按时间正序组织，构建用户级整合语料
    diaries_sorted = list(sorted(diaries, key=lambda d: (d.diary_date, d.created_at)))
    combined_sections = []
    for d in diaries_sorted:
        content = (d.content or "").strip()
        if len(content) > 1200:
            content = content[:1200] + "..."
        combined_sections.append(
            f"【日期】{d.diary_date}\n"
            f"【标题】{d.title or '无标题'}\n"
            f"【情绪标签】{', '.join(d.emotion_tags or []) or '无'}\n"
            f"【重要性】{d.importance_score}/10\n"
            f"【正文】\n{content}"
        )
    integrated_content = "\n\n---\n\n".join(combined_sections)

    # 获取用户画像（简化版，实际应该从user_profiles表获取）
    emotion_counter = {}
    importance_sum = 0
    for d in diaries_sorted:
        importance_sum += d.importance_score or 5
        for tag in (d.emotion_tags or []):
            emotion_counter[tag] = emotion_counter.get(tag, 0) + 1
    top_emotions = [k for k, _ in sorted(emotion_counter.items(), key=lambda x: x[1], reverse=True)[:3]]
    avg_importance = round(importance_sum / max(len(diaries_sorted), 1), 2)

    user_profile = {
        "username": current_user.username or "用户",
        "identity_tag": "通用",
        "current_state": "正常",
        "personality_type": "INFP",
        "social_style": "真实",
        "catchphrases": [],
        "analysis_scope": "user_integrated",
        "diary_count": len(diaries_sorted),
        "top_emotions": top_emotions,
        "avg_importance": avg_importance,
        "window_start": str(diaries_sorted[0].diary_date),
        "window_end": str(diaries_sorted[-1].diary_date),
    }

    # 获取时间轴上下文（与分析窗口保持一致）
    timeline_events = await timeline_service.get_timeline(
        db,
        current_user.id,
        start_date=start_date,
        end_date=anchor_date,
        limit=min(max(request.max_diaries, 20), 200)
    )

    timeline_context = [
        {
            "date": str(event.event_date),
            "summary": event.event_summary,
            "emotion": event.emotion_tag or "未分类"
        }
        for event in timeline_events
    ]

    # 执行分析
    try:
        state = await agent_orchestrator.analyze_diary(
            user_id=current_user.id,
            diary_id=anchor_diary.id if anchor_diary else diaries_sorted[-1].id,
            diary_content=integrated_content,
            diary_date=anchor_date,
            user_profile=user_profile,
            timeline_context=timeline_context
        )

        # 格式化结果
        result = agent_orchestrator.format_result(state)

        # 如果有错误，返回特殊响应
        if state.get("error"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"分析失败: {state['error']}"
            )

        # 持久化分析结果：更新/创建时间轴事件 + 标记日记已分析
        try:
            timeline_event = state.get("timeline_event") or {}
            summary = (timeline_event.get("event_summary") or "").strip()
            if summary:
                # 用户级整合分析：将事件挂到锚点日记（有锚点）或最新日记（无锚点）
                target_diary = anchor_diary or diaries_sorted[-1]
                existing_event_result = await db.execute(
                    select(TimelineEvent).where(
                        TimelineEvent.diary_id == target_diary.id
                    ).limit(1)
                )
                existing_event = existing_event_result.scalar_one_or_none()

                if existing_event:
                    existing_event.event_date = target_diary.diary_date
                    existing_event.event_summary = summary
                    existing_event.emotion_tag = timeline_event.get("emotion_tag")
                    existing_event.importance_score = int(timeline_event.get("importance_score") or 5)
                    existing_event.event_type = timeline_event.get("event_type")
                    existing_event.related_entities = timeline_event.get("related_entities") or {}
                else:
                    event_data = TimelineEventCreate(
                        diary_id=target_diary.id,
                        event_date=target_diary.diary_date,
                        event_summary=summary,
                        emotion_tag=timeline_event.get("emotion_tag"),
                        importance_score=int(timeline_event.get("importance_score") or 5),
                        event_type=timeline_event.get("event_type"),
                        related_entities=timeline_event.get("related_entities") or {},
                    )
                    await timeline_service.create_event(db, current_user.id, event_data)

            # 将窗口内日记都标记为已分析，体现“整合分析”语义
            for d in diaries_sorted:
                d.is_analyzed = True
            await db.commit()
            if anchor_diary:
                await db.refresh(anchor_diary)
        except Exception as persist_err:
            # 不阻断主分析结果返回，但把告警写入metadata
            await db.rollback()
            result.setdefault("metadata", {})
            result["metadata"]["persist_warning"] = str(persist_err)

        result.setdefault("metadata", {})
        result["metadata"]["analysis_scope"] = "user_integrated"
        result["metadata"]["analyzed_diary_count"] = len(diaries_sorted)
        result["metadata"]["analyzed_period"] = {
            "start_date": str(diaries_sorted[0].diary_date),
            "end_date": str(diaries_sorted[-1].diary_date),
            "anchor_date": str(anchor_date),
            "window_days": request.window_days,
        }
        result["metadata"]["analyzed_diary_ids"] = [d.id for d in diaries_sorted]

        # 持久化分析结果（供“查看分析结果”直接读取，避免重复运行）
        try:
            target_diary = anchor_diary or diaries_sorted[-1]
            analysis_result_for_save = dict(result)
            analysis_result_for_save.setdefault("metadata", {})
            analysis_result_for_save["metadata"]["saved_for_diary_id"] = target_diary.id

            existing_analysis_result = await db.execute(
                select(AIAnalysis).where(
                    AIAnalysis.user_id == current_user.id,
                    AIAnalysis.diary_id == target_diary.id
                ).limit(1)
            )
            existing_analysis = existing_analysis_result.scalar_one_or_none()
            if existing_analysis:
                existing_analysis.result_json = analysis_result_for_save
            else:
                db.add(AIAnalysis(
                    user_id=current_user.id,
                    diary_id=target_diary.id,
                    result_json=analysis_result_for_save
                ))
            await db.commit()
        except Exception as save_result_err:
            await db.rollback()
            result.setdefault("metadata", {})
            result["metadata"]["result_save_warning"] = str(save_result_err)

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分析失败: {str(e)}"
        )


@router.post("/analyze-async", summary="异步分析日记（后台任务）")
async def analyze_diary_async(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    异步分析日记（后台任务模式）

    返回任务ID，可通过GET /ai/analyze/{taskId}查询结果
    """
    # 简化实现：直接同步执行
    # 在生产环境中，应该使用Celery或类似的后台任务系统

    result = await analyze_diary(request, background_tasks, current_user, db)

    return result


@router.get("/analyses", summary="获取历史分析记录")
async def get_analyses(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取用户的历史分析记录
    """
    result = await db.execute(
        select(AIAnalysis).where(
            AIAnalysis.user_id == current_user.id
        ).order_by(AIAnalysis.updated_at.desc()).limit(100)
    )
    rows = list(result.scalars().all())
    return {
        "analyses": [
            {
                "id": row.id,
                "diary_id": row.diary_id,
                "updated_at": row.updated_at,
                "metadata": (row.result_json or {}).get("metadata", {})
            }
            for row in rows
        ],
        "total": len(rows)
    }


@router.get("/result/{diary_id}", response_model=AnalysisResponse, summary="获取指定日记最近一次分析结果")
async def get_analysis_result(
    diary_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定日记最近一次已保存的分析结果
    """
    result = await db.execute(
        select(AIAnalysis).where(
            AIAnalysis.user_id == current_user.id,
            AIAnalysis.diary_id == diary_id
        ).limit(1)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该日记暂无已保存分析结果"
        )
    return row.result_json


@router.post("/satir-analysis", summary="萨提亚冰山分析")
async def satir_analysis(
    request: AnalysisRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    仅执行萨提亚冰山模型分析

    不包含时间轴提取和社交文案生成
    """
    # 获取日记
    diary = await diary_service.get_diary(db, request.diary_id, current_user.id)

    if not diary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日记不存在"
        )

    # 简化实现：返回模拟分析
    return {
        "diary_id": diary.id,
        "satir_analysis": {
            "behavior_layer": {
                "event": diary.content[:100] + "..."
            },
            "emotion_layer": {
                "surface_emotion": "待分析",
                "underlying_emotion": "待分析",
                "emotion_intensity": 5,
                "emotion_analysis": "请使用完整分析功能"
            },
            "cognitive_layer": {
                "irrational_beliefs": [],
                "automatic_thoughts": []
            },
            "belief_layer": {
                "core_beliefs": [],
                "life_rules": [],
                "belief_analysis": ""
            },
            "core_self_layer": {
                "yearnings": [],
                "life_energy": "未知",
                "deepest_desire": "未识别",
                "existence_insight": "请使用完整分析功能"
            }
        },
        "therapeutic_response": "这是简化版分析。请使用 /ai/analyze 获取完整分析。",
        "metadata": {
            "analysis_type": "satir_only",
            "processing_time": 0
        }
    }


@router.post("/social-posts", summary="生成朋友圈文案")
async def generate_social_posts(
    request: AnalysisRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    仅生成朋友圈文案

    不包含萨提亚分析
    """
    # 获取日记
    diary = await diary_service.get_diary(db, request.diary_id, current_user.id)

    if not diary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日记不存在"
        )

    # 简化实现：返回模拟文案
    content_preview = diary.content[:50] + "..." if len(diary.content) > 50 else diary.content

    return {
        "diary_id": diary.id,
        "social_posts": [
            {
                "version": "A",
                "style": "简洁版",
                "content": content_preview
            },
            {
                "version": "B",
                "style": "完整版",
                "content": diary.content[:100] if len(diary.content) > 100 else diary.content
            },
            {
                "version": "C",
                "style": "感悟版",
                "content": f"关于{diary.title or '今天'}的一些感悟"
            }
        ],
        "metadata": {
            "generation_type": "social_only",
            "processing_time": 0
        }
    }


@router.get("/models", summary="获取AI模型信息")
async def get_ai_models():
    """
    获取可用的AI模型信息

    用于前端展示AI能力
    """
    return {
        "available_models": [
            {
                "name": "DeepSeek V3",
                "provider": "DeepSeek",
                "type": "LLM",
                "features": ["萨提亚分析", "文案生成", "情感分析"]
            }
        ],
        "agent_system": {
            "name": "Multi-Agent System",
            "version": "1.0",
            "agents": [
                {"id": 0, "name": "Context Collector", "description": "上下文收集器"},
                {"id": 1, "name": "Timeline Manager", "description": "时间线管家"},
                {"id": 2, "name": "Satir Therapist", "description": "萨提亚分析师"},
                {"id": 3, "name": "Social Content Creator", "description": "社交内容生成"}
            ]
        }
    }
