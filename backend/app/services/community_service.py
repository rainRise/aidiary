"""
社区服务层
处理帖子、评论、点赞、收藏、浏览记录的业务逻辑
"""
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, delete

from app.models.community import CommunityPost, PostComment, PostLike, PostCollect, PostView, CIRCLES
from app.models.database import User


class CommunityService:
    """社区服务"""

    # ==================== 圈子 ====================

    async def get_circles(self, db: AsyncSession) -> List[dict]:
        """获取所有圈子及帖子数量"""
        circles = []
        for c in CIRCLES:
            count_result = await db.execute(
                select(func.count(CommunityPost.id)).where(
                    and_(
                        CommunityPost.circle_id == c["id"],
                        CommunityPost.is_deleted == False
                    )
                )
            )
            count = count_result.scalar() or 0
            circles.append({**c, "post_count": count})
        return circles

    # ==================== 帖子 CRUD ====================

    async def create_post(
        self, db: AsyncSession, user_id: int,
        circle_id: str, content: str,
        images: Optional[List[str]] = None,
        is_anonymous: bool = False
    ) -> CommunityPost:
        """创建帖子"""
        valid_ids = [c["id"] for c in CIRCLES]
        if circle_id not in valid_ids:
            raise ValueError(f"无效的圈子ID: {circle_id}")

        post = CommunityPost(
            user_id=user_id,
            circle_id=circle_id,
            content=content,
            images=images or [],
            is_anonymous=is_anonymous,
        )
        db.add(post)
        await db.commit()
        await db.refresh(post)
        return post

    async def get_post(self, db: AsyncSession, post_id: int) -> Optional[CommunityPost]:
        """获取单个帖子"""
        result = await db.execute(
            select(CommunityPost).where(
                and_(CommunityPost.id == post_id, CommunityPost.is_deleted == False)
            )
        )
        return result.scalar_one_or_none()

    async def list_posts(
        self, db: AsyncSession,
        circle_id: Optional[str] = None,
        page: int = 1, page_size: int = 20
    ) -> Tuple[List[CommunityPost], int]:
        """获取帖子列表（分页）"""
        conditions = [CommunityPost.is_deleted == False]
        if circle_id:
            conditions.append(CommunityPost.circle_id == circle_id)

        # 总数
        count_q = select(func.count(CommunityPost.id)).where(and_(*conditions))
        total = (await db.execute(count_q)).scalar() or 0

        # 分页
        offset = (page - 1) * page_size
        q = (
            select(CommunityPost)
            .where(and_(*conditions))
            .order_by(desc(CommunityPost.created_at))
            .offset(offset)
            .limit(page_size)
        )
        result = await db.execute(q)
        posts = list(result.scalars().all())
        return posts, total

    async def list_user_posts(
        self, db: AsyncSession, user_id: int,
        page: int = 1, page_size: int = 20
    ) -> Tuple[List[CommunityPost], int]:
        """获取某用户的帖子"""
        conditions = [
            CommunityPost.user_id == user_id,
            CommunityPost.is_deleted == False,
        ]
        count_q = select(func.count(CommunityPost.id)).where(and_(*conditions))
        total = (await db.execute(count_q)).scalar() or 0

        offset = (page - 1) * page_size
        q = (
            select(CommunityPost)
            .where(and_(*conditions))
            .order_by(desc(CommunityPost.created_at))
            .offset(offset)
            .limit(page_size)
        )
        result = await db.execute(q)
        posts = list(result.scalars().all())
        return posts, total

    async def update_post(
        self, db: AsyncSession, post_id: int, user_id: int,
        content: Optional[str] = None, images: Optional[List[str]] = None
    ) -> Optional[CommunityPost]:
        """更新帖子（匿名帖不可编辑）"""
        post = await self.get_post(db, post_id)
        if not post or post.user_id != user_id:
            return None
        if post.is_anonymous:
            raise ValueError("匿名帖子不允许编辑")
        if content is not None:
            post.content = content
        if images is not None:
            post.images = images
        await db.commit()
        await db.refresh(post)
        return post

    async def delete_post(self, db: AsyncSession, post_id: int, user_id: int) -> bool:
        """软删除帖子"""
        post = await self.get_post(db, post_id)
        if not post or post.user_id != user_id:
            return False
        post.is_deleted = True
        await db.commit()
        return True

    # ==================== 评论 ====================

    async def create_comment(
        self, db: AsyncSession, post_id: int, user_id: int,
        content: str, parent_id: Optional[int] = None,
        is_anonymous: bool = False
    ) -> PostComment:
        """创建评论"""
        post = await self.get_post(db, post_id)
        if not post:
            raise ValueError("帖子不存在")

        comment = PostComment(
            post_id=post_id,
            user_id=user_id,
            content=content,
            parent_id=parent_id,
            is_anonymous=is_anonymous,
        )
        db.add(comment)
        # 更新帖子评论计数
        post.comment_count = (post.comment_count or 0) + 1
        await db.commit()
        await db.refresh(comment)
        return comment

    async def list_comments(
        self, db: AsyncSession, post_id: int
    ) -> Tuple[List[PostComment], int]:
        """获取帖子的评论列表"""
        conditions = [
            PostComment.post_id == post_id,
            PostComment.is_deleted == False,
        ]
        count_q = select(func.count(PostComment.id)).where(and_(*conditions))
        total = (await db.execute(count_q)).scalar() or 0

        q = (
            select(PostComment)
            .where(and_(*conditions))
            .order_by(PostComment.created_at)
        )
        result = await db.execute(q)
        comments = list(result.scalars().all())
        return comments, total

    async def delete_comment(self, db: AsyncSession, comment_id: int, user_id: int) -> bool:
        """软删除评论"""
        result = await db.execute(
            select(PostComment).where(
                and_(PostComment.id == comment_id, PostComment.is_deleted == False)
            )
        )
        comment = result.scalar_one_or_none()
        if not comment or comment.user_id != user_id:
            return False

        comment.is_deleted = True
        # 更新帖子评论计数
        post = await self.get_post(db, comment.post_id)
        if post and post.comment_count > 0:
            post.comment_count -= 1
        await db.commit()
        return True

    # ==================== 点赞 ====================

    async def toggle_like(self, db: AsyncSession, post_id: int, user_id: int) -> bool:
        """切换点赞状态，返回 True=已点赞, False=已取消"""
        post = await self.get_post(db, post_id)
        if not post:
            raise ValueError("帖子不存在")

        existing = await db.execute(
            select(PostLike).where(
                and_(PostLike.user_id == user_id, PostLike.post_id == post_id)
            )
        )
        like = existing.scalar_one_or_none()

        if like:
            await db.delete(like)
            post.like_count = max((post.like_count or 0) - 1, 0)
            await db.commit()
            return False
        else:
            db.add(PostLike(user_id=user_id, post_id=post_id))
            post.like_count = (post.like_count or 0) + 1
            await db.commit()
            return True

    async def is_liked(self, db: AsyncSession, post_id: int, user_id: int) -> bool:
        """检查是否已点赞"""
        result = await db.execute(
            select(PostLike.id).where(
                and_(PostLike.user_id == user_id, PostLike.post_id == post_id)
            )
        )
        return result.scalar_one_or_none() is not None

    # ==================== 收藏 ====================

    async def toggle_collect(self, db: AsyncSession, post_id: int, user_id: int) -> bool:
        """切换收藏状态，返回 True=已收藏, False=已取消"""
        post = await self.get_post(db, post_id)
        if not post:
            raise ValueError("帖子不存在")

        existing = await db.execute(
            select(PostCollect).where(
                and_(PostCollect.user_id == user_id, PostCollect.post_id == post_id)
            )
        )
        collect = existing.scalar_one_or_none()

        if collect:
            await db.delete(collect)
            post.collect_count = max((post.collect_count or 0) - 1, 0)
            await db.commit()
            return False
        else:
            db.add(PostCollect(user_id=user_id, post_id=post_id))
            post.collect_count = (post.collect_count or 0) + 1
            await db.commit()
            return True

    async def is_collected(self, db: AsyncSession, post_id: int, user_id: int) -> bool:
        """检查是否已收藏"""
        result = await db.execute(
            select(PostCollect.id).where(
                and_(PostCollect.user_id == user_id, PostCollect.post_id == post_id)
            )
        )
        return result.scalar_one_or_none() is not None

    async def list_collected_posts(
        self, db: AsyncSession, user_id: int,
        page: int = 1, page_size: int = 20
    ) -> Tuple[List[CommunityPost], int]:
        """获取用户收藏列表"""
        count_q = select(func.count(PostCollect.id)).where(PostCollect.user_id == user_id)
        total = (await db.execute(count_q)).scalar() or 0

        offset = (page - 1) * page_size
        q = (
            select(CommunityPost)
            .join(PostCollect, PostCollect.post_id == CommunityPost.id)
            .where(
                and_(
                    PostCollect.user_id == user_id,
                    CommunityPost.is_deleted == False
                )
            )
            .order_by(desc(PostCollect.created_at))
            .offset(offset)
            .limit(page_size)
        )
        result = await db.execute(q)
        posts = list(result.scalars().all())
        return posts, total

    # ==================== 浏览记录 ====================

    async def record_view(self, db: AsyncSession, post_id: int, user_id: int) -> None:
        """记录浏览（每次点开详情都记录一条）"""
        view = PostView(user_id=user_id, post_id=post_id)
        db.add(view)
        await db.commit()

    async def list_view_history(
        self, db: AsyncSession, user_id: int,
        page: int = 1, page_size: int = 20
    ) -> Tuple[List[dict], int]:
        """获取浏览记录（去重：同一帖子只显示最后一次）"""
        # 子查询：每个帖子最后一次浏览
        subq = (
            select(
                PostView.post_id,
                func.max(PostView.created_at).label("last_viewed")
            )
            .where(PostView.user_id == user_id)
            .group_by(PostView.post_id)
            .subquery()
        )

        count_q = select(func.count()).select_from(subq)
        total = (await db.execute(count_q)).scalar() or 0

        offset = (page - 1) * page_size
        q = (
            select(CommunityPost, subq.c.last_viewed)
            .join(subq, subq.c.post_id == CommunityPost.id)
            .where(CommunityPost.is_deleted == False)
            .order_by(desc(subq.c.last_viewed))
            .offset(offset)
            .limit(page_size)
        )
        result = await db.execute(q)
        items = [{"post": post, "viewed_at": viewed_at} for post, viewed_at in result.all()]
        return items, total

    # ==================== 辅助方法 ====================

    async def get_user(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """获取用户"""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def build_post_response(
        self, db: AsyncSession, post: CommunityPost, current_user_id: Optional[int] = None
    ) -> dict:
        """构建帖子响应数据"""
        author = None
        if not post.is_anonymous:
            user = await self.get_user(db, post.user_id)
            if user:
                author = {
                    "id": user.id,
                    "username": user.username,
                    "avatar_url": user.avatar_url,
                }

        is_liked = False
        is_collected = False
        if current_user_id:
            is_liked = await self.is_liked(db, post.id, current_user_id)
            is_collected = await self.is_collected(db, post.id, current_user_id)

        return {
            "id": post.id,
            "circle_id": post.circle_id,
            "content": post.content,
            "images": post.images or [],
            "is_anonymous": post.is_anonymous,
            "author": author,
            "like_count": post.like_count or 0,
            "comment_count": post.comment_count or 0,
            "collect_count": post.collect_count or 0,
            "is_liked": is_liked,
            "is_collected": is_collected,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }

    async def build_comment_response(self, db: AsyncSession, comment: PostComment) -> dict:
        """构建评论响应数据"""
        author = None
        if not comment.is_anonymous:
            user = await self.get_user(db, comment.user_id)
            if user:
                author = {
                    "id": user.id,
                    "username": user.username,
                    "avatar_url": user.avatar_url,
                }

        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "content": comment.content,
            "is_anonymous": comment.is_anonymous,
            "author": author,
            "parent_id": comment.parent_id,
            "created_at": comment.created_at,
        }


# 全局实例
community_service = CommunityService()
