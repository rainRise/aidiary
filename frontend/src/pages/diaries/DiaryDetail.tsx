// 日记详情页面 - 温暖柔和心理日记风格
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDiaryStore } from '@/store/diaryStore'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import { aiService } from '@/services/ai.service'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { BookOpen, Calendar, Star, MessageCircle, FileText, Loader2, FilePenLine, NotebookPen } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SocialPost } from '@/types/analysis'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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

function formatServerUtcToLocal(raw: string): string {
  const text = (raw || '').trim()
  if (!text) return '-'
  const normalized = text.includes(' ') ? text.replace(' ', 'T') : text
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(normalized)
  const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`)
  if (Number.isNaN(parsed.getTime())) return text
  return format(parsed, 'yyyy-MM-dd HH:mm')
}

function fallbackCopyText(text: string): boolean {
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

export default function DiaryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentDiary, fetchDiary, deleteDiary } = useDiaryStore()
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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
    try {
      await deleteDiary(currentDiary.id)
      navigate('/diaries')
    } catch (error) {
      toast('删除失败', 'error')
    }
  }

  const emotionTags = currentDiary?.emotion_tags ?? []
  const [isGeneratingPosts, setIsGeneratingPosts] = useState(false)
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([])
  const [styleSampleText, setStyleSampleText] = useState('')
  const [styleSampleCount, setStyleSampleCount] = useState(0)
  const [isLoadingSamples, setIsLoadingSamples] = useState(false)
  const [isSavingSamples, setIsSavingSamples] = useState(false)
  const [copiedPostIndex, setCopiedPostIndex] = useState<number | null>(null)

  const loadStyleSamples = async () => {
    try {
      setIsLoadingSamples(true)
      const result = await aiService.getSocialStyleSamples()
      setStyleSampleCount(result.total || 0)
    } catch (_err) {
      // 不阻断主流程
    } finally {
      setIsLoadingSamples(false)
    }
  }

  useEffect(() => {
    void loadStyleSamples()
  }, [])

  const handleGenerateSocialPosts = async () => {
    if (!currentDiary) return
    try {
      setIsGeneratingPosts(true)
      const result = await aiService.generateSocialPosts(currentDiary.id)
      setSocialPosts(result.social_posts || [])
      toast('已生成今日朋友圈文案', 'success')
    } catch (e: any) {
      toast(e?.response?.data?.detail || '生成文案失败', 'error')
    } finally {
      setIsGeneratingPosts(false)
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

  const handleSaveStyleSamples = async () => {
    const parsed = styleSampleText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length >= 6)
      .slice(0, 80)
    if (parsed.length === 0) {
      toast('请粘贴至少1条历史文案（每条不少于6字）', 'error')
      return
    }
    try {
      setIsSavingSamples(true)
      const result = await aiService.saveSocialStyleSamples(parsed, true)
      setStyleSampleCount(result.total || parsed.length)
      setStyleSampleText('')
      toast(`已导入 ${result.total} 条风格样本`, 'success')
    } catch (e: any) {
      toast(e?.response?.data?.detail || '保存风格样本失败', 'error')
    } finally {
      setIsSavingSamples(false)
    }
  }

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
      <ConfirmDialog
        open={deleteDialogOpen}
        title="确定删除这篇日记吗？"
        description={currentDiary ? <>删除后不可恢复：<span className="font-medium text-stone-700">《{currentDiary.title || '无标题'}》</span></> : undefined}
        confirmText="确认删除"
        cancelText="我再想想"
        danger
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => {
          setDeleteDialogOpen(false)
          void handleDelete()
        }}
      />

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
            <p>创建于 {formatServerUtcToLocal(currentDiary.created_at)}</p>
            {currentDiary.updated_at !== currentDiary.created_at && (
              <p>更新于 {formatServerUtcToLocal(currentDiary.updated_at)}</p>
            )}
          </div>
        </div>

        {/* 今日朋友圈文案 */}
        <div className="card-warm overflow-hidden">
          <div className="p-6" style={{ background: 'linear-gradient(135deg, rgba(232,143,123,0.10), rgba(160,154,184,0.10))' }}>
            <div className="flex items-center gap-2 mb-3">
              <FilePenLine className="w-4 h-4 text-[#b56f61]" />
              <h3 className="text-sm font-semibold text-stone-600">今日朋友圈文案</h3>
              {isGeneratingPosts && (
                <span className="ml-auto flex items-center gap-1 text-xs text-violet-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> 生成中...
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mb-4 leading-5">
              基于这篇日记，生成适合今天发布的多版本文案
            </p>

            <div className="mb-4 p-3 rounded-2xl bg-white/70 border border-[#e7dbd5]">
              <div className="flex items-center gap-2 mb-2">
                <NotebookPen className="w-3.5 h-3.5 text-[#b56f61]" />
                <span className="text-xs font-medium text-stone-600">喂养我的旧文案（去 AI 味）</span>
                <span className="ml-auto text-[11px] text-stone-400">
                  {isLoadingSamples ? '读取中...' : `已存 ${styleSampleCount}/50`}
                </span>
              </div>
              <textarea
                value={styleSampleText}
                onChange={(e) => setStyleSampleText(e.target.value)}
                rows={4}
                placeholder="每行一条你过去真实发过的动态（建议一次贴20-50条）"
                className="w-full resize-y rounded-xl border border-[#e7dbd5] bg-[#fffdfa] px-3 py-2 text-xs text-stone-600 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-[#d8c7bc]"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleSaveStyleSamples}
                  disabled={isSavingSamples}
                  className="h-8 px-3 rounded-xl text-[11px] font-semibold text-white shadow-sm transition-all active:scale-[0.97] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
                >
                  {isSavingSamples ? '保存中...' : '覆盖保存到风格库'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateSocialPosts}
                disabled={isGeneratingPosts}
                className="h-9 px-5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.97] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
              >
                {isGeneratingPosts ? '正在生成...' : '生成今日朋友圈文案'}
              </button>
              <button
                onClick={() => navigate('/analysis')}
                className="h-9 px-4 rounded-xl text-xs font-medium text-[#b56f61] bg-white border border-[#e7dbd5] hover:bg-[#f5efea] transition-all"
              >
                去综合分析
              </button>
            </div>

            {socialPosts.length > 0 && (
              <div className="mt-5 space-y-3">
                {socialPosts.map((post, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/70 border border-[#e7dbd5]">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5efea] text-[#b56f61]">{post.version}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-400">{post.style}</span>
                      </div>
                      <button
                        onClick={() => void copyPost(post.content, idx)}
                        className={`text-xs transition-colors ${copiedPostIndex === idx ? 'text-emerald-500' : 'text-[#b56f61] hover:text-[#a45f52]'}`}
                      >
                        {copiedPostIndex === idx ? '已复制' : '复制'}
                      </button>
                    </div>
                    <p className="text-sm text-stone-600 leading-6">{post.content}</p>
                  </div>
                ))}
              </div>
            )}
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
            onClick={() => setDeleteDialogOpen(true)}
            className="h-11 px-5 rounded-2xl text-sm font-medium bg-white border border-red-100 text-red-400 hover:bg-red-50 transition-all active:scale-[0.98] shadow-sm"
          >
            删除
          </button>
        </div>
      </main>
    </div>
  )
}


