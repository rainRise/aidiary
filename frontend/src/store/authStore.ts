// 认证状态管理
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/auth'
import { authService } from '@/services/auth.service'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (email: string, code: string) => Promise<void>
  loginWithPassword: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, code: string, username?: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, code: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.login({ email, code })
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          })
          localStorage.setItem('access_token', response.access_token)
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || '登录失败',
            isLoading: false,
          })
          throw error
        }
      },

      loginWithPassword: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.loginWithPassword(email, password)
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          })
          localStorage.setItem('access_token', response.access_token)
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || '登录失败',
            isLoading: false,
          })
          throw error
        }
      },

      register: async (
        email: string,
        password: string,
        code: string,
        username?: string
      ) => {
        set({ isLoading: true, error: null })
        try {
          await authService.verifyRegisterCode({ email, code, type: 'register' })
          await authService.register({ email, password, username, code })
          set({ isLoading: false })
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || '注册失败',
            isLoading: false,
          })
          throw error
        }
      },

      logout: async () => {
        try {
          await authService.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          })
          localStorage.removeItem('access_token')
        }
      },

      checkAuth: async () => {
        const token = localStorage.getItem('access_token')
        if (!token) {
          set({ isAuthenticated: false, user: null })
          return
        }

        set({ isLoading: true })
        try {
          const user = await authService.getCurrentUser()
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          })
          localStorage.removeItem('access_token')
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
