// AI分析结果展示页面 - 温暖柔和心理日记风格
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { aiService } from '@/services/ai.service'
import { diaryService } from '@/services/diary.service'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import type { AnalysisResponse, Diary } from '@/types'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Sparkles, Calendar, Snowflake, Heart, FileText } from 'lucide-react'

const warmBg = { background: 'linear-gradient(160deg, #fff8f5 0%, #fdf4ff 60%, #f5f3ff 100%)' }
const gradientBtn = { background: 'linear-gradient(135deg, #fb7185, #c084fc)' }

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [diary, setDiary] = useState<Diary | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedPostIndex, setCopiedPostIndex] = useState<number | null>(null)

  useEffect(() => {
    if (id) {
      loadData(Number(id))
    }
  }, [id])

  const loadData = async (diaryId: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const diaryData = await diaryService.get(diaryId)
      setDiary(diaryData)
      if (diaryData.is_analyzed) {
        try {
          const saved = await aiService.getResultByDiary(diaryId)
          setAnalysis(saved)
        } catch {
          // 已分析但无已保存结果时，允许手动重新分析
        }
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!id) return
    if (diary?.is_analyzed && !analysis) {
      try {
        const saved = await aiService.getResultByDiary(Number(id))
        setAnalysis(saved)
        return
      } catch {
        // 没有保存结果时再走重新分析
      }
    }
    setIsAnalyzing(true)
    setError(null)
    try {
      const result = await aiService.analyze({ diary_id: Number(id) })
      setAnalysis(result)
      if (diary) {
        setDiary({ ...diary, is_analyzed: true })
      }
    } catch (err: any) {
      setError(err.message || 'AI分析失败')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const fallbackCopyText = (text: string): boolean => {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }

  const copyPost = async (content: string, index: number) => {
    let ok = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content)
        ok = true
      } else {
        ok = fallbackCopyText(content)
      }
    } catch {
      ok = fallbackCopyText(content)
    }
    if (!ok) {
      toast('复制失败，请手动选择复制', 'error')
      return
    }
    setCopiedPostIndex(index)
    toast('已复制到剪贴板', 'success')
    window.setTimeout(() => {
      setCopiedPostIndex((prev) => (prev === index ? null : prev))
    }, 1400)
  }

  const emotionTags = diary?.emotion_tags ?? []

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={warmBg}>
        <Loading size="lg" />
      </div>
    )
  }

  if (error && !diary) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={warmBg}>
        <div className="card-warm p-8 text-center max-w-sm">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/diaries')}
            className="h-10 px-6 rounded-xl text-sm font-medium text-white shadow-sm"
            style={gradientBtn}
          >
            返回日记列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={warmBg}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-rose-100/60" style={{ background: 'rgba(255,248,245,0.88)' }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex justify-between items-center py-3.5">
            <button
              onClick={() => navigate(`/diaries/${id}`)}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
            >
              ← 返回日记
            </button>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-400" /> AI 分析</span>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* 日记摘要 */}
        {diary && (
          <div className="card-warm p-5">
            <h2 className="text-base font-bold text-stone-700 mb-1">{diary.title}</h2>
            <p className="text-xs text-stone-400 mb-3">
              <Calendar className="w-3.5 h-3.5 inline-block mr-1" />{format(new Date(diary.diary_date), 'yyyy年MM月dd日', { locale: zhCN })}
            </p>
            <p className="text-sm text-stone-500 line-clamp-3 leading-6">{diary.content}</p>
            {emotionTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {emotionTags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="text-xs px-2.5 py-1 rounded-2xl text-white font-medium"
                    style={gradientBtn}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 触发分析 */}
        {!analysis && !isAnalyzing && (
          <div className="card-warm p-10 text-center">
            <Sparkles className="w-8 h-8 text-violet-400 mx-auto mb-3" />
            {diary?.is_analyzed ? (
              <>
                <p className="text-stone-400 text-sm mb-1">已完成分析</p>
                <p className="text-xs text-stone-300 mb-5">点击下方重新运行以查看最新结果</p>
              </>
            ) : (
              <>
                <p className="text-stone-400 text-sm mb-1">还没有 AI 分析结果</p>
                <p className="text-xs text-stone-300 mb-5">如果刚刚保存日记，分析可能正在后台运行中</p>
              </>
            )}
            <button
              onClick={handleAnalyze}
              className="h-11 px-8 rounded-2xl text-sm font-semibold text-white shadow-md transition-all active:scale-[0.97]"
              style={gradientBtn}
            >
              {diary?.is_analyzed ? (analysis ? '重新分析' : '查看分析结果') : '开始 AI 分析'}
            </button>
          </div>
        )}

        {/* 分析中 */}
        {isAnalyzing && (
          <div className="card-warm p-10 text-center">
            <Loading size="lg" />
            <p className="mt-4 text-stone-500 text-sm">AI 正在深度分析中...</p>
            <p className="text-xs text-stone-300 mt-1">这可能需要 10-20 秒</p>
          </div>
        )}

        {/* 分析结果 */}
        {analysis && (
          <div className="space-y-5">
            {/* 时间轴事件 */}
            {analysis.timeline_event && (
              <div className="card-warm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-stone-600">时间轴事件</h3>
                </div>
                <p className="text-sm text-stone-600 leading-6 mb-4">{analysis.timeline_event.event_summary}</p>
                <div className="flex flex-wrap gap-3">
                  <span className="text-xs px-3 py-1.5 rounded-2xl bg-rose-50 text-rose-400 border border-rose-100">
                    {analysis.timeline_event.emotion_tag}
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-2xl bg-violet-50 text-violet-400 border border-violet-100">
                    重要性 {analysis.timeline_event.importance_score}/10
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-2xl bg-amber-50 text-amber-500 border border-amber-100">
                    {getEventTypeLabel(analysis.timeline_event.event_type)}
                  </span>
                </div>
              </div>
            )}

            {/* 萨提亚冰山分析 */}
            {analysis.satir_analysis && (
              <div className="card-warm p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Snowflake className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-stone-600">萨提亚冰山模型</h3>
                  <span className="text-xs text-stone-300 ml-auto">深度心理分析</span>
                </div>
                <div className="space-y-4">
                  {/* 情绪层 */}
                  {analysis.satir_analysis.emotion_layer && (
                    <div className="border-l-3 border-rose-300 pl-4 py-2" style={{ borderLeftWidth: '3px' }}>
                      <h4 className="text-xs font-semibold text-rose-400 mb-2">第2层 · 情绪层</h4>
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <p className="text-xs text-stone-300">表层情绪</p>
                          <p className="text-sm text-stone-600 font-medium">{analysis.satir_analysis.emotion_layer.surface_emotion}</p>
                        </div>
                        {analysis.satir_analysis.emotion_layer.underlying_emotion && (
                          <div>
                            <p className="text-xs text-stone-300">潜在情绪</p>
                            <p className="text-sm text-stone-600 font-medium">{analysis.satir_analysis.emotion_layer.underlying_emotion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 认知层 */}
                  {(analysis.satir_analysis.cognitive_layer?.irrational_beliefs?.length ?? 0) > 0 && (
                    <div className="border-l-3 border-amber-300 pl-4 py-2" style={{ borderLeftWidth: '3px' }}>
                      <h4 className="text-xs font-semibold text-amber-500 mb-2">第3层 · 认知层</h4>
                      <p className="text-xs text-stone-300 mb-1">非理性信念</p>
                      <ul className="space-y-1">
                        {analysis.satir_analysis.cognitive_layer!.irrational_beliefs!.map(
                          (belief: string, index: number) => (
                            <li key={index} className="text-sm text-stone-600">• {belief}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  {/* 信念层 */}
                  {(analysis.satir_analysis.belief_layer?.core_beliefs?.length ?? 0) > 0 && (
                    <div className="border-l-3 border-violet-300 pl-4 py-2" style={{ borderLeftWidth: '3px' }}>
                      <h4 className="text-xs font-semibold text-violet-400 mb-2">第4层 · 信念层</h4>
                      <p className="text-xs text-stone-300 mb-1">核心信念</p>
                      <ul className="space-y-1">
                        {analysis.satir_analysis.belief_layer!.core_beliefs!.map(
                          (belief: string, index: number) => (
                            <li key={index} className="text-sm text-stone-600">• {belief}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  {/* 存在层 */}
                  {analysis.satir_analysis.core_self_layer?.deepest_desire && (
                    <div className="border-l-3 border-rose-400 pl-4 py-2" style={{ borderLeftWidth: '3px' }}>
                      <h4 className="text-xs font-semibold text-rose-400 mb-2">第5层 · 存在层</h4>
                      <p className="text-xs text-stone-300 mb-1">深层渴望</p>
                      <p className="text-sm text-stone-600 font-medium">
                        {analysis.satir_analysis.core_self_layer.deepest_desire}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 疗愈回复 */}
            {analysis.therapeutic_response && (
              <div className="card-warm overflow-hidden">
                <div className="p-5" style={{ background: 'linear-gradient(135deg, rgba(251,113,133,0.06), rgba(192,132,252,0.06))' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-semibold text-stone-600">疗愈回复</h3>
                    <span className="text-xs text-stone-300 ml-auto">来自 AI 心理咨询师</span>
                  </div>
                  <p className="text-sm text-stone-600 leading-7 whitespace-pre-line">
                    {analysis.therapeutic_response}
                  </p>
                </div>
              </div>
            )}

            {/* 朋友圈文案 */}
            {analysis.social_posts && analysis.social_posts.length > 0 && (
              <div className="card-warm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-stone-600">朋友圈文案</h3>
                  <span className="text-xs text-stone-300 ml-auto">选择最适合你的</span>
                </div>
                <div className="space-y-3">
                  {analysis.social_posts.map((post: any, index: number) => (
                    <div key={index} className="p-4 rounded-2xl bg-stone-50/60 border border-stone-100/80">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-400">{post.version}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-400">{post.style}</span>
                        </div>
                        <button
                          onClick={() => void copyPost(post.content, index)}
                          className={`text-xs transition-colors ${copiedPostIndex === index ? 'text-emerald-500' : 'text-rose-400 hover:text-rose-500'}`}
                        >
                          {copiedPostIndex === index ? '已复制' : '复制'}
                        </button>
                      </div>
                      <p className="text-sm text-stone-500 leading-6">{post.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 元数据 */}
            {analysis.metadata && (
              <div className="text-center text-xs text-stone-300 py-2">
                <p>处理时间: {analysis.metadata.processing_time.toFixed(2)}秒</p>
                {analysis.metadata.analysis_scope === 'user_integrated' && analysis.metadata.analyzed_period && (
                  <p>
                    整合范围: {analysis.metadata.analyzed_diary_count ?? '-'} 篇 ·
                    {analysis.metadata.analyzed_period.start_date} 至 {analysis.metadata.analyzed_period.end_date}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="card-warm p-5 border-red-100">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
      </main>
    </div>
  )
}

function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    work: '工作',
    relationship: '关系',
    health: '健康',
    achievement: '成就',
    other: '其他',
  }
  return labels[type] || type
}
