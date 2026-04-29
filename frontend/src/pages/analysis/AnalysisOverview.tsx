import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { aiService } from '@/services/ai.service'
import { Loading } from '@/components/common/Loading'
import type { EvidenceItem, IcebergAnalysisResponse } from '@/types/analysis'
import { Sparkles, ChevronDown, ChevronUp, Waves, Droplets, Brain, KeyRound, Heart, Mail, Link2, ShieldCheck, HelpCircle, FileText } from 'lucide-react'

// ── 冰山层级配置 ──
const LAYERS = [
  {
    key: 'behavior',
    labelKey: 'icebergOverview.layers.behavior',
    sublabelKey: 'icebergOverview.layers.behaviorSub',
    icon: Waves,
    gradient: 'linear-gradient(135deg, #dff5ff 0%, #c7dcff 100%)',
    border: 'border-sky-200/70',
    textColor: 'text-sky-800',
    tagBg: 'bg-white/24 text-sky-700 border-white/35',
  },
  {
    key: 'emotion',
    labelKey: 'icebergOverview.layers.emotion',
    sublabelKey: 'icebergOverview.layers.emotionSub',
    icon: Droplets,
    gradient: 'linear-gradient(135deg, #cfe7ff 0%, #a9c9ff 100%)',
    border: 'border-blue-200/70',
    textColor: 'text-blue-800',
    tagBg: 'bg-white/24 text-blue-700 border-white/35',
  },
  {
    key: 'cognition',
    labelKey: 'icebergOverview.layers.cognition',
    sublabelKey: 'icebergOverview.layers.cognitionSub',
    icon: Brain,
    gradient: 'linear-gradient(135deg, #aebdff 0%, #8298f7 100%)',
    border: 'border-indigo-200/70',
    textColor: 'text-white',
    tagBg: 'bg-white/18 text-white border-white/24',
  },
  {
    key: 'belief',
    labelKey: 'icebergOverview.layers.belief',
    sublabelKey: 'icebergOverview.layers.beliefSub',
    icon: KeyRound,
    gradient: 'linear-gradient(135deg, #7f8ff6 0%, #6675e8 50%, #7187f6 100%)',
    border: 'border-violet-300/50',
    textColor: 'text-violet-100',
    tagBg: 'bg-violet-900/30 text-violet-200 border-violet-500/30',
  },
  {
    key: 'yearning',
    labelKey: 'icebergOverview.layers.yearning',
    sublabelKey: 'icebergOverview.layers.yearningSub',
    icon: Heart,
    gradient: 'linear-gradient(135deg, #6578ea 0%, #6e61d8 55%, #7b66e8 100%)',
    border: 'border-purple-400/50',
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

function uniqueByDateEvidence(items: EvidenceItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.diary_date}-${item.diary_id}-${item.snippet}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getLayerEvidence(layerKey: string, data: any, allEvidence: EvidenceItem[]) {
  const evidence = uniqueByDateEvidence(allEvidence || [])
  if (layerKey === 'behavior') {
    const dates = new Set<string>((data?.patterns || []).flatMap((p: any) => p.evidence_dates || []))
    return evidence.filter((item) => dates.size === 0 || dates.has(item.diary_date)).slice(0, 4)
  }
  if (layerKey === 'emotion') {
    const dates = new Set<string>((data?.turning_points || []).map((tp: any) => tp.date))
    return evidence.filter((item) => dates.size === 0 || dates.has(item.diary_date)).slice(0, 4)
  }
  if (layerKey === 'cognition') {
    const snippets = (data?.thought_patterns || []).map((tp: any) => String(tp.evidence_snippet || '')).filter(Boolean)
    return evidence.filter((item) => snippets.length === 0 || snippets.some((s: string) => item.snippet.includes(s.slice(0, 12)) || s.includes(item.snippet.slice(0, 12)))).slice(0, 4)
  }
  return evidence.slice(0, 4)
}

function getConfidenceLabel(evidenceCount: number, index: number) {
  if (evidenceCount >= 6 && index <= 2) return '较高'
  if (evidenceCount >= 3) return '中等'
  return '偏低'
}

function getLayerInference(layerKey: string, data: any) {
  if (layerKey === 'behavior') return data?.patterns?.[0]?.behavior || data?.summary
  if (layerKey === 'emotion') return data?.emotion_flow?.[0]?.description || data?.summary
  if (layerKey === 'cognition') return data?.thought_patterns?.[0]?.pattern || data?.summary
  if (layerKey === 'belief') return data?.self_narrative || data?.core_beliefs?.[0]?.belief || data?.summary
  return data?.life_energy || data?.yearnings?.[0]?.yearning || data?.summary
}

function getUncertainty(layerKey: string) {
  const map: Record<string, string> = {
    behavior: '行为模式来自日记中的重复线索，不代表所有场景下都会如此。',
    emotion: '情绪判断会受到记录时机和表达方式影响，适合结合当天事件一起看。',
    cognition: '认知层是基于文本线索的推断，不能替代你自己的真实感受。',
    belief: '信念层属于深层假设，系统会保持保守，不把它当作绝对结论。',
    yearning: '渴望层更接近方向性理解，需要通过后续记录持续验证。',
  }
  return map[layerKey] || '该观察用于自我觉察，不作为诊断结论。'
}

// ── 冰山卡片组件 ──
function IcebergCard({
  layer,
  data,
  index,
  visible,
  evidence,
  t,
}: {
  layer: typeof LAYERS[number]
  data: any
  index: number
  visible: boolean
  evidence: EvidenceItem[]
  t: (key: string, opts?: any) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isDeep = index >= 3
  const summaryColor = index >= 2 ? 'text-white/92' : 'text-slate-700'
  const sublabelColor = index >= 2 ? 'text-white/62' : 'text-slate-500/70'
  const layerEvidence = getLayerEvidence(layer.key, data, evidence)
  const confidence = getConfidenceLabel(evidence.length, index)

  if (!data?.summary) return null

  return (
    <div
      ref={ref}
      className={`rounded-[28px] border ${layer.border} overflow-hidden shadow-[0_22px_60px_rgba(49,65,138,0.18)] transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ background: layer.gradient, transitionDelay: `${index * 120}ms` }}
    >
      <div className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute right-5 top-5 h-24 w-24 rounded-full bg-white/12 blur-xl" />
        <div className="pointer-events-none absolute -right-4 bottom-3 h-28 w-28 rounded-full border border-white/18" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-white/16 shadow-inner">
              <layer.icon className={`w-5 h-5 ${layer.textColor}`} />
            </span>
            <div>
              <h3 className={`text-xl font-bold ${layer.textColor}`}>{t(layer.labelKey)}</h3>
              <p className={`mt-0.5 text-sm ${sublabelColor}`}>{t(layer.sublabelKey)}</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`relative text-xs flex items-center gap-1 ${index >= 2 ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-700'} transition-colors`}
          >
            {expanded ? t('icebergOverview.collapse') : t('icebergOverview.expand')}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <p className={`relative mt-5 text-[15px] leading-8 ${summaryColor}`}>{data.summary}</p>

        <div className="relative mt-5 grid grid-cols-3 gap-3">
          <span className={`inline-flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold ${layer.tagBg}`}>
            <FileText className="h-3.5 w-3.5" /> 基于 {Math.max(evidence.length, 1)} 篇日记
          </span>
          <span className={`inline-flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold ${layer.tagBg}`}>
            <Link2 className="h-3.5 w-3.5" /> 证据 {layerEvidence.length || evidence.length} 条
          </span>
          <span className={`inline-flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold ${layer.tagBg}`}>
            <ShieldCheck className="h-3.5 w-3.5" /> 置信度：{confidence}
          </span>
        </div>

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
        <div className={`mx-3 mb-3 rounded-[24px] border bg-white/88 px-5 pb-5 pt-4 shadow-inner ${isDeep ? 'border-white/20' : 'border-white/80'}`}>
          <div className="mb-5 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-indigo-500" />
            <h4 className="text-sm font-bold text-slate-700">证据链 / 为什么这样判断</h4>
          </div>
          <div className="relative mb-5 space-y-3 pl-4">
            <div className="absolute bottom-3 left-[5px] top-2 w-px bg-indigo-100" />
            {(layerEvidence.length ? layerEvidence : evidence.slice(0, 3)).map((item, i) => (
              <div key={`${item.diary_id}-${i}`} className="relative rounded-2xl bg-indigo-50/70 px-4 py-3">
                <span className="absolute -left-[19px] top-4 h-3 w-3 rounded-full border-2 border-white bg-indigo-400 shadow" />
                <p className="text-xs font-semibold text-indigo-500">
                  {item.diary_date} 《{item.title || '未命名日记'}》
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">“{item.snippet}”</p>
              </div>
            ))}
          </div>

          <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-violet-600">
              <Sparkles className="h-4 w-4" /> AI 推理
            </div>
            <p className="text-sm leading-7 text-slate-600">
              {getLayerInference(layer.key, data)}
            </p>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">
              <HelpCircle className="h-4 w-4" /> 不确定性
            </div>
            <p className="text-sm leading-7 text-slate-500">{getUncertainty(layer.key)}</p>
          </div>

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
                  <p className="text-xs text-blue-500/60 mb-1.5">{t('icebergOverview.turningPoints')}</p>
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
                  {tp.trigger && <p className="text-xs text-indigo-400 mt-0.5">{t('icebergOverview.triggerScene')}{tp.trigger}</p>}
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
                  <p className="text-sm text-violet-700 font-medium">「{b.belief}」</p>
                  {b.origin_hint && <p className="text-xs text-violet-500/70 mt-0.5">{t('icebergOverview.possibleOrigin')}{b.origin_hint}</p>}
                  {b.impact && <p className="text-xs text-violet-500/70 mt-0.5">{t('icebergOverview.impact')}{b.impact}</p>}
                </div>
              ))}
              {data.self_narrative && (
                <div className="pt-2 border-t border-violet-100">
                  <p className="text-xs text-violet-400 mb-1">{t('icebergOverview.selfNarrative')}</p>
                  <p className="text-sm text-violet-700 italic">"{data.self_narrative}"</p>
                </div>
              )}
            </div>
          )}

          {/* 渴望层：渴望列表 */}
          {layer.key === 'yearning' && (
            <div className="space-y-3">
              {data.yearnings?.map((y: any, i: number) => (
                <div key={i}>
                  <p className="text-sm text-purple-700 font-medium">{y.yearning}</p>
                  {y.connection && <p className="text-xs text-purple-500/70 mt-0.5">{y.connection}</p>}
                </div>
              ))}
              {data.life_energy && (
                <div className="pt-2 border-t border-purple-100">
                  <p className="text-xs text-purple-400 mb-1">{t('icebergOverview.lifeEnergy')}</p>
                  <p className="text-sm text-purple-700">{data.life_energy}</p>
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
  const { t } = useTranslation()
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
      setError(e?.response?.data?.detail || t('icebergOverview.analysisFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const diveTexts = [
    `⬇ ${t('icebergOverview.dive1')}`,
    `⬇ ${t('icebergOverview.dive2')}`,
    `⬇ ${t('icebergOverview.dive3')}`,
    `⬇ ${t('icebergOverview.dive4')}`,
  ]

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
            <button onClick={() => navigate('/')} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← {t('common.back')}</button>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-500" /> {t('icebergOverview.title')}
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
                alt={t('icebergOverview.title')}
                className="w-36 h-auto opacity-90 drop-shadow-lg"
              />
              <p className="text-xs text-stone-400 mt-2 mb-1">{t('icebergOverview.selectWindowHint')}</p>
            </div>
          )}
          <div className="p-5 pt-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-stone-600">{t('icebergOverview.analysisWindow')}</span>
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
                  {t('icebergOverview.lastNDays', { count: d })}
                </button>
              ))}
            </div>
            <button
              onClick={runAnalysis}
              disabled={isLoading}
              className="mt-4 w-full h-11 rounded-2xl text-sm font-semibold text-white shadow-md disabled:opacity-50 transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #818cf8, #7c3aed)' }}
            >
              {isLoading ? t('icebergOverview.analyzing') : t('icebergOverview.startJourney')}
            </button>
          </div>
        </div>

        {/* 加载状态 */}
        {isLoading && (
          <div className="rounded-2xl border border-sky-200 bg-white/80 backdrop-blur p-8 text-center mb-6">
            <img
              src="/images/iceberg-guide_1.png"
              alt={t('icebergOverview.exploring')}
              className="w-44 h-44 mx-auto rounded-xl object-cover opacity-80 mb-4"
            />
            <Loading size="lg" />
            <p className="mt-4 text-stone-500 text-sm">{t('icebergOverview.retrievingDiaries')}</p>
            <p className="text-xs text-stone-400 mt-1">{t('icebergOverview.estimatedTime')}</p>
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
              <h2 className="text-lg font-bold text-stone-700">{t('icebergOverview.yourJourney')}</h2>
              <p className="text-xs text-stone-400 mt-1">
                {result.metadata?.period?.start_date ?? '—'} {t('icebergOverview.to')} {result.metadata?.period?.end_date ?? '—'} · {t('icebergOverview.diaryCount', { count: result.metadata?.analyzed_diary_count ?? 0 })}
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
                  evidence={result.evidence || []}
                  t={t}
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
                      <h3 className="text-sm font-semibold text-amber-700">{t('icebergOverview.letterToYou')}</h3>
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
              <p>{t('icebergOverview.processingTime', { time: (result.metadata?.processing_time ?? 0).toFixed(1) })} · {t('icebergOverview.evidenceCount', { count: result.metadata?.retrieved_chunk_count ?? 0 })}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
