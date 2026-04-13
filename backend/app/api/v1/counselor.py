"""
辅导员/心理老师认证 API 端点

RESTful 规范：
- POST   /counselor/applications        提交认证申请
- GET    /counselor/applications/me     查看我的申请
- GET    /counselor/bindings            查看我的绑定范围
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models.database import User, CounselorApplication, CounselorBinding, ApplicationStatus
from app.schemas.counselor import (
    CounselorApplyRequest,
    CounselorApplicationResponse,
    BindingResponse,
)
from app.core.deps import get_current_active_user

router = APIRouter(prefix="/counselor", tags=["辅导员/心理老师"])


# ==================== 认证申请 ====================

@router.post(
    "/applications",
    response_model=CounselorApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="提交辅导员/心理老师认证申请",
)
async def submit_application(
    data: CounselorApplyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    提交辅导员/心理老师认证申请。

    - 已有 pending 状态的申请不可重复提交
    - 已是 counselor/psychologist 角色无需再申请
    """
    # 已是目标角色，无需申请
    if current_user.role == data.target_role:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"您已是 {data.target_role} 角色，无需重复申请",
        )

    # 检查是否有 pending 状态的申请
    existing = await db.execute(
        select(CounselorApplication).where(
            CounselorApplication.user_id == current_user.id,
            CounselorApplication.status == ApplicationStatus.pending.value,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="您已有待审核的申请，请等待管理员处理",
        )

    # 创建申请记录
    application = CounselorApplication(
        user_id=current_user.id,
        target_role=data.target_role,
        real_name=data.real_name,
        department=data.department,
        employee_id=data.employee_id,
        phone=data.phone,
        qualification_images=data.qualification_images or [],
        introduction=data.introduction,
    )
    db.add(application)

    # 如果同时提交了绑定范围，一并创建
    if data.bindings:
        for binding in data.bindings:
            db.add(CounselorBinding(
                user_id=current_user.id,
                scope_type=binding.scope_type,
                scope_name=binding.scope_name,
            ))

    await db.commit()
    await db.refresh(application)

    return CounselorApplicationResponse(
        id=application.id,
        user_id=application.user_id,
        target_role=application.target_role,
        real_name=application.real_name,
        department=application.department,
        employee_id=application.employee_id,
        phone=application.phone,
        qualification_images=application.qualification_images,
        introduction=application.introduction,
        status=application.status,
        reviewed_by=application.reviewed_by,
        review_comment=application.review_comment,
        reviewed_at=application.reviewed_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
        user_email=current_user.email,
        user_username=current_user.username,
    )


@router.get(
    "/applications/me",
    response_model=CounselorApplicationResponse,
    summary="查看我的认证申请",
)
async def get_my_application(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """查看当前用户的认证申请（最新一条）"""
    result = await db.execute(
        select(CounselorApplication)
        .where(CounselorApplication.user_id == current_user.id)
        .order_by(CounselorApplication.created_at.desc())
        .limit(1)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="暂无认证申请记录",
        )

    return CounselorApplicationResponse(
        id=application.id,
        user_id=application.user_id,
        target_role=application.target_role,
        real_name=application.real_name,
        department=application.department,
        employee_id=application.employee_id,
        phone=application.phone,
        qualification_images=application.qualification_images,
        introduction=application.introduction,
        status=application.status,
        reviewed_by=application.reviewed_by,
        review_comment=application.review_comment,
        reviewed_at=application.reviewed_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
        user_email=current_user.email,
        user_username=current_user.username,
    )


# ==================== 绑定范围 ====================

@router.get(
    "/bindings",
    response_model=list[BindingResponse],
    summary="查看我的绑定范围",
)
async def get_my_bindings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """查看当前辅导员/心理老师的绑定范围（院系/班级）"""
    result = await db.execute(
        select(CounselorBinding)
        .where(CounselorBinding.user_id == current_user.id)
        .order_by(CounselorBinding.scope_type, CounselorBinding.scope_name)
    )
    bindings = result.scalars().all()
    return [BindingResponse.model_validate(b) for b in bindings]
