// API客户端配置
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000,
  withCredentials: true, // 自动携带 httpOnly cookie
  headers: {
    'Content-Type': 'application/json',
  },
})

// 是否正在刷新 token
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = []
let hasRedirectedForAuth = false

function processQueue(error: any) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(undefined)))
  failedQueue = []
}

function handleAuthExpired() {
  if (hasRedirectedForAuth) return
  hasRedirectedForAuth = true

  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  })

  if (window.location.pathname !== '/welcome') {
    window.location.replace('/welcome')
  }
}

// 响应拦截器 - 401 时自动刷新 token
api.interceptors.response.use(
  (response) => {
    const payload = response?.data
    if (
      payload &&
      typeof payload === 'object' &&
      'code' in payload &&
      'message' in payload &&
      'request_id' in payload &&
      'data' in payload
    ) {
      response.data = payload.data
      ;(response as any).requestId = payload.request_id
      ;(response as any).message = payload.message
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 如果是 refresh 接口本身返回 401，直接跳转登录
      if (originalRequest.url?.includes('/auth/refresh')) {
        handleAuthExpired()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // 已经在刷新中，排队等待
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => api(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await api.post('/api/v1/auth/refresh')
        processQueue(null)
        return api(originalRequest) // 重试原始请求
      } catch (refreshError) {
        processQueue(refreshError)
        // refresh 也失败了，跳转登录
        handleAuthExpired()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
