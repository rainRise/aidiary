"""
日记相关的 Pydantic Schemas
"""
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field, field_validator


class DiaryCreate(BaseModel):
    """创建日记请求"""
    title: Optional[str] = Field(None, max_length=200, description="日记标题")
    content: str = Field(..., min_length=1, max_length=10000, description="日记内容")
    content_html: Optional[str] = Field(None, max_length=50000, description="日记HTML内容")
    diary_date: Optional[date] = Field(None, description="日记日期")
    emotion_tags: Optional[List[str]] = Field(None, description="情绪标签列表")
    importance_score: int = Field(default=5, ge=1, le=10, description="重要性评分（1-10）")
    images: Optional[List[str]] = Field(None, description="图片URL列表")

    @field_validator('diary_date', mode='before')
    @classmethod
    def set_default_date(cls, v):
        """如果没有提供日期，使用今天"""
        if v is None:
            return date.today()
        return v

    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        """验证内容不为空"""
        if not v or not v.strip():
            raise ValueError('日记内容不能为空')
        return v


class DiaryUpdate(BaseModel):
    """更新日记请求"""
    title: Optional[str] = Field(None, max_length=200, description="日记标题")
    content: Optional[str] = Field(None, min_length=1, max_length=10000, description="日记内容")
    content_html: Optional[str] = Field(None, max_length=50000, description="日记HTML内容")
    diary_date: Optional[date] = Field(None, description="日记日期")
    emotion_tags: Optional[List[str]] = Field(None, description="情绪标签列表")
    importance_score: Optional[int] = Field(None, ge=1, le=10, description="重要性评分（1-10）")
    images: Optional[List[str]] = Field(None, description="图片URL列表")
    is_analyzed: Optional[bool] = Field(None, description="是否已分析")


class DiaryResponse(BaseModel):
    """日记响应"""
    id: int
    user_id: int
    title: Optional[str]
    content: str
    content_html: Optional[str]
    diary_date: date
    emotion_tags: Optional[List[str]]
    importance_score: int
    word_count: int
    images: Optional[List[str]]
    is_analyzed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DiaryListResponse(BaseModel):
    """日记列表响应"""
    items: List[DiaryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TimelineEventCreate(BaseModel):
    """创建时间轴事件请求"""
    diary_id: Optional[int] = Field(None, description="关联的日记ID")
    event_date: date = Field(..., description="事件日期")
    event_summary: str = Field(..., min_length=1, max_length=500, description="事件摘要")
    emotion_tag: Optional[str] = Field(None, max_length=50, description="情绪标签")
    importance_score: int = Field(default=5, ge=1, le=10, description="重要性评分")
    event_type: Optional[str] = Field(None, max_length=50, description="事件类型")
    related_entities: Optional[dict] = Field(None, description="相关实体")


class TimelineEventResponse(BaseModel):
    """时间轴事件响应"""
    id: int
    user_id: int
    diary_id: Optional[int]
    event_date: date
    event_summary: str
    emotion_tag: Optional[str]
    importance_score: int
    event_type: Optional[str]
    related_entities: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True
