// 仪表盘/首页 - AI 情绪成长产品首页
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useDiaryStore } from '@/store/diaryStore'
import { getEmotionDisplayLabel } from '@/utils/emotionLabels'
import { diaryService } from '@/services/diary.service'
import type { DashboardInsights, Diary } from '@/types/diary'
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Heart,
  LogOut,
  MessageCircle,
  Orbit,
  PenLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  TrendingUp,
} from 'lucide-react'

type EmotionStat = { tag: string; count: number; percentage: number }
type RecentDashboardDiary = {
  id: number
  title: string
  diary_date: string
  emotion_tags: string[]
  summary?: string
  content?: string
  word_count: number
  analysis_path?: string
}
type DashboardStats = {
  total: number
  last30Days: number
  thisMonth: number
  topEmotion: string
  topEmotionCount: number
  trend: 'ascending' | 'descending' | 'stable'
  trendLabel: string
  trendDelta: number
  riskLabel: string
  riskDesc: string
}

const negativeEmotionPattern = /焦虑|压力|低落|消沉|疲惫|难过|紧张|担忧|烦躁|崩溃|痛苦|失落|孤独|无助/

function normalizeEmotionTag(tag?: string) {
  return (tag || '').trim().toLowerCase()
}

function getDiaryDate(diary: Diary) {
  return new Date(`${diary.diary_date}T00:00:00`)
}

function formatDate(date: string) {
  return date ? date.split('-').join('.') : ''
}

function toPreviewText(text: string, max = 92) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return '这篇日记还没有正文摘要。'
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized
}

