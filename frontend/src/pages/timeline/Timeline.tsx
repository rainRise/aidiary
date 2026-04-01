import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading } from '@/components/common/Loading'
import { diaryService } from '@/services/diary.service'
import type { TerrainPoint, TerrainResponse, TerrainValley } from '@/types/diary'

type DimensionKey = 'energy' | 'valence' | 'density'
type DayWindow = 7 | 30 | 90

const DIMENSION_CONFIG: Record<DimensionKey, { label: string; yLabel: string; formatter: (v: number) => string }> = {
  energy: {
    label: '能量水平',
    yLabel: '生命力',
    formatter: (v) => `${v.toFixed(1)} 分`,
  },
  valence: {
    label: '愉悦程度',
    yLabel: '情绪正负',
    formatter: (v) => `${v.toFixed(2)}`,
  },
  density: {
    label: '事件密度',
    yLabel: '生活丰富度',
    formatter: (v) => `${Math.round(v)} 件`,
  },
}

function getEventTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    work: '工作',
    relationship: '关系',
    health: '健康',
    achievement: '成就',
    other: '其他',
  }
  if (!type) return '日常'
  return labels[type] || type
}

function interpolateValues(points: TerrainPoint[], key: DimensionKey): Array<number | null> {
  const raw = points.map((p) => (p[key] ?? null) as number | null)
  const values = [...raw]
  const knownIndexes = raw.map((v, i) => ({ v, i })).filter((item) => item.v !== null).map((item) => item.i)

  if (knownIndexes.length === 0) {
    return raw
  }

  const firstKnown = knownIndexes[0]
  const lastKnown = knownIndexes[knownIndexes.length - 1]

  for (let i = 0; i < firstKnown; i += 1) {
    values[i] = raw[firstKnown]
  }
  for (let i = lastKnown + 1; i < values.length; i += 1) {
    values[i] = raw[lastKnown]
  }

  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== null) continue

    let left = i - 1
    while (left >= 0 && values[left] === null) left -= 1
    let right = i + 1
    while (right < values.length && values[right] === null) right += 1

    if (left >= 0 && right < values.length && values[left] !== null && values[right] !== null) {
      const start = values[left] as number
      const end = values[right] as number
      values[i] = start + ((end - start) * (i - left)) / (right - left)
    }
  }

  return values
}

function isDateInValley(dateStr: string, valleys: TerrainValley[]): boolean {
  return valleys.some((valley) => dateStr >= valley.date_range[0] && dateStr <= valley.date_range[1])
}

