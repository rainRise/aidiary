// 认证状态管理
// Token 通过 httpOnly cookie 管理，前端不直接接触 token
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/auth'
import { authService } from '@/services/auth.service'

interface AuthState {
  user: User | null
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
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, code: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.login({ email, code })
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          })
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
            isAuthenticated: true,
            isLoading: false,
          })
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
            isAuthenticated: false,
          })
        }
      },

      checkAuth: async () => {
        set({ isLoading: true })
        try {
          const user = await authService.getCurrentUser()
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
