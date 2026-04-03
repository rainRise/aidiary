import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiService } from '@/services/ai.service'
import { Loading } from '@/components/common/Loading'
import type { IcebergAnalysisResponse } from '@/types/analysis'
import { Sparkles, ChevronDown, ChevronUp, Waves, Droplets, Brain, KeyRound, Heart, Mail } from 'lucide-react'

// ── 冰山层级配置 ──
const LAYERS = [
  {
    key: 'behavior',
    label: '行为层',
    sublabel: '水面之上 · 别人看到的你',
    icon: Waves,
    gradient: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
    border: 'border-sky-200',
    textColor: 'text-sky-700',
    tagBg: 'bg-sky-50 text-sky-600 border-sky-100',
  },
  {
    key: 'emotion',
    label: '情绪层',
    sublabel: '水面之下 · 你的真实感受',
    icon: Droplets,
    gradient: 'linear-gradient(135deg, #bfdbfe, #93c5fd)',
    border: 'border-blue-200',
    textColor: 'text-blue-700',
    tagBg: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    key: 'cognition',
    label: '认知层',
    sublabel: '更深处 · 你反复对自己说的话',
    icon: Brain,
    gradient: 'linear-gradient(135deg, #a5b4fc, #818cf8)',
    border: 'border-indigo-200',
    textColor: 'text-indigo-700',
    tagBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    key: 'belief',
    label: '信念层',
    sublabel: '深层 · 驱动一切的核心信念',
    icon: KeyRound,
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    border: 'border-violet-300',
    textColor: 'text-violet-100',
    tagBg: 'bg-violet-900/30 text-violet-200 border-violet-500/30',
  },
  {
    key: 'yearning',
    label: '渴望层',
    sublabel: '最深处 · 你真正渴望的',
    icon: Heart,
    gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    border: 'border-purple-400',
    textColor: 'text-amber-100',
    tagBg: 'bg-purple-900/30 text-amber-200 border-amber-400/30',
  },
] as const

// ── 情绪色块颜色映射 ──
const EMOTION_COLORS: Record<string, string> = {
  warm: '#fb923c',
  cool: '#60a5fa',
  neutral: '#a1a1aa',
}

// ── 下潜指示器 ──
function DiveIndicator({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3 text-xs text-stone-400">
      <div className="w-px h-6 bg-gradient-to-b from-transparent to-stone-300" />
      <span>{text}</span>
      <div className="w-px h-6 bg-gradient-to-b from-transparent to-stone-300" />
    </div>
  )
}

