// 认证相关类型定义

export interface User {
  id: number
  email: string
  username?: string
  avatar_url?: string
  mbti?: string
  social_style?: string
  current_state?: string
  catchphrases?: string[]
  role: string
  counselor_info?: Record<string, any>
  is_verified: boolean
  created_at: string
  updated_at: string
}

export type UserRole = 'student' | 'counselor' | 'psychologist' | 'admin'

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

// 辅导员/心理老师认证申请
export interface CounselorApplyRequest {
  target_role: 'counselor' | 'psychologist'
  real_name: string
  department: string
  employee_id?: string
  phone?: string
  qualification_images?: string[]
  introduction?: string
  bindings?: BindingCreateRequest[]
}

export interface BindingCreateRequest {
  scope_type: 'department' | 'class'
  scope_name: string
}

export interface CounselorApplicationResponse {
  id: number
  user_id: number
  target_role: string
  real_name: string
  department: string
  employee_id?: string
  phone?: string
  qualification_images?: string[]
  introduction?: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: number
  review_comment?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
  user_email?: string
  user_username?: string
}

export interface CounselorApplicationListResponse {
  items: CounselorApplicationResponse[]
  total: number
  page: number
  page_size: number
}

export interface ApplicationReviewRequest {
  action: 'approve' | 'reject'
  comment?: string
}

export interface BindingResponse {
  id: number
  user_id: number
  scope_type: string
  scope_name: string
  created_at: string
}

// 管理后台 - 用户
export interface AdminUserResponse {
  id: number
  email: string
  username?: string
  avatar_url?: string
  role: string
  counselor_info?: Record<string, any>
  is_active: boolean
  is_verified: boolean
  created_at: string
  updated_at: string
  bindings: BindingBrief[]
}

export interface BindingBrief {
  id: number
  scope_type: string
  scope_name: string
}

export interface AdminUserListResponse {
  items: AdminUserResponse[]
  total: number
  page: number
  page_size: number
}

// 管理后台 - 帖子
export interface AdminPostResponse {
  id: number
  circle_id: number
  user_id: number
  content: string
  images: string[]
  is_anonymous: boolean
  is_hidden: boolean
  likes_count: number
  comments_count: number
  created_at: string
  updated_at: string
  author_email?: string
  author_username?: string
  author_role?: string
}

export interface AdminPostListResponse {
  items: AdminPostResponse[]
  total: number
  page: number
  page_size: number
}

// 管理后台 - 看板
export interface AdminDashboardResponse {
  total_users: number
  active_users: number
  counselor_count: number
  psychologist_count: number
  total_diaries: number
  total_posts: number
  anonymous_posts: number
  pending_applications: number
}
