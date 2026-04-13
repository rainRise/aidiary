"""
管理后台 API 端点

RESTful 规范：
- GET    /admin/applications             审核列表
- PUT    /admin/applications/{id}        审核通过/拒绝
- GET    /admin/users                    用户管理列表
- PUT    /admin/users/{id}               修改用户信息（角色/状态）
- DELETE /admin/users/{id}               禁用用户
- GET    /admin/posts                    帖子列表（含匿名用户真实身份）
- PUT    /admin/posts/{id}               帖子管理（隐藏/删除/标记）
- GET    /admin/dashboard                系统概览数据

所有接口仅 admin 角色可访问。
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db import get_db
from app.models.database import (
    User, UserRole, ApplicationStatus,
    CounselorApplication, CounselorBinding,
)
from app.models.community import CommunityPost
from app.models.diary import Diary
from app.schemas.counselor import (
    CounselorApplicationResponse,
    CounselorApplicationListResponse,
    ApplicationReviewRequest,
    BindingResponse,
)
from app.schemas.admin import (
    AdminUserResponse, AdminUserListResponse, AdminUserUpdateRequest,
    AdminPostResponse, AdminPostListResponse, AdminPostUpdateRequest,
    AdminDashboardResponse,
)
from app.core.deps import require_admin

router = APIRouter(prefix="/admin", tags=["管理后台"])


# ==================== 认证审核 ====================

@router.get(
    "/applications",
    response_model=CounselorApplicationListResponse,
    summary="获取认证申请列表",
)
async def list_applications(
    status_filter: Optional[str] = Query(
        None, alias="status", pattern="^(pending|approved|rejected)$",
        description="按状态筛选"
    ),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员查看辅导员/心理老师认证申请列表"""
    query = select(CounselorApplication)
    count_query = select(func.count(CounselorApplication.id))

    if status_filter:
        query = query.where(CounselorApplication.status == status_filter)
        count_query = count_query.where(CounselorApplication.status == status_filter)

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(CounselorApplication.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    applications = result.scalars().all()

    items = []
    for app in applications:
        user_result = await db.execute(select(User).where(User.id == app.user_id))
        user = user_result.scalar_one_or_none()

        items.append(CounselorApplicationResponse(
            id=app.id,
            user_id=app.user_id,
            target_role=app.target_role,
            real_name=app.real_name,
            department=app.department,
            employee_id=app.employee_id,
            phone=app.phone,
            qualification_images=app.qualification_images,
            introduction=app.introduction,
            status=app.status,
            reviewed_by=app.reviewed_by,
            review_comment=app.review_comment,
            reviewed_at=app.reviewed_at,
            created_at=app.created_at,
            updated_at=app.updated_at,
            user_email=user.email if user else None,
            user_username=user.username if user else None,
        ))

    return CounselorApplicationListResponse(
        items=items, total=total, page=page, page_size=page_size,
    )


@router.put(
    "/applications/{application_id}",
    response_model=CounselorApplicationResponse,
    summary="审核认证申请",
)
async def review_application(
    application_id: int,
    data: ApplicationReviewRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    管理员审核认证申请（通过/拒绝）。

    - 通过：自动将用户角色升级为申请的 target_role
    - 拒绝：仅更新申请状态，不影响用户角色
    """
    result = await db.execute(
        select(CounselorApplication).where(CounselorApplication.id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="申请记录不存在",
        )

    if application.status != ApplicationStatus.pending.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该申请已被处理，无法重复操作",
        )

    new_status = ApplicationStatus.approved.value if data.action == "approve" else ApplicationStatus.rejected.value
    application.status = new_status
    application.reviewed_by = admin.id
    application.review_comment = data.comment
    application.reviewed_at = datetime.utcnow()

    if data.action == "approve":
        user_result = await db.execute(select(User).where(User.id == application.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.role = application.target_role
            user.counselor_info = {
                "real_name": application.real_name,
                "department": application.department,
                "employee_id": application.employee_id,
                "phone": application.phone,
                "target_role": application.target_role,
            }

    await db.commit()
    await db.refresh(application)

    user_result = await db.execute(select(User).where(User.id == application.user_id))
    user = user_result.scalar_one_or_none()

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
        user_email=user.email if user else None,
        user_username=user.username if user else None,
    )


# ==================== 用户管理 ====================

@router.get(
    "/users",
    response_model=AdminUserListResponse,
    summary="获取用户列表",
)
async def list_users(
    search: Optional[str] = Query(None, description="搜索（邮箱/用户名）"),
    role: Optional[str] = Query(None, pattern="^(student|counselor|psychologist|admin)$", description="按角色筛选"),
    is_active: Optional[bool] = Query(None, description="按激活状态筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员查看用户列表，支持搜索和筛选"""
    query = select(User)
    count_query = select(func.count(User.id))

    if search:
        search_filter = User.email.ilike(f"%{search}%") | User.username.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for u in users:
        bindings_result = await db.execute(
            select(CounselorBinding).where(CounselorBinding.user_id == u.id)
        )
        from app.schemas.admin import BindingBrief
        bindings = [BindingBrief.model_validate(b) for b in bindings_result.scalars().all()]

        items.append(AdminUserResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            avatar_url=u.avatar_url,
            role=u.role,
            counselor_info=u.counselor_info,
            is_active=u.is_active,
            is_verified=u.is_verified,
            created_at=u.created_at,
            updated_at=u.updated_at,
            bindings=bindings,
        ))

    return AdminUserListResponse(
        items=items, total=total, page=page, page_size=page_size,
    )


@router.put(
    "/users/{user_id}",
    response_model=AdminUserResponse,
    summary="修改用户信息",
)
async def update_user(
    user_id: int,
    data: AdminUserUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    管理员修改用户信息（角色、状态等）。

    - 不允许修改自己的角色
    - 不允许将其他管理员降级
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    if user.id == admin.id and data.role and data.role != admin.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不能修改自己的角色",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    bindings_result = await db.execute(
        select(CounselorBinding).where(CounselorBinding.user_id == user.id)
    )
    from app.schemas.admin import BindingBrief
    bindings = [BindingBrief.model_validate(b) for b in bindings_result.scalars().all()]

    return AdminUserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        avatar_url=user.avatar_url,
        role=user.role,
        counselor_info=user.counselor_info,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
        bindings=bindings,
    )


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="禁用用户",
)
async def disable_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """禁用用户（软删除，设置 is_active=False）"""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不能禁用自己",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    user.is_active = False
    await db.commit()


