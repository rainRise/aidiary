// AI分析结果展示页面 - 温暖柔和心理日记风格
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { aiService } from '@/services/ai.service'
import { diaryService } from '@/services/diary.service'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import type { AnalysisResponse, Diary } from '@/types'
import { format } from 'date-fns'
import { Sparkles, Calendar, Snowflake, Heart, FileText } from 'lucide-react'
import { getEmotionDisplayLabel } from '@/utils/emotionLabels'

const warmBg = { background: 'linear-gradient(160deg, #fff8f5 0%, #fdf4ff 60%, #f5f3ff 100%)' }
const gradientBtn = { background: 'linear-gradient(135deg, #fb7185, #c084fc)' }

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

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
      setError(err.message || t('analysisResult.loadFailed'))
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
      setError(err.message || t('analysisResult.aiFailed'))
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
      toast(t('analysisResult.copyFailed'), 'error')
      return
    }
    setCopiedPostIndex(index)
    toast(t('analysisResult.copied'), 'success')
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
            {t('analysisResult.backToList')}
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/diaries/${id}`)}
                className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
              >
                ← {t('analysisResult.backToDiary')}
              </button>
              <button
                onClick={() => navigate('/')}
                className="text-sm text-violet-400 hover:text-violet-500 transition-colors"
              >
                {t('analysisResult.backHome')}
              </button>
            </div>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-400" /> {t('analysisResult.aiAnalysis')}</span>
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
              <Calendar className="w-3.5 h-3.5 inline-block mr-1" />{format(new Date(diary.diary_date), 'yyyy-MM-dd')}
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
                    {getEmotionDisplayLabel(t, tag)}
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
                <p className="text-stone-400 text-sm mb-1">{t('analysisResult.alreadyAnalyzed')}</p>
                <p className="text-xs text-stone-300 mb-5">{t('analysisResult.rerunHint')}</p>
              </>
            ) : (
              <>
                <p className="text-stone-400 text-sm mb-1">{t('analysisResult.noResult')}</p>
                <p className="text-xs text-stone-300 mb-5">{t('analysisResult.backgroundHint')}</p>
              </>
            )}
            <button
              onClick={handleAnalyze}
              className="h-11 px-8 rounded-2xl text-sm font-semibold text-white shadow-md transition-all active:scale-[0.97]"
              style={gradientBtn}
            >
              {diary?.is_analyzed ? (analysis ? t('analysisResult.reanalyze') : t('analysisResult.viewResult')) : t('analysisResult.startAnalysis')}
            </button>
          </div>
        )}

        {/* 分析中 */}
        {isAnalyzing && (
          <div className="card-warm p-10 text-center">
            <Loading size="lg" />
            <p className="mt-4 text-stone-500 text-sm">{t('analysisResult.deepAnalyzing')}</p>
            <p className="text-xs text-stone-300 mt-1">{t('analysisResult.estimatedTime')}</p>
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
                  <h3 className="text-sm font-semibold text-stone-600">{t('analysisResult.timelineEvent')}</h3>
                </div>
                <p className="text-sm text-stone-600 leading-6 mb-4">{analysis.timeline_event.event_summary}</p>
                <div className="flex flex-wrap gap-3">
                  <span className="text-xs px-3 py-1.5 rounded-2xl bg-rose-50 text-rose-400 border border-rose-100">
                    {getEmotionDisplayLabel(t, analysis.timeline_event.emotion_tag)}
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-2xl bg-violet-50 text-violet-400 border border-violet-100">
                    {t('analysisResult.importanceScore', { score: analysis.timeline_event.importance_score })}
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-2xl bg-amber-50 text-amber-500 border border-amber-100">
                    {t(`analysisResult.eventType.${analysis.timeline_event.event_type}`, { defaultValue: analysis.timeline_event.event_type })}
                  </span>
                </div>
              </div>
            )}

            {/* 萨提亚冰山分析 */}
            {analysis.satir_analysis && (
              <div className="card-warm p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Snowflake className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-stone-600">{t('analysisResult.satirModel')}</h3>
                  <span className="text-xs text-stone-300 ml-auto">{t('analysisResult.deepPsychAnalysis')}</span>
                </div>
                <div className="space-y-4">
                  {/* 情绪层 */}
                  {analysis.satir_analysis.emotion_layer && (
                    <div className="border-l-3 border-rose-300 pl-4 py-2" style={{ borderLeftWidth: '3px' }}>
                      <h4 className="text-xs font-semibold text-rose-400 mb-2">{t('analysisResult.layer2Emotion')}</h4>
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <p className="text-xs text-stone-300">{t('analysisResult.surfaceEmotion')}</p>
                          <p className="text-sm text-stone-600 font-medium">{analysis.satir_analysis.emotion_layer.surface_emotion}</p>
                        </div>
                        {analysis.satir_analysis.emotion_layer.underlying_emotion && (
                          <div>
                            <p className="text-xs text-stone-300">{t('analysisResult.underlyingEmotion')}</p>
                            <p className="text-sm text-stone-600 font-medium">{analysis.satir_analysis.emotion_layer.underlying_emotion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 认知层 */}
                  {(analysis.satir_analysis.cognitive_layer?.irrational_beliefs?.length ?? 0) > 0 && (
                    <div className="border-l-3 border-amber-300 pl-4 py-2" style={{ borderLeftWidth: '3px' }}>
                      <h4 className="text-xs font-semibold text-amber-500 mb-2">{t('analysisResult.layer3Cognition')}</h4>
                      <p className="text-xs text-stone-300 mb-1">{t('analysisResult.irrationalBeliefs')}</p>
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
                      <h4 className="text-xs font-semibold text-violet-400 mb-2">{t('analysisResult.layer4Belief')}</h4>
                      <p className="text-xs text-stone-300 mb-1">{t('analysisResult.coreBeliefs')}</p>
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
                      <h4 className="text-xs font-semibold text-rose-400 mb-2">{t('analysisResult.layer5Existence')}</h4>
                      <p className="text-xs text-stone-300 mb-1">{t('analysisResult.deepDesire')}</p>
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
                    <h3 className="text-sm font-semibold text-stone-600">{t('analysisResult.healingResponse')}</h3>
                    <span className="text-xs text-stone-300 ml-auto">{t('analysisResult.fromAiCounselor')}</span>
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
                  <h3 className="text-sm font-semibold text-stone-600">{t('analysisResult.socialPosts')}</h3>
                  <span className="text-xs text-stone-300 ml-auto">{t('analysisResult.pickBest')}</span>
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
                          {copiedPostIndex === index ? t('analysisResult.copiedLabel') : t('analysisResult.copyLabel')}
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
                <p>{t('analysisResult.processingTime', { time: analysis.metadata.processing_time.toFixed(2) })}</p>
                {analysis.metadata.analysis_scope === 'user_integrated' && analysis.metadata.analyzed_period && (
                  <p>
                    {t('analysisResult.integratedRange', { count: analysis.metadata.analyzed_diary_count ?? '-' })} ·
                    {analysis.metadata.analyzed_period.start_date} {t('icebergOverview.to')} {analysis.metadata.analyzed_period.end_date}
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
