// 日记编辑器 - 温暖柔和心理日记风格
import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDiaryStore } from '@/store/diaryStore'
import { toast } from '@/components/ui/toast'
import { PenLine, Calendar, MessageCircle, Star, Smile, CloudSun, AlertCircle, Trophy, HeartHandshake, HelpCircle, Sparkles, Battery, Heart, Angry, Frown, PartyPopper, ChevronRight, RefreshCw } from 'lucide-react'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { aiService } from '@/services/ai.service'
import { diaryService } from '@/services/diary.service'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'

const PRESET_EMOTIONS_KEYS = [
  'happy', 'calm', 'anxious', 'achievement', 'satisfied',
  'worried', 'expectant', 'exhausted', 'touched', 'angry', 'sad', 'excited'
]

const GUIDED_QUESTIONS_KEYS = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'
]

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface DiaryDraft {
  title: string
  content: string
  contentHtml: string
  diaryDate: string
  emotionTags: string[]
  importanceScore: number
  savedAt: number
}

export default function DiaryEditor() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()
  const { createDiary, updateDiary, isLoading } = useDiaryStore()

  // 引导问题（带翻译）
  const GUIDED_QUESTIONS = GUIDED_QUESTIONS_KEYS.map(key => t(`auth.guidedQuestions.${key}`))

  // 情绪预设（带翻译）
  const PRESET_EMOTIONS = PRESET_EMOTIONS_KEYS.map(key => ({
    key,
    label: t(`diary.emotion.${key}`),
    icon: {
      happy: <Smile className="w-3.5 h-3.5" />,
      calm: <CloudSun className="w-3.5 h-3.5" />,
      anxious: <AlertCircle className="w-3.5 h-3.5" />,
      achievement: <Trophy className="w-3.5 h-3.5" />,
      satisfied: <HeartHandshake className="w-3.5 h-3.5" />,
      worried: <HelpCircle className="w-3.5 h-3.5" />,
      expectant: <Sparkles className="w-3.5 h-3.5" />,
      exhausted: <Battery className="w-3.5 h-3.5" />,
      touched: <Heart className="w-3.5 h-3.5" />,
      angry: <Angry className="w-3.5 h-3.5" />,
      sad: <Frown className="w-3.5 h-3.5" />,
      excited: <PartyPopper className="w-3.5 h-3.5" />,
    }[key]
  }))

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().split('T')[0])
  const [emotionTags, setEmotionTags] = useState<string[]>([])
  const [importanceScore, setImportanceScore] = useState(5)
  const [isAnalyzing] = useState(false)
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [guidedQuestion, setGuidedQuestion] = useState(GUIDED_QUESTIONS[new Date().getDate() % GUIDED_QUESTIONS.length])
  const [guidanceSource, setGuidanceSource] = useState<'ai' | 'fallback'>('fallback')
  const [isLoadingGuidance, setIsLoadingGuidance] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle')
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAutoSaveSnapshotRef = useRef('')
  const hasInitializedDraftRef = useRef(false)
  const draftKey = `yinji:diary-draft:${isEditMode ? id : 'new'}`

  useEffect(() => {
    const init = async () => {
      if (!isEditMode || !id) return
      try {
        setIsInitializing(true)
        const diary = await diaryService.get(Number(id))
        const baseDraft: DiaryDraft = {
          title: diary.title || '',
          content: diary.content || '',
          contentHtml: diary.content_html || '',
          diaryDate: diary.diary_date || new Date().toISOString().split('T')[0],
          emotionTags: diary.emotion_tags || [],
          importanceScore: diary.importance_score || 5,
          savedAt: Date.now(),
        }
        const localDraft = readDraft(draftKey)
        const serverUpdatedAt = new Date(diary.updated_at || diary.created_at || 0).getTime()
        const draft = localDraft && localDraft.savedAt > serverUpdatedAt ? localDraft : baseDraft
        setTitle(draft.title)
        setContent(draft.content)
        setContentHtml(draft.contentHtml)
        setDiaryDate(draft.diaryDate)
        setEmotionTags(draft.emotionTags)
        setImportanceScore(draft.importanceScore)
        lastAutoSaveSnapshotRef.current = serializeDraft(draft)
        if (localDraft && localDraft.savedAt > serverUpdatedAt) {
          setAutoSaveStatus('saved')
          setLastAutoSavedAt(localDraft.savedAt)
        }
      } catch (error: any) {
        toast(error?.response?.data?.detail || '加载日记失败', 'error')
        navigate('/diaries')
      } finally {
        hasInitializedDraftRef.current = true
        setIsInitializing(false)
      }
    }
    init()
  }, [draftKey, id, isEditMode, navigate])

  useEffect(() => {
    if (isEditMode) return
    const localDraft = readDraft(draftKey)
    if (localDraft) {
      setTitle(localDraft.title)
      setContent(localDraft.content)
      setContentHtml(localDraft.contentHtml)
      setDiaryDate(localDraft.diaryDate)
      setEmotionTags(localDraft.emotionTags)
      setImportanceScore(localDraft.importanceScore)
      setAutoSaveStatus('saved')
      setLastAutoSavedAt(localDraft.savedAt)
      lastAutoSaveSnapshotRef.current = serializeDraft(localDraft)
    }
    hasInitializedDraftRef.current = true
  }, [draftKey, isEditMode])

  useEffect(() => {
    if (!hasInitializedDraftRef.current || isInitializing) return

    const draft: DiaryDraft = {
      title,
      content,
      contentHtml,
      diaryDate,
      emotionTags,
      importanceScore,
      savedAt: Date.now(),
    }
    const snapshot = serializeDraft(draft)
    if (snapshot === lastAutoSaveSnapshotRef.current) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setAutoSaveStatus('saving')
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const savedAt = Date.now()
        const draftToSave = { ...draft, savedAt }
        localStorage.setItem(draftKey, JSON.stringify(draftToSave))

        if (isEditMode && id && title.trim() && content.trim()) {
          await diaryService.update(Number(id), {
            title: title.trim(),
            content: content.trim(),
            content_html: contentHtml || undefined,
            diary_date: diaryDate,
            emotion_tags: emotionTags.length > 0 ? emotionTags : [],
            importance_score: importanceScore,
          })
        }

        lastAutoSaveSnapshotRef.current = serializeDraft(draftToSave)
        setLastAutoSavedAt(savedAt)
        setAutoSaveStatus('saved')
      } catch (error) {
        console.error('Auto save failed:', error)
        setAutoSaveStatus('error')
      }
    }, 1200)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [content, contentHtml, diaryDate, draftKey, emotionTags, id, importanceScore, isEditMode, isInitializing, title])

  const loadDailyGuidance = useCallback(async () => {
    try {
      setIsLoadingGuidance(true)
      const result = await aiService.getDailyGuidance()
      const question = (result.question || '').trim()
      if (!question) throw new Error('empty question')
      setGuidedQuestion(question)
      setGuidanceSource(result.source === 'ai' ? 'ai' : 'fallback')
    } catch (error) {
      const fallback = GUIDED_QUESTIONS[new Date().getDate() % GUIDED_QUESTIONS.length]
      setGuidedQuestion(fallback)
      setGuidanceSource('fallback')
    } finally {
      setIsLoadingGuidance(false)
    }
  }, [])

  useEffect(() => {
    void loadDailyGuidance()
  }, [loadDailyGuidance])

  const toggleEmotionTag = (tag: string) => {
    setEmotionTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleContentChange = useCallback((text: string, html: string) => {
    setContent(text)
    setContentHtml(html)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      toast('请填写标题和内容', 'error')
      return
    }
    try {
      if (isEditMode && id) {
        await updateDiary(Number(id), {
          title: title.trim(),
          content: content.trim(),
          content_html: contentHtml || undefined,
          diary_date: diaryDate,
          emotion_tags: emotionTags.length > 0 ? emotionTags : [],
          importance_score: importanceScore,
        })
        localStorage.removeItem(draftKey)
        toast(t('diary.updateSuccess'), 'success')
        navigate(`/diaries/${id}`)
      } else {
        const diary = await createDiary({
          title: title.trim(),
          content: content.trim(),
          content_html: contentHtml || undefined,
          diary_date: diaryDate,
          emotion_tags: emotionTags.length > 0 ? emotionTags : undefined,
          importance_score: importanceScore,
        })
        localStorage.removeItem(draftKey)
        toast(t('diary.saveSuccess'), 'success')
        // 不再自动触发综合分析（萨提亚）
        // 时间轴事件由后端自动生成 + 异步精炼
        navigate(`/diaries/${diary.id}`)
      }
    } catch (error: any) {
      toast(error.message || t('diary.saveFailed'), 'error')
    }
  }

  const handleGenerateTitle = async () => {
    if (!content.trim() || content.trim().length < 10) {
      toast(t('diary.needContentForTitle'), 'error')
      return
    }
    try {
      setIsGeneratingTitle(true)
      const result = await aiService.generateTitle(content, title)
      setTitle(result.title)
      toast(t('diary.titleGenerated'), 'success')
    } catch (error: any) {
      toast(error?.response?.data?.detail || t('diary.titleGenerateFailed'), 'error')
    } finally {
      setIsGeneratingTitle(false)
    }
  }

  const wordCount = content.length
  const importanceLabels = ['', '随意', '', '', '一般', '', '', '', '重要', '', '非常重要']
  const autoSaveText = {
    idle: '尚未自动保存',
    saving: '正在保存…',
    saved: lastAutoSavedAt ? `已自动保存 ${formatAutoSaveTime(lastAutoSavedAt)}` : '已自动保存',
    error: '保存失败，请重试',
  }[autoSaveStatus]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70 relative" style={{ background: 'rgba(248,245,239,0.88)' }}>
        {/* 语言切换器 */}
        <div className="absolute top-2 right-4">
          <LanguageSwitcher />
        </div>
        
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex justify-between items-center py-3.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="text-sm text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
              >
                ← {t('common.back')}
              </button>
              <button
                onClick={() => navigate('/')}
                className="text-sm text-[#b56f61] hover:text-[#9c5e52] transition-colors"
              >
                {t('navigation.dashboard')}
              </button>
            </div>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5"><PenLine className="w-4 h-4 text-[#b56f61]" /> {isEditMode ? t('diary.editDiary') : t('diary.newDiary')}</span>
            <button
              onClick={handleSubmit}
              disabled={isLoading || isInitializing}
              className="h-8 px-4 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-all active:scale-[0.97] shadow-sm"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {isLoading || isAnalyzing
                ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : isEditMode ? t('common.update') : t('common.save')}
            </button>
          </div>
          <div className="pb-2 text-center">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
              autoSaveStatus === 'error'
                ? 'bg-red-50 text-red-400 border border-red-100'
                : autoSaveStatus === 'saving'
                  ? 'bg-amber-50 text-amber-500 border border-amber-100'
                  : 'bg-white/70 text-stone-400 border border-stone-100'
            }`}>
              {autoSaveStatus === 'saving' && <span className="h-2 w-2 rounded-full border border-amber-300 border-t-transparent animate-spin" />}
              {autoSaveText}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {isInitializing ? (
          <div className="card-warm p-8 text-center text-stone-400 text-sm">{t('common.loading')}</div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 标题与日期 */}
          <div className="card-warm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder={t('editor.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 bg-transparent text-xl font-bold text-stone-700 placeholder:text-stone-200 outline-none border-none"
              />
              <button
                type="button"
                onClick={handleGenerateTitle}
                disabled={isGeneratingTitle || !content.trim()}
                className="h-9 px-4 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
              >
                {isGeneratingTitle
                  ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : t('editor.aiTitle')}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-stone-300" />
              <input
                type="date"
                value={diaryDate}
                onChange={(e) => setDiaryDate(e.target.value)}
                className="text-sm text-stone-400 bg-transparent outline-none border-none [color-scheme:light] cursor-pointer hover:text-stone-600 transition-colors"
              />
            </div>
          </div>

          {/* 今日引导问题 */}
          <div className="card-warm p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-stone-400 mb-1">{t('editor.dailyQuestion')}</p>
              <p className="text-sm text-stone-600 leading-6">{guidedQuestion}</p>
              <p className="text-[11px] text-stone-300 mt-1">{guidanceSource === 'ai' ? t('editor.aiGuidance') : t('editor.fallbackGuidance')}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadDailyGuidance()}
              disabled={isLoadingGuidance}
              className="shrink-0 h-7 w-7 rounded-lg border border-[#e7dbd5] bg-white text-stone-400 hover:text-stone-600 hover:bg-[#f8f5f2] transition-colors disabled:opacity-50 flex items-center justify-center"
              title={t('editor.refreshQuestion')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGuidance ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setTitle(guidedQuestion)}
              className="shrink-0 flex items-center gap-0.5 text-xs text-[#b56f61] hover:text-[#a45f52] transition-colors"
            >
              用作标题 <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* 日记内容 - 富文本编辑器 */}
          <div className="card-warm overflow-hidden">
            <RichTextEditor
              value={content}
              onChange={handleContentChange}
            />
            <div className="px-6 py-3 border-t border-[#efe6e0] flex justify-between items-center">
              <span className="text-xs text-stone-300">{wordCount} {t('diary.words')}</span>
              {wordCount > 0 && (
                <span className="text-xs text-[#c89b8e]">
                  {wordCount < 100 ? t('editor.keepWriting') : wordCount < 300 ? t('editor.goodJob') : t('editor.richContent')}
                </span>
              )}
            </div>
          </div>

          {/* 情绪标签 */}
          <div className="card-warm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-4 h-4 text-[#b56f61]" />
              <h3 className="text-sm font-semibold text-stone-600">{t('editor.mood')}</h3>
              {emotionTags.length > 0 && (
                <span className="text-xs text-[#b56f61] bg-[#f5efea] px-2 py-0.5 rounded-full ml-auto">
                  {t('editor.selected')} {emotionTags.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_EMOTIONS.map(({ label, icon, key }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleEmotionTag(key)}
                  className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    emotionTags.includes(key)
                      ? 'text-white shadow-sm'
                      : 'bg-stone-50 text-stone-500 border border-stone-100 hover:border-[#d8c7bc] hover:bg-[#f5efea] hover:text-[#a45f52]'
                  }`}
                  style={emotionTags.includes(key)
                    ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }
                    : undefined}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 重要性评分 */}
          <div className="card-warm p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-stone-600">{t('editor.importance')}</h3>
              </div>
              <span className="text-lg font-bold text-[#b56f61]">{importanceScore}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={importanceScore}
              onChange={(e) => setImportanceScore(parseInt(e.target.value))}
              className="w-full h-2 appearance-none rounded-full outline-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #e88f7b 0%, #a09ab8 ${(importanceScore - 1) / 9 * 100}%, #e5e7eb ${(importanceScore - 1) / 9 * 100}%)`,
              }}
            />
            <div className="flex justify-between text-[11px] text-stone-300 mt-2">
              <span>{t('editor.casual')}</span>
              <span className="text-[#c89b8e] font-medium">{importanceLabels[importanceScore]}</span>
              <span>{t('editor.veryImportant')}</span>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="flex gap-3 pb-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 h-12 rounded-2xl text-sm font-medium bg-white border border-stone-100 text-stone-400 hover:bg-stone-50 transition-all active:scale-[0.98] shadow-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim() || !content.trim()}
              className="flex-1 h-12 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 transition-all active:scale-[0.98] shadow-md"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                : isEditMode ? t('editor.saveChanges') : t('editor.saveDiary')}
            </button>
          </div>
        </form>
        )}
      </main>
    </div>
  )
}

function readDraft(key: string): DiaryDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DiaryDraft>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      title: parsed.title || '',
      content: parsed.content || '',
      contentHtml: parsed.contentHtml || '',
      diaryDate: parsed.diaryDate || new Date().toISOString().split('T')[0],
      emotionTags: Array.isArray(parsed.emotionTags) ? parsed.emotionTags : [],
      importanceScore: Number(parsed.importanceScore) || 5,
      savedAt: Number(parsed.savedAt) || 0,
    }
  } catch {
    return null
  }
}

function serializeDraft(draft: DiaryDraft): string {
  return JSON.stringify({
    title: draft.title,
    content: draft.content,
    contentHtml: draft.contentHtml,
    diaryDate: draft.diaryDate,
    emotionTags: draft.emotionTags,
    importanceScore: draft.importanceScore,
  })
}

function formatAutoSaveTime(timestamp: number): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

