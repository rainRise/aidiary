// 我的收藏页面
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityService, type Post } from '@/services/community.service'
import { toast } from '@/components/ui/toast'
import { ArrowLeft, Heart, MessageCircle, Bookmark, EyeOff } from 'lucide-react'

const CIRCLE_ICONS: Record<string, string> = {
  anxiety: '😰', sadness: '😔', growth: '🌱', peace: '☀️', confusion: '🤔',
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

export default function CollectionsPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    communityService
      .getCollections({ page, page_size: 20 })
      .then((res) => {
        setPosts(res.items)
        setTotalPages(res.total_pages)
      })
      .catch(() => toast('加载收藏失败', 'error'))
      .finally(() => setIsLoading(false))
  }, [page])

  const handleUncollect = async (e: React.MouseEvent, postId: number) => {
    e.stopPropagation()
    try {
      await communityService.toggleCollect(postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      toast('已取消收藏', 'success')
    } catch {
      toast('操作失败', 'error')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.85)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-3">
            <button onClick={() => navigate('/community')} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <h1 className="text-sm font-semibold text-stone-700">我的收藏</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-stone-200 border-t-[#b56f61] rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark className="w-10 h-10 text-stone-200 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">还没有收藏</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => navigate(`/community/post/${post.id}`)}
                className="p-5 rounded-2xl bg-white/70 border border-white/80 hover:bg-white/90 hover:shadow-sm cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  {post.is_anonymous ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center">
                        <EyeOff className="w-3 h-3 text-stone-400" />
                      </div>
                      <span className="text-xs text-stone-400">匿名用户</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
                        style={!post.author?.avatar_url ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' } : undefined}>
                        {post.author?.avatar_url ? (
                          <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (post.author?.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-stone-500">{post.author?.username || '未命名'}</span>
                    </div>
                  )}
                  <span className="text-[10px] text-stone-300 ml-auto">{CIRCLE_ICONS[post.circle_id]} {timeAgo(post.created_at)}</span>
                </div>
                <p className="text-sm text-stone-600 leading-relaxed line-clamp-3 whitespace-pre-wrap mb-3">{post.content}</p>
                <div className="flex items-center gap-5">
                  <span className="flex items-center gap-1 text-xs text-stone-300">
                    <Heart className="w-3.5 h-3.5" /> {post.like_count || ''}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-stone-300">
                    <MessageCircle className="w-3.5 h-3.5" /> {post.comment_count || ''}
                  </span>
                  <button
                    onClick={(e) => handleUncollect(e, post.id)}
                    className="flex items-center gap-1 text-xs text-amber-400 ml-auto"
                  >
                    <Bookmark className="w-3.5 h-3.5 fill-current" /> 取消收藏
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-500 hover:bg-white disabled:opacity-30 transition-all">上一页</button>
            <span className="text-xs text-stone-400">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-500 hover:bg-white disabled:opacity-30 transition-all">下一页</button>
          </div>
        )}
      </main>
    </div>
  )
}
