// 日记列表页面 - 温暖柔和心理日记风格
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDiaryStore } from '@/store/diaryStore'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { BookOpen, Sprout, Star, Search, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { getEmotionDisplayLabel } from '@/utils/emotionLabels'

const EMOTION_FILTERS_KEYS = [
  'all', 'happy', 'calm', 'anxious', 'achievement', 'satisfied', 'worried', 'exhausted'
]

function toPreviewText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim()
}

export default function DiaryList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { diaries, isLoading, fetchDiaries, pagination, deleteDiary } = useDiaryStore()
  const [selectedEmotion, setSelectedEmotion] = useState<string | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 情绪过滤器（带翻译）
  const EMOTION_FILTERS = EMOTION_FILTERS_KEYS.map(key => ({
    key,
    label: t(`diary.emotion.${key}`),
  }))

  useEffect(() => {
    fetchDiaries({ emotionTag: selectedEmotion, keyword: keyword || undefined })
  }, [fetchDiaries, selectedEmotion, keyword])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setKeyword(value.trim())
    }, 400)
  }

  const clearSearch = () => {
    setSearchInput('')
    setKeyword('')
  }

  const handleDelete = async (id: number, title: string) => {
    setDeleteTarget({ id, title })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteDiary(deleteTarget.id)
      toast(t('diary.deleteSuccess'), 'success')
    } catch (error) {
      toast(t('diary.deleteFailed'), 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleLoadMore = () => {
    if (pagination.page < pagination.totalPages) {
      fetchDiaries({ page: pagination.page + 1, emotionTag: selectedEmotion, keyword: keyword || undefined })
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
        title={t('diary.deleteConfirm')}
        description={deleteTarget ? <>《{deleteTarget.title || t('diary.noTitle')}》</> : undefined}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70 relative" style={{ background: 'rgba(248,245,239,0.88)' }}>
        {/* 语言切换器 */}
        <div className="absolute top-2 right-4">
          <LanguageSwitcher />
        </div>
        
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex justify-between items-center py-3.5">
            <button onClick={() => navigate('/')} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
              ← {t('common.back')}
            </button>
            <span className="text-sm font-semibold text-stone-600 flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-[#b56f61]" /> {t('navigation.myDiaries')}</span>
            <button
              onClick={() => navigate('/diaries/new')}
              className="h-8 px-4 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {t('navigation.writeDiary')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* 搜索框 */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('diary.searchPlaceholder')}
            className="w-full h-10 pl-10 pr-10 rounded-2xl text-sm text-stone-600 placeholder:text-stone-300 bg-white border border-stone-100 focus:border-[#d8c7bc] focus:ring-2 focus:ring-rose-100 outline-none transition-all shadow-sm"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 情绪筛选 */}
        <div className="flex gap-2 flex-wrap mb-6">
          {EMOTION_FILTERS.map(({ key, label }) => {
            const isAll = key === 'all'
            const isActive = isAll ? selectedEmotion === undefined : selectedEmotion === key
            return (
              <button
                key={key}
                onClick={() => setSelectedEmotion(isAll ? undefined : key)}
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
            {keyword ? (
              <>
                <Search className="w-10 h-10 text-stone-200 mx-auto mb-3" />
                <p className="text-stone-400 text-sm mb-2">未找到包含 "<span className="font-medium text-stone-500">{keyword}</span>" 的日记</p>
                <button
                  onClick={clearSearch}
                  className="text-sm text-[#b56f61] hover:underline mt-2"
                >
                  清除搜索
                </button>
              </>
            ) : (
              <>
                <Sprout className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
                <p className="text-stone-400 text-sm mb-5">{t('diary.noDiaries')}</p>
                <button
                  onClick={() => navigate('/diaries/new')}
                  className="h-10 px-6 rounded-2xl text-sm font-semibold text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
                >
                  {t('navigation.writeDiary')}
                </button>
              </>
            )}
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
                        <h3 className="text-sm font-bold text-stone-700 truncate">{diary.title || t('diary.noTitle')}</h3>
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
                            {getEmotionDisplayLabel(t, tag)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-stone-300">{diary.word_count} {t('diary.words')}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/diaries/${diary.id}/edit`) }}
                          className="text-[11px] text-stone-300 hover:text-stone-500 px-2 py-1 rounded-lg hover:bg-stone-50 transition-colors"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(diary.id, diary.title) }}
                          className="text-[11px] text-stone-300 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          {t('common.delete')}
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

