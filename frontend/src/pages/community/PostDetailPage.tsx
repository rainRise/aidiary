// 帖子详情页
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { communityService, type Post, type Comment } from '@/services/community.service'
import { toast } from '@/components/ui/toast'
import { Heart, MessageCircle, Bookmark, ArrowLeft, Send, EyeOff, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const CIRCLE_ICONS: Record<string, string> = {
  anxiety: '😰', sadness: '😔', growth: '🌱', peace: '☀️', confusion: '🤔',
}
const CIRCLE_NAMES: Record<string, string> = {
  anxiety: '焦虑', sadness: '失落', growth: '成长', peace: '平静', confusion: '困惑',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = 60000, hour = 3600000, day = 86400000
  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

export default function PostDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [isAnonymousComment, setIsAnonymousComment] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!id) return
    const postId = parseInt(id)
    setIsLoading(true)
    Promise.all([
      communityService.getPost(postId),
      communityService.getComments(postId),
    ])
      .then(([postData, commentData]) => {
        setPost(postData)
        setComments(commentData.items)
      })
      .catch(() => toast('加载失败', 'error'))
      .finally(() => setIsLoading(false))
  }, [id])

  const handleLike = async () => {
    if (!post) return
    try {
      const { liked } = await communityService.toggleLike(post.id)
      setPost((p) => p ? { ...p, is_liked: liked, like_count: liked ? p.like_count + 1 : p.like_count - 1 } : p)
    } catch {
      toast('操作失败', 'error')
    }
  }

  const handleCollect = async () => {
    if (!post) return
    try {
      const { collected } = await communityService.toggleCollect(post.id)
      setPost((p) => p ? { ...p, is_collected: collected, collect_count: collected ? p.collect_count + 1 : p.collect_count - 1 } : p)
    } catch {
      toast('操作失败', 'error')
    }
  }

  const handleSendComment = async () => {
    if (!post || !commentText.trim()) return
    setIsSending(true)
    try {
      const comment = await communityService.createComment(post.id, {
        content: commentText.trim(),
        is_anonymous: isAnonymousComment,
      })
      setComments((prev) => [...prev, comment])
      setPost((p) => p ? { ...p, comment_count: p.comment_count + 1 } : p)
      setCommentText('')
      toast('评论成功', 'success')
    } catch (err: any) {
      toast(err?.response?.data?.detail || '评论失败', 'error')
    } finally {
      setIsSending(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      await communityService.deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setPost((p) => p ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p)
      toast('已删除', 'success')
    } catch {
      toast('删除失败', 'error')
    }
  }

  const handleDeletePost = async () => {
    if (!post) return
    if (!window.confirm('确定要删除这条动态吗？')) return
    try {
      await communityService.deletePost(post.id)
      toast('已删除', 'success')
      navigate('/community', { replace: true })
    } catch {
      toast('删除失败', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(158deg, #f8f5ef, #f2eef5)' }}>
        <div className="w-7 h-7 border-2 border-stone-200 border-t-[#b56f61] rounded-full animate-spin" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(158deg, #f8f5ef, #f2eef5)' }}>
        <p className="text-stone-400 text-sm">帖子不存在</p>
      </div>
    )
  }

  const isMyPost = post.author?.id === user?.id

  return (
    <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶栏 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.85)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-14">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <span className="text-xs text-stone-400">
              {CIRCLE_ICONS[post.circle_id]} {CIRCLE_NAMES[post.circle_id]}
            </span>
            {isMyPost && (
              <button onClick={handleDeletePost} className="text-xs text-red-300 hover:text-red-500 transition-colors flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            )}
            {!isMyPost && <div className="w-12" />}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 帖子内容 */}
        <div className="p-5 rounded-2xl bg-white/70 border border-white/80">
          {/* 作者 */}
          <div className="flex items-center gap-2.5 mb-4">
            {post.is_anonymous ? (
              <>
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
                  <EyeOff className="w-4 h-4 text-stone-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500">匿名用户</p>
                  <p className="text-[10px] text-stone-300">{timeAgo(post.created_at)}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
                  style={!post.author?.avatar_url ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' } : undefined}>
                  {post.author?.avatar_url ? (
                    <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (post.author?.username || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-600">{post.author?.username || '未命名'}</p>
                  <p className="text-[10px] text-stone-300">{timeAgo(post.created_at)}</p>
                </div>
              </>
            )}
          </div>

          {/* 正文 */}
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap mb-4">
            {post.content}
          </p>

          {/* 图片 */}
          {post.images && post.images.length > 0 && (
            <div className={`grid gap-2 mb-4 ${post.images.length === 1 ? 'grid-cols-1 max-w-sm' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {post.images.map((img, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-stone-100">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* 操作栏 */}
          <div className="flex items-center gap-6 pt-3 border-t border-stone-100">
            <button onClick={handleLike}
              className={`flex items-center gap-1.5 text-sm transition-colors ${post.is_liked ? 'text-rose-400' : 'text-stone-400 hover:text-rose-400'}`}>
              <Heart className={`w-4.5 h-4.5 ${post.is_liked ? 'fill-current' : ''}`} />
              {post.like_count > 0 ? post.like_count : '点赞'}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-stone-400">
              <MessageCircle className="w-4.5 h-4.5" />
              {post.comment_count > 0 ? post.comment_count : '评论'}
            </span>
            <button onClick={handleCollect}
              className={`flex items-center gap-1.5 text-sm transition-colors ${post.is_collected ? 'text-amber-400' : 'text-stone-400 hover:text-amber-400'}`}>
              <Bookmark className={`w-4.5 h-4.5 ${post.is_collected ? 'fill-current' : ''}`} />
              {post.collect_count > 0 ? post.collect_count : '收藏'}
            </button>
          </div>
        </div>

        {/* 评论区 */}
        <div>
          <h3 className="text-sm font-semibold text-stone-600 mb-3">
            评论 {comments.length > 0 && `(${comments.length})`}
          </h3>

          {comments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs text-stone-300">还没有评论，说点什么吧</p>
            </div>
          ) : (
            <div className="space-y-2">
              {comments.map((comment) => (
                <div key={comment.id} className="p-4 rounded-2xl bg-white/60 border border-white/80">
                  <div className="flex items-center gap-2 mb-2">
                    {comment.is_anonymous ? (
                      <>
                        <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center">
                          <EyeOff className="w-3 h-3 text-stone-400" />
                        </div>
                        <span className="text-xs text-stone-400">匿名用户</span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
                          style={!comment.author?.avatar_url ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' } : undefined}>
                          {comment.author?.avatar_url ? (
                            <img src={comment.author.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (comment.author?.username || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-xs text-stone-500 font-medium">{comment.author?.username || '未命名'}</span>
                      </>
                    )}
                    <span className="text-[10px] text-stone-300 ml-auto">{timeAgo(comment.created_at)}</span>
                    {comment.author?.id === user?.id && (
                      <button onClick={() => handleDeleteComment(comment.id)}
                        className="text-stone-300 hover:text-red-400 transition-colors ml-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 底部评论输入框 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200/70 backdrop-blur-xl" style={{ background: 'rgba(248,245,239,0.95)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAnonymousComment(!isAnonymousComment)}
              className={`shrink-0 p-2 rounded-xl transition-all ${isAnonymousComment ? 'bg-[#e88f7b]/10 text-[#e88f7b]' : 'text-stone-300 hover:text-stone-500'}`}
              title={isAnonymousComment ? '匿名评论开启' : '匿名评论关闭'}
            >
              <EyeOff className="w-4 h-4" />
            </button>
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
              placeholder={isAnonymousComment ? '匿名说点什么...' : '说点什么...'}
              className="flex-1 h-10 px-4 rounded-2xl bg-white/70 border border-stone-200/50 text-sm text-stone-600 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-[#e88f7b]/20 transition-all"
            />
            <button
              onClick={handleSendComment}
              disabled={isSending || !commentText.trim()}
              className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-white disabled:opacity-40 transition-all active:scale-[0.95]"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
