// AI分析结果展示页面
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { aiService } from '@/services/ai.service'
import { diaryService } from '@/services/diary.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading } from '@/components/common/Loading'
import { toast } from '@/components/ui/toast'
import type { AnalysisResponse, Diary } from '@/types'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [diary, setDiary] = useState<Diary | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      loadData(Number(id))
    }
  }, [id])

  const loadData = async (diaryId: number) => {
    setIsLoading(true)
    setError(null)

    try {
      // 加载日记详情
      const diaryData = await diaryService.get(diaryId)
      setDiary(diaryData)

      // 如果日记已分析，加载分析结果
      if (diaryData.is_analyzed) {
        try {
          const analysisData = await aiService.analyze({ diary_id: diaryId })
          setAnalysis(analysisData)
        } catch (err) {
          // 分析数据可能不存在，但不显示错误
          console.log('No analysis data found')
        }
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!id) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const result = await aiService.analyze({ diary_id: Number(id) })
      setAnalysis(result)

      // 更新日记的已分析状态
      if (diary) {
        setDiary({ ...diary, is_analyzed: true })
      }
    } catch (err: any) {
      setError(err.message || 'AI分析失败')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyPost = (content: string) => {
    navigator.clipboard.writeText(content)
    toast('已复制到剪贴板', 'success')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  if (error && !diary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate('/diaries')}>返回日记列表</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Button variant="ghost" onClick={() => navigate(`/diaries/${id}`)}>
              ← 返回日记
            </Button>
            <h1 className="text-xl font-bold">AI分析结果</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 日记信息 */}
        {diary && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{diary.title}</CardTitle>
              <CardDescription>
                {format(new Date(diary.diary_date), 'yyyy年MM月dd日', { locale: zhCN })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground line-clamp-3">{diary.content}</p>
              <div className="flex gap-2 mt-4">
                {diary.emotion_tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 触发分析按钮 */}
        {!analysis && !isAnalyzing && (
          <Card className="mb-8">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">还没有AI分析结果</p>
              <Button onClick={handleAnalyze} size="lg">
                🤖 开始AI分析
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 分析中 */}
        {isAnalyzing && (
          <Card className="mb-8">
            <CardContent className="py-12 text-center">
              <Loading size="lg" />
              <p className="mt-4 text-muted-foreground">AI正在深度分析中...</p>
              <p className="text-sm text-muted-foreground">这可能需要10-20秒</p>
            </CardContent>
          </Card>
        )}

        {/* 分析结果 */}
        {analysis && (
          <div className="space-y-8">
            {/* 时间轴事件 */}
            {analysis.timeline_event && (
              <Card>
                <CardHeader>
                  <CardTitle>📅 时间轴事件</CardTitle>
                  <CardDescription>从日记中提取的关键事件</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        事件摘要
                      </label>
                      <p className="text-lg mt-1">{analysis.timeline_event.event_summary}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          情绪标签
                        </label>
                        <p className="text-lg mt-1">{analysis.timeline_event.emotion_tag}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          重要性评分
                        </label>
                        <p className="text-lg mt-1 text-primary font-bold">
                          {analysis.timeline_event.importance_score}/10
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        事件类型
                      </label>
                      <p className="mt-1">
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {getEventTypeLabel(analysis.timeline_event.event_type)}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 萨提亚冰山分析 */}
            {analysis.satir_analysis && (
              <Card>
                <CardHeader>
                  <CardTitle>🧊 萨提亚冰山模型</CardTitle>
                  <CardDescription>深度心理分析（5层模型）</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* 情绪层 */}
                    {analysis.satir_analysis.emotion_layer && (
                      <div className="border-l-4 border-emotion-joy pl-4">
                        <h4 className="font-semibold mb-2">第2层：情绪层</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-muted-foreground">表层情绪</label>
                            <p className="text-lg">{analysis.satir_analysis.emotion_layer.surface_emotion}</p>
                          </div>
                          {analysis.satir_analysis.emotion_layer.underlying_emotion && (
                            <div>
                              <label className="text-sm text-muted-foreground">潜在情绪</label>
                              <p className="text-lg">{analysis.satir_analysis.emotion_layer.underlying_emotion}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 认知层 */}
                    {analysis.satir_analysis.cognitive_layer &&
                      analysis.satir_analysis.cognitive_layer.irrational_beliefs &&
                      analysis.satir_analysis.cognitive_layer.irrational_beliefs.length > 0 && (
                        <div className="border-l-4 border-blue-500 pl-4">
                          <h4 className="font-semibold mb-2">第3层：认知层</h4>
                          <label className="text-sm text-muted-foreground">非理性信念</label>
                          <ul className="mt-1 space-y-1">
                            {analysis.satir_analysis.cognitive_layer.irrational_beliefs.map(
                              (belief: string, index: number) => (
                                <li key={index} className="text-lg">
                                  • {belief}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                    {/* 信念层 */}
                    {analysis.satir_analysis.belief_layer &&
                      analysis.satir_analysis.belief_layer.core_beliefs &&
                      analysis.satir_analysis.belief_layer.core_beliefs.length > 0 && (
                        <div className="border-l-4 border-purple-500 pl-4">
                          <h4 className="font-semibold mb-2">第4层：信念层</h4>
                          <label className="text-sm text-muted-foreground">核心信念</label>
                          <ul className="mt-1 space-y-1">
                            {analysis.satir_analysis.belief_layer.core_beliefs.map(
                              (belief: string, index: number) => (
                                <li key={index} className="text-lg">
                                  • {belief}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                    {/* 存在层 */}
                    {analysis.satir_analysis.core_self_layer &&
                      analysis.satir_analysis.core_self_layer.deepest_desire && (
                        <div className="border-l-4 border-primary pl-4">
                          <h4 className="font-semibold mb-2">第5层：存在层</h4>
                          <label className="text-sm text-muted-foreground">深层渴望</label>
                          <p className="text-lg mt-1">
                            {analysis.satir_analysis.core_self_layer.deepest_desire}
                          </p>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 疗愈回复 */}
            {analysis.therapeutic_response && (
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-0">
                <CardHeader>
                  <CardTitle>💙 疗愈回复</CardTitle>
                  <CardDescription>来自AI心理咨询师的温暖回应</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg leading-relaxed whitespace-pre-line">
                    {analysis.therapeutic_response}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 朋友圈文案 */}
            {analysis.social_posts && analysis.social_posts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>📝 朋友圈文案</CardTitle>
                  <CardDescription>AI生成的3个版本，选择最适合你的</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysis.social_posts.map((post: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                              {post.version}
                            </span>
                            <span className="text-xs px-2 py-1 bg-secondary rounded ml-2">
                              {post.style}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyPost(post.content)}
                          >
                            复制
                          </Button>
                        </div>
                        <p className="text-sm leading-relaxed">{post.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 分析元数据 */}
            {analysis.metadata && (
              <div className="text-center text-sm text-muted-foreground">
                <p>处理时间: {analysis.metadata.processing_time.toFixed(2)}秒</p>
                <p>分析时间: {new Date().toLocaleString('zh-CN')}</p>
              </div>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <Card className="mb-8 border-destructive">
            <CardContent className="py-6">
              <p className="text-destructive text-center">{error}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    work: '工作',
    relationship: '关系',
    health: '健康',
    achievement: '成就',
    other: '其他',
  }
  return labels[type] || type
}
