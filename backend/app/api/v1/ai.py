"""
AI分析相关的API端点
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
from app.models.diary import Diary
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
    对日记进行完整的AI分析

    分析流程：
    1. 收集用户上下文
    2. 提取时间轴事件
    3. 萨提亚冰山五层分析
    4. 生成疗愈回复
    5. 生成朋友圈文案
    """
    # 获取日记
    diary = await diary_service.get_diary(db, request.diary_id, current_user.id)

    if not diary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日记不存在"
        )

    # 获取用户画像（简化版，实际应该从user_profiles表获取）
    user_profile = {
        "username": current_user.username or "用户",
        "identity_tag": "通用",
        "current_state": "正常",
        "personality_type": "INFP",
        "social_style": "真实",
        "catchphrases": []
    }

    # 获取时间轴上下文（最近7天）
    from datetime import timedelta, date
    start_date = date.today() - timedelta(days=7)
    timeline_events = await timeline_service.get_timeline(
        db,
        current_user.id,
        start_date=start_date,
        limit=10
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
            diary_id=request.diary_id,
            diary_content=diary.content,
            diary_date=diary.diary_date,
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
    # 简化实现：从ai_analyses表查询
    # 实际应该创建ai_analyses表来存储分析历史

    # 暂时返回空列表
    return {
        "analyses": [],
        "total": 0,
        "message": "分析历史功能待实现"
    }


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
