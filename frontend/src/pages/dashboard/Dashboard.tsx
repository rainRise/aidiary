// 仪表盘/首页 - 温暖柔和心理日记风格
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useDiaryStore } from '@/store/diaryStore'
import EmotionChart, { normalizeEmotionTag } from '@/components/common/EmotionChart'
import { PenLine, BookOpen, Settings, LogOut, Sprout, BookMarked, Moon, Heart, Clock, MessageCircle, FileText, Orbit, Sparkles } from 'lucide-react'
import { getEmotionDisplayLabel } from '@/utils/emotionLabels'

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { diaries, fetchDiaries, isLoading } = useDiaryStore()
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    topEmotion: '',
  })
  const [localEmotionStats, setLocalEmotionStats] = useState<{ tag: string; count: number; percentage: number }[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchDiaries({ page: 1, pageSize: 50 })
  }, [])

  useEffect(() => {
    if (diaries.length > 0) {
      const now = new Date()
      const thisMonth = diaries.filter((d) => {
        const date = new Date(d.diary_date)
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      }).length

      const emotionCounts: Record<string, number> = {}
      diaries.forEach((d) => {
        ;(d.emotion_tags ?? []).forEach((tag) => {
          const normalizedTag = normalizeEmotionTag(tag)
          if (!normalizedTag) return
          emotionCounts[normalizedTag] = (emotionCounts[normalizedTag] || 0) + 1
        })
      })

      const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '暂无'

      setStats({
        total: diaries.length,
        thisMonth,
        topEmotion,
      })

      const totalTags = Object.values(emotionCounts).reduce((a, b) => a + b, 0)
      const computed = Object.entries(emotionCounts)
        .map(([tag, count]) => ({ tag, count, percentage: totalTags > 0 ? Math.round((count / totalTags) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
      setLocalEmotionStats(computed)
    }
  }, [diaries])

  const handleLogout = async () => {
    setShowUserMenu(false)
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

  const displayName = user?.username || user?.email?.split('@')[0] || '用户'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  if (isLoading && diaries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(158deg, #f8f5ef, #f2eef5)' }}>
        <div className="w-8 h-8 border-2 border-[#d9cbc2] border-t-[#b56f61] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.85)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex justify-between items-center h-15 py-3">
            <div className="flex items-center gap-3">
              <img
                src="/yingji_logo_2_healing_1_no_bg.png"
                alt="映记 Logo"
                className="w-9 h-9 object-contain drop-shadow-sm"
              />
              <span className="text-stone-700 font-semibold">映记</span>
              <div className="hidden sm:flex items-center gap-0.5 ml-3">
                {[['/', t('navigation.dashboard')], ['/diaries', t('navigation.diaries')], ['/growth', t('navigation.growth')], ['/emotion', t('navigation.emotion')], ['/community', t('navigation.community')]].map(([path, label]) => (
                  <button key={path} onClick={() => navigate(path)}
                    className="px-3 py-1.5 text-sm rounded-xl text-stone-500 hover:text-stone-800 hover:bg-[#f5efea] transition-all">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 用户头像 + 下拉菜单 */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-2xl hover:bg-[#f5efea]/80 transition-all"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md ring-2 ring-white/80 overflow-hidden"
                  style={!user?.avatar_url ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' } : undefined}>
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    : avatarLetter}
                </div>
                <span className="text-sm text-stone-600 font-medium hidden sm:block">{displayName}</span>
                <svg className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              {/* 下拉菜单 */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white/95 backdrop-blur-xl shadow-xl border border-stone-200/70 overflow-hidden z-50"
                  style={{ animation: 'fadeInDown 0.15s ease-out' }}>
                  {/* 用户信息区 */}
                  <div className="px-4 py-3.5 border-b border-[#efe6e0]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm overflow-hidden"
                        style={!user?.avatar_url ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' } : undefined}>
                        {user?.avatar_url
                          ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          : avatarLetter}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-700 truncate">{displayName}</p>
                        <p className="text-xs text-stone-400 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* 菜单项 */}
                  <div className="py-1.5">
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/diaries/new') }}
                      className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-[#f5efea]/80 transition-colors flex items-center gap-3"
                    >
                      <PenLine className="w-4 h-4 text-[#b56f61]" />
                      {t('navigation.writeDiary')}
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/diaries') }}
                      className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-[#f5efea]/80 transition-colors flex items-center gap-3"
                    >
                      <BookOpen className="w-4 h-4 text-violet-400" />
                      {t('navigation.myDiaries')}
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/settings') }}
                      className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-[#f5efea]/80 transition-colors flex items-center gap-3"
                    >
                      <Settings className="w-4 h-4 text-stone-400" />
                      {t('navigation.settings')}
                    </button>
                    {user?.role === 'student' && (
                      <button
                        onClick={() => { setShowUserMenu(false); navigate('/counselor/apply') }}
                        className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-[#f5efea]/80 transition-colors flex items-center gap-3"
                      >
                        <Sparkles className="w-4 h-4 text-rose-400" />
                        申请辅导员/心理老师认证
                      </button>
                    )}
                    {(user?.role === 'counselor' || user?.role === 'psychologist' || user?.role === 'admin') && (
                      <button
                        onClick={() => { setShowUserMenu(false); navigate('/counselor/dashboard') }}
                        className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-[#f5efea]/80 transition-colors flex items-center gap-3"
                      >
                        <Sparkles className="w-4 h-4 text-violet-400" />
                        辅导员工作台
                      </button>
                    )}
                  </div>

                  {/* 登出 */}
                  <div className="border-t border-[#efe6e0] py-1.5">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-50/60 transition-colors flex items-center gap-3"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      {t('auth.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-8 space-y-6">
        {/* 欢迎横幅 */}
        <div className="relative overflow-hidden rounded-3xl p-8 min-h-[180px]">
          <img src="/dashboard-banner-bg_1.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/60 via-white/30 to-transparent" />
          <div className="relative">
            <p className="text-[#b56f61]/80 text-sm mb-1">{greeting()}</p>
            <h1 className="text-2xl font-bold text-stone-700 mb-1.5">
              {displayName}
            </h1>
            <p className="text-stone-500/80 text-sm mb-5">{t('dashboard.welcomeMessage')}</p>
            <button
              onClick={() => navigate('/diaries/new')}
              className="h-10 px-6 rounded-2xl text-sm font-semibold text-white shadow-md transition-all duration-200 active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {t('dashboard.startWriting')}
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('dashboard.totalDiaries'), value: stats.total, icon: <BookMarked className="w-5 h-5 text-[#b56f61]" />, bg: 'from-[#f8efe9] to-[#ede8f1]', border: 'border-[#e7dbd5]', val: 'text-[#a45f52]' },
            { label: t('dashboard.thisMonth'), value: stats.thisMonth, icon: <Moon className="w-5 h-5 text-violet-400" />, bg: 'from-violet-50 to-purple-50', border: 'border-violet-100', val: 'text-violet-500' },
            { label: t('dashboard.topEmotion'), value: stats.topEmotion || '—', icon: <Heart className="w-5 h-5 text-amber-400" />, bg: 'from-amber-50 to-orange-50', border: 'border-amber-100', val: 'text-amber-500' },
          ].map((item, index) => (
            <div key={index} className={`rounded-2xl bg-gradient-to-br ${item.bg} border ${item.border} p-5`}>
              <span className="block mb-2">{item.icon}</span>
              <p className="text-xs text-stone-400 mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.val}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* 快速操作 */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: <PenLine className="w-6 h-6 text-[#b56f61]" />, title: t('navigation.writeDiary'), desc: t('dashboard.recordToday'), bg: 'hover:bg-[#f5efea] hover:border-[#d8c7bc]', action: () => navigate('/diaries/new') },
            { icon: <BookOpen className="w-6 h-6 text-violet-400" />, title: t('navigation.diaries'), desc: t('dashboard.browseRecords'), bg: 'hover:bg-violet-50 hover:border-violet-200', action: () => navigate('/diaries') },
            { icon: <Clock className="w-6 h-6 text-emerald-400" />, title: t('navigation.growth'), desc: t('dashboard.growthInsights'), bg: 'hover:bg-emerald-50 hover:border-emerald-200', action: () => navigate('/growth') },
            { icon: <Orbit className="w-6 h-6 text-rose-400" />, title: t('navigation.emotion'), desc: t('dashboard.emotionVisualization'), bg: 'hover:bg-rose-50 hover:border-rose-200', action: () => navigate('/emotion') },
            { icon: <Sparkles className="w-6 h-6 text-amber-400" />, title: t('navigation.analysis'), desc: t('dashboard.longTermInsights'), bg: 'hover:bg-amber-50 hover:border-amber-200', action: () => navigate('/analysis') },
            ...(user?.role === 'student'
              ? [{
                  icon: <Sparkles className="w-6 h-6 text-[#e88f7b]" />,
                  title: '角色认证申请',
                  desc: '申请辅导员或心理老师身份',
                  bg: 'hover:bg-[#fff1ec] hover:border-[#f2c9bd]',
                  action: () => navigate('/counselor/apply'),
                }]
              : []),
            ...(user?.role === 'counselor' || user?.role === 'psychologist' || user?.role === 'admin'
              ? [{
                  icon: <Sparkles className="w-6 h-6 text-[#8d79bb]" />,
                  title: '辅导员工作台',
                  desc: '查看脱敏趋势与重点关注学生',
                  bg: 'hover:bg-[#f4eefc] hover:border-[#d6c8ec]',
                  action: () => navigate('/counselor/dashboard'),
                }]
              : []),
          ].map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className={`group card-warm p-5 text-left ${item.bg} transition-all duration-200 active:scale-[0.97]`}
            >
              <span className="block mb-3">{item.icon}</span>
              <p className="text-sm font-semibold text-stone-700">{item.title}</p>
              <p className="text-xs text-stone-400 mt-0.5">{item.desc}</p>
            </button>
          ))}
        </div>

        {/* 情绪统计图表 */}
        {localEmotionStats.length > 0 && (
          <div className="card-warm p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4.5 h-4.5 text-[#b56f61]" />
                <h2 className="text-sm font-semibold text-stone-700">{t('dashboard.emotionDistribution')}</h2>
              </div>
              <button
                onClick={() => navigate('/emotion')}
                className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-xl border border-rose-100 text-rose-500 hover:bg-rose-50 transition-colors"
              >
                <Orbit className="w-3.5 h-3.5" />
                {t('dashboard.viewEmotionMap')}
              </button>
            </div>
            <p className="text-xs text-stone-400 mb-4 ml-7">{t('dashboard.emotionLast30Days')}</p>
            <EmotionChart data={localEmotionStats} type="bubble" />
          </div>
        )}

        {/* 最近日记 */}
        {diaries.length > 0 && (
          <div className="card-warm overflow-hidden">
            <div className="flex justify-between items-center px-6 pt-6 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-[#b56f61]" />
                <div>
                  <h2 className="text-sm font-semibold text-stone-700">{t('dashboard.recentDiaries')}</h2>
                  <p className="text-xs text-stone-400">{t('dashboard.recentRecords')}</p>
                </div>
              </div>
              <button onClick={() => navigate('/diaries')}
                className="text-xs text-[#b56f61] hover:text-[#a45f52] transition-colors">
                查看全部 →
              </button>
            </div>
            <div className="px-4 pb-4 space-y-1">
              {diaries.slice(0, 4).map((diary) => (
                <div
                  key={diary.id}
                  className="p-4 rounded-2xl hover:bg-[#f5efea]/60 cursor-pointer transition-all duration-200"
                  onClick={() => navigate(`/diaries/${diary.id}`)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-sm text-stone-700 truncate pr-4">
                      {diary.title || '无标题'}
                    </h3>
                    <span className="text-[11px] text-stone-300 shrink-0">{diary.diary_date}</span>
                  </div>
                  <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">{diary.content}</p>
                  {(diary.emotion_tags ?? []).length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {(diary.emotion_tags ?? []).map((tag, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-[#e7dbd5] text-[#b56f61] rounded-full">
                          {getEmotionDisplayLabel(t, tag)}
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
            <Sprout className="w-12 h-12 text-emerald-300 mx-auto mb-4 animate-float" />
            <p className="text-stone-500 text-sm mb-1.5">{t('dashboard.noDiaries')}</p>
            <p className="text-stone-300 text-xs mb-6">{t('dashboard.firstDiaryPrompt')}</p>
          </div>
        )}
      </main>
    </div>
  )
}
