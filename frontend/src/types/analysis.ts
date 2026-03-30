// AI分析相关类型定义

export interface AnalysisRequest {
  diary_id?: number
  window_days?: number
  max_diaries?: number
}

export interface TimelineEventAnalysis {
  event_summary: string
  emotion_tag: string
  importance_score: number
  event_type: string
  related_entities: Record<string, any>
}

export interface EmotionLayer {
  surface_emotion: string
  underlying_emotion?: string
  emotion_intensity?: number
  emotion_description?: string
}

export interface CognitiveLayer {
  irrational_beliefs?: string[]
  automatic_thoughts?: string[]
  cognitive_patterns?: string[]
}

export interface BeliefLayer {
  core_beliefs?: string[]
  life_rules?: string[]
  value_system?: string[]
}

export interface CoreSelfLayer {
  deepest_desire?: string
  universal_needs?: string[]
  life_energy?: string
}

export interface SatirAnalysis {
  behavior_layer: Record<string, any>
  emotion_layer: EmotionLayer
  cognitive_layer: CognitiveLayer
  belief_layer: BeliefLayer
  core_self_layer: CoreSelfLayer
}

export interface SocialPost {
  version: string
  style: string
  content: string
}

export interface AnalysisMetadata {
  processing_time: number
  current_step: string
  error?: string
  analysis_scope?: 'single_diary' | 'user_integrated'
  analyzed_diary_count?: number
  analyzed_period?: {
    start_date: string
    end_date: string
    anchor_date: string
    window_days: number
  }
  analyzed_diary_ids?: number[]
  workflow?: string[]
  agent_runs?: Array<{
    agent_code: string
    agent_name: string
    model: string
    step: string
    status: 'running' | 'success' | 'error'
    started_at: number
    ended_at?: number
    duration_ms?: number
    error?: string
  }>
  persist_warning?: string
}

export interface AnalysisResponse {
  diary_id: number
  user_id: number
  timeline_event: TimelineEventAnalysis
  satir_analysis: SatirAnalysis
  therapeutic_response: string
  social_posts: SocialPost[]
  metadata: AnalysisMetadata
}
