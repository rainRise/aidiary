// AI分析API服务
import api from './api'
import type {
  AnalysisRequest,
  AnalysisResponse,
  SatirAnalysis,
  SocialPost,
} from '@/types/analysis'

export const aiService = {
  // 完整AI分析
  analyze: async (data: AnalysisRequest): Promise<AnalysisResponse> => {
    const response = await api.post<AnalysisResponse>('/api/v1/ai/analyze', data)
    return response.data
  },

  // 异步AI分析
  analyzeAsync: async (data: AnalysisRequest): Promise<{ task_id: string }> => {
    const response = await api.post<{ task_id: string }>('/api/v1/ai/analyze-async', data)
    return response.data
  },

  // 仅萨提亚分析
  satirAnalysis: async (diaryId: number): Promise<SatirAnalysis> => {
    const response = await api.post<SatirAnalysis>('/api/v1/ai/satir-analysis', {
      diary_id: diaryId,
    })
    return response.data
  },

  // 生成朋友圈文案
  generateSocialPosts: async (diaryId: number): Promise<SocialPost[]> => {
    const response = await api.post<SocialPost[]>('/api/v1/ai/social-posts', {
      diary_id: diaryId,
    })
    return response.data
  },

  // 获取历史分析
  getAnalyses: async (params?: {
    page?: number
    page_size?: number
  }): Promise<{
    items: AnalysisResponse[]
    total: number
  }> => {
    const response = await api.get('/api/v1/ai/analyses', { params })
    return response.data
  },

  // 获取AI模型信息
  getModelInfo: async (): Promise<{
    model: string
    provider: string
    status: string
  }> => {
    const response = await api.get('/api/v1/ai/models')
    return response.data
  },

  // 根据内容生成标题
  generateTitle: async (content: string, currentTitle?: string): Promise<{ title: string }> => {
    const response = await api.post<{ title: string }>('/api/v1/ai/generate-title', {
      content,
      current_title: currentTitle,
    })
    return response.data
  },
}
