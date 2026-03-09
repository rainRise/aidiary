// 仪表盘/首页 - Apple风格深色主题
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useDiaryStore } from '@/store/diaryStore'
import { toast } from '@/components/ui/toast'
import EmotionChart from '@/components/common/EmotionChart'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { diaries, fetchDiaries, fetchEmotionStats, emotionStats, isLoading } = useDiaryStore()
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    topEmotion: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    await Promise.all([
      fetchDiaries({ page: 1, pageSize: 5 }),
      fetchEmotionStats(30),
    ])
  }

  useEffect(() => {
    if (diaries.length > 0) {
      const now = new Date()
      const thisMonth = diaries.filter((d) => {
        const date = new Date(d.diary_date)
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      }).length

      const emotionCounts: Record<string, number> = {}
      diaries.forEach((d) => {
        d.emotion_tags.forEach((tag) => {
          emotionCounts[tag] = (emotionCounts[tag] || 0) + 1
        })
      })

      const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '暂无'

      setStats({
        total: diaries.length,
        thisMonth,
        topEmotion,
      })
    }
  }, [diaries])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6) return '夜深了'
    if (h < 12) return '早上好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  if (isLoading && diaries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <span className="text-primary text-lg font-semibold tracking-wide">印记</span>
              <div className="hidden sm:flex items-center gap-1 ml-4">
                <button onClick={() => navigate('/')} className="px-3 py-1.5 text-sm text-white/80 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all">首页</button>
                <button onClick={() => navigate('/diaries')} className="px-3 py-1.5 text-sm text-white/40 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all">日记</button>
                <button onClick={() => navigate('/timeline')} className="px-3 py-1.5 text-sm text-white/40 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all">时间轴</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/40 hidden sm:block">
                {user?.username || user?.email?.split('@')[0]}
              </span>
              <button onClick={() => navigate('/settings')} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.1] transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
              <button onClick={handleLogout} className="text-xs text-white/30 hover:text-white/60 transition-colors">
                登出
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-8 space-y-8">
        {/* 欢迎区域 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.06] p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <p className="text-white/40 text-sm mb-1">{greeting()}</p>
            <h1 className="text-2xl font-bold text-white/95 mb-2">
              {user?.username || user?.email?.split('@')[0]}
            </h1>
            <p className="text-white/40 text-sm mb-6">今天想记录些什么呢？</p>
            <button
              onClick={() => navigate('/diaries/new')}
              className="h-10 px-6 rounded-xl text-sm font-medium bg-primary hover:bg-primary/90 text-white transition-all duration-200 active:scale-[0.98]"
            >
              开始写日记
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '总日记', value: stats.total, color: 'text-white/90' },
            { label: '本月', value: stats.thisMonth, color: 'text-primary' },
            { label: '主要情绪', value: stats.topEmotion || '—', color: 'text-emerald-400' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
              <p className="text-xs text-white/30 mb-2">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* 情绪统计图表 */}
        {emotionStats.length > 0 && (
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-6">
            <h2 className="text-sm font-medium text-white/70 mb-1">情绪统计</h2>
            <p className="text-xs text-white/30 mb-4">近30天情绪分布</p>
            <EmotionChart data={emotionStats} type="bar" />
          </div>
        )}

        {/* 快速操作 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '✍️', title: '写日记', desc: '记录想法', action: () => navigate('/diaries/new') },
            { icon: '📖', title: '日记本', desc: '浏览记录', action: () => navigate('/diaries') },
            { icon: '📅', title: '时间轴', desc: '回顾历程', action: () => navigate('/timeline') },
            { icon: '🤖', title: 'AI分析', desc: '心理洞察', action: () => {
              if (diaries.length > 0) navigate(`/analysis/${diaries[0].id}`)
              else toast('请先创建一篇日记', 'info')
            }},
          ].map((item) => (
            <button
              key={item.title}
              onClick={item.action}
              className="group rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5 text-left hover:bg-white/[0.08] hover:border-white/[0.1] transition-all duration-200 active:scale-[0.97]"
            >
              <span className="text-2xl block mb-3">{item.icon}</span>
              <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{item.title}</p>
              <p className="text-xs text-white/30 mt-0.5">{item.desc}</p>
            </button>
          ))}
        </div>

        {/* 最近日记 */}
        {diaries.length > 0 && (
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
            <div className="flex justify-between items-center p-6 pb-4">
              <div>
                <h2 className="text-sm font-medium text-white/70">最近日记</h2>
                <p className="text-xs text-white/30 mt-0.5">你最近的记录</p>
              </div>
              <button
                onClick={() => navigate('/diaries')}
                className="text-xs text-white/40 hover:text-primary transition-colors"
              >
                查看全部 →
              </button>
            </div>
            <div className="px-6 pb-6 space-y-2">
              {diaries.slice(0, 3).map((diary) => (
                <div
                  key={diary.id}
                  className="p-4 rounded-xl hover:bg-white/[0.04] cursor-pointer transition-all duration-200 group"
                  onClick={() => navigate(`/diaries/${diary.id}`)}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <h3 className="font-medium text-sm text-white/80 group-hover:text-white transition-colors">
                      {diary.title || '无标题'}
                    </h3>
                    <span className="text-[11px] text-white/25 shrink-0 ml-4">{diary.diary_date}</span>
                  </div>
                  <p className="text-xs text-white/35 line-clamp-2 leading-relaxed">
                    {diary.content}
                  </p>
                  {diary.emotion_tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {diary.emotion_tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary/70 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {diaries.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📝</p>
            <p className="text-white/50 text-sm mb-2">还没有任何日记</p>
            <p className="text-white/25 text-xs mb-6">点击上方按钮开始你的第一篇</p>
          </div>
        )}
      </main>
    </div>
  )
}
