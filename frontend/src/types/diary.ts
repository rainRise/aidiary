// 日记相关类型定义

export type EmotionTag = string
export type EventType = 'work' | 'relationship' | 'health' | 'achievement' | 'other'

export interface Diary {
  id: number
  user_id: number
  title: string
  content: string
  diary_date: string
  emotion_tags: EmotionTag[]
  importance_score: number
  word_count: number
  media_urls: string[]
  created_at: string
  updated_at: string
  is_analyzed: boolean
}

export interface DiaryCreate {
  title: string
  content: string
  diary_date?: string
  emotion_tags?: EmotionTag[]
  importance_score?: number
  media_urls?: string[]
}

export interface DiaryUpdate {
  title?: string
  content?: string
  diary_date?: string
  emotion_tags?: EmotionTag[]
  importance_score?: number
  media_urls?: string[]
}

export interface DiaryListResponse {
  items: Diary[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface TimelineEvent {
  id: number
  diary_id: number
  event_summary: string
  emotion_tag: string
  importance_score: number
  event_type: EventType
  related_entities: Record<string, any>
  event_date: string
  created_at: string
}

export interface EmotionStats {
  tag: string
  count: number
  percentage: number
}

export interface TerrainEvent {
  id: number | null
  diary_id: number
  summary: string
  emotion_tag: string | null
  importance_score: number
  event_type: EventType | null
  source_label?: string
}

export interface TerrainPoint {
  date: string
  energy: number | null
  valence: number | null
  density: number
  events: TerrainEvent[]
}

export interface TerrainPeak {
  date: string
  value: number
  label: string
  summary: string
}

export interface TerrainValley {
  date_range: [string, string]
  min_value: number
  days: number
  label: string
  summary: string
}

export interface TerrainInsights {
  peaks: TerrainPeak[]
  valleys: TerrainValley[]
  trend: 'ascending' | 'descending' | 'stable' | 'overall' | string
  trend_description: string
}

export interface TerrainMeta {
  start_date: string
  end_date: string
  total_events: number
  days_with_data: number
  total_days: number
}

export interface TerrainResponse {
  points: TerrainPoint[]
  insights: TerrainInsights
  meta: TerrainMeta
}
