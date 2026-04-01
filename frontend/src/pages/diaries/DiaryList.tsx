// 日记列表页面 - 温暖柔和心理日记风格
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiaryStore } from '@/store/diaryStore'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { BookOpen, Sprout, Star } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const EMOTION_FILTERS = ['全部', '开心', '平静', '焦虑', '成就感', '满足', '担忧', '疲惫']

function toPreviewText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim()
}

export default function DiaryList() {
  const navigate = useNavigate()
  const { diaries, isLoading, fetchDiaries, pagination, deleteDiary } = useDiaryStore()
  const [selectedEmotion, setSelectedEmotion] = useState<string | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)

  useEffect(() => {
    fetchDiaries({ emotionTag: selectedEmotion })
  }, [fetchDiaries, selectedEmotion])

  const handleDelete = async (id: number, title: string) => {
    setDeleteTarget({ id, title })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteDiary(deleteTarget.id)
    } catch (error) {
      toast('删除失败', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleLoadMore = () => {
    if (pagination.page < pagination.totalPages) {
      fetchDiaries({ page: pagination.page + 1, emotionTag: selectedEmotion })
    }
  }

  if (isLoading && diaries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="确定删除这篇日记吗？"
        description={deleteTarget ? <>删除后不可恢复：<span className="font-medium text-stone-700">《{deleteTarget.title || '无标题'}》</span></> : undefined}
        confirmText="确认删除"
        cancelText="我再想想"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.88)' }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex justify-between items-center py-3.5">
            <button onClick={() => navigate('/')} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
              ← 返回
            </button>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-[#b56f61]" /> 我的日记</span>
            <button
              onClick={() => navigate('/diaries/new')}
              className="h-8 px-4 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              写日记
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* 情绪筛选 */}
        <div className="flex gap-2 flex-wrap mb-6">
          {EMOTION_FILTERS.map((label) => {
            const isActive = label === '全部' ? selectedEmotion === undefined : selectedEmotion === label
            return (
              <button
                key={label}
                onClick={() => setSelectedEmotion(label === '全部' ? undefined : label)}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'bg-white text-stone-400 border border-stone-100 hover:border-[#d8c7bc] hover:text-[#b56f61]'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' } : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* 日记列表 */}
        {diaries.length === 0 ? (
          <div className="card-warm p-12 text-center">
            <Sprout className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
            <p className="text-stone-400 text-sm mb-5">还没有日记，开始写第一篇吧</p>
            <button
              onClick={() => navigate('/diaries/new')}
              className="h-10 px-6 rounded-2xl text-sm font-semibold text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              写日记
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {diaries.map((diary) => {
                const tags = diary.emotion_tags ?? []
                return (
                  <div
                    key={diary.id}
                    className="card-warm p-5 cursor-pointer hover:shadow-md transition-all duration-200 active:scale-[0.99]"
                    onClick={() => navigate(`/diaries/${diary.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-stone-700 truncate">{diary.title || '无标题'}</h3>
                        <p className="text-xs text-stone-300 mt-0.5">
                          {format(new Date(diary.diary_date), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-[#b56f61] shrink-0 ml-3 flex items-center gap-1">
                        <Star className="w-3 h-3" /> {diary.importance_score}/10
                      </span>
                    </div>

                    <p className="text-xs text-stone-400 line-clamp-2 leading-5 mb-3">
                      {toPreviewText(diary.content)}
                    </p>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {tags.map((tag, index) => (
                          <span
                            key={index}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5efea] text-[#b56f61] border border-[#e7dbd5]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-stone-300">{diary.word_count} 字</span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/diaries/${diary.id}/edit`) }}
                          className="text-[11px] text-stone-300 hover:text-stone-500 px-2 py-1 rounded-lg hover:bg-stone-50 transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(diary.id, diary.title) }}
                          className="text-[11px] text-stone-300 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 加载更多 */}
            {pagination.page < pagination.totalPages && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="w-full h-11 rounded-2xl text-sm font-medium bg-white border border-stone-100 text-stone-400 hover:bg-stone-50 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
                >
                  {isLoading ? <Loading size="sm" /> : '加载更多'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}


