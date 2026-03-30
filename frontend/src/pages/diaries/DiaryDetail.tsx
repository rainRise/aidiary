// 日记详情页面 - 温暖柔和心理日记风格
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDiaryStore } from '@/store/diaryStore'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { BookOpen, Calendar, Star, MessageCircle, FileText, Sparkles, Loader2, Brain } from 'lucide-react'
import type { ReactNode } from 'react'

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    return <span key={index}>{part}</span>
  })
}

function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n')

  return (
    <div className="space-y-3 text-sm leading-7 text-stone-600">
      {lines.map((line, index) => {
        const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim())
        if (headingMatch) {
          const level = headingMatch[1].length
          const text = headingMatch[2]
          if (level === 1) return <h1 key={index} className="text-2xl font-bold text-stone-700">{renderInline(text)}</h1>
          if (level === 2) return <h2 key={index} className="text-xl font-bold text-stone-700">{renderInline(text)}</h2>
          if (level === 3) return <h3 key={index} className="text-lg font-semibold text-stone-700">{renderInline(text)}</h3>
          return <h4 key={index} className="text-base font-semibold text-stone-700">{renderInline(text)}</h4>
        }

        const imageMatch = /^!\[(.*?)\]\((.+?)\)$/.exec(line.trim())
        if (imageMatch) {
          const alt = imageMatch[1] || '日记图片'
          const src = imageMatch[2]
          return (
            <img
              key={index}
              src={src}
              alt={alt}
              loading="lazy"
              className="w-full max-h-[420px] object-contain rounded-xl border border-[#e7dbd5] bg-white"
            />
          )
        }

        if (!line.trim()) {
          return <div key={index} className="h-1" />
        }

        return (
          <p key={index}>
            {renderInline(line)}
          </p>
        )
      })}
    </div>
  )
}

export default function DiaryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentDiary, fetchDiary, deleteDiary } = useDiaryStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadDiary(Number(id))
    }
  }, [id])

  const loadDiary = async (diaryId: number) => {
    setIsLoading(true)
    try {
      await fetchDiary(diaryId)
    } catch (error) {
      console.error('Failed to load diary:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!currentDiary) return

    if (confirm(`确定要删除日记《${currentDiary.title}》吗？`)) {
      try {
        await deleteDiary(currentDiary.id)
        navigate('/diaries')
      } catch (error) {
        toast('删除失败', 'error')
      }
    }
  }

  const handleAnalyze = () => {
    if (id) {
      navigate(`/analysis/${id}`)
    }
  }

  const emotionTags = currentDiary?.emotion_tags ?? []
  const [analyzing, setAnalyzing] = useState(false)

  // 如果日记未分析，轮询直到分析完成
  useEffect(() => {
    if (!currentDiary || currentDiary.is_analyzed) {
      setAnalyzing(false)
      return
    }
    setAnalyzing(true)
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
      try {
        await fetchDiary(currentDiary.id)
      } catch {}
      if (attempts >= 24) {
        clearInterval(timer)
        setAnalyzing(false)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [currentDiary?.id, currentDiary?.is_analyzed])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
        <Loading size="lg" />
      </div>
    )
  }

  if (!currentDiary) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
        <div className="card-warm p-8 text-center max-w-sm">
          <p className="text-stone-400 mb-4 flex items-center justify-center gap-1.5"><BookOpen className="w-4 h-4" /> 日记不存在</p>
          <button
            onClick={() => navigate('/diaries')}
            className="h-10 px-6 rounded-xl text-sm font-medium text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.88)' }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex justify-between items-center py-3.5">
            <button
              onClick={() => navigate('/diaries')}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
            >
              ← 返回
            </button>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-[#b56f61]" /> 日记详情</span>
            <div className="w-12" />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* 日记内容卡片 */}
        <div className="card-warm p-6 space-y-5">
          {/* 标题 */}
          <div>
            <h1 className="text-xl font-bold text-stone-700 mb-3">{currentDiary.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {format(new Date(currentDiary.diary_date), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
              </span>
              <span className="text-stone-200">·</span>
              <span>{currentDiary.word_count} 字</span>
              <span className="text-stone-200">·</span>
              <span className="text-[#b56f61] font-medium flex items-center gap-1"><Star className="w-3.5 h-3.5" /> 重要性 {currentDiary.importance_score}/10</span>
            </div>
          </div>

          {/* 情绪标签 */}
          {emotionTags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-stone-400 mb-2 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> 心情标签</p>
              <div className="flex flex-wrap gap-2">
                {emotionTags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs px-3 py-1.5 rounded-2xl text-white font-medium"
                    style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 日记正文 */}
          <div>
            <p className="text-xs font-medium text-stone-400 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> 日记内容</p>
            <div className="p-5 rounded-2xl bg-[#f5efea]/40 border border-[#e7dbd5]/50">
              <MarkdownContent markdown={currentDiary.content} />
            </div>
          </div>

          {/* 时间信息 */}
          <div className="text-xs text-stone-300 pt-2 border-t border-[#efe6e0] space-y-1">
            <p>创建于 {format(new Date(currentDiary.created_at), 'yyyy-MM-dd HH:mm')}</p>
            {currentDiary.updated_at !== currentDiary.created_at && (
              <p>更新于 {format(new Date(currentDiary.updated_at), 'yyyy-MM-dd HH:mm')}</p>
            )}
          </div>
        </div>

        {/* AI分析卡片 */}
        <div className="card-warm overflow-hidden">
          <div className="p-6" style={{ background: 'linear-gradient(135deg, rgba(232,143,123,0.10), rgba(160,154,184,0.10))' }}>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-stone-600">AI 深度分析</h3>
              {analyzing && (
                <span className="ml-auto flex items-center gap-1 text-xs text-violet-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> 分析中...
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mb-4 leading-5">
              基于萨提亚冰山模型，深入了解你的情绪、认知和深层渴望
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAnalyze}
                disabled={analyzing && !currentDiary.is_analyzed}
                className="h-9 px-5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.97] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
              >
                {currentDiary.is_analyzed ? '查看分析结果' : analyzing ? '等待分析完成...' : '开始 AI 分析'}
              </button>
              {currentDiary.is_analyzed && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> 已分析
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 pb-8">
          <button
            onClick={() => navigate('/diaries/new')}
            className="flex-1 h-11 rounded-2xl text-sm font-medium text-white shadow-sm transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
          >
            写新日记
          </button>
          <button
            onClick={handleDelete}
            className="h-11 px-5 rounded-2xl text-sm font-medium bg-white border border-red-100 text-red-400 hover:bg-red-50 transition-all active:scale-[0.98] shadow-sm"
          >
            删除
          </button>
        </div>
      </main>
    </div>
  )
}