function buildStats(diaries: Diary[]): { stats: DashboardStats; emotionStats: EmotionStat[] } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start30 = new Date(today)
  start30.setDate(today.getDate() - 29)
  const split15 = new Date(today)
  split15.setDate(today.getDate() - 14)
  const previousStart = new Date(today)
  previousStart.setDate(today.getDate() - 29)
  const previousEnd = new Date(today)
  previousEnd.setDate(today.getDate() - 15)

  const thisMonth = diaries.filter((d) => {
    const date = getDiaryDate(d)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }).length

  const last30Days = diaries.filter((d) => getDiaryDate(d) >= start30).length
  const recentHalf = diaries.filter((d) => getDiaryDate(d) >= split15).length
  const previousHalf = diaries.filter((d) => {
    const date = getDiaryDate(d)
    return date >= previousStart && date <= previousEnd
  }).length
  const trendDelta = previousHalf === 0 ? (recentHalf > 0 ? 100 : 0) : Math.round(((recentHalf - previousHalf) / previousHalf) * 100)
  const trend = trendDelta > 12 ? 'ascending' : trendDelta < -12 ? 'descending' : 'stable'
  const trendLabel = trend === 'ascending' ? '整体回升' : trend === 'descending' ? '略有回落' : '比较稳定'

  const emotionCounts: Record<string, number> = {}
  diaries.forEach((d) => {
    ;(d.emotion_tags ?? []).forEach((tag) => {
      const normalizedTag = normalizeEmotionTag(tag)
      if (!normalizedTag) return
      emotionCounts[normalizedTag] = (emotionCounts[normalizedTag] || 0) + 1
    })
  })

  const totalTags = Object.values(emotionCounts).reduce((a, b) => a + b, 0)
  const emotionStats = Object.entries(emotionCounts)
    .map(([tag, count]) => ({ tag, count, percentage: totalTags > 0 ? Math.round((count / totalTags) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  const [topEmotion = '暂无', topEmotionCount = 0] = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0] || []
  const negativeCount = emotionStats
    .filter((item) => negativeEmotionPattern.test(item.tag))
    .reduce((sum, item) => sum + item.count, 0)
  const negativeRatio = totalTags ? negativeCount / totalTags : 0
  const riskLabel = negativeRatio > 0.35 ? '需要关注' : trend === 'descending' ? '轻度波动' : '状态平稳'
  const riskDesc = negativeRatio > 0.35
    ? '建议留意压力与休息节奏'
    : trend === 'descending'
      ? '近期记录减少，可温柔地补一次回顾'
      : '继续保持记录与睡眠节奏'

  return {
    stats: {
      total: diaries.length,
      last30Days,
      thisMonth,
      topEmotion,
      topEmotionCount,
      trend,
      trendLabel,
      trendDelta,
      riskLabel,
      riskDesc,
    },
    emotionStats,
  }
}

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { diaries, fetchDiaries, isLoading } = useDiaryStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [dashboardInsights, setDashboardInsights] = useState<DashboardInsights | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
    void fetchDiaries({ page: 1, pageSize: 80 })
    diaryService.getDashboardInsights(30)
      .then(setDashboardInsights)
      .catch(() => setDashboardInsights(null))
  }, [fetchDiaries])

  const fallbackDashboard = useMemo(() => buildStats(diaries), [diaries])
  const stats = useMemo(
    () => dashboardInsights ? toDashboardStats(dashboardInsights) : fallbackDashboard.stats,
    [dashboardInsights, fallbackDashboard.stats]
  )
  const emotionStats = useMemo(
    () => dashboardInsights?.emotion_stats?.length
      ? dashboardInsights.emotion_stats.map((item) => ({ tag: item.tag, count: item.count, percentage: item.percentage }))
      : fallbackDashboard.emotionStats,
    [dashboardInsights, fallbackDashboard.emotionStats]
  )
  const recentDiaries: RecentDashboardDiary[] = useMemo(
    () => dashboardInsights?.recent_diaries?.length
      ? dashboardInsights.recent_diaries
      : diaries.slice(0, 6).map((diary) => ({ ...diary, summary: toPreviewText(diary.content), analysis_path: `/analysis/${diary.id}` })),
    [dashboardInsights, diaries]
  )
  const displayName = user?.username || user?.email?.split('@')[0] || '用户'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  const handleLogout = async () => {
    setShowUserMenu(false)
    await logout()
    navigate('/login')
  }

  if (isLoading && diaries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf7f2]">
        <div className="h-8 w-8 rounded-full border-2 border-[#eaded8] border-t-[#d9796f] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fffaf6_0%,#f7f1ec_46%,#f4f1fb_100%)] text-stone-700">
      <DashboardNav
        displayName={displayName}
        avatarLetter={avatarLetter}
        avatarUrl={user?.avatar_url}
        email={user?.email}
        role={user?.role}
        showUserMenu={showUserMenu}
        menuRef={menuRef}
        onToggleMenu={() => setShowUserMenu((value) => !value)}
        onCloseMenu={() => setShowUserMenu(false)}
        onLogout={handleLogout}
        onNavigate={navigate}
      />

      <main className="mx-auto max-w-[1460px] space-y-5 px-4 py-5 sm:px-6 lg:px-10">
        <DashboardHero
          displayName={displayName}
          stats={stats}
          emotionStats={emotionStats}
          observation={dashboardInsights?.ai_observation}
          onWrite={() => navigate('/diaries/new')}
          onAnalysis={() => navigate('/analysis')}
        />

        <OverviewStatCards stats={stats} t={t} />

        <PrimaryActionCards onNavigate={navigate} />

        {emotionStats.length > 0 ? (
          <EmotionInsightSection
            stats={stats}
            emotionStats={emotionStats}
            insights={dashboardInsights?.insights}
            t={t}
            onNavigate={navigate}
          />
        ) : null}

        {recentDiaries.length > 0 ? (
          <RecentDiaryGrid diaries={recentDiaries} t={t} onNavigate={navigate} />
        ) : (
          <EmptyDiaryState onWrite={() => navigate('/diaries/new')} />
        )}
      </main>
    </div>
  )
}

function toDashboardStats(data: DashboardInsights): DashboardStats {
  return {
    total: data.stats.total_diaries,
    last30Days: data.stats.last_days_count,
    thisMonth: data.stats.this_month_count,
    topEmotion: data.stats.top_emotion,
    topEmotionCount: data.stats.top_emotion_count,
    trend: data.stats.trend === 'ascending' || data.stats.trend === 'descending' ? data.stats.trend : 'stable',
    trendLabel: data.stats.trend_label,
    trendDelta: data.stats.trend_delta,
    riskLabel: data.stats.risk_label,
    riskDesc: data.stats.risk_desc,
  }
}

