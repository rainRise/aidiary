// 社区API服务
import api from './api'

export interface PostAuthor {
  id: number
  username: string | null
  avatar_url: string | null
}

export interface Post {
  id: number
  circle_id: string
  content: string
  images: string[]
  is_anonymous: boolean
  author: PostAuthor | null
  like_count: number
  comment_count: number
  collect_count: number
  is_liked: boolean
  is_collected: boolean
  created_at: string
  updated_at: string
}

export interface PostListResponse {
  items: Post[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface Comment {
  id: number
  post_id: number
  content: string
  is_anonymous: boolean
  author: PostAuthor | null
  parent_id: number | null
  created_at: string
}

export interface CommentListResponse {
  items: Comment[]
  total: number
}

export interface CircleInfo {
  id: string
  name: string
  label: string
  color: string
  post_count: number
}

export interface ViewHistoryItem {
  post: Post
  viewed_at: string
}

export interface ViewHistoryResponse {
  items: ViewHistoryItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export const communityService = {
  // 圈子
  async getCircles(): Promise<CircleInfo[]> {
    const { data } = await api.get('/api/v1/community/circles')
    return data
  },

  // 帖子
  async createPost(payload: {
    circle_id: string
    content: string
    images?: string[]
    is_anonymous?: boolean
  }): Promise<Post> {
    const { data } = await api.post('/api/v1/community/posts', payload)
    return data
  },

  async getPosts(params: {
    circle_id?: string
    page?: number
    page_size?: number
  } = {}): Promise<PostListResponse> {
    const { data } = await api.get('/api/v1/community/posts', { params })
    return data
  },

  async getMyPosts(params: {
    page?: number
    page_size?: number
  } = {}): Promise<PostListResponse> {
    const { data } = await api.get('/api/v1/community/posts/mine', { params })
    return data
  },

  async getPost(postId: number): Promise<Post> {
    const { data } = await api.get(`/api/v1/community/posts/${postId}`)
    return data
  },

  async updatePost(postId: number, payload: {
    content?: string
    images?: string[]
  }): Promise<Post> {
    const { data } = await api.put(`/api/v1/community/posts/${postId}`, payload)
    return data
  },

  async deletePost(postId: number): Promise<void> {
    await api.delete(`/api/v1/community/posts/${postId}`)
  },

  // 图片上传
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/api/v1/community/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.url
  },

  // 评论
  async getComments(postId: number): Promise<CommentListResponse> {
    const { data } = await api.get(`/api/v1/community/posts/${postId}/comments`)
    return data
  },

  async createComment(postId: number, payload: {
    content: string
    parent_id?: number
    is_anonymous?: boolean
  }): Promise<Comment> {
    const { data } = await api.post(`/api/v1/community/posts/${postId}/comments`, payload)
    return data
  },

  async deleteComment(commentId: number): Promise<void> {
    await api.delete(`/api/v1/community/comments/${commentId}`)
  },

  // 点赞
  async toggleLike(postId: number): Promise<{ liked: boolean }> {
    const { data } = await api.post(`/api/v1/community/posts/${postId}/like`)
    return data
  },

  // 收藏
  async toggleCollect(postId: number): Promise<{ collected: boolean }> {
    const { data } = await api.post(`/api/v1/community/posts/${postId}/collect`)
    return data
  },

  async getCollections(params: {
    page?: number
    page_size?: number
  } = {}): Promise<PostListResponse> {
    const { data } = await api.get('/api/v1/community/collections', { params })
    return data
  },

  // 浏览记录
  async getViewHistory(params: {
    page?: number
    page_size?: number
  } = {}): Promise<ViewHistoryResponse> {
    const { data } = await api.get('/api/v1/community/history', { params })
    return data
  },
}
