// 情绪统计图表组件
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { EmotionStats } from '@/types'

interface EmotionChartProps {
  data: EmotionStats[]
  type?: 'bar' | 'line' | 'pie'
}

const EMOTION_COLORS: Record<string, string> = {
  开心: '#FBBF24',
  平静: '#34D399',
  焦虑: '#F87171',
  成就感: '#A78BFA',
  满足: '#60A5FA',
  担忧: '#FB923C',
  期待: '#F472B6',
  疲惫: '#9CA3AF',
  感动: '#FCD34D',
  愤怒: '#EF4444',
  悲伤: '#3B82F6',
  兴奋: '#F59E0B',
}

export function EmotionBarChart({ data }: { data: EmotionStats[] }) {
  const chartData = data.map((item) => ({
    name: item.tag,
    count: item.count,
    percentage: item.percentage,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" fill="#8B5CF6" name="数量" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function EmotionLineChart({ data }: { data: Array<{ date: string; emotions: Record<string, number> }> }) {
  // 将数据转换为Recharts格式
  const chartData = data.map((item) => ({
    date: item.date.split('T')[0].substring(5), // MM-DD
    ...item.emotions,
  }))

  // 获取所有情绪标签
  const emotionKeys = Array.from(
    new Set(data.flatMap((item) => Object.keys(item.emotions)))
  )

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        {emotionKeys.map((emotion) => (
          <Line
            key={emotion}
            type="monotone"
            dataKey={emotion}
            stroke={EMOTION_COLORS[emotion] || '#8B5CF6'}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function EmotionPieChart({ data }: { data: EmotionStats[] }) {
  const chartData = data.map((item) => ({
    name: item.tag,
    value: item.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={EMOTION_COLORS[entry.name] || '#8B5CF6'}
            />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function EmotionChart({ data, type = 'bar' }: EmotionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        暂无数据
      </div>
    )
  }

  switch (type) {
    case 'bar':
      return <EmotionBarChart data={data} />
    case 'pie':
      return <EmotionPieChart data={data} />
    default:
      return <EmotionBarChart data={data} />
  }
}
