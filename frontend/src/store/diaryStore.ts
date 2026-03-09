// 日记状态管理
import { create } from 'zustand'
import type { Diary, TimelineEvent, EmotionStats } from '@/types/diary'
import { diaryService } from '@/services/diary.service'

interface DiaryState {
  diaries: Diary[]
  currentDiary: Diary | null
  timelineEvents: TimelineEvent[]
  emotionStats: EmotionStats[]
  isLoading: boolean
  error: string | null
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }

  // Actions
  fetchDiaries: (params?: {
    page?: number
    pageSize?: number
    emotionTag?: string
  }) => Promise<void>
  fetchDiary: (id: number) => Promise<void>
  createDiary: (data: {
    title: string
    content: string
    diaryDate?: string
    emotionTags?: string[]
    importanceScore?: number
  }) => Promise<Diary>
  updateDiary: (id: number, data: Partial<Diary>) => Promise<void>
  deleteDiary: (id: number) => Promise<void>
  fetchTimelineEvents: (limit?: number) => Promise<void>
  fetchEmotionStats: (days?: number) => Promise<void>
  clearCurrentDiary: () => void
  clearError: () => void
}

export const useDiaryStore = create<DiaryState>((set, _get) => ({
  diaries: [],
  currentDiary: null,
  timelineEvents: [],
  emotionStats: [],
  isLoading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  },

  fetchDiaries: async (params = {}) => {
    set({ isLoading: true, error: null })
    try {
      const response = await diaryService.list({
        page: params.page || 1,
        page_size: params.pageSize || 20,
        emotion_tag: params.emotionTag,
      })
      set({
        diaries: response.items,
        pagination: {
          total: response.total,
          page: response.page,
          pageSize: response.page_size,
          totalPages: response.total_pages,
        },
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || '获取日记列表失败',
        isLoading: false,
      })
    }
  },

  fetchDiary: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      const diary = await diaryService.get(id)
      set({ currentDiary: diary, isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || '获取日记详情失败',
        isLoading: false,
      })
    }
  },

  createDiary: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const diary = await diaryService.create(data)
      set((state) => ({
        diaries: [diary, ...state.diaries],
        isLoading: false,
      }))
      return diary
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || '创建日记失败',
        isLoading: false,
      })
      throw error
    }
  },

  updateDiary: async (id: number, data: Partial<Diary>) => {
    set({ isLoading: true, error: null })
    try {
      const updatedDiary = await diaryService.update(id, data)
      set((state) => ({
        diaries: state.diaries.map((d) => (d.id === id ? updatedDiary : d)),
        currentDiary: state.currentDiary?.id === id ? updatedDiary : state.currentDiary,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || '更新日记失败',
        isLoading: false,
      })
      throw error
    }
  },

  deleteDiary: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      await diaryService.delete(id)
      set((state) => ({
        diaries: state.diaries.filter((d) => d.id !== id),
        currentDiary: state.currentDiary?.id === id ? null : state.currentDiary,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || '删除日记失败',
        isLoading: false,
      })
      throw error
    }
  },

  fetchTimelineEvents: async (limit = 10) => {
    try {
      const events = await diaryService.getRecentTimeline(limit)
      set({ timelineEvents: events })
    } catch (error: any) {
      console.error('Failed to fetch timeline events:', error)
    }
  },

  fetchEmotionStats: async (days = 30) => {
    try {
      const stats = await diaryService.getEmotionStats(days)
      set({ emotionStats: stats })
    } catch (error: any) {
      console.error('Failed to fetch emotion stats:', error)
    }
  },

  clearCurrentDiary: () => set({ currentDiary: null }),
  clearError: () => set({ error: null }),
}))
