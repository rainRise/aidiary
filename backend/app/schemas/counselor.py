"""
辅导员/心理老师认证相关 Pydantic Schemas
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BindingCreateRequest(BaseModel):
    """绑定范围创建请求"""
    scope_type: str = Field(
        ...,
        pattern="^(department|class)$",
        description="范围类型：department（院系）或 class（班级）",
    )
    scope_name: str = Field(..., min_length=1, max_length=100, description="范围名称")


class CounselorApplyRequest(BaseModel):
    """提交辅导员/心理老师认证申请"""
    target_role: str = Field(
        ...,
        pattern="^(counselor|psychologist)$",
        description="申请的目标角色：counselor（辅导员）或 psychologist（心理老师）",
    )
    real_name: str = Field(..., min_length=2, max_length=50, description="真实姓名")
    department: str = Field(..., min_length=1, max_length=100, description="所属院系/单位")
    employee_id: Optional[str] = Field(None, max_length=50, description="工号")
    phone: Optional[str] = Field(None, max_length=20, description="联系电话")
    qualification_images: Optional[list[str]] = Field(
        None, description="资质证明照片URL列表"
    )
    introduction: Optional[str] = Field(None, max_length=500, description="个人简介/申请说明")
    bindings: Optional[list[BindingCreateRequest]] = Field(
        None, description="申请绑定的范围（院系/班级）"
    )


class CounselorApplicationResponse(BaseModel):
    """认证申请响应"""
    id: int
    user_id: int
    target_role: str
    real_name: str
    department: str
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    qualification_images: Optional[list[str]] = None
    introduction: Optional[str] = None
    status: str
    reviewed_by: Optional[int] = None
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # 关联用户信息（列表页需要）
    user_email: Optional[str] = None
    user_username: Optional[str] = None

    class Config:
        from_attributes = True


class ApplicationReviewRequest(BaseModel):
    """管理员审核请求"""
    action: str = Field(
        ...,
        pattern="^(approve|reject)$",
        description="审核动作：approve（通过）或 reject（拒绝）",
    )
    comment: Optional[str] = Field(None, max_length=500, description="审核意见")


class BindingResponse(BaseModel):
    """绑定关系响应"""
    id: int
    user_id: int
    scope_type: str
    scope_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class CounselorApplicationListResponse(BaseModel):
    """认证申请列表响应（分页）"""
    items: list[CounselorApplicationResponse]
    total: int
    page: int
    page_size: int


class CounselorDashboardMetric(BaseModel):
    label: str
    value: int
    detail: Optional[str] = None


class CounselorTrendPoint(BaseModel):
    date: str
    diary_count: int
    active_students: int
    avg_importance: float


class CounselorEmotionStat(BaseModel):
    emotion: str
    count: int
    ratio: float


class CounselorFocusStudent(BaseModel):
    masked_name: str
    department: Optional[str] = None
    class_name: Optional[str] = None
    diary_count: int
    dominant_emotion: str
    risk_level: str
    note: str
    last_diary_date: Optional[str] = None


class CounselorWeeklyDigestPreview(BaseModel):
    week_start: Optional[str] = None
    sent_at: Optional[str] = None
    summary: Optional[dict] = None


class CounselorDashboardResponse(BaseModel):
    bindings: list[BindingResponse]
    metrics: list[CounselorDashboardMetric]
    trend: list[CounselorTrendPoint]
    emotion_distribution: list[CounselorEmotionStat]
    focus_students: list[CounselorFocusStudent]
    weekly_digest: Optional[CounselorWeeklyDigestPreview] = None
