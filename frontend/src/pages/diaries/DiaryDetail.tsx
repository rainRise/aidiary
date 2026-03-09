// 日记详情页面
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDiaryStore } from '@/store/diaryStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  if (!currentDiary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">日记不存在</p>
            <Button onClick={() => navigate('/diaries')}>返回列表</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Button variant="ghost" onClick={() => navigate('/diaries')}>
              ← 返回
            </Button>
            <h1 className="text-xl font-bold">日记详情</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* 日记内容卡片 */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{currentDiary.title}</CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {format(new Date(currentDiary.diary_date), 'yyyy年MM月dd日 EEEE', {
                        locale: zhCN,
                      })}
                    </span>
                    <span>{currentDiary.word_count} 字</span>
                    <span className="text-lg font-bold text-primary">
                      重要性: {currentDiary.importance_score}/10
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 情绪标签 */}
              {currentDiary.emotion_tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">情绪标签</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {currentDiary.emotion_tags.map((tag, index) => (
                      <span
                        key={index}
                        className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 日记内容 */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">日记内容</label>
                <div className="mt-2 p-4 bg-secondary rounded-lg">
                  <p className="whitespace-pre-wrap leading-relaxed">{currentDiary.content}</p>
                </div>
              </div>

              {/* 元信息 */}
              <div className="text-sm text-muted-foreground">
                <p>创建时间: {format(new Date(currentDiary.created_at), 'yyyy-MM-dd HH:mm:ss')}</p>
                {currentDiary.updated_at !== currentDiary.created_at && (
                  <p>
                    更新时间: {format(new Date(currentDiary.updated_at), 'yyyy-MM-dd HH:mm:ss')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI分析卡片 */}
          <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🤖</span>
                <span>AI深度分析</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/90 mb-4">
                基于萨提亚冰山模型，深入了解你的情绪、认知和深层渴望
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={handleAnalyze}
                  className="bg-white text-primary hover:bg-white/90"
                >
                  {currentDiary.is_analyzed ? '查看分析结果' : '开始AI分析'}
                </Button>
                {!currentDiary.is_analyzed && (
                  <span className="text-sm text-white/70 flex items-center">
                    还未分析
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <Card>
            <CardContent className="py-4">
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/diaries/${currentDiary.id}/edit`)}
                >
                  编辑日记
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/diaries/new')}
                >
                  写新日记
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                >
                  删除
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
