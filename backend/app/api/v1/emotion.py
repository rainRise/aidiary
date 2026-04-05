"""
情绪特征向量 & 聚类分析 API
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.db import get_db
from app.api.v1.auth import get_current_active_user
from app.models.database import User
from app.models.diary import Diary
from app.services.emotion_feature_service import (
    emotion_feature_extractor,
    emotion_cluster_engine,
)

router = APIRouter(prefix="/emotion")


@router.get("/cluster")
async def get_emotion_clusters(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(200, ge=5, le=500, description="分析的日记数量上限"),
):
    """
    获取用户日记的情绪聚类分析结果。

    算法流程:
    1. 获取用户最近 N 篇日记
    2. 对每篇日记提取 8 维情绪特征向量 (VAD + NLP特征)
    3. K-Means 聚类 (自动选 K)
    4. PCA 降维到 2D/3D
    5. 返回聚类结果 + 散点坐标 + 统计信息
    """
    result = await db.execute(
        select(Diary)
        .where(Diary.user_id == current_user.id)
        .order_by(desc(Diary.diary_date))
        .limit(limit)
    )
    diaries = list(result.scalars().all())

    if not diaries:
        return {
            "points": [],
            "clusters": [],
            "stats": {"total_diaries": 0, "num_clusters": 0},
            "pca_components": {},
        }

    # 提取特征向量
    texts = [d.content or "" for d in diaries]
    vectors = emotion_feature_extractor.batch_extract(texts)

    diary_ids = [d.id for d in diaries]
    diary_dates = [str(d.diary_date) for d in diaries]
    diary_titles = [d.title or "无标题" for d in diaries]

    # 聚类分析
    analysis = emotion_cluster_engine.analyze(
        vectors=vectors,
        diary_ids=diary_ids,
        diary_dates=diary_dates,
        diary_titles=diary_titles,
    )

    return analysis


@router.get("/analyze/{diary_id}")
async def analyze_single_diary(
    diary_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    分析单篇日记的情绪特征向量（含可读解释）。
    """
    result = await db.execute(
        select(Diary).where(Diary.id == diary_id, Diary.user_id == current_user.id)
    )
    diary = result.scalar_one_or_none()
    if not diary:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="日记不存在")

    explanation = emotion_feature_extractor.explain(diary.content or "")
    explanation["diary_id"] = diary.id
    explanation["diary_date"] = str(diary.diary_date)
    explanation["title"] = diary.title or "无标题"

    return explanation