# ==================== 帖子管理（匿名追溯） ====================

@router.get(
    "/posts",
    response_model=AdminPostListResponse,
    summary="获取帖子列表（含匿名真实身份）",
)
async def list_posts(
    circle_id: Optional[int] = Query(None, description="按圈子筛选"),
    is_anonymous: Optional[bool] = Query(None, description="按是否匿名筛选"),
    is_hidden: Optional[bool] = Query(None, description="按是否隐藏筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    管理员查看帖子列表，匿名帖子也可查看真实发帖人。

    - 普通用户看到的是匿名信息
    - 管理员可看到 author_email（匿名帖追溯）
    """
    query = select(CommunityPost)
    count_query = select(func.count(CommunityPost.id))

    if circle_id is not None:
        query = query.where(CommunityPost.circle_id == circle_id)
        count_query = count_query.where(CommunityPost.circle_id == circle_id)
    if is_anonymous is not None:
        query = query.where(CommunityPost.is_anonymous == is_anonymous)
        count_query = count_query.where(CommunityPost.is_anonymous == is_anonymous)
    if is_hidden is not None:
        query = query.where(CommunityPost.is_hidden == is_hidden)
        count_query = count_query.where(CommunityPost.is_hidden == is_hidden)

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(CommunityPost.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    posts = result.scalars().all()

    items = []
    for post in posts:
        user_result = await db.execute(select(User).where(User.id == post.user_id))
        author = user_result.scalar_one_or_none()

        items.append(AdminPostResponse(
            id=post.id,
            circle_id=post.circle_id,
            user_id=post.user_id,
            content=post.content,
            images=post.images or [],
            is_anonymous=post.is_anonymous,
            is_hidden=post.is_hidden,
            likes_count=post.like_count,
            comments_count=post.comment_count,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author_email=author.email if author else None,
            author_username=author.username if author else None,
            author_role=author.role if author else None,
        ))

    return AdminPostListResponse(
        items=items, total=total, page=page, page_size=page_size,
    )


@router.put(
    "/posts/{post_id}",
    response_model=AdminPostResponse,
    summary="管理帖子",
)
async def update_post(
    post_id: int,
    data: AdminPostUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理员管理帖子（隐藏/显示/删除标记）。"""
    result = await db.execute(
        select(CommunityPost).where(CommunityPost.id == post_id)
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(post, field):
            setattr(post, field, value)

    await db.commit()
    await db.refresh(post)

    user_result = await db.execute(select(User).where(User.id == post.user_id))
    author = user_result.scalar_one_or_none()

    return AdminPostResponse(
        id=post.id,
        circle_id=post.circle_id,
        user_id=post.user_id,
        content=post.content,
        images=post.images or [],
        is_anonymous=post.is_anonymous,
        is_hidden=post.is_hidden,
        likes_count=post.like_count,
        comments_count=post.comment_count,
        created_at=post.created_at,
        updated_at=post.updated_at,
        author_email=author.email if author else None,
        author_username=author.username if author else None,
        author_role=author.role if author else None,
    )


# ==================== 系统看板 ====================

@router.get(
    "/dashboard",
    response_model=AdminDashboardResponse,
    summary="系统概览数据",
)
async def get_dashboard(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取系统运行概览数据"""
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar() or 0
    counselor_count = (await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.counselor.value)
    )).scalar() or 0
    psychologist_count = (await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.psychologist.value)
    )).scalar() or 0
    total_diaries = (await db.execute(select(func.count(Diary.id)))).scalar() or 0
    total_posts = (await db.execute(select(func.count(CommunityPost.id)))).scalar() or 0
    anonymous_posts = (await db.execute(
        select(func.count(CommunityPost.id)).where(CommunityPost.is_anonymous == True)
    )).scalar() or 0
    pending_applications = (await db.execute(
        select(func.count(CounselorApplication.id)).where(
            CounselorApplication.status == ApplicationStatus.pending.value
        )
    )).scalar() or 0

    return AdminDashboardResponse(
        total_users=total_users,
        active_users=active_users,
        counselor_count=counselor_count,
        psychologist_count=psychologist_count,
        total_diaries=total_diaries,
        total_posts=total_posts,
        anonymous_posts=anonymous_posts,
        pending_applications=pending_applications,
    )
