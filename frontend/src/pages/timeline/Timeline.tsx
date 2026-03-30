// 时间轴页面
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiaryStore } from '@/store/diaryStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loading } from '@/components/common/Loading'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function Timeline() {
  const navigate = useNavigate()
  const { timelineEvents, fetchTimelineEvents, isLoading } = useDiaryStore()

  useEffect(() => {
    fetchTimelineEvents(20)
  }, [fetchTimelineEvents])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶部导航 */}
      <header className="backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.88)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-[#f5efea]">
              ← 返回
            </Button>
            <h1 className="text-xl font-bold">时间轴</h1>
            <Button onClick={() => navigate('/diaries/new')} className="text-white" style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}>写日记</Button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {timelineEvents.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground mb-4">还没有时间轴事件</p>
              <Button onClick={() => navigate('/diaries/new')}>写第一篇日记</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {/* 时间轴线 */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* 时间轴事件 */}
            <div className="space-y-8">
              {timelineEvents.map((event) => (
                <div key={event.id} className="relative pl-16">
                  {/* 时间点 */}
                  <div className="absolute left-6 w-4 h-4 bg-primary rounded-full border-4 border-white shadow" />

                  {/* 事件卡片 */}
                  <Card
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/diaries/${event.diary_id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                      <div className="text-sm text-muted-foreground mb-1">
                            {format(new Date(event.event_date), 'yyyy年MM月dd日 EEEE', {
                              locale: zhCN,
                            })}
                          </div>
                          <h3 className="text-lg font-semibold">{event.event_summary}</h3>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-lg font-bold text-[#b56f61]">
                            {event.importance_score}/10
                          </span>
                          <span className="text-xs px-2 py-1 bg-[#f5efea] text-[#b56f61] rounded-full">
                            {event.emotion_tag}
                          </span>
                        </div>
                      </div>

                      {/* 事件类型标签 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded">
                          {getEventTypeLabel(event.event_type)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
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
