import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading } from '@/components/common/Loading'
import { diaryService } from '@/services/diary.service'
import type { TerrainEvent, TerrainPoint, TerrainResponse } from '@/types/diary'

type DayWindow = 7 | 30 | 90

type SatirLayer = 'behavior' | 'emotion' | 'cognition' | 'belief' | 'desire'

const EMOTION_COLOR: Record<string, string> = {
  开心: '#F5C842',
  兴奋: '#F5C842',
  满足: '#F5C842',
  平静: '#F5C842',
  成长: '#7BC47F',
  积极: '#7BC47F',
  焦虑: '#8AAFC8',
  担忧: '#8AAFC8',
  压力: '#8AAFC8',
  困惑: '#B8A9D4',
  低落: '#B8A9D4',
  失落: '#B8A9D4',
  愤怒: '#E8856A',
  激动: '#E8856A',
}

const SATIR_LAYER_STYLE: Record<
  SatirLayer,
  { title: string; bg: string; color: string; empty: string }
> = {
  behavior: { title: '我做了什么', bg: '#FFF5E6', color: '#D4820A', empty: '暂无行为关键词' },
  emotion: { title: '我感受到', bg: '#F0EBF8', color: '#7B5EA7', empty: '暂无情绪关键词' },
  cognition: { title: '我在想', bg: '#E8F4F0', color: '#2E7D62', empty: '暂无认知关键词' },
  belief: { title: '我相信', bg: '#EBF2FA', color: '#2563AB', empty: '暂无信念关键词' },
  desire: { title: '我渴望', bg: '#FEF3F2', color: '#C0392B', empty: '暂无渴望关键词' },
}

const EVENT_ICON_MAP: Record<string, string> = {
  work: '💼',
  relationship: '🤝',
  health: '🌙',
  achievement: '🏆',
  other: '✨',
}

const LAYER_KEYWORDS: Record<SatirLayer, string[]> = {
  behavior: ['做', '完成', '推进', '开发', '工作', '学习', '运动', '整理', '沟通', '安排'],
  emotion: ['开心', '平静', '焦虑', '担忧', '失落', '疲惫', '满足', '困惑', '难过', '轻松'],
  cognition: ['觉得', '意识到', '反思', '想到', '理解', '判断', '计划', '逻辑', '选择', '原因'],
  belief: ['应该', '必须', '价值', '意义', '相信', '原则', '重要', '成长', '坚持', '标准'],
  desire: ['希望', '想要', '渴望', '期待', '被看见', '自由', '平衡', '陪伴', '突破', '安全感'],
}

function getPrimaryEmotion(point: TerrainPoint): string {
  const raw = point.events[0]?.emotion_tag || ''
  return raw || '无记录'
}

function getMoodColor(point: TerrainPoint): string {
  const emotion = getPrimaryEmotion(point)
  return EMOTION_COLOR[emotion] || '#E8E6E2'
}