export default function Timeline() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [windowDays, setWindowDays] = useState<DayWindow>(30)
  const [dimension, setDimension] = useState<DimensionKey>('energy')
  const [terrain, setTerrain] = useState<TerrainResponse | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<TerrainPoint | null>(null)

  useEffect(() => {
    const loadTerrain = async () => {
      setIsLoading(true)
      try {
        const data = await diaryService.getTerrainData(windowDays)
        setTerrain(data)
        const firstWithEvents = [...data.points].reverse().find((p) => p.events.length > 0)
        setSelectedPoint(firstWithEvents || data.points[data.points.length - 1] || null)
      } catch (error) {
        console.error('Failed to fetch terrain data:', error)
        setTerrain(null)
        setSelectedPoint(null)
      } finally {
        setIsLoading(false)
      }
    }

    void loadTerrain()
  }, [windowDays])

  const chartData = useMemo(() => {
    if (!terrain) return []
    const interpolated = interpolateValues(terrain.points, dimension)
    const peakDateSet = new Set(terrain.insights.peaks.map((p) => p.date))

    return terrain.points.map((point, index) => ({
      date: point.date,
      label: format(new Date(point.date), 'M/d'),
      value: interpolated[index],
      raw: point,
      isPeak: peakDateSet.has(point.date),
      isValley: isDateInValley(point.date, terrain.insights.valleys),
      hasEvents: point.events.length > 0,
    }))
  }, [terrain, dimension])

  const yDomain = useMemo(() => {
    if (dimension === 'energy') return [1, 10]
    if (dimension === 'valence') return [-1, 1]

    const maxDensity = Math.max(...chartData.map((d) => d.value || 0), 2)
    return [0, Math.ceil(maxDensity + 1)]
  }, [chartData, dimension])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(1200px 600px at -10% -10%, rgba(236, 230, 244, 0.65) 0%, rgba(248, 245, 240, 0.9) 45%, rgba(245, 241, 247, 1) 100%)',
      }}
    >
      <header className="backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.82)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="text-stone-600 hover:bg-stone-100/70">
              ← 返回
            </Button>
            <h1 className="text-lg sm:text-xl font-semibold text-stone-800 tracking-wide">成长轨迹</h1>
            <Button onClick={() => navigate('/diaries/new')} className="text-white" style={{ background: 'linear-gradient(135deg, #e28674, #9c95b5)' }}>
              写日记
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-8 space-y-6">
        {!terrain || chartData.length === 0 ? (
          <Card className="border-stone-200/80 bg-white/90">
            <CardContent className="py-14 text-center">
              <p className="text-stone-500 mb-4">还没有足够的数据生成地形图</p>
              <Button onClick={() => navigate('/diaries/new')}>写第一篇日记</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-stone-200/70 bg-white/88 shadow-[0_14px_35px_rgba(95,84,122,0.08)]">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base sm:text-lg text-stone-800">情绪地形图</CardTitle>
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
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DIMENSION_CONFIG) as DimensionKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDimension(key)}
                      className={`h-9 px-4 rounded-2xl text-sm font-medium transition-all ${
                        dimension === key
                          ? 'text-white shadow-md'
                          : 'text-stone-600 bg-stone-100 hover:bg-stone-200/70'
                      }`}
                      style={dimension === key ? { background: 'linear-gradient(135deg, #da7c6f, #9891b0)' } : undefined}
                    >
                      {DIMENSION_CONFIG[key].label}
                    </button>
                  ))}
                </div>

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
                        <linearGradient id="terrainFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e08c7c" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#9d92b5" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>

                      {terrain.insights.valleys.map((valley, index) => (
                        <ReferenceArea
                          key={`${valley.date_range[0]}-${valley.date_range[1]}-${index}`}
                          x1={valley.date_range[0]}
                          x2={valley.date_range[1]}
                          fill="#baaed1"
                          fillOpacity={0.12}
                          strokeOpacity={0}
                        />
                      ))}

                      <CartesianGrid strokeDasharray="4 4" stroke="#d8d2de" opacity={0.65} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => format(new Date(value), 'M/d')}
                        stroke="#8e8599"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        domain={yDomain as [number, number]}
                        stroke="#8e8599"
                        tick={{ fontSize: 12 }}
                        width={50}
                      />
                      <Tooltip
                        cursor={{ stroke: '#b7a9c8', strokeDasharray: '3 3' }}
                        contentStyle={{
                          borderRadius: '14px',
                          border: '1px solid #e8e1ee',
                          background: 'rgba(255,255,255,0.95)',
                          boxShadow: '0 10px 24px rgba(73, 59, 93, 0.12)',
                        }}
                        formatter={(value: number) => DIMENSION_CONFIG[dimension].formatter(value)}
                        labelFormatter={(value) => format(new Date(value), 'yyyy年MM月dd日')}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        connectNulls
                        stroke="#8e7aa6"
                        strokeWidth={3}
                        fill="url(#terrainFill)"
                        activeDot={{ r: 7, fill: '#dd7f6d', stroke: '#fff', strokeWidth: 2 }}
                        dot={(props: any) => {
                          const payload = props?.payload
                          if (!payload) return <g />
                          const fill = payload.isPeak ? '#d97159' : payload.isValley ? '#8e83a8' : '#b8adca'
                          const r = payload.isPeak ? 5 : payload.hasEvents ? 3 : 2
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={r}
                              fill={fill}
                              stroke="#fff"
                              strokeWidth={1.5}
                              onClick={() => setSelectedPoint(payload.raw as TerrainPoint)}
                              className="cursor-pointer"
                            />
                          )
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200/70 bg-white/90 shadow-[0_12px_30px_rgba(85,76,106,0.07)]">
              <CardHeader>
                <CardTitle className="text-base text-stone-800">事件详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedPoint ? (
                  <>
                    <div className="text-sm text-stone-500">
                      {format(new Date(selectedPoint.date), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="px-2.5 py-1 rounded-full bg-[#f6f2ef] text-[#a06058]">
                        生命力 {selectedPoint.energy ?? '-'}
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
                          <div
                            key={`${event.diary_id}-${idx}`}
                            className="rounded-xl border border-stone-200/80 bg-stone-50/60 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm text-stone-700">{event.summary}</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                  <span>{event.emotion_tag || '未标注情绪'}</span>
                                  <span>·</span>
                                  <span>{getEventTypeLabel(event.event_type)}</span>
                                  <span>·</span>
                                  <span>重要性 {event.importance_score}/10</span>
                                  {event.source_label ? (
                                    <>
                                      <span>·</span>
                                      <span className="px-1.5 py-0.5 rounded-md bg-[#f3eef9] text-[#7f6d96]">
                                        {event.source_label}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
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
                  <p className="text-sm text-stone-500">点击地形图上的任意点查看详情。</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-stone-200/70 bg-white/88">
              <CardHeader>
                <CardTitle className="text-base text-stone-800">AI 洞察</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-[#e8dfe8] bg-[#fbf8fd] px-4 py-3 text-sm text-stone-700">
                  🧭 {terrain.insights.trend_description}
                </div>

                {terrain.insights.peaks.length > 0 && (
                  <div className="rounded-xl border border-[#f1e4df] bg-[#fff9f7] px-4 py-3 text-sm text-stone-700">
                    ⛰️ {format(new Date(terrain.insights.peaks[0].date), 'M月d日')}：{terrain.insights.peaks[0].summary}
                  </div>
                )}

                {terrain.insights.valleys.length > 0 && (
                  <div className="rounded-xl border border-[#e6e1ef] bg-[#f8f6fc] px-4 py-3 text-sm text-stone-700">
                    🏕️ {format(new Date(terrain.insights.valleys[0].date_range[0]), 'M月d日')} -{' '}
                    {format(new Date(terrain.insights.valleys[0].date_range[1]), 'M月d日')}：{terrain.insights.valleys[0].summary}
                  </div>
                )}

                <div className="text-xs text-stone-400">
                  覆盖时间：{terrain.meta.start_date} 至 {terrain.meta.end_date}，共 {terrain.meta.total_events} 条事件
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
