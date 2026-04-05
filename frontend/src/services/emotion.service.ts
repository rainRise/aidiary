import api from './api'

export interface EmotionPoint {
  diary_id: number
  diary_date: string
  title: string
  cluster: number
  x: number
  y: number
  z?: number
  features: Record<string, number>
}

export interface EmotionCluster {
  id: number
  label: string
  size: number
  centroid: Record<string, number>
  dominant_features: { name: string; label: string; value: number }[]
}

export interface EmotionClusterResult {
  points: EmotionPoint[]
  clusters: EmotionCluster[]
  stats: {
    total_diaries: number
    num_clusters: number
    silhouette_score: number
    avg_valence: number
    avg_arousal: number
    avg_dominance: number
    valence_std: number
    explained_variance_2d: number[]
    explained_variance_3d?: number[]
  }
  pca_components: {
    pc1_label: string
    pc2_label: string
  }
}

export interface EmotionExplanation {
  diary_id: number
  diary_date: string
  title: string
  vector: number[]
  features: Record<string, { value: number; label: string }>
  mood_category: string
  matched_emotions: { word: string; valence: number; arousal: number; dominance: number }[]
}

export const emotionService = {
  async getClusterAnalysis(limit = 200): Promise<EmotionClusterResult> {
    const res = await api.get('/api/v1/emotion/cluster', { params: { limit } })
    return res.data
  },

  async analyzeDiary(diaryId: number): Promise<EmotionExplanation> {
    const res = await api.get(`/api/v1/emotion/analyze/${diaryId}`)
    return res.data
  },
}
