// AI分析API服务
import api from './api'
import type {
  AnalysisRequest,
  AnalysisResponse,
  ComprehensiveAnalysisRequest,
  ComprehensiveAnalysisResponse,
  DailyGuidanceResponse,
  SatirAnalysis,
  SocialPost,
  SocialStyleSamplesResponse,
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
  generateSocialPosts: async (diaryId: number): Promise<{ diary_id: number; social_posts: SocialPost[]; metadata?: Record<string, any> }> => {
    const response = await api.post<{ diary_id: number; social_posts: SocialPost[]; metadata?: Record<string, any> }>('/api/v1/ai/social-posts', {
      diary_id: diaryId,
    })
    return response.data
  },

  // 用户级综合分析（RAG）
  comprehensiveAnalysis: async (data: ComprehensiveAnalysisRequest): Promise<ComprehensiveAnalysisResponse> => {
    const response = await api.post<ComprehensiveAnalysisResponse>('/api/v1/ai/comprehensive-analysis', data)
    return response.data
  },

  // 获取每日个性化引导问题
  getDailyGuidance: async (): Promise<DailyGuidanceResponse> => {
    const response = await api.get<DailyGuidanceResponse>('/api/v1/ai/daily-guidance')
    return response.data
  },

  // 获取朋友圈风格样本
  getSocialStyleSamples: async (): Promise<SocialStyleSamplesResponse> => {
    const response = await api.get<SocialStyleSamplesResponse>('/api/v1/ai/social-style-samples')
    return response.data
  },

  // 上传朋友圈风格样本
  saveSocialStyleSamples: async (samples: string[], replace: boolean = true): Promise<SocialStyleSamplesResponse> => {
    const response = await api.put<SocialStyleSamplesResponse>('/api/v1/ai/social-style-samples', {
      samples,
      replace,
    })
    return response.data
  },

  // 获取历史分析
  getAnalyses: async (params?: {
    page?: number
    page_size?: number
  }): Promise<{
    analyses: Array<{
      id: number
      diary_id: number
      updated_at: string
      metadata: Record<string, any>
    }>
    total: number
  }> => {
    const response = await api.get('/api/v1/ai/analyses', { params })
    return response.data
  },

  // 获取指定日记的最近分析结果
  getResultByDiary: async (diaryId: number): Promise<AnalysisResponse> => {
    const response = await api.get<AnalysisResponse>(`/api/v1/ai/result/${diaryId}`)
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
