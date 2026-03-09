// 日记编辑器 - Apple风格
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiaryStore } from '@/store/diaryStore'
import { toast } from '@/components/ui/toast'

const PRESET_EMOTIONS = [
  '开心', '平静', '焦虑', '成就感', '满足', '担忧',
  '期待', '疲惫', '感动', '愤怒', '悲伤', '兴奋',
]

export default function DiaryEditor() {
  const navigate = useNavigate()
  const { createDiary, isLoading } = useDiaryStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().split('T')[0])
  const [emotionTags, setEmotionTags] = useState<string[]>([])
  const [importanceScore, setImportanceScore] = useState(5)

  const toggleEmotionTag = (tag: string) => {
    setEmotionTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      toast('请填写标题和内容', 'error')
      return
    }

    try {
      const diary = await createDiary({
        title: title.trim(),
        content: content.trim(),
        diaryDate,
        emotionTags: emotionTags.length > 0 ? emotionTags : undefined,
        importanceScore,
      })

      toast('日记保存成功', 'success')
      navigate(`/diaries/${diary.id}`)
    } catch (error: any) {
      toast(error.message || '保存失败', 'error')
    }
  }

  const wordCount = content.length

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex justify-between items-center h-14">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              ← 返回
            </button>
            <span className="text-sm font-medium text-white/70">写日记</span>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="h-8 px-4 rounded-lg text-xs font-medium bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-all active:scale-[0.97]"
            >
              {isLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : '保存'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 标题与日期 */}
          <div className="space-y-4">
            <input
              type="text"
              placeholder="日记标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-2xl font-bold text-white/90 placeholder:text-white/15 outline-none border-none"
              required
            />
            <input
              type="date"
              value={diaryDate}
              onChange={(e) => setDiaryDate(e.target.value)}
              className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs outline-none focus:border-primary/50 [color-scheme:dark]"
            />
          </div>

          {/* 日记内容 */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="今天发生了什么？你有什么感受？&#10;&#10;在这里自由书写..."
              className="w-full min-h-[380px] p-5 bg-transparent text-white/80 text-sm leading-relaxed placeholder:text-white/15 outline-none resize-none"
              required
            />
            <div className="px-5 py-3 border-t border-white/[0.04] flex justify-between items-center">
              <span className="text-[11px] text-white/20">{wordCount} 字</span>
            </div>
          </div>

          {/* 情绪标签 */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">心情标签</h3>
            <div className="flex flex-wrap gap-2">
              {PRESET_EMOTIONS.map((emotion) => (
                <button
                  key={emotion}
                  type="button"
                  onClick={() => toggleEmotionTag(emotion)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    emotionTags.includes(emotion)
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/[0.04] text-white/40 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white/60'
                  }`}
                >
                  {emotion}
                </button>
              ))}
            </div>
          </div>

          {/* 重要性评分 */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">重要性</h3>
              <span className="text-lg font-bold text-primary">{importanceScore}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={importanceScore}
              onChange={(e) => setImportanceScore(parseInt(e.target.value))}
              className="w-full h-1 appearance-none bg-white/10 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div className="flex justify-between text-[10px] text-white/20 mt-2 px-0.5">
              <span>随意</span>
              <span>一般</span>
              <span>重要</span>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="flex gap-3 pb-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 h-12 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] transition-all active:scale-[0.98]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 h-12 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : '保存日记'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
