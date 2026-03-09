// 认证相关类型定义

export interface User {
  id: number
  email: string
  username?: string
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  email: string
  code: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface RegisterRequest {
  email: string
  password: string
  code: string
  username?: string
}

export interface SendCodeRequest {
  email: string
}

export interface VerifyCodeRequest {
  email: string
  code: string
  type: 'register' | 'login'
}
