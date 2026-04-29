// 日记API服务
import api from './api'
import type {
  Diary,
  DiaryCreate,
  DiaryUpdate,
  DiaryListResponse,
  TimelineEvent,
  EmotionStats,
  TerrainResponse,
  GrowthDailyInsight,
  DashboardInsights,
  CareProgress,
} from '@/types/diary'

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export const diaryService = {
  // 创建日记
  create: async (data: DiaryCreate): Promise<Diary> => {
    const response = await api.post<Diary>('/api/v1/diaries/', data)
    return response.data
  },

  // 获取日记列表
  list: async (params?: {
    page?: number
    page_size?: number
    emotion_tag?: string
    start_date?: string
    end_date?: string
    keyword?: string
  }): Promise<DiaryListResponse> => {
    const response = await api.get<DiaryListResponse>('/api/v1/diaries/', { params })
    return response.data
  },

  // 获取日记详情
  get: async (id: number): Promise<Diary> => {
    const response = await api.get<Diary>(`/api/v1/diaries/${id}`)
    return response.data
  },

  // 更新日记
  update: async (id: number, data: DiaryUpdate): Promise<Diary> => {
    const response = await api.put<Diary>(`/api/v1/diaries/${id}`, data)
    return response.data
  },

  // 删除日记
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/diaries/${id}`)
  },

  // 按日期获取日记
  getByDate: async (date: string): Promise<Diary[]> => {
    const response = await api.get<Diary[]>(`/api/v1/diaries/date/${date}`)
    return response.data
  },

  // 获取最近的时间轴事件
  getRecentTimeline: async (days: number = 7): Promise<TimelineEvent[]> => {
    const response = await api.get<TimelineEvent[]>('/api/v1/diaries/timeline/recent', {
      params: { days },
    })
    return response.data
  },

  // 获取日期范围的时间轴事件
  getTimelineByRange: async (start: string, end: string): Promise<TimelineEvent[]> => {
    const response = await api.get<TimelineEvent[]>('/api/v1/diaries/timeline/range', {
      params: { start_date: start, end_date: end },
    })
    return response.data
  },

  // 获取指定日期的时间轴事件
  getTimelineByDate: async (date: string): Promise<TimelineEvent[]> => {
    const response = await api.get<TimelineEvent[]>(`/api/v1/diaries/timeline/date/${date}`)
    return response.data
  },

  // 获取情绪统计
  getEmotionStats: async (days: number = 30): Promise<EmotionStats[]> => {
    const response = await api.get<EmotionStats[]>('/api/v1/diaries/stats/emotions', {
      params: { days },
    })
    return response.data
  },

  // 获取首页仪表盘洞察
  getDashboardInsights: async (days: number = 30): Promise<DashboardInsights> => {
    const response = await api.get<DashboardInsights>('/api/v1/diaries/dashboard/insights', {
      params: { days },
    })
    return response.data
  },

  // 获取连续照顾与心灯护盾进度
  getCareProgress: async (): Promise<CareProgress> => {
    const response = await api.get<CareProgress>('/api/v1/diaries/care/progress')
    return response.data
  },

  // 主动选择“今天不想写”，也作为一次有效照顾行为落库
  createRestCareRecord: async (): Promise<{ created: boolean; diary_id: number; message: string }> => {
    const response = await api.post<{ created: boolean; diary_id: number; message: string }>('/api/v1/diaries/care/rest')
    return response.data
  },

  // 获取成长中心数据（能量/情绪/事件密度）
  getTerrainData: async (days: number = 30): Promise<TerrainResponse> => {
    const response = await api.get<TerrainResponse>('/api/v1/diaries/timeline/terrain', {
      params: { days },
    })
    return response.data
  },

  // 获取某日成长悬浮洞察（首次会在后端生成并缓存）
  getGrowthDailyInsight: async (targetDate: string): Promise<GrowthDailyInsight> => {
    const response = await api.get<GrowthDailyInsight>('/api/v1/diaries/growth/daily-insight', {
      params: { target_date: targetDate },
    })
    return response.data
  },

  // 上传日记图片
  uploadImage: async (file: File): Promise<string> => {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error('图片大小不能超过 10MB')
    }
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<{ url: string }>('/api/v1/diaries/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.url
  },

  // 语音转文字（上传 WAV）
  speechToText: async (file: Blob): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file, 'voice-input.wav')
    const response = await api.post<{ text: string }>('/api/v1/diaries/speech-to-text', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.text || ''
  },

  getSpeechStreamUrl: (): string => {
    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin
    const url = new URL('/api/v1/diaries/speech-to-text/stream', base)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
  },
}