function DashboardNav({
  displayName,
  avatarLetter,
  avatarUrl,
  email,
  role,
  showUserMenu,
  menuRef,
  onToggleMenu,
  onCloseMenu,
  onLogout,
  onNavigate,
}: {
  displayName: string
  avatarLetter: string
  avatarUrl?: string | null
  email?: string
  role?: string
  showUserMenu: boolean
  menuRef: React.RefObject<HTMLDivElement>
  onToggleMenu: () => void
  onCloseMenu: () => void
  onLogout: () => void
  onNavigate: (path: string) => void
}) {
  const { t } = useTranslation()
  const navItems = [
    ['/', t('navigation.dashboard')],
    ['/diaries', t('navigation.diaries')],
    ['/growth', t('navigation.growth')],
    ['/emotion', t('navigation.emotion')],
    ['/community', t('navigation.community')],
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-[#eadfd8]/80 bg-[#fffaf6]/86 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1460px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('/')} className="flex items-center gap-3">
            <img src="/yingji_logo_2_healing_1_no_bg.png" alt="映记 Logo" className="h-10 w-10 object-contain drop-shadow-sm" />
            <span className="text-xl font-bold tracking-normal text-stone-800">映记</span>
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(([path, label]) => {
              const active = path === '/'
              return (
                <button
                  key={path}
                  onClick={() => onNavigate(path)}
                  className={`relative rounded-2xl px-5 py-3 text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#fff0e9] text-[#a85d50] shadow-sm'
                      : 'text-stone-500 hover:bg-white/70 hover:text-stone-800'
                  }`}
                >
                  {label}
                  {active ? <span className="absolute bottom-1 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-[#e8796e]" /> : null}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={onToggleMenu}
            className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 transition-all hover:bg-white/70"
          >
            <UserAvatar avatarUrl={avatarUrl} avatarLetter={avatarLetter} size="md" />
            <span className="hidden text-sm font-medium text-stone-600 sm:block">{displayName}</span>
            <ChevronRight className={`h-4 w-4 text-stone-400 transition-transform ${showUserMenu ? 'rotate-90' : ''}`} />
          </button>

          {showUserMenu ? (
            <div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-3xl border border-[#eadfd8] bg-white/96 shadow-[0_22px_60px_rgba(98,72,58,0.16)] backdrop-blur-xl">
              <div className="border-b border-[#f0e5df] px-4 py-4">
                <div className="flex items-center gap-3">
                  <UserAvatar avatarUrl={avatarUrl} avatarLetter={avatarLetter} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-800">{displayName}</p>
                    <p className="truncate text-xs text-stone-400">{email}</p>
                  </div>
                </div>
              </div>
              <div className="py-2">
                <MenuButton icon={<PenLine />} label={t('navigation.writeDiary')} onClick={() => { onCloseMenu(); onNavigate('/diaries/new') }} />
                <MenuButton icon={<BookOpen />} label={t('navigation.myDiaries')} onClick={() => { onCloseMenu(); onNavigate('/diaries') }} />
                <MenuButton icon={<Settings />} label={t('navigation.settings')} onClick={() => { onCloseMenu(); onNavigate('/settings') }} />
                {role === 'student' ? (
                  <MenuButton icon={<Sparkles />} label="申请辅导员/心理老师认证" onClick={() => { onCloseMenu(); onNavigate('/counselor/apply') }} />
                ) : null}
                {role === 'counselor' || role === 'psychologist' || role === 'admin' ? (
                  <MenuButton icon={<BarChart3 />} label="辅导员工作台" onClick={() => { onCloseMenu(); onNavigate('/counselor/dashboard') }} />
                ) : null}
              </div>
              <div className="border-t border-[#f0e5df] py-2">
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-400 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  {t('auth.logout')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function UserAvatar({ avatarUrl, avatarLetter, size }: { avatarUrl?: string | null; avatarLetter: string; size: 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-11 w-11' : 'h-10 w-10'
  return (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white shadow-md ring-2 ring-white/90`}
      style={!avatarUrl ? { background: 'linear-gradient(135deg, #e99380, #b49ad0)' } : undefined}
    >
      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : avatarLetter}
    </span>
  )
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-stone-600 transition-colors hover:bg-[#fff5ef]"
    >
      <span className="text-[#b96d60] [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      {label}
    </button>
  )
}

function DashboardHero({
  displayName,
  stats,
  emotionStats,
  observation,
  onWrite,
  onAnalysis,
}: {
  displayName: string
  stats: DashboardStats
  emotionStats: EmotionStat[]
  observation?: DashboardInsights['ai_observation']
  onWrite: () => void
  onAnalysis: () => void
}) {
  const topLabel = stats.topEmotion === '暂无' ? '平稳' : stats.topEmotion
  const readableTop = topLabel === '平稳' ? topLabel : topLabel
  const secondaryEmotion = emotionStats[1]?.tag

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-[#f9ded9] shadow-[0_18px_54px_rgba(171,103,88,0.14)]">
      <img src="/dashboard-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-95" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,249,244,0.88)_0%,rgba(255,241,234,0.68)_44%,rgba(252,218,222,0.24)_100%)]" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <div className="flex min-h-[218px] flex-col justify-center">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/72 px-3 py-1.5 text-xs font-semibold text-[#b76458] shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {displayName}，今天也被好好接住
          </div>
          <h1 className="max-w-3xl text-[30px] font-bold leading-tight tracking-normal text-stone-900 sm:text-[38px] lg:text-[42px]">
            让每一个情绪，都被温柔看见
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-stone-600">
            基于 AI 与萨提亚冰山模型，帮助你记录情绪、理解自己、看见成长。
            把零散的日常片段，慢慢沉淀成属于你的心理成长轨迹。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onWrite}
              className="group inline-flex h-11 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#f26f63,#e451a4)] px-6 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(226,81,113,0.26)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(226,81,113,0.32)] active:scale-[0.98]"
            >
              <PenLine className="h-5 w-5" />
              开始写日记
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onAnalysis}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/80 bg-white/84 px-6 text-sm font-semibold text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white active:scale-[0.98]"
            >
              <Sparkles className="h-5 w-5 text-[#996ff0]" />
              查看 AI 分析
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-[385px] rounded-[28px] border border-white/85 bg-white/80 p-5 shadow-[0_18px_48px_rgba(121,85,84,0.14)] backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-stone-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#f5edff] text-[#9369df]">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              AI 今日观察
            </div>
            <p className="text-base font-semibold leading-7 text-stone-800">
              {observation?.summary || `你近期的情绪以「${readableTop}」${secondaryEmotion ? `和「${secondaryEmotion}」` : ''}为主，整体状态${stats.trend === 'descending' ? '有些起伏' : '正在慢慢稳定'}。`}
            </p>
            <div className="mt-3 rounded-2xl bg-[#faf1ff] px-4 py-3 text-xs font-medium leading-6 text-[#9d6bd2]">
              {observation?.encouragement || `${stats.riskDesc}，继续记录，情绪会越来越有迹可循。`}
            </div>
            <div className="mt-4 h-14 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fff9fb,#fff4ed)] px-3 py-2">
              <svg viewBox="0 0 320 56" className="h-full w-full" role="img" aria-label="近期情绪波形趋势">
                <defs>
                  <linearGradient id="heroWaveStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#b99cf1" />
                    <stop offset="52%" stopColor="#e99ed9" />
                    <stop offset="100%" stopColor="#f39ab4" />
                  </linearGradient>
                  <linearGradient id="heroWaveFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#e99ed9" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="#f39ab4" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M4 35 C28 35 31 23 54 23 C75 23 78 40 99 40 C120 40 122 18 143 18 C164 18 166 34 186 34 C206 34 208 26 226 26 C247 26 249 12 270 12 C291 12 294 27 316 27"
                  fill="none"
                  stroke="url(#heroWaveStroke)"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
                <path
                  d="M4 35 C28 35 31 23 54 23 C75 23 78 40 99 40 C120 40 122 18 143 18 C164 18 166 34 186 34 C206 34 208 26 226 26 C247 26 249 12 270 12 C291 12 294 27 316 27 L316 56 L4 56 Z"
                  fill="url(#heroWaveFill)"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function OverviewStatCards({ stats, t }: { stats: DashboardStats; t: ReturnType<typeof useTranslation>['t'] }) {
  const statCards = [
    {
      icon: <CalendarDays />,
      label: '最近30天记录',
      value: `${stats.last30Days}天`,
      desc: '坚持记录的每一天',
      className: 'from-[#fff3ef] to-[#fff9f5] border-[#f4d7cf] text-[#db6f5f]',
    },
    {
      icon: <Heart />,
      label: '主要情绪',
      value: stats.topEmotion === '暂无' ? '待记录' : getEmotionDisplayLabel(t, stats.topEmotion),
      desc: stats.topEmotionCount ? `出现 ${stats.topEmotionCount} 次` : '写下第一篇后生成',
      className: 'from-[#fff8df] to-[#fffdf5] border-[#f1dfb2] text-[#d78a1c]',
    },
    {
      icon: <TrendingUp />,
      label: '情绪趋势',
      value: stats.trendLabel,
      desc: stats.trendDelta === 0 ? '较上期基本持平' : `较上期 ${stats.trendDelta > 0 ? '+' : ''}${stats.trendDelta}%`,
      className: 'from-[#f6efff] to-[#fffafe] border-[#dfcff6] text-[#8f63e4]',
    },
    {
      icon: <ShieldCheck />,
      label: 'AI 状态提示',
      value: stats.riskLabel,
      desc: stats.riskDesc,
      className: 'from-[#edf7ff] to-[#f7fcff] border-[#cfe4f7] text-[#5f92d8]',
    },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statCards.map((item) => (
        <article
          key={item.label}
          className={`group rounded-[22px] border bg-gradient-to-br p-4 shadow-[0_12px_34px_rgba(115,84,69,0.055)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(115,84,69,0.10)] ${item.className}`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/75 shadow-sm [&_svg]:h-5 [&_svg]:w-5">
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-500">{item.label}</p>
              <p className="mt-0.5 truncate text-xl font-bold tracking-normal">{item.value}</p>
              <p className="mt-1 truncate text-xs text-stone-400">{item.desc}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}

function PrimaryActionCards({ onNavigate }: { onNavigate: (path: string) => void }) {
  const actions = [
    {
      icon: <PenLine />,
      title: '写日记',
      desc: '记录今天的感受与事件',
      path: '/diaries/new',
      className: 'border-[#ffcfc8] bg-[linear-gradient(135deg,#fff8f5,#fff0ef)] text-[#dd6d62]',
    },
    {
      icon: <Sparkles />,
      title: 'AI 分析',
      desc: '基于冰山模型理解情绪背后的原因',
      path: '/analysis',
      className: 'border-[#dfd0ff] bg-[linear-gradient(135deg,#fbf8ff,#f6f0ff)] text-[#8f65e8]',
    },
    {
      icon: <BarChart3 />,
      title: '成长中心',
      desc: '查看长期趋势、转折点与成长建议',
      path: '/growth',
      className: 'border-[#ccebdc] bg-[linear-gradient(135deg,#f6fffa,#effbf4)] text-[#4bbf88]',
    },
  ]

  const secondary = [
    { label: '日记浏览', path: '/diaries', icon: <BookOpen /> },
    { label: '情绪星图', path: '/emotion', icon: <Orbit /> },
    { label: '匿名社区', path: '/community', icon: <MessageCircle /> },
  ]

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_250px]">
      {actions.map((item) => (
        <button
          key={item.title}
          onClick={() => onNavigate(item.path)}
          className={`group min-h-[98px] rounded-[22px] border p-4 text-left shadow-[0_12px_34px_rgba(115,84,69,0.055)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(115,84,69,0.12)] ${item.className}`}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/76 shadow-sm [&_svg]:h-6 [&_svg]:w-6">
              {item.icon}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-stone-400 transition-all group-hover:translate-x-1 group-hover:text-current">
              <ChevronRight className="h-5 w-5" />
            </span>
          </div>
          <h2 className="mt-3 text-lg font-bold text-stone-800">{item.title}</h2>
          <p className="mt-1 text-sm text-stone-500">{item.desc}</p>
        </button>
      ))}
      <div className="grid gap-2 rounded-[22px] border border-[#eadfd8] bg-white/64 p-3 shadow-[0_12px_34px_rgba(115,84,69,0.05)] sm:grid-cols-3 lg:grid-cols-1">
        {secondary.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.path)}
            className="flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold text-stone-600 transition-all hover:bg-[#fff6f0] hover:text-[#ad6558]"
          >
            <span className="flex items-center gap-2 [&_svg]:h-4 [&_svg]:w-4">{item.icon}{item.label}</span>
            <ChevronRight className="h-4 w-4 text-stone-300" />
          </button>
        ))}
      </div>
    </section>
  )
}

function EmotionInsightSection({
  stats,
  emotionStats,
  insights: backendInsights,
  t,
  onNavigate,
}: {
  stats: DashboardStats
  emotionStats: EmotionStat[]
  insights?: string[]
  t: ReturnType<typeof useTranslation>['t']
  onNavigate: (path: string) => void
}) {
  const displayStats = emotionStats.slice(0, 7)
  const maxCount = Math.max(...displayStats.map((item) => item.count), 1)
  const topTwo = displayStats.slice(0, 2).map((item) => `「${getEmotionDisplayLabel(t, item.tag)}」`).join('和')
  const insights = backendInsights?.length ? backendInsights : [
    `近期情绪以${topTwo || '平稳状态'}为主，整体状态${stats.trend === 'descending' ? '略有波动' : '较积极稳定'}。`,
    stats.trend === 'ascending'
      ? '记录频率在近期有所回升，说明你正在重新建立和自己对话的节奏。'
      : stats.trend === 'descending'
        ? '近期记录节奏略有下降，可以用一句话日记先轻轻接住当天状态。'
        : '记录节奏比较稳定，适合继续观察重复出现的情绪主题。',
    stats.riskLabel === '需要关注'
      ? '负向情绪占比偏高，建议关注压力来源、睡眠和可求助资源。'
      : '你的情绪恢复能力较好，能够从轻微压力中慢慢调整回来。',
    '建议保持规律记录与睡眠节奏，让成长轨迹持续变得清晰。',
  ]

  return (
    <section className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
      <div className="rounded-[28px] border border-[#eadfd8] bg-white/78 p-6 shadow-[0_18px_52px_rgba(115,84,69,0.08)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#c86e61]" />
              <h2 className="text-xl font-bold text-stone-800">情绪分布</h2>
              <span className="text-sm text-stone-400">近30天</span>
            </div>
            <p className="mt-1 text-sm text-stone-400">气泡大小代表出现频率</p>
          </div>
          <button
            onClick={() => onNavigate('/emotion')}
            className="hidden rounded-2xl border border-[#eadfd8] bg-white/78 px-4 py-2 text-sm font-semibold text-[#b76458] transition-all hover:bg-[#fff3ee] sm:inline-flex"
          >
            进入情绪星图
          </button>
        </div>
        <div className="relative min-h-[255px] overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#fffaf7,#fdf3ef)] p-5">
          <div className="flex min-h-[220px] flex-wrap items-center justify-center gap-4">
            {displayStats.map((item, index) => {
              const size = 84 + (item.count / maxCount) * 68
              const palette = [
                'from-[#74d6b0] to-[#9fe5cc]',
                'from-[#f7b84b] to-[#ffd67d]',
                'from-[#a98bef] to-[#c9b5ff]',
                'from-[#7fcbd5] to-[#a8e4ea]',
                'from-[#f59b8f] to-[#ffc0b8]',
                'from-[#b8d875] to-[#d4ed9c]',
                'from-[#f3a6ce] to-[#ffd0e6]',
              ][index % 7]
              return (
                <button
                  key={item.tag}
                  className={`flex shrink-0 flex-col items-center justify-center rounded-full bg-gradient-to-br ${palette} text-white shadow-[0_14px_34px_rgba(102,75,62,0.13)] transition-all hover:-translate-y-1`}
                  style={{ width: size, height: size }}
                >
                  <span className="text-base font-bold">{getEmotionDisplayLabel(t, item.tag)}</span>
                  <span className="mt-1 text-sm font-semibold opacity-90">{item.count}次</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#eadfd8] bg-white/82 p-6 shadow-[0_18px_52px_rgba(115,84,69,0.08)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4edff] text-[#8f63e4]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-stone-800">AI 综合观察</h2>
            <p className="text-sm text-stone-400">把数据翻译成更容易理解的提醒</p>
          </div>
        </div>
        <div className="space-y-3">
          {insights.map((item, index) => (
            <div key={index} className="flex gap-3 rounded-2xl bg-[#fff9f5] px-4 py-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[#d37b6d] shadow-sm">
                {index + 1}
              </span>
              <p className="text-sm leading-7 text-stone-600">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RecentDiaryGrid({ diaries, t, onNavigate }: { diaries: RecentDashboardDiary[]; t: ReturnType<typeof useTranslation>['t']; onNavigate: (path: string) => void }) {
  return (
    <section className="rounded-[28px] border border-[#eadfd8] bg-white/74 p-6 shadow-[0_18px_52px_rgba(115,84,69,0.08)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookMarked className="h-5 w-5 text-[#b76458]" />
          <div>
            <h2 className="text-xl font-bold text-stone-800">最近日记</h2>
            <p className="text-sm text-stone-400">从真实记录里，看见最近的自己</p>
          </div>
        </div>
        <button onClick={() => onNavigate('/diaries')} className="text-sm font-semibold text-[#b76458] transition-colors hover:text-[#914c42]">
          查看全部 →
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {diaries.map((diary) => (
          <article
            key={diary.id}
            className="group rounded-[24px] border border-[#efe4de] bg-white/88 p-5 shadow-[0_12px_32px_rgba(100,76,60,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(100,76,60,0.12)]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="line-clamp-1 text-lg font-bold text-stone-800">{diary.title || '无标题'}</h3>
              <span className="shrink-0 text-xs font-medium text-stone-400">{formatDate(diary.diary_date)}</span>
            </div>
            <div className="mb-3 flex min-h-[28px] flex-wrap gap-2">
              {(diary.emotion_tags ?? []).slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-[#f2eee9] px-2.5 py-1 text-xs font-medium text-[#b76458]">
                  {getEmotionDisplayLabel(t, tag)}
                </span>
              ))}
            </div>
            <p className="min-h-[52px] text-sm leading-7 text-stone-500 line-clamp-2">{diary.summary || toPreviewText(diary.content || '')}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-stone-300">{diary.word_count || 0} 字</span>
              <button
                onClick={() => onNavigate(diary.analysis_path || `/analysis/${diary.id}`)}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-[#e9d9ff] bg-[#fbf8ff] px-3.5 py-2 text-xs font-bold text-[#8f63e4] transition-all hover:bg-[#f4edff]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                查看分析
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function EmptyDiaryState({ onWrite }: { onWrite: () => void }) {
  return (
    <section className="rounded-[28px] border border-[#eadfd8] bg-white/74 px-6 py-16 text-center shadow-[0_18px_52px_rgba(115,84,69,0.08)]">
      <Sprout className="mx-auto mb-4 h-12 w-12 text-emerald-300" />
      <h2 className="text-xl font-bold text-stone-800">从第一篇日记开始</h2>
      <p className="mt-2 text-sm text-stone-400">一句话也可以，先把今天的感受轻轻放下来。</p>
      <button
        onClick={onWrite}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#d8786a] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(216,120,106,0.24)] transition-all hover:-translate-y-0.5"
      >
        <PenLine className="h-4 w-4" />
        写第一篇日记
      </button>
    </section>
  )
}
