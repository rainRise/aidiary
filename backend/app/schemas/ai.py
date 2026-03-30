"""
AI分析相关的 Pydantic Schemas
"""
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class AnalysisRequest(BaseModel):
    """分析请求"""
    diary_id: int = Field(..., description="日记ID")

class TitleSuggestionRequest(BaseModel):
    """标题生成请求"""
    content: str = Field(..., min_length=10, max_length=10000, description="日记内容")
    current_title: Optional[str] = Field(default=None, max_length=200, description="当前标题")


class TitleSuggestionResponse(BaseModel):
    """标题生成响应"""
    title: str = Field(..., description="推荐标题")


class AnalysisResponse(BaseModel):
    """分析响应"""
    diary_id: int
    user_id: int
    timeline_event: Dict = Field(description="时间轴事件")
    satir_analysis: Dict = Field(description="萨提亚冰山分析")
    therapeutic_response: str = Field(description="疗愈回复")
    social_posts: List[Dict] = Field(description="朋友圈文案")
    metadata: Dict = Field(description="元数据")


class TimelineEventResponse(BaseModel):
    """时间轴事件响应"""
    event_summary: str
    emotion_tag: str
    importance_score: int
    event_type: str
    related_entities: Dict


class SatirAnalysisResponse(BaseModel):
    """萨提亚分析响应"""
    behavior_layer: Dict
    emotion_layer: Dict
    cognitive_layer: Dict
    belief_layer: Dict
    core_self_layer: Dict


class SocialPostResponse(BaseModel):
    """朋友圈文案响应"""
    version: str
    style: str
    content: str
