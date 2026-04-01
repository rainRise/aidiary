"""
AI分析相关的 Pydantic Schemas
"""
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class AnalysisRequest(BaseModel):
    """分析请求"""
    diary_id: Optional[int] = Field(default=None, description="锚点日记ID（可选，用于确定分析时间窗口）")
    window_days: int = Field(default=30, ge=7, le=365, description="分析窗口天数（默认30天）")
    max_diaries: int = Field(default=40, ge=5, le=200, description="最多纳入分析的日记数（默认40）")


class ComprehensiveAnalysisRequest(BaseModel):
    """用户级综合分析请求"""
    window_days: int = Field(default=90, ge=14, le=365, description="分析窗口天数")
    max_diaries: int = Field(default=120, ge=20, le=500, description="最多纳入分析的日记数")
    focus: Optional[str] = Field(default=None, description="分析关注点（可选）")


class EvidenceItem(BaseModel):
    diary_id: int
    diary_date: str
    title: str
    snippet: str
    reason: str
    score: float


class ComprehensiveAnalysisResponse(BaseModel):
    """用户级综合分析响应"""
    summary: str
    key_themes: List[str]
    emotion_trends: List[str]
    continuity_signals: List[str]
    turning_points: List[str]
    growth_suggestions: List[str]
    evidence: List[EvidenceItem]
    metadata: Dict


class DailyGuidanceResponse(BaseModel):
    """每日AI引导问题响应"""
    question: str
    source: str = Field(description="ai 或 fallback")
    metadata: Dict


class SocialStyleSamplesRequest(BaseModel):
    """上传/更新社交风格样本"""
    samples: List[str] = Field(..., min_length=1, max_length=120, description="历史文案样本列表")
    replace: bool = Field(default=True, description="是否覆盖旧样本")


class SocialStyleSamplesResponse(BaseModel):
    """社交风格样本响应"""
    total: int
    samples: List[str]
    metadata: Dict

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
