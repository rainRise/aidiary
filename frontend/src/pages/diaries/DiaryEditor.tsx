// 日记编辑器 - 温暖柔和心理日记风格
import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDiaryStore } from '@/store/diaryStore'
import { toast } from '@/components/ui/toast'
import { PenLine, Calendar, MessageCircle, Star, Smile, CloudSun, AlertCircle, Trophy, HeartHandshake, HelpCircle, Sparkles, Battery, Heart, Angry, Frown, PartyPopper, ChevronRight, RefreshCw } from 'lucide-react'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { aiService } from '@/services/ai.service'
import { diaryService } from '@/services/diary.service'

const PRESET_EMOTIONS = [
  { label: '开心', icon: <Smile className="w-3.5 h-3.5" /> },
  { label: '平静', icon: <CloudSun className="w-3.5 h-3.5" /> },
  { label: '焦虑', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  { label: '成就感', icon: <Trophy className="w-3.5 h-3.5" /> },
  { label: '满足', icon: <HeartHandshake className="w-3.5 h-3.5" /> },
  { label: '担忧', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  { label: '期待', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { label: '疲惫', icon: <Battery className="w-3.5 h-3.5" /> },
  { label: '感动', icon: <Heart className="w-3.5 h-3.5" /> },
  { label: '愤怒', icon: <Angry className="w-3.5 h-3.5" /> },
  { label: '悲伤', icon: <Frown className="w-3.5 h-3.5" /> },
  { label: '兴奋', icon: <PartyPopper className="w-3.5 h-3.5" /> },
]

// 每日引导问题（基于时间随机选取）
const GUIDED_QUESTIONS = [
  '今天有没有一个让你印象深刻的瞬间？',
  '今天你感觉最充实的事情是什么？',
  '有没有什么话你想对今天的自己说？',
  '今天遇到了什么挑战？你是怎么应对的？',
  '今天有什么让你感到温暖或感动的事？',
  '今天的心情用一个词来形容会是什么？',
  '今天有没有什么事情让你感到困惑或烦恼？',
  '如果今天可以重来，你会改变什么？',
  '今天你为自己做了什么？',
  '此刻你最想感谢的人或事是什么？',
]

export default function DiaryEditor() {
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()
  const { createDiary, updateDiary, isLoading } = useDiaryStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().split('T')[0])
  const [emotionTags, setEmotionTags] = useState<string[]>([])
  const [importanceScore, setImportanceScore] = useState(5)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [guidedQuestion, setGuidedQuestion] = useState(GUIDED_QUESTIONS[new Date().getDate() % GUIDED_QUESTIONS.length])
  const [guidanceSource, setGuidanceSource] = useState<'ai' | 'fallback'>('fallback')
  const [isLoadingGuidance, setIsLoadingGuidance] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (!isEditMode || !id) return
      try {
        setIsInitializing(true)
        const diary = await diaryService.get(Number(id))
        setTitle(diary.title || '')
        setContent(diary.content || '')
        setDiaryDate(diary.diary_date || new Date().toISOString().split('T')[0])
        setEmotionTags(diary.emotion_tags || [])
        setImportanceScore(diary.importance_score || 5)
      } catch (error: any) {
        toast(error?.response?.data?.detail || '加载日记失败', 'error')
        navigate('/diaries')
      } finally {
        setIsInitializing(false)
      }
    }
    init()
  }, [id, isEditMode, navigate])

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

  const handleContentChange = useCallback((text: string, _html: string) => {
    setContent(text)
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
          diary_date: diaryDate,
          emotion_tags: emotionTags.length > 0 ? emotionTags : [],
          importance_score: importanceScore,
        })
        toast('日记更新成功', 'success')
        navigate(`/diaries/${id}`)
      } else {
        const diary = await createDiary({
          title: title.trim(),
          content: content.trim(),
          diary_date: diaryDate,
          emotion_tags: emotionTags.length > 0 ? emotionTags : undefined,
          importance_score: importanceScore,
        })
        toast('日记保存成功', 'success')
        // 后台自动触发AI分析
        setIsAnalyzing(true)
        aiService.analyze({ diary_id: diary.id })
          .then(() => {
            toast('AI 分析已完成', 'success')
          })
          .catch(() => {
            // 静默失败，用户可以手动触发
          })
          .finally(() => setIsAnalyzing(false))
        navigate(`/diaries/${diary.id}`)
      }
    } catch (error: any) {
      toast(error.message || '保存失败', 'error')
    }
  }

  const handleGenerateTitle = async () => {
    if (!content.trim() || content.trim().length < 10) {
      toast('先写几句内容，AI 才能更懂你', 'error')
      return
    }
    try {
      setIsGeneratingTitle(true)
      const result = await aiService.generateTitle(content, title)
      setTitle(result.title)
      toast('已生成标题', 'success')
    } catch (error: any) {
      toast(error?.response?.data?.detail || '生成标题失败', 'error')
    } finally {
      setIsGeneratingTitle(false)
    }
  }

  const wordCount = content.length
  const importanceLabels = ['', '随意', '', '', '一般', '', '', '', '重要', '', '非常重要']

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.88)' }}>
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex justify-between items-center py-3.5">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
            >
              ← 返回
            </button>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5"><PenLine className="w-4 h-4 text-[#b56f61]" /> 写日记</span>
            <button
              onClick={handleSubmit}
              disabled={isLoading || isInitializing}
              className="h-8 px-4 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-all active:scale-[0.97] shadow-sm"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {isLoading || isAnalyzing
                ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : isEditMode ? '更新' : '保存'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {isInitializing ? (
          <div className="card-warm p-8 text-center text-stone-400 text-sm">正在加载日记...</div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 标题与日期 */}
          <div className="card-warm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="给今天起个标题..."
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
                  : 'AI 起题'}
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
              <p className="text-xs text-stone-400 mb-1">今日思考</p>
              <p className="text-sm text-stone-600 leading-6">{guidedQuestion}</p>
              <p className="text-[11px] text-stone-300 mt-1">{guidanceSource === 'ai' ? 'AI个性化问题' : '系统引导问题'}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadDailyGuidance()}
              disabled={isLoadingGuidance}
              className="shrink-0 h-7 w-7 rounded-lg border border-[#e7dbd5] bg-white text-stone-400 hover:text-stone-600 hover:bg-[#f8f5f2] transition-colors disabled:opacity-50 flex items-center justify-center"
              title="换一题"
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
              <span className="text-xs text-stone-300">{wordCount} 字</span>
              {wordCount > 0 && (
                <span className="text-xs text-[#c89b8e]">
                  {wordCount < 100 ? '继续写写' : wordCount < 300 ? '写得不错' : '内容很丰富'}
                </span>
              )}
            </div>
          </div>

          {/* 情绪标签 */}
          <div className="card-warm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-4 h-4 text-[#b56f61]" />
              <h3 className="text-sm font-semibold text-stone-600">今天的心情</h3>
              {emotionTags.length > 0 && (
                <span className="text-xs text-[#b56f61] bg-[#f5efea] px-2 py-0.5 rounded-full ml-auto">
                  已选 {emotionTags.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_EMOTIONS.map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleEmotionTag(label)}
                  className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    emotionTags.includes(label)
                      ? 'text-white shadow-sm'
                      : 'bg-stone-50 text-stone-500 border border-stone-100 hover:border-[#d8c7bc] hover:bg-[#f5efea] hover:text-[#a45f52]'
                  }`}
                  style={emotionTags.includes(label)
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
                <h3 className="text-sm font-semibold text-stone-600">这件事对我有多重要？</h3>
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
              <span>随意</span>
              <span className="text-[#c89b8e] font-medium">{importanceLabels[importanceScore]}</span>
              <span>非常重要</span>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="flex gap-3 pb-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 h-12 rounded-2xl text-sm font-medium bg-white border border-stone-100 text-stone-400 hover:bg-stone-50 transition-all active:scale-[0.98] shadow-sm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim() || !content.trim()}
              className="flex-1 h-12 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 transition-all active:scale-[0.98] shadow-md"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                : isEditMode ? '保存修改' : '保存日记'}
            </button>
          </div>
        </form>
        )}
      </main>
    </div>
  )
}


