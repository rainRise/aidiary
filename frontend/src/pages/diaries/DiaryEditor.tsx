// 日记编辑器 - 温暖柔和心理日记风格
import { useState, useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDiaryStore } from '@/store/diaryStore'
import { toast } from '@/components/ui/toast'
import { PenLine, Calendar, MessageCircle, Star, Smile, CloudSun, AlertCircle, Trophy, HeartHandshake, HelpCircle, Sparkles, Battery, Heart, Angry, Frown, PartyPopper, ChevronRight, RefreshCw, ShieldCheck, Target, Gift, Mic, Wand2, Sprout } from 'lucide-react'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { aiService } from '@/services/ai.service'
import { diaryService } from '@/services/diary.service'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import type { CareProgress, Diary } from '@/types/diary'

const PRESET_EMOTIONS_KEYS = [
  'happy', 'calm', 'anxious', 'achievement', 'satisfied',
  'worried', 'expectant', 'exhausted', 'touched', 'angry', 'sad', 'excited'
]

const GUIDED_QUESTIONS_KEYS = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'
]

const CHECKIN_EMOTIONS = [
  { key: 'happy', label: '开心', emoji: '😄', planet: '晴屿', description: '通常出现在你感到轻松、愿意靠近世界的时候。' },
  { key: 'calm', label: '平静', emoji: '🙂', planet: '静湾', description: '通常出现在你节奏稳定、心里有一点空间的时候。' },
  { key: 'neutral', label: '一般', emoji: '😐', planet: '灰原', description: '通常出现在你没有明显起伏，只是平平走过一天的时候。' },
  { key: 'sad', label: '低落', emoji: '😞', planet: '雨谷', description: '通常出现在你需要被理解、也需要慢一点的时候。' },
  { key: 'anxious', label: '焦虑', emoji: '😰', planet: '雾岛', description: '通常出现在你感到疲惫、任务很多或想独处的时候。' },
  { key: 'angry', label: '烦躁', emoji: '😡', planet: '赤丘', description: '通常出现在你的边界被触碰、能量被消耗的时候。' },
  { key: 'exhausted', label: '疲惫', emoji: '😴', planet: '眠星', description: '通常出现在身体想暂停、需要恢复的时候。' },
]

const CHECKIN_EVENTS = [
  { key: 'study', label: '学习' },
  { key: 'relationship', label: '人际' },
  { key: 'family', label: '家庭' },
  { key: 'body', label: '身体' },
  { key: 'work', label: '工作' },
  { key: 'other', label: '其他' },
]

