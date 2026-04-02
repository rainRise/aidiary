// 社区主页 - 情绪共鸣圈
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { communityService, type Post, type CircleInfo } from '@/services/community.service'
import { Heart, MessageCircle, Bookmark, Plus, Clock, Sparkles } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import AnonymousAvatar from '@/components/community/AnonymousAvatar'

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
        {/* 今日社区氛围横幅 */}
        <section className="relative overflow-hidden rounded-3xl border border-[#eadfd7] shadow-[0_14px_28px_rgba(145,124,122,0.12)]">
          <img
            src="/assets/community/community-atmosphere_1.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(108deg,rgba(255,252,248,0.88)_0%,rgba(255,252,248,0.64)_52%,rgba(255,252,248,0.28)_100%)]" />
          <div className="relative p-5 sm:p-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/70 bg-white/45 backdrop-blur-sm text-[#936d63] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              今日社区氛围
            </div>
            <h2
              className="mt-3 text-[22px] sm:text-[26px] leading-tight text-stone-700 font-semibold"
              style={{ fontFamily: '"STSong", "Songti SC", serif' }}
            >
              慢一点表达，也能被认真听见
            </h2>
            <p className="mt-2 text-sm text-stone-600/90 max-w-[560px] leading-6">
              今天的共鸣圈更适合分享“真实近况”，不需要完美总结，讲出你当下的一点感受就好。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-white/70 text-stone-600 border border-white/80">
                今日帖子 {posts.length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/70 text-stone-600 border border-white/80">
                当前分组 {activeCircle ? circles.find((c) => c.id === activeCircle)?.name || '全部' : '全部'}
              </span>
            </div>
          </div>
        </section>

        {/* 圈子选择 */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => handleCircleChange('')}
            className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-medium border transition-all duration-200 ${
              !activeCircle
                ? 'text-white border-transparent shadow-md'
                : 'bg-white/55 text-stone-500 border-[#e9dfd6] hover:bg-white/85'
            }`}
            style={
              !activeCircle
                ? {
                    background: 'linear-gradient(135deg, #de8d79, #9f9ab8)',
                    boxShadow: '0 10px 20px rgba(164,130,132,0.28)',
                  }
                : undefined
            }
          >
            全部
          </button>
          {circles.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCircleChange(c.id)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-medium border transition-all duration-200 flex items-center gap-1.5 ${
                activeCircle === c.id
                  ? 'text-white border-transparent shadow-md'
                  : 'bg-white/55 text-stone-500 border-[#e9dfd6] hover:bg-white/85'
              }`}
              style={
                activeCircle === c.id
                  ? {
                      background: `linear-gradient(135deg, ${c.color || '#de8d79'}, #a09ab8)`,
                      boxShadow: '0 10px 20px rgba(164,130,132,0.28)',
                    }
                  : undefined
              }
            >
              <span>{CIRCLE_ICONS[c.id] || '💬'}</span>
              {c.name}
              <span className={`text-[10px] ml-0.5 ${activeCircle === c.id ? 'text-white/80' : 'text-stone-300'}`}>{c.post_count}</span>
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
                className="rounded-[24px] border border-[#e7ddd6] bg-[#fffdfa]/85 overflow-hidden hover:shadow-[0_14px_28px_rgba(149,128,126,0.12)] cursor-pointer transition-all duration-250"
              >
                {/* 作者区 */}
                <div className="px-5 pt-4.5 pb-3 border-b border-[#efe3dc] bg-[linear-gradient(180deg,rgba(255,250,246,0.78),rgba(255,250,246,0.42))]">
                  <div className="flex items-center gap-2.5">
                    {post.is_anonymous ? (
                      <>
                        <AnonymousAvatar />
                        <div>
                          <p className="text-sm font-medium text-stone-600">匿名用户</p>
                          <p className="text-[10px] text-stone-400">{timeAgo(post.created_at)}</p>
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
                          <p className="text-[10px] text-stone-400">{timeAgo(post.created_at)}</p>
                        </div>
                      </>
                    )}
                    <span
                      className="ml-auto text-[11px] px-2.5 py-1 rounded-full border font-medium"
                      style={{
                        color: circles.find((c) => c.id === post.circle_id)?.color || '#999',
                        borderColor: (circles.find((c) => c.id === post.circle_id)?.color || '#999') + '44',
                        backgroundColor: (circles.find((c) => c.id === post.circle_id)?.color || '#999') + '14',
                      }}
                    >
                      {CIRCLE_ICONS[post.circle_id]} {circles.find((c) => c.id === post.circle_id)?.name}
                    </span>
                  </div>
                </div>

                {/* 内容区 */}
                <div className="px-5 py-4 bg-white/55">
                  <p className="text-[15px] text-stone-700 leading-7 line-clamp-4 whitespace-pre-wrap mb-3">
                    {post.content}
                  </p>

                  {/* 图片 */}
                  {post.images && post.images.length > 0 && (
                    <div className={`grid gap-2 mb-0.5 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {post.images.slice(0, 3).map((img, i) => (
                        <div key={i} className="aspect-square rounded-xl overflow-hidden bg-stone-100 border border-[#eee2da]">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 互动区 */}
                <div className="px-5 py-3 border-t border-[#efe3dc] bg-[linear-gradient(180deg,rgba(252,246,241,0.46),rgba(252,246,241,0.28))]">
                  <div className="flex items-center gap-5 pt-0.5">
                    <button
                      onClick={(e) => handleLike(e, post.id)}
                      className={`flex items-center gap-1 text-xs transition-colors ${post.is_liked ? 'text-rose-400' : 'text-stone-400 hover:text-rose-400'}`}
                    >
                      <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-current' : ''}`} />
                      {post.like_count > 0 && post.like_count}
                    </button>
                    <span className="flex items-center gap-1 text-xs text-stone-400">
                      <MessageCircle className="w-4 h-4" />
                      {post.comment_count > 0 && post.comment_count}
                    </span>
                    <button
                      onClick={(e) => handleCollect(e, post.id)}
                      className={`flex items-center gap-1 text-xs transition-colors ${post.is_collected ? 'text-amber-500' : 'text-stone-400 hover:text-amber-500'}`}
                    >
                      <Bookmark className={`w-4 h-4 ${post.is_collected ? 'fill-current' : ''}`} />
                      {post.collect_count > 0 && post.collect_count}
                    </button>
                  </div>
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
