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
  sendLoginCode: async (email: string, captcha?: { token: string; slide_x: number; duration: number }) => {
    const response = await api.post('/api/v1/auth/login/send-code', {
      email,
      type: 'login',
      captcha_token: captcha?.token,
      captcha_x: captcha?.slide_x,
      captcha_duration: captcha?.duration,
    })
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
  sendRegisterCode: async (email: string, captcha?: { token: string; slide_x: number; duration: number }) => {
    const response = await api.post('/api/v1/auth/register/send-code', {
      email,
      type: 'register',
      captcha_token: captcha?.token,
      captcha_x: captcha?.slide_x,
      captcha_duration: captcha?.duration,
    })
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

  // 发送重置密码验证码
  sendResetPasswordCode: async (email: string, captcha?: { token: string; slide_x: number; duration: number }) => {
    const response = await api.post('/api/v1/auth/reset-password/send-code', {
      email,
      type: 'reset',
      captcha_token: captcha?.token,
      captcha_x: captcha?.slide_x,
      captcha_duration: captcha?.duration,
    })
    return response.data
  },

  // 重置密码
  resetPassword: async (email: string, code: string, newPassword: string) => {
    const response = await api.post('/api/v1/auth/reset-password', { email, code, new_password: newPassword })
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

  // 获取用户画像
  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/api/v1/users/profile')
    return response.data
  },

  // 更新用户画像
  updateProfile: async (data: {
    username?: string
    mbti?: string
    social_style?: string
    current_state?: string
    catchphrases?: string[]
  }): Promise<User> => {
    const response = await api.put<User>('/api/v1/users/profile', data)
    return response.data
  },

  // 上传头像
  uploadAvatar: async (file: File): Promise<User> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<User>('/api/v1/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}