const REFLECTION_OPTIONS = [
  { key: 'too_much', label: '事情太多' },
  { key: 'not_good_enough', label: '害怕做不好' },
  { key: 'where_to_start', label: '不知道从哪里开始' },
  { key: 'messy', label: '说不清，只是很乱' },
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

type LightMemory = Pick<Diary, 'id' | 'title' | 'content' | 'diary_date'>

export default function DiaryEditor() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const [showDeepEditor, setShowDeepEditor] = useState(isEditMode)
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
  const [checkinEmotion, setCheckinEmotion] = useState('anxious')
  const [checkinEnergy, setCheckinEnergy] = useState(2)
  const [checkinEvent, setCheckinEvent] = useState('study')
  const [isLightCompleted, setIsLightCompleted] = useState(false)
  const [showOneLine, setShowOneLine] = useState(false)
  const [showAiQuestion, setShowAiQuestion] = useState(false)
  const [oneLineText, setOneLineText] = useState('')
  const [selectedReflection, setSelectedReflection] = useState('')
  const [lightReward, setLightReward] = useState<{ points: number; card: string } | null>(null)
  const [savedLightDiaryId, setSavedLightDiaryId] = useState<number | null>(null)
  const [careProgress, setCareProgress] = useState<CareProgress | null>(null)
  const [lightMemory, setLightMemory] = useState<LightMemory | null>(null)
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

  const loadCareProgress = useCallback(async () => {
    try {
      const progress = await diaryService.getCareProgress()
      setCareProgress(progress)
    } catch {
      setCareProgress(null)
    }
  }, [])

  useEffect(() => {
    if (!isEditMode) void loadCareProgress()
  }, [isEditMode, loadCareProgress])

  useEffect(() => {
    if (isEditMode) return
    let cancelled = false
    diaryService.list({ page: 1, page_size: 4, emotion_tag: checkinEmotion })
      .then((result) => {
        if (cancelled) return
        const memory = result.items.find((item) => item.diary_date !== diaryDate)
        setLightMemory(memory ? {
          id: memory.id,
          title: memory.title,
          content: memory.content,
          diary_date: memory.diary_date,
        } : null)
      })
      .catch(() => {
        if (!cancelled) setLightMemory(null)
      })
    return () => {
      cancelled = true
    }
  }, [checkinEmotion, diaryDate, isEditMode])

  const toggleEmotionTag = (tag: string) => {
    setEmotionTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleContentChange = useCallback((text: string, html: string) => {
    setContent(text)
    setContentHtml(html)
  }, [])

  const selectedCheckinEmotion = CHECKIN_EMOTIONS.find((item) => item.key === checkinEmotion) || CHECKIN_EMOTIONS[0]
  const selectedCheckinEvent = CHECKIN_EVENTS.find((item) => item.key === checkinEvent) || CHECKIN_EVENTS[0]
  const selectedReflectionLabel = REFLECTION_OPTIONS.find((item) => item.key === selectedReflection)?.label
  const lightContent = buildLightContent({
    emotionLabel: selectedCheckinEmotion.label,
    energy: checkinEnergy,
    eventLabel: selectedCheckinEvent.label,
    oneLineText,
    reflectionLabel: selectedReflectionLabel,
  })
  const canLightSubmit = isLightCompleted || Boolean(checkinEmotion && checkinEvent)

  const completeHeartLight = async () => {
    const nextTitle = title.trim() || `今日心灯：${selectedCheckinEmotion.label}`
    const nextContent = content.trim() || lightContent
    setTitle(nextTitle)
    setContent(nextContent)
    setContentHtml(`<p>${escapeHtml(nextContent).replace(/\n/g, '<br>')}</p>`)
    try {
      if (!savedLightDiaryId) {
        const diary = await createDiary({
          title: nextTitle,
          content: nextContent,
          content_html: `<p>${escapeHtml(nextContent).replace(/\n/g, '<br>')}</p>`,
          diary_date: diaryDate,
          emotion_tags: emotionTags.length > 0 ? emotionTags : [checkinEmotion],
          importance_score: importanceScore,
        })
        setSavedLightDiaryId(diary.id)
        localStorage.removeItem(draftKey)
        void loadCareProgress()
      }
      setIsLightCompleted(true)
      setLightReward({ points: oneLineText.trim() || selectedReflection ? 10 : 5, card: selectedReflectionLabel || selectedCheckinEmotion.label })
      toast('今日心灯已点亮。你可以到这里为止，也可以补充几句话。', 'success')
    } catch (error: any) {
      toast(error.message || t('diary.saveFailed'), 'error')
    }
  }

  const handleRestCareRecord = async () => {
    try {
      const result = await diaryService.createRestCareRecord()
      if (result.created) setSavedLightDiaryId(result.diary_id)
      setIsLightCompleted(true)
      localStorage.removeItem(draftKey)
      void loadCareProgress()
      toast(result.message || '已记录，今天到这里也很好。', 'success')
    } catch (error: any) {
      toast(error.message || '记录失败，请稍后重试', 'error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalTitle = title.trim() || (canLightSubmit ? `今日心灯：${selectedCheckinEmotion.label}` : '')
    const finalContent = content.trim() || (canLightSubmit ? lightContent : '')
    const finalContentHtml = contentHtml || (finalContent ? `<p>${escapeHtml(finalContent).replace(/\n/g, '<br>')}</p>` : undefined)

    if (!finalTitle || !finalContent) {
      toast('可以先完成 5 秒情绪签到，也可以写标题和内容', 'error')
      return
    }
    try {
      if ((isEditMode && id) || savedLightDiaryId) {
        const targetId = savedLightDiaryId || Number(id)
        await updateDiary(targetId, {
          title: finalTitle,
          content: finalContent,
          content_html: finalContentHtml,
          diary_date: diaryDate,
          emotion_tags: emotionTags.length > 0 ? emotionTags : (savedLightDiaryId ? [checkinEmotion] : []),
          importance_score: importanceScore,
        })
        localStorage.removeItem(draftKey)
        toast(t('diary.updateSuccess'), 'success')
        navigate(`/diaries/${targetId}`)
      } else {
        const diary = await createDiary({
          title: finalTitle,
          content: finalContent,
          content_html: finalContentHtml,
          diary_date: diaryDate,
          emotion_tags: emotionTags.length > 0 ? emotionTags : [checkinEmotion],
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
  const isFullEditorVisible = isEditMode || showDeepEditor

  const openFullEditor = () => {
    const nextContent = content.trim() || lightContent
    setShowDeepEditor(true)
    setShowOneLine(true)
    setTitle((prev) => prev || `今日心灯：${selectedCheckinEmotion.label}`)
    setContent(nextContent)
    setContentHtml(`<p>${escapeHtml(nextContent).replace(/\n/g, '<br>')}</p>`)
    setTimeout(() => document.getElementById('full-diary-editor-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70 relative" style={{ background: 'rgba(248,245,239,0.88)' }}>
        {/* 语言切换器 */}
        <div className="absolute top-2 right-4">
          <LanguageSwitcher />
        </div>
        
        <div className="max-w-6xl mx-auto px-6">
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
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
              <PenLine className="w-4 h-4 text-[#b56f61]" />
              {isEditMode ? t('diary.editDiary') : isFullEditorVisible ? t('diary.newDiary') : '今日心灯'}
            </span>
            {isFullEditorVisible ? (
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
            ) : (
              <div className="h-8 w-16" />
            )}
          </div>
          {isFullEditorVisible && <div className="pb-2 text-center">
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
          </div>}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {isInitializing ? (
          <div className="card-warm p-8 text-center text-stone-400 text-sm">{t('common.loading')}</div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isEditMode && (
            <>
              <HeartLightCheckin
                emotion={checkinEmotion}
                energy={checkinEnergy}
                eventType={checkinEvent}
                isCompleted={isLightCompleted}
                onEmotionChange={(value) => {
                  setCheckinEmotion(value)
                  setEmotionTags((prev) => prev.includes(value) ? prev : [value, ...prev.filter((tag) => tag !== 'neutral')].slice(0, 4))
                }}
                onEnergyChange={setCheckinEnergy}
                onEventChange={setCheckinEvent}
                onComplete={completeHeartLight}
                onRest={handleRestCareRecord}
                onAddLine={() => {
                  setShowOneLine(true)
                  setTimeout(() => document.getElementById('light-one-line')?.focus(), 50)
                }}
              />

              <CareProgressSummary progress={careProgress} />

              <DailyReflectionPrompt
                question={guidedQuestion}
                showAiQuestion={showAiQuestion}
                selectedReflection={selectedReflection}
                onSkip={handleRestCareRecord}
                onWriteOneLine={() => {
                  setShowOneLine(true)
                  setTimeout(() => document.getElementById('light-one-line')?.focus(), 50)
                }}
                onVoice={() => toast('语音轻记录可以作为下一步接入，这里先保留入口。', 'success')}
                onAskAi={() => setShowAiQuestion(true)}
                onSelectReflection={(value) => {
                  setSelectedReflection(value)
                  const label = REFLECTION_OPTIONS.find((item) => item.key === value)?.label || ''
                  const generated = `今天我有点${selectedCheckinEmotion.label}，主要是${label}。`
                  setOneLineText(generated)
                  setShowOneLine(true)
                  setTitle((prev) => prev || `今日心灯：${selectedCheckinEmotion.label}`)
                }}
              />

              <LightNextStepBar onOpenFullEditor={openFullEditor} onOpenGrowth={() => navigate('/growth')} />

              <div className="grid gap-4 lg:grid-cols-[1fr_0.82fr]">
                <LightNotePanel
                  visible={showOneLine}
                  value={oneLineText}
                  onChange={(value) => {
                    setOneLineText(value)
                    if (isLightCompleted || value.trim()) {
                      const nextContent = buildLightContent({
                        emotionLabel: selectedCheckinEmotion.label,
                        energy: checkinEnergy,
                        eventLabel: selectedCheckinEvent.label,
                        oneLineText: value,
                        reflectionLabel: selectedReflectionLabel,
                      })
                      setContent(nextContent)
                      setContentHtml(`<p>${escapeHtml(nextContent).replace(/\n/g, '<br>')}</p>`)
                    }
                  }}
                />
                <div className="space-y-4">
                  <EmotionPlanet emotion={selectedCheckinEmotion} />
                  {lightMemory ? <MemoryBlindBox memory={lightMemory} onOpen={() => navigate(`/diaries/${lightMemory.id}`)} /> : null}
                </div>
              </div>

              {lightReward && <LightRewardBar points={lightReward.points} card={lightReward.card} />}
            </>
          )}

          {isFullEditorVisible && (
          <>
          {/* 标题与日期 */}
          <div id="full-diary-editor-anchor" className="card-warm p-6 space-y-4">
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
              disabled={isLoading || (!title.trim() && !content.trim() && !canLightSubmit)}
              className="flex-1 h-12 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 transition-all active:scale-[0.98] shadow-md"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                : isEditMode ? t('editor.saveChanges') : t('editor.saveDiary')}
            </button>
          </div>
          </>
          )}
        </form>
        )}
      </main>
    </div>
  )
}

function HeartLightCheckin({
  emotion,
  energy,
  eventType,
  isCompleted,
  onEmotionChange,
  onEnergyChange,
  onEventChange,
  onComplete,
  onRest,
  onAddLine,
}: {
  emotion: string
  energy: number
  eventType: string
  isCompleted: boolean
  onEmotionChange: (value: string) => void
  onEnergyChange: (value: number) => void
  onEventChange: (value: string) => void
  onComplete: () => void
  onRest: () => void
  onAddLine: () => void
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#eadfd8] bg-white/82 shadow-[0_18px_54px_rgba(122,83,73,0.1)]">
      <div className="absolute inset-y-0 left-0 hidden w-36 overflow-hidden bg-[linear-gradient(160deg,#fff4e8,#ffe7ee_55%,#f2edff)] sm:block">
        <div className="absolute left-5 top-10 h-24 w-24 rounded-full bg-white/45 blur-xl" />
        <img
          src="/xindeng-small.png"
          alt="心灯"
          width={96}
          height={96}
          className="absolute left-5 top-12 h-24 w-24 object-contain drop-shadow-[0_18px_28px_rgba(214,135,116,0.2)]"
        />
        <Sparkles className="absolute left-6 top-6 h-4 w-4 text-white" />
        <Sparkles className="absolute right-5 top-11 h-3 w-3 text-[#f2a7a0]" />
      </div>

      {isCompleted && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 animate-[heartLightCenterPop_0.5s_ease-out] flex-col items-center text-center">
          <img src="/star-small.png" alt="今日已点亮" width={96} height={96} className="h-24 w-24 object-contain drop-shadow-[0_18px_28px_rgba(233,172,91,0.34)]" />
          <span className="mt-1 rounded-full bg-white/78 px-4 py-1.5 text-sm font-bold text-[#c57668] shadow-[0_10px_24px_rgba(163,103,95,0.12)] backdrop-blur">
            今日已点亮
          </span>
        </div>
      )}

      <div className="relative p-5 sm:pl-40">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff4df] shadow-inner sm:hidden">
            <img src="/xindeng-small.png" alt="心灯" width={48} height={48} className="h-12 w-12 object-contain" />
          </span>
          <div>
            <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-normal text-stone-800">今天也来点亮一盏心灯吧</h2>
            <Sparkles className="h-4 w-4 text-[#f0a09a]" />
            </div>
            <p className="mt-1 text-sm text-stone-400">只需要 5 秒，不必马上写很多。</p>
          </div>
        </div>

        <div className="rounded-3xl border border-[#eadfd8] bg-white/62 p-4 shadow-inner">
          <CheckinRow label="情绪">
            {CHECKIN_EMOTIONS.map((item) => (
              <ChoicePill
                key={item.key}
                active={emotion === item.key}
                onClick={() => onEmotionChange(item.key)}
              >
                <span>{item.emoji}</span>{item.label}
              </ChoicePill>
            ))}
          </CheckinRow>
          <CheckinRow label="能量">
            {[1, 2, 3, 4, 5].map((item) => (
              <ChoicePill
                key={item}
                active={energy === item}
                onClick={() => onEnergyChange(item)}
              >
                {item}
              </ChoicePill>
            ))}
          </CheckinRow>
          <CheckinRow label="事件">
            {CHECKIN_EVENTS.map((item) => (
              <ChoicePill
                key={item.key}
                active={eventType === item.key}
                onClick={() => onEventChange(item.key)}
              >
                {item.label}
              </ChoicePill>
            ))}
          </CheckinRow>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#f58b7d,#b19adc)] px-7 text-sm font-bold text-white shadow-[0_14px_34px_rgba(210,113,121,0.24)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" /> 完成今日心灯
          </button>
          <button
            type="button"
            onClick={onAddLine}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[#eadfd8] bg-white/82 px-6 text-sm font-bold text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <PenLine className="h-4 w-4" /> 继续补一句
          </button>
          <button
            type="button"
            onClick={onRest}
            className="h-12 px-3 text-sm font-semibold text-stone-400 transition-colors hover:text-[#b56f61]"
          >
            今天不想写
          </button>
        </div>
        <p className="mt-3 text-center text-sm text-stone-400">
          {isCompleted ? '今日心灯已点亮。你可以到这里为止，也可以补充一句话。' : '不写正文也可以完成一次轻记录。'}
        </p>
      </div>
    </section>
  )
}

function CheckinRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 py-2 sm:grid-cols-[72px_1fr] sm:items-center">
      <div className="text-sm font-semibold text-stone-500">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function ChoicePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-16 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? 'border-[#a7a0d8] bg-[#f6f1ff] text-[#6c62af] shadow-sm ring-1 ring-[#cfc8ef]'
          : 'border-[#eadfd8] bg-white/78 text-stone-500 hover:border-[#d5c5bc] hover:bg-[#fff8f4]'
      }`}
    >
      {children}
    </button>
  )
}

function CareProgressSummary({ progress }: { progress: CareProgress | null }) {
  const protectedStreak = progress?.protected_streak ?? 0
  const shieldBalance = progress?.shield_balance ?? 0
  const weeklyActive = progress?.weekly_active_count ?? 0
  const weeklyGoal = progress?.weekly_goal ?? 3
  const shieldMax = progress?.shield_max ?? 3

  return (
    <section className="flex flex-wrap items-center justify-center gap-3 rounded-3xl border border-[#eadfd8] bg-white/62 px-4 py-3 text-sm text-stone-500 shadow-[0_10px_28px_rgba(122,83,73,0.06)]">
      <SummaryPill icon={<Sprout />} label={`${protectedStreak} 天连续心灯`} />
      <SummaryPill icon={<ShieldCheck />} label={`${shieldBalance}/${shieldMax} 个心灯护盾`} />
      <SummaryPill icon={<Target />} label={`本周 ${Math.min(weeklyActive, weeklyGoal)}/${weeklyGoal} 次轻记录`} />
      {progress?.shield_awarded && <span className="rounded-full bg-[#fff2d8] px-3 py-1 text-xs font-semibold text-amber-600">已奖励护盾 +1</span>}
    </section>
  )
}

function SummaryPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 font-semibold text-stone-600 shadow-sm [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-[#b88f72]">
      {icon}
      {label}
    </span>
  )
}

function LightNextStepBar({ onOpenFullEditor, onOpenGrowth }: { onOpenFullEditor: () => void; onOpenGrowth: () => void }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={onOpenFullEditor}
        className="flex items-center justify-between rounded-3xl border border-[#eadfd8] bg-white/78 px-5 py-4 text-left shadow-[0_12px_34px_rgba(122,83,73,0.07)] transition-all hover:-translate-y-0.5"
      >
        <span>
          <span className="block text-sm font-bold text-stone-700">写完整日记</span>
          <span className="mt-1 block text-xs text-stone-400">进入富文本编辑、图片和自动保存</span>
        </span>
        <ChevronRight className="h-5 w-5 text-stone-300" />
      </button>
      <button
        type="button"
        onClick={onOpenGrowth}
        className="flex items-center justify-between rounded-3xl border border-[#eadfd8] bg-white/64 px-5 py-4 text-left shadow-[0_12px_34px_rgba(122,83,73,0.05)] transition-all hover:-translate-y-0.5"
      >
        <span>
          <span className="block text-sm font-bold text-stone-700">查看成长旅程</span>
          <span className="mt-1 block text-xs text-stone-400">情绪趋势、时间线和长期回看</span>
        </span>
        <ChevronRight className="h-5 w-5 text-stone-300" />
      </button>
    </section>
  )
}

function DailyReflectionPrompt({
  question,
  showAiQuestion,
  selectedReflection,
  onSkip,
  onWriteOneLine,
  onVoice,
  onAskAi,
  onSelectReflection,
}: {
  question: string
  showAiQuestion: boolean
  selectedReflection: string
  onSkip: () => void
  onWriteOneLine: () => void
  onVoice: () => void
  onAskAi: () => void
  onSelectReflection: (value: string) => void
}) {
  return (
    <section className="rounded-3xl border border-[#eadfd8] bg-white/76 p-5 shadow-[0_14px_40px_rgba(122,83,73,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fff4dc] text-amber-500">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-stone-500">今日映题</p>
            <p className="mt-1 text-lg font-bold leading-7 text-stone-800">{question}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <PromptButton icon={<ChevronRight />} label="今天不想写" onClick={onSkip} />
          <PromptButton icon={<PenLine />} label="写一句" onClick={onWriteOneLine} active />
          <PromptButton icon={<Mic />} label="语音说说" onClick={onVoice} />
          <PromptButton icon={<Wand2 />} label="让 AI 问我" onClick={onAskAi} />
        </div>
      </div>
      {showAiQuestion && (
        <div className="mt-4 rounded-3xl border border-[#eadfd8] bg-[#fffaf6] p-4">
          <p className="mb-3 text-sm font-semibold text-stone-600">这份感受更像是：</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {REFLECTION_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectReflection(item.key)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                  selectedReflection === item.key
                    ? 'border-[#a7a0d8] bg-[#f6f1ff] text-[#6c62af]'
                    : 'border-[#eadfd8] bg-white text-stone-500 hover:bg-[#fff6f2]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function PromptButton({ icon, label, onClick, active = false }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-5 text-sm font-semibold transition-all active:scale-[0.98] ${
        active ? 'border-[#b7a6df] bg-white text-[#7767b6]' : 'border-[#eadfd8] bg-white/78 text-stone-500 hover:bg-[#fff6f2]'
      }`}
    >
      <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>{label}
    </button>
  )
}

function LightNotePanel({ visible, value, onChange }: { visible: boolean; value: string; onChange: (value: string) => void }) {
  return (
    <section className="rounded-3xl border border-[#eadfd8] bg-white/78 p-5 shadow-[0_14px_40px_rgba(122,83,73,0.08)]">
      <div className="mb-3 flex items-center gap-2">
        <PenLine className="h-4 w-4 text-[#d98878]" />
        <h3 className="text-base font-bold text-stone-700">轻记录</h3>
      </div>
      {visible ? (
        <>
          <textarea
            id="light-one-line"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="比如：今天我有点焦虑，主要是害怕自己做不好。"
            className="min-h-36 w-full resize-none rounded-2xl border border-[#eadfd8] bg-white/70 p-4 text-sm leading-7 text-stone-700 outline-none transition-all placeholder:text-stone-300 focus:border-[#c9badc]"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
            <span>{value.length} 字</span>
            <span>写得不精确也没关系</span>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#eadfd8] bg-white/50 p-6 text-sm leading-7 text-stone-400">
          你可以只完成心灯签到，不需要写正文。想补充时，再写一句就好。
        </div>
      )}
    </section>
  )
}

function EmotionPlanet({ emotion }: { emotion: typeof CHECKIN_EMOTIONS[number] }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#eadfd8] bg-white/78 p-5 shadow-[0_14px_40px_rgba(122,83,73,0.08)]">
      <div className="absolute right-3 top-4 h-24 w-32 rounded-full bg-[radial-gradient(circle,#d8c4ff_0%,#ffe1f2_45%,transparent_70%)] blur-sm" />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">🌌</span>
            <h3 className="text-base font-bold text-stone-700">情绪星球</h3>
          </div>
          <p className="text-sm leading-7 text-stone-600">今天你点亮了“{emotion.planet}”的一颗星。</p>
          <p className="text-sm leading-7 text-stone-500">{emotion.description}</p>
        </div>
        <div className="relative flex h-24 w-28 shrink-0 items-center justify-center">
          <div className="absolute h-16 w-24 rotate-[-10deg] rounded-full border border-violet-200" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b8a7ff,#ffd5e5)] text-2xl shadow-[0_0_24px_rgba(170,137,245,0.35)]">
            {emotion.emoji}
          </div>
          <Sparkles className="absolute right-2 top-1 h-5 w-5 text-amber-300" />
        </div>
      </div>
    </section>
  )
}

function MemoryBlindBox({ memory, onOpen }: { memory: LightMemory; onOpen: () => void }) {
  const preview = memory.content.replace(/\s+/g, ' ').slice(0, 68)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full overflow-hidden rounded-3xl border border-[#eadfd8] bg-white/78 p-5 text-left shadow-[0_14px_40px_rgba(122,83,73,0.08)] transition-all hover:-translate-y-0.5"
    >
      <div className="absolute right-4 top-5 h-20 w-24 rounded-full bg-[radial-gradient(circle,#ffe1b8_0%,#f1d8ff_55%,transparent_72%)] blur-sm" />
      <div className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff0df] text-2xl shadow-inner">
          🎁
        </span>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Gift className="h-4 w-4 text-[#d99370]" />
            <h3 className="text-base font-bold text-stone-700">记忆盲盒</h3>
          </div>
          <p className="text-sm leading-6 text-stone-600">你在 {memory.diary_date} 有过相近记录。</p>
          <p className="text-sm leading-6 text-stone-500">{preview}{memory.content.length > 68 ? '...' : ''}</p>
        </div>
      </div>
    </button>
  )
}

function LightRewardBar({ points, card }: { points: number; card: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#eadfd8] bg-[linear-gradient(100deg,#fffaf3,#ffe7df,#f0e9ff)] px-6 py-4 shadow-[0_14px_40px_rgba(122,83,73,0.08)]">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_40%,#fff_0_2px,transparent_3px),radial-gradient(circle_at_80%_55%,#fff_0_2px,transparent_3px)]" />
      <div className="relative flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-stone-700">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-white/62 px-5 py-2 text-[#c47a61]">
          <Sparkles className="h-4 w-4" /> +{points} 映光
        </span>
        <span className="h-6 w-px bg-[#e6d7d0]" />
        <span>获得卡牌：{card}</span>
        <span className="rotate-6 rounded-xl bg-white/60 px-3 py-2 text-xs text-[#8e83bd] shadow-sm">心灯已点亮</span>
      </div>
    </div>
  )
}

function buildLightContent({
  emotionLabel,
  energy,
  eventLabel,
  oneLineText,
  reflectionLabel,
}: {
  emotionLabel: string
  energy: number
  eventLabel: string
  oneLineText: string
  reflectionLabel?: string
}) {
  const lines = [
    `今天我点亮了一盏心灯。`,
    `情绪：${emotionLabel}；能量：${energy}/5；事件：${eventLabel}。`,
  ]
  if (reflectionLabel) {
    lines.push(`这份感受更像是：${reflectionLabel}。`)
  }
  if (oneLineText.trim()) {
    lines.push(oneLineText.trim())
  }
  return lines.join('\n')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
