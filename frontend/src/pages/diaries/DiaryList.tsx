// 日记列表页面
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiaryStore } from '@/store/diaryStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function DiaryList() {
  const navigate = useNavigate()
  const { diaries, isLoading, fetchDiaries, pagination, deleteDiary } = useDiaryStore()
  const [selectedEmotion, setSelectedEmotion] = useState<string | undefined>()

  useEffect(() => {
    fetchDiaries({ emotionTag: selectedEmotion })
  }, [fetchDiaries, selectedEmotion])

  const handleDelete = async (id: number, title: string) => {
    if (confirm(`确定要删除日记《${title}》吗？`)) {
      try {
        await deleteDiary(id)
      } catch (error) {
        toast('删除失败', 'error')
      }
    }
  }

  const handleLoadMore = () => {
    if (pagination.page < pagination.totalPages) {
      fetchDiaries({ page: pagination.page + 1, emotionTag: selectedEmotion })
    }
  }

  if (isLoading && diaries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              ← 返回
            </Button>
            <h1 className="text-xl font-bold">我的日记</h1>
            <Button onClick={() => navigate('/diaries/new')}>写日记</Button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 筛选器 */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedEmotion === undefined ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEmotion(undefined)}
            >
              全部
            </Button>
            <Button
              variant={selectedEmotion === '开心' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEmotion('开心')}
            >
              开心
            </Button>
            <Button
              variant={selectedEmotion === '平静' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEmotion('平静')}
            >
              平静
            </Button>
            <Button
              variant={selectedEmotion === '焦虑' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEmotion('焦虑')}
            >
              焦虑
            </Button>
            <Button
              variant={selectedEmotion === '成就感' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEmotion('成就感')}
            >
              成就感
            </Button>
          </div>
        </div>

        {/* 日记列表 */}
        {diaries.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground mb-4">还没有日记，开始写第一篇吧！</p>
              <Button onClick={() => navigate('/diaries/new')}>写日记</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {diaries.map((diary) => (
                <Card
                  key={diary.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/diaries/${diary.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-1">{diary.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(diary.diary_date), 'yyyy年MM月dd日 EEEE', {
                            locale: zhCN,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-primary">
                          {diary.importance_score}/10
                        </span>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-3 line-clamp-3">
                      {diary.content}
                    </p>

                    {diary.emotion_tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {diary.emotion_tags.map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>{diary.word_count} 字</span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/diaries/${diary.id}/edit`)
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(diary.id, diary.title)
                          }}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 加载更多 */}
            {pagination.page < pagination.totalPages && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? <Loading size="sm" /> : '加载更多'}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
