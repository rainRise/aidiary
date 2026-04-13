// 管理后台 API 服务
import api from './api'
import type {
  CounselorApplyRequest,
  CounselorApplicationResponse,
  CounselorApplicationListResponse,
  ApplicationReviewRequest,
  BindingResponse,
  AdminUserListResponse,
  AdminUserResponse,
  AdminPostListResponse,
  AdminPostResponse,
  AdminDashboardResponse,
} from '@/types/auth'

// ==================== 辅导员认证 ====================

export const counselorService = {
  /** 提交认证申请 */
  async apply(data: CounselorApplyRequest): Promise<CounselorApplicationResponse> {
    const res = await api.post('/api/v1/counselor/applications', data)
    return res.data
  },

  /** 查看我的申请 */
  async getMyApplication(): Promise<CounselorApplicationResponse> {
    const res = await api.get('/api/v1/counselor/applications/me')
    return res.data
  },

  /** 查看我的绑定范围 */
  async getMyBindings(): Promise<BindingResponse[]> {
    const res = await api.get('/api/v1/counselor/bindings')
    return res.data
  },
}

// ==================== 管理后台 ====================

export const adminService = {
  // ---- 认证审核 ----
  /** 获取认证申请列表 */
  async listApplications(params?: {
    status?: string
    page?: number
    page_size?: number
  }): Promise<CounselorApplicationListResponse> {
    const res = await api.get('/api/v1/admin/applications', { params })
    return res.data
  },

  /** 审核认证申请 */
  async reviewApplication(id: number, data: ApplicationReviewRequest): Promise<CounselorApplicationResponse> {
    const res = await api.put(`/api/v1/admin/applications/${id}`, data)
    return res.data
  },

  // ---- 用户管理 ----
  /** 获取用户列表 */
  async listUsers(params?: {
    search?: string
    role?: string
    is_active?: boolean
    page?: number
    page_size?: number
  }): Promise<AdminUserListResponse> {
    const res = await api.get('/api/v1/admin/users', { params })
    return res.data
  },

  /** 修改用户信息 */
  async updateUser(id: number, data: { role?: string; is_active?: boolean; is_verified?: boolean }): Promise<AdminUserResponse> {
    const res = await api.put(`/api/v1/admin/users/${id}`, data)
    return res.data
  },

  /** 禁用用户 */
  async disableUser(id: number): Promise<void> {
    await api.delete(`/api/v1/admin/users/${id}`)
  },

  // ---- 帖子管理 ----
  /** 获取帖子列表（含匿名追溯） */
  async listPosts(params?: {
    circle_id?: number
    is_anonymous?: boolean
    is_hidden?: boolean
    page?: number
    page_size?: number
  }): Promise<AdminPostListResponse> {
    const res = await api.get('/api/v1/admin/posts', { params })
    return res.data
  },

  /** 管理帖子 */
  async updatePost(id: number, data: { is_hidden?: boolean }): Promise<AdminPostResponse> {
    const res = await api.put(`/api/v1/admin/posts/${id}`, data)
    return res.data
  },

  // ---- 系统看板 ----
  /** 获取系统概览数据 */
  async getDashboard(): Promise<AdminDashboardResponse> {
    const res = await api.get('/api/v1/admin/dashboard')
    return res.data
  },
}
