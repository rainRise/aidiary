// 社区主页 - 情绪共鸣圈
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { communityService, type Post, type CircleInfo } from '@/services/community.service'
import { Heart, MessageCircle, Bookmark, Plus, Clock, EyeOff } from 'lucide-react'
import { toast } from '@/components/ui/toast'

const CIRCLE_ICONS: Record<string, string> = {
  anxiety: '😰',
  sadness: '😔',
  growth: '🌱',
  peace: '☀️',
  confusion: '🤔',
}

function timeAgo(dateStr: string) {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = now - d
  const min = 60000
  const hour = 3600000
  const day = 86400000
  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [circles, setCircles] = useState<CircleInfo[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [activeCircle, setActiveCircle] = useState<string>(searchParams.get('circle') || '')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // 加载圈子
  useEffect(() => {
    communityService.getCircles().then(setCircles).catch(() => {})
  }, [])

  // 加载帖子
  useEffect(() => {
    setIsLoading(true)
    communityService
      .getPosts({ circle_id: activeCircle || undefined, page, page_size: 20 })
      .then((res) => {
        setPosts(res.items)
        setTotalPages(res.total_pages)
      })
      .catch(() => toast('加载帖子失败', 'error'))
      .finally(() => setIsLoading(false))
  }, [activeCircle, page])

  const handleCircleChange = (circleId: string) => {
    const newCircle = circleId === activeCircle ? '' : circleId
    setActiveCircle(newCircle)
    setPage(1)
    if (newCircle) {
      setSearchParams({ circle: newCircle })
    } else {
      setSearchParams({})
    }
  }

  const handleLike = async (e: React.MouseEvent, postId: number) => {
    e.stopPropagation()
    try {
      const { liked } = await communityService.toggleLike(postId)
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: liked, like_count: liked ? p.like_count + 1 : p.like_count - 1 }
            : p
        )
      )
    } catch {
      toast('操作失败', 'error')
    }
  }

  const handleCollect = async (e: React.MouseEvent, postId: number) => {
    e.stopPropagation()
    try {
      const { collected } = await communityService.toggleCollect(postId)
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_collected: collected, collect_count: collected ? p.collect_count + 1 : p.collect_count - 1 }
            : p
        )
      )
    } catch {
      toast('操作失败', 'error')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.85)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← 返回</button>
              <h1 className="text-base font-semibold text-stone-700">情绪共鸣圈</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/community/history')}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-[#f5efea] transition-all"
                title="浏览记录"
              >
                <Clock className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => navigate('/community/collections')}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-[#f5efea] transition-all"
                title="我的收藏"
              >
                <Bookmark className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => navigate('/community/new')}
                className="h-9 px-4 rounded-xl text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.97] flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
              >
                <Plus className="w-4 h-4" />
                发帖
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 圈子选择 */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => handleCircleChange('')}
            className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-medium border transition-all ${
              !activeCircle
                ? 'bg-white text-stone-700 border-stone-300 shadow-sm'
                : 'bg-white/50 text-stone-400 border-transparent hover:bg-white/80'
            }`}
          >
            全部
          </button>
          {circles.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCircleChange(c.id)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-medium border transition-all flex items-center gap-1.5 ${
                activeCircle === c.id
                  ? 'bg-white text-stone-700 border-stone-300 shadow-sm'
                  : 'bg-white/50 text-stone-400 border-transparent hover:bg-white/80'
              }`}
            >
              <span>{CIRCLE_ICONS[c.id] || '💬'}</span>
              {c.name}
              <span className="text-[10px] text-stone-300 ml-0.5">{c.post_count}</span>
            </button>
          ))}
        </div>

        {/* 当前圈子描述 */}
        {activeCircle && (
          <div className="px-4 py-3 rounded-2xl bg-white/60 border border-white/80">
            <p className="text-sm text-stone-500">
              <span className="text-lg mr-1.5">{CIRCLE_ICONS[activeCircle]}</span>
              {circles.find((c) => c.id === activeCircle)?.label}
            </p>
          </div>
        )}

        {/* 帖子列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-stone-200 border-t-[#b56f61] rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-400 text-sm mb-2">还没有帖子</p>
            <p className="text-stone-300 text-xs">成为第一个分享的人吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => navigate(`/community/post/${post.id}`)}
                className="p-5 rounded-2xl bg-white/70 border border-white/80 hover:bg-white/90 hover:shadow-sm cursor-pointer transition-all duration-200"
              >
                {/* 作者行 */}
                <div className="flex items-center gap-2.5 mb-3">
                  {post.is_anonymous ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                        <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-500">匿名用户</p>
                        <p className="text-[10px] text-stone-300">{timeAgo(post.created_at)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
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
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border"
                    style={{
                      color: circles.find((c) => c.id === post.circle_id)?.color || '#999',
                      borderColor: (circles.find((c) => c.id === post.circle_id)?.color || '#999') + '40',
                      backgroundColor: (circles.find((c) => c.id === post.circle_id)?.color || '#999') + '10',
                    }}>
                    {CIRCLE_ICONS[post.circle_id]} {circles.find((c) => c.id === post.circle_id)?.name}
                  </span>
                </div>

                {/* 内容 */}
                <p className="text-sm text-stone-600 leading-relaxed line-clamp-4 whitespace-pre-wrap mb-3">
                  {post.content}
                </p>

                {/* 图片 */}
                {post.images && post.images.length > 0 && (
                  <div className={`grid gap-2 mb-3 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {post.images.slice(0, 3).map((img, i) => (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden bg-stone-100">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 底部操作 */}
                <div className="flex items-center gap-5 pt-1">
                  <button
                    onClick={(e) => handleLike(e, post.id)}
                    className={`flex items-center gap-1 text-xs transition-colors ${post.is_liked ? 'text-rose-400' : 'text-stone-300 hover:text-rose-400'}`}
                  >
                    <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-current' : ''}`} />
                    {post.like_count > 0 && post.like_count}
                  </button>
                  <span className="flex items-center gap-1 text-xs text-stone-300">
                    <MessageCircle className="w-4 h-4" />
                    {post.comment_count > 0 && post.comment_count}
                  </span>
                  <button
                    onClick={(e) => handleCollect(e, post.id)}
                    className={`flex items-center gap-1 text-xs transition-colors ${post.is_collected ? 'text-amber-400' : 'text-stone-300 hover:text-amber-400'}`}
                  >
                    <Bookmark className={`w-4 h-4 ${post.is_collected ? 'fill-current' : ''}`} />
                    {post.collect_count > 0 && post.collect_count}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-500 hover:bg-white disabled:opacity-30 transition-all"
            >
              上一页
            </button>
            <span className="text-xs text-stone-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-500 hover:bg-white disabled:opacity-30 transition-all"
            >
              下一页
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
