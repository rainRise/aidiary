// 认证API服务
import api from './api'
import type {
  User,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  VerifyCodeRequest,
} from '@/types/auth'

export const authService = {
  // 发送登录验证码
  sendLoginCode: async (email: string) => {
    const response = await api.post('/api/v1/auth/login/send-code', { email, type: 'login' })
    return response.data
  },

  // 验证码登录
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/api/v1/auth/login', data)
    return response.data
  },

  // 密码登录
  loginWithPassword: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/api/v1/auth/login/password', { email, password })
    return response.data
  },

  // 发送注册验证码
  sendRegisterCode: async (email: string) => {
    const response = await api.post('/api/v1/auth/register/send-code', { email, type: 'register' })
    return response.data
  },

  // 验证注册验证码
  verifyRegisterCode: async (data: VerifyCodeRequest) => {
    const response = await api.post('/api/v1/auth/register/verify', data)
    return response.data
  },

  // 注册
  register: async (data: RegisterRequest) => {
    const response = await api.post('/api/v1/auth/register', data)
    return response.data
  },

  // 登出
  logout: async () => {
    const response = await api.post('/api/v1/auth/logout')
    return response.data
  },

  // 获取当前用户信息
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/api/v1/auth/me')
    return response.data
  },
}