// ── 冰山卡片组件 ──
function IcebergCard({
  layer,
  data,
  index,
  visible,
}: {
  layer: typeof LAYERS[number]
  data: any
  index: number
  visible: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isDeep = index >= 3
  const summaryColor = isDeep ? 'text-white/90' : 'text-stone-600'
  const sublabelColor = isDeep ? 'text-white/50' : 'text-stone-400'

  if (!data?.summary) return null

  return (
    <div
      ref={ref}
      className={`rounded-2xl border ${layer.border} overflow-hidden transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ background: layer.gradient, transitionDelay: `${index * 120}ms` }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <layer.icon className={`w-4.5 h-4.5 ${layer.textColor}`} />
            <div>
              <h3 className={`text-sm font-bold ${layer.textColor}`}>{layer.label}</h3>
              <p className={`text-xs ${sublabelColor}`}>{layer.sublabel}</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`text-xs flex items-center gap-1 ${isDeep ? 'text-white/60 hover:text-white/90' : 'text-stone-400 hover:text-stone-600'} transition-colors`}
          >
            {expanded ? '收起' : '展开'}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <p className={`text-sm leading-7 ${summaryColor}`}>{data.summary}</p>

        {/* 情绪层特有：情绪色块条 */}
        {layer.key === 'emotion' && data.emotion_flow?.length > 0 && (
          <div className="mt-4">
            <div className="flex rounded-lg overflow-hidden h-3 gap-0.5">
              {data.emotion_flow.map((phase: any, i: number) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ backgroundColor: EMOTION_COLORS[phase.color] || EMOTION_COLORS.neutral }}
                  title={`${phase.phase}: ${phase.dominant_emotion}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {data.emotion_flow.map((phase: any, i: number) => (
                <span key={i} className="text-[10px] text-blue-500/60 flex-1 text-center truncate">{phase.dominant_emotion}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className={`px-5 pb-5 pt-2 border-t ${isDeep ? 'border-white/10' : 'border-black/5'}`}>
          {/* 行为层：模式列表 */}
          {layer.key === 'behavior' && data.patterns?.length > 0 && (
            <div className="space-y-2.5">
              {data.patterns.map((p: any, i: number) => (
                <div key={i} className="text-sm text-stone-600">
                  <span className="font-medium">• {p.behavior}</span>
                  {p.frequency && <span className="text-stone-400 ml-2">({p.frequency})</span>}
                </div>
              ))}
            </div>
          )}

          {/* 情绪层：阶段 + 转折点 */}
          {layer.key === 'emotion' && (
            <div className="space-y-3">
              {data.emotion_flow?.map((phase: any, i: number) => (
                <div key={i} className="text-sm text-blue-700/80">
                  <span className="font-medium">{phase.phase}：</span>
                  <span>{phase.description || phase.dominant_emotion}</span>
                </div>
              ))}
              {data.turning_points?.length > 0 && (
                <div className="pt-2 border-t border-blue-200/50">
                  <p className="text-xs text-blue-500/60 mb-1.5">转折点</p>
                  {data.turning_points.map((tp: any, i: number) => (
                    <p key={i} className="text-sm text-blue-700/80">
                      <span className="text-blue-400">{tp.date}</span> — {tp.description}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 认知层：思维模式 */}
          {layer.key === 'cognition' && data.thought_patterns?.length > 0 && (
            <div className="space-y-3">
              {data.thought_patterns.map((tp: any, i: number) => (
                <div key={i}>
                  <p className="text-sm text-indigo-700 font-medium">「{tp.pattern}」</p>
                  {tp.trigger && <p className="text-xs text-indigo-400 mt-0.5">触发场景：{tp.trigger}</p>}
                  {tp.evidence_snippet && <p className="text-xs text-indigo-400/70 mt-0.5 italic">"{tp.evidence_snippet}"</p>}
                </div>
              ))}
            </div>
          )}

          {/* 信念层：核心信念 */}
          {layer.key === 'belief' && (
            <div className="space-y-3">
              {data.core_beliefs?.map((b: any, i: number) => (
                <div key={i}>
                  <p className="text-sm text-violet-100 font-medium">「{b.belief}」</p>
                  {b.origin_hint && <p className="text-xs text-violet-300/60 mt-0.5">可能来自：{b.origin_hint}</p>}
                  {b.impact && <p className="text-xs text-violet-300/60 mt-0.5">影响：{b.impact}</p>}
                </div>
              ))}
              {data.self_narrative && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-violet-300/50 mb-1">你讲给自己的故事</p>
                  <p className="text-sm text-violet-100 italic">"{data.self_narrative}"</p>
                </div>
              )}
            </div>
          )}

          {/* 渴望层：渴望列表 */}
          {layer.key === 'yearning' && (
            <div className="space-y-3">
              {data.yearnings?.map((y: any, i: number) => (
                <div key={i}>
                  <p className="text-sm text-amber-200 font-medium">{y.yearning}</p>
                  {y.connection && <p className="text-xs text-purple-300/60 mt-0.5">{y.connection}</p>}
                </div>
              ))}
              {data.life_energy && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-purple-300/50 mb-1">生命力方向</p>
                  <p className="text-sm text-amber-200">{data.life_energy}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 主页面 ──
export default function AnalysisOverview() {
  const navigate = useNavigate()
  const [windowDays, setWindowDays] = useState(90)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<IcebergAnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cardsVisible, setCardsVisible] = useState(false)

  const runAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)
    setCardsVisible(false)
    try {
      const data = await aiService.comprehensiveAnalysis({ window_days: windowDays, max_diaries: 120 })
      setResult(data)
      setTimeout(() => setCardsVisible(true), 100)
    } catch (e: any) {
      setError(e?.response?.data?.detail || '冰山分析失败')
    } finally {
      setIsLoading(false)
    }
  }

  const diveTexts = ['⬇ 潜入水面之下', '⬇ 更深一层', '⬇ 继续下潜', '⬇ 抵达最深处']

  const layerDataMap: Record<string, any> = result
    ? {
        behavior: result.behavior_layer,
        emotion: result.emotion_layer,
        cognition: result.cognition_layer,
        belief: result.belief_layer,
        yearning: result.yearning_layer,
      }
    : {}

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f0f9ff 0%, #ede9fe 40%, #1e1b4b 100%)' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-sky-100/60" style={{ background: 'rgba(240,249,255,0.9)' }}>
        <div className="max-w-lg mx-auto px-5">
          <div className="flex justify-between items-center py-3.5">
            <button onClick={() => navigate('/')} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← 返回</button>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-500" /> 冰山之旅
            </span>
            <div className="w-12" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-0">
        {/* 控制面板 + 冰山装饰 */}
        <div className="rounded-2xl border border-sky-200 bg-white/80 backdrop-blur overflow-hidden mb-6 relative">
          {/* 冰山 hero 装饰图 */}
          {!result && !isLoading && (
            <div className="flex flex-col items-center pt-6 pb-2">
              <img
                src="/images/iceberg-hero_1_no_bg.png"
                alt="冰山"
                className="w-36 h-auto opacity-90 drop-shadow-lg"
              />
              <p className="text-xs text-stone-400 mt-2 mb-1">选择时间窗口，探索你的内心冰山</p>
            </div>
          )}
          <div className="p-5 pt-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-stone-600">分析窗口</span>
              {[30, 90, 180].map((d) => (
                <button
                  key={d}
                  onClick={() => setWindowDays(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${
                    windowDays === d
                      ? 'text-white border-transparent shadow-sm'
                      : 'text-stone-500 border-stone-200 bg-white'
                  }`}
                  style={windowDays === d ? { background: 'linear-gradient(135deg, #818cf8, #7c3aed)' } : undefined}
                >
                  近 {d} 天
                </button>
              ))}
            </div>
            <button
              onClick={runAnalysis}
              disabled={isLoading}
              className="mt-4 w-full h-11 rounded-2xl text-sm font-semibold text-white shadow-md disabled:opacity-50 transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #818cf8, #7c3aed)' }}
            >
              {isLoading ? '正在深入分析...' : '开始冰山之旅'}
            </button>
          </div>
        </div>

        {/* 加载状态 */}
        {isLoading && (
          <div className="rounded-2xl border border-sky-200 bg-white/80 backdrop-blur p-8 text-center mb-6">
            <img
              src="/images/iceberg-guide_1.png"
              alt="探索中"
              className="w-44 h-44 mx-auto rounded-xl object-cover opacity-80 mb-4"
            />
            <Loading size="lg" />
            <p className="mt-4 text-stone-500 text-sm">正在检索日记 → 逐层分析冰山...</p>
            <p className="text-xs text-stone-400 mt-1">通常需要 30~60 秒</p>
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-500 mb-6">{error}</div>
        )}

        {/* 冰山卡片 */}
        {result && (
          <div>
            {/* 标题 */}
            <div className={`text-center mb-6 transition-all duration-700 ${cardsVisible ? 'opacity-100' : 'opacity-0'}`}>
              <h2 className="text-lg font-bold text-stone-700">你的冰山之旅</h2>
              <p className="text-xs text-stone-400 mt-1">
                {result.metadata?.period?.start_date ?? '—'} 至 {result.metadata?.period?.end_date ?? '—'} · {result.metadata?.analyzed_diary_count ?? 0} 篇日记
              </p>
            </div>

            {/* 五层卡片 */}
            {LAYERS.map((layer, index) => (
              <div key={layer.key}>
                <IcebergCard
                  layer={layer}
                  data={layerDataMap[layer.key]}
                  index={index}
                  visible={cardsVisible}
                />
                {index < LAYERS.length - 1 && layerDataMap[layer.key]?.summary && (
                  <DiveIndicator text={diveTexts[index] || '⬇'} />
                )}
              </div>
            ))}

            {/* 致你的一封信 */}
            {result.letter && (
              <div className={`mt-8 transition-all duration-700 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: '800ms' }}>
                <div
                  className="rounded-2xl border border-amber-300/40 p-6 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #fefce8, #fef9c3, #fef3c7)' }}
                >
                  <img
                    src="/images/letter-bg_1.png"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
                  />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <Mail className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-700">致你的一封信</h3>
                    </div>
                    <div className="text-sm text-amber-800 leading-8 whitespace-pre-line" style={{ fontFamily: '"LXGW WenKai", "楷体", KaiTi, serif' }}>
                      {result.letter}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 元数据 */}
            <div className={`text-center text-xs text-white/30 py-6 mt-4 transition-opacity duration-500 ${cardsVisible ? 'opacity-100' : 'opacity-0'}`}>
              <p>分析耗时 {(result.metadata?.processing_time ?? 0).toFixed(1)}s · 检索 {result.metadata?.retrieved_chunk_count ?? 0} 条证据</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