function getMoodOpacity(point?: TerrainPoint): number {
  if (!point || point.events.length === 0) return 0.15
  const energy = point.energy ?? 5
  const density = point.density ?? 0
  const score = Math.max(0, Math.min(1, energy / 10 * 0.7 + Math.min(density, 4) / 4 * 0.3))
  return 0.5 + score * 0.5
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function tokenCount(text: string, token: string): number {
  if (!text || !token) return 0
  let idx = 0
  let count = 0
  while (idx >= 0) {
    idx = text.indexOf(token, idx)
    if (idx >= 0) {
      count += 1
      idx += token.length
    }
  }
  return count
}

function pickTopKeywords(events: TerrainEvent[], layer: SatirLayer): Array<{ word: string; weight: number }> {
  const candidates = LAYER_KEYWORDS[layer]
  const text = events.map((e) => `${e.summary} ${e.emotion_tag || ''}`).join(' ')
  const scored = candidates
    .map((w) => ({ word: w, weight: tokenCount(text, w) }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)

  if (scored.length === 0) return []
  const max = scored[0].weight || 1
  return scored.map((s) => ({ word: s.word, weight: Math.max(0.3, s.weight / max) }))
}

export default function Timeline() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [windowDays, setWindowDays] = useState<DayWindow>(30)
  const [terrain, setTerrain] = useState<TerrainResponse | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<TerrainPoint | null>(null)
  const [markerSummary, setMarkerSummary] = useState<{ icon: string; summary: string; diaryId: number | null } | null>(null)
  const [calendarMonth, setCalendarMonth] = useState<Date>(monthStart(new Date()))

  useEffect(() => {
    const loadTerrain = async () => {
      setIsLoading(true)
      try {
        const data = await diaryService.getTerrainData(windowDays)
        setTerrain(data)
        const firstWithEvents = [...data.points].reverse().find((p) => p.events.length > 0)
        setSelectedPoint(firstWithEvents || data.points[data.points.length - 1] || null)
      } catch (error) {
        console.error('Failed to fetch growth data:', error)
        setTerrain(null)
        setSelectedPoint(null)
      } finally {
        setIsLoading(false)
      }
    }
    void loadTerrain()
  }, [windowDays])

  const pointMap = useMemo(() => {
    const map = new Map<string, TerrainPoint>()
    ;(terrain?.points || []).forEach((p) => map.set(p.date, p))
    return map
  }, [terrain])

  const calendarCells = useMemo(() => {
    const start = monthStart(calendarMonth)
    const end = monthEnd(calendarMonth)
    const list: Array<{ date: Date; inMonth: boolean }> = []
    const firstWeekDay = start.getDay()
    for (let i = 0; i < firstWeekDay; i += 1) {
      const d = new Date(start)
      d.setDate(start.getDate() - (firstWeekDay - i))
      list.push({ date: d, inMonth: false })
    }
    for (let d = 1; d <= end.getDate(); d += 1) {
      list.push({ date: new Date(start.getFullYear(), start.getMonth(), d), inMonth: true })
    }
    while (list.length % 7 !== 0) {
      const last = list[list.length - 1].date
      const next = new Date(last)
      next.setDate(last.getDate() + 1)
      list.push({ date: next, inMonth: false })
    }
    return list
  }, [calendarMonth])

  const chartData = useMemo(() => {
    if (!terrain) return []
    return terrain.points.map((point, i, arr) => {
      const prev = i > 0 ? arr[i - 1] : null
      const jump = prev && point.energy !== null && prev.energy !== null ? Math.abs(point.energy - prev.energy) : 0
      const marker = jump >= 2 && point.events.length > 0 ? point.events[0] : null
      return {
        date: point.date,
        label: format(new Date(point.date), 'M/d'),
        value: point.energy ?? null,
        raw: point,
        markerIcon: marker ? EVENT_ICON_MAP[marker.event_type || 'other'] || '✨' : null,
        markerSummary: marker?.summary || null,
        markerDiaryId: marker?.diary_id || null,
      }
    })
  }, [terrain])

  const satirKeywords = useMemo(() => {
    const events = (terrain?.points || []).flatMap((p) => p.events)
    return {
      behavior: pickTopKeywords(events, 'behavior'),
      emotion: pickTopKeywords(events, 'emotion'),
      cognition: pickTopKeywords(events, 'cognition'),
      belief: pickTopKeywords(events, 'belief'),
      desire: pickTopKeywords(events, 'desire'),
    }
  }, [terrain])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <header className="backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(250,249,247,0.86)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="text-stone-600 hover:bg-stone-100/70">
              ← 返回
            </Button>
            <h1 className="text-lg sm:text-xl font-semibold text-stone-800 tracking-wide">成长中心</h1>
            <Button onClick={() => navigate('/diaries/new')} className="text-white" style={{ background: 'linear-gradient(135deg, #e28674, #9c95b5)' }}>
              写日记
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-8 space-y-8">
        {!terrain || terrain.points.length < 3 ? (
          <Card className="border-stone-200/80 bg-white/90">
            <CardContent className="py-14 text-center">
              <p className="text-stone-500 mb-4">再写几篇日记，成长洞察将逐渐清晰</p>
              <Button onClick={() => navigate('/diaries/new')}>写第一篇日记</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-stone-200/70 bg-white/88 shadow-[0_14px_35px_rgba(95,84,122,0.08)]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg text-stone-800">心情日历</CardTitle>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                      className="w-8 h-8 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 mx-auto" />
                    </button>
                    <span className="text-sm text-stone-600 min-w-[90px] text-center">
                      {format(calendarMonth, 'yyyy年M月')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                      className="w-8 h-8 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-all"
                    >
                      <ChevronRight className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="grid grid-cols-7 gap-2 text-xs text-stone-400 mb-2 px-1">
                  {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
                    <div key={w} className="text-center">{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map(({ date, inMonth }) => {
                    const key = dateKey(date)
                    const point = pointMap.get(key)
                    const color = point ? getMoodColor(point) : '#E8E6E2'
                    const opacity = getMoodOpacity(point)
                    const summary = point?.events[0]?.summary || '暂无记录'
                    const diaryId = point?.events[0]?.diary_id || null
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (diaryId) navigate(`/diaries/${diaryId}`)
                        }}
                        className={`relative w-full aspect-square rounded-full border border-white/80 transition-all duration-300 hover:scale-105 ${inMonth ? '' : 'opacity-45'}`}
                        style={{ backgroundColor: color, opacity, cursor: diaryId ? 'pointer' : 'default' }}
                        title={`${format(date, 'M月d日')} · ${getPrimaryEmotion(point || { date: key, energy: null, valence: null, density: 0, events: [] })} · ${summary}`}
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-stone-700/75">
                          {date.getDate()}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200/70 bg-white/88 shadow-[0_14px_35px_rgba(95,84,122,0.08)]">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base sm:text-lg text-stone-800">能量值趋势图</CardTitle>
                  <div className="flex items-center gap-2">
                    {([7, 30, 90] as DayWindow[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setWindowDays(d)}
                        className={`h-8 px-3.5 rounded-xl text-xs font-medium transition-all ${
                          windowDays === d
                            ? 'text-white shadow'
                            : 'text-stone-600 bg-stone-100 hover:bg-stone-200/70'
                        }`}
                        style={windowDays === d ? { background: 'linear-gradient(135deg, #df7f70, #8f86ab)' } : undefined}
                      >
                        {d} 天
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="h-[320px] sm:h-[360px] w-full rounded-2xl border border-stone-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.75)_0%,rgba(248,244,250,0.6)_100%)] px-2 sm:px-4 pt-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 16, right: 10, left: 6, bottom: 8 }}
                      onClick={(state: any) => {
                        const payload = state?.activePayload?.[0]?.payload
                        if (payload?.raw) setSelectedPoint(payload.raw as TerrainPoint)
                      }}
                    >
                      <defs>
                        <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F5C842" stopOpacity={0.32} />
                          <stop offset="55%" stopColor="#E9A6A0" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#4A6FA5" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="4 4" stroke="#d8d2de" opacity={0.65} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => format(new Date(value), 'M/d')}
                        stroke="#8e8599"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis domain={[1, 10]} stroke="#8e8599" tick={{ fontSize: 12 }} width={44} />
                      <Tooltip
                        cursor={{ stroke: '#b7a9c8', strokeDasharray: '3 3' }}
                        contentStyle={{
                          borderRadius: '14px',
                          border: '1px solid #e8e1ee',
                          background: 'rgba(255,255,255,0.95)',
                          boxShadow: '0 10px 24px rgba(73, 59, 93, 0.12)',
                        }}
                        formatter={(value: number) => `${value?.toFixed?.(1) ?? '-'} 分`}
                        labelFormatter={(value) => format(new Date(value), 'yyyy年MM月dd日')}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        connectNulls
                        stroke="#8e7aa6"
                        strokeWidth={2.5}
                        fill="url(#energyFill)"
                        animationDuration={600}
                        activeDot={{ r: 6, fill: '#dd7f6d', stroke: '#fff', strokeWidth: 2 }}
                        dot={(props: any) => {
                          const payload = props?.payload
                          if (!payload) return <g />
                          const fill =
                            payload.value >= 7 ? '#F5C842' : payload.value <= 3 ? '#4A6FA5' : '#D7A1A0'
                          return (
                            <g>
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={3}
                                fill={fill}
                                stroke="#fff"
                                strokeWidth={1.2}
                                onClick={() => setSelectedPoint(payload.raw as TerrainPoint)}
                                className="cursor-pointer"
                              />
                              {payload.markerIcon ? (
                                <text
                                  x={props.cx}
                                  y={props.cy - 10}
                                  textAnchor="middle"
                                  fontSize={14}
                                  className="cursor-pointer"
                                  onClick={() =>
                                    setMarkerSummary({
                                      icon: payload.markerIcon,
                                      summary: payload.markerSummary || '关键事件',
                                      diaryId: payload.markerDiaryId,
                                    })
                                  }
                                >
                                  {payload.markerIcon}
                                </text>
                              ) : null}
                            </g>
                          )
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {markerSummary ? (
                  <div className="rounded-xl border border-[#ece2da] bg-[#fffaf6] px-4 py-3 text-sm text-stone-700 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{markerSummary.icon} 关键节点</p>
                      <p className="text-stone-600 truncate">{markerSummary.summary}</p>
                    </div>
                    {markerSummary.diaryId ? (
                      <Button
                        variant="ghost"
                        className="text-[#a06058] hover:bg-[#f7eeea] hover:text-[#8f4f47]"
                        onClick={() => navigate(`/diaries/${markerSummary.diaryId}`)}
                      >
                        查看日记 →
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-stone-200/70 bg-white/90 shadow-[0_12px_30px_rgba(85,76,106,0.07)]">
              <CardHeader>
                <CardTitle className="text-base text-stone-800">萨提亚关键词卡片</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {(Object.keys(SATIR_LAYER_STYLE) as SatirLayer[]).map((layer) => {
                    const style = SATIR_LAYER_STYLE[layer]
                    const words = satirKeywords[layer]
                    return (
                      <div key={layer} className="rounded-2xl p-3.5 min-h-[160px]" style={{ background: style.bg }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: style.color }}>
                          {style.title}
                        </p>
                        {words.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {words.map((w) => (
                              <span
                                key={`${layer}-${w.word}`}
                                style={{
                                  color: style.color,
                                  fontSize: `${12 + Math.round(w.weight * 10)}px`,
                                  opacity: 0.6 + w.weight * 0.4,
                                }}
                              >
                                {w.word}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400">{style.empty}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200/70 bg-white/90 shadow-[0_12px_30px_rgba(85,76,106,0.07)]">
              <CardHeader>
                <CardTitle className="text-base text-stone-800">人际关系图谱（即将上线）</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-stone-500 leading-7">
                  这里将展示你近期记录中出现的人际互动关系与情感连结变化，帮助你看见长期关系模式。
                </p>
              </CardContent>
            </Card>

            <Card className="border-stone-200/70 bg-white/88">
              <CardHeader>
                <CardTitle className="text-base text-stone-800">当日详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedPoint ? (
                  <>
                    <div className="text-sm text-stone-500">
                      {format(new Date(selectedPoint.date), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="px-2.5 py-1 rounded-full bg-[#f6f2ef] text-[#a06058]">
                        能量值 {selectedPoint.energy ?? '-'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-[#f2eff7] text-[#7f6d96]">
                        愉悦值 {selectedPoint.valence ?? '-'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-[#eff3f7] text-[#637b95]">
                        事件数 {selectedPoint.density}
                      </span>
                    </div>
                    {selectedPoint.events.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPoint.events.map((event, idx) => (
                          <div key={`${event.diary_id}-${idx}`} className="rounded-xl border border-stone-200/80 bg-stone-50/60 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm text-stone-700">{event.summary}</p>
                                <p className="text-xs text-stone-500 mt-1">
                                  {event.emotion_tag || '未标注情绪'} · 重要性 {event.importance_score}/10
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                className="text-[#a06058] hover:bg-[#f7eeea] hover:text-[#8f4f47]"
                                onClick={() => navigate(`/diaries/${event.diary_id}`)}
                              >
                                查看日记 →
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-500">当天没有结构化事件，可能只记录了简短日记。</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-stone-500">点击日历或趋势图中的节点查看详情。</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

