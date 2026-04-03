import api from './api'

export interface AssistantProfile {
  nickname: string | null
  proactive_greeting_enabled: boolean
  is_muted: boolean
  initialized: boolean
}

export interface AssistantSession {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface AssistantMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface StreamCallbacks {
  onMeta?: (meta: { session_id: number; user_message_id: number }) => void
  onChunk?: (text: string) => void
  onDone?: (data: any) => void
  onError?: (message: string) => void
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || ''
}

export const assistantService = {
  async getProfile(): Promise<AssistantProfile> {
    const { data } = await api.get('/api/v1/assistant/profile')
    return data
  },

  async updateProfile(payload: Partial<AssistantProfile>): Promise<AssistantProfile> {
    const { data } = await api.put('/api/v1/assistant/profile', payload)
    return data
  },

  async listSessions(): Promise<AssistantSession[]> {
    const { data } = await api.get('/api/v1/assistant/sessions')
    return data
  },

  async createSession(title?: string): Promise<AssistantSession> {
    const { data } = await api.post('/api/v1/assistant/sessions', { title })
    return data
  },

  async archiveSession(sessionId: number): Promise<void> {
    await api.delete(`/api/v1/assistant/sessions/${sessionId}`)
  },

  async clearSession(sessionId: number): Promise<void> {
    await api.post(`/api/v1/assistant/sessions/${sessionId}/clear`)
  },

  async listMessages(sessionId: number): Promise<AssistantMessage[]> {
    const { data } = await api.get(`/api/v1/assistant/sessions/${sessionId}/messages`)
    return data
  },

  async streamChat(
    payload: { message: string; session_id?: number | null },
    callbacks: StreamCallbacks
  ): Promise<void> {
    const base = getApiBaseUrl()
    const response = await fetch(`${base}/api/v1/assistant/chat/stream`, {
      method: 'POST',
      credentials: 'include', // 自动携带 httpOnly cookie
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      throw new Error(`请求失败：${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let eventName = ''
    let dataRaw = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const chunk of parts) {
        const lines = chunk.split('\n')
        eventName = ''
        dataRaw = ''
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataRaw += line.slice(5).trim()
          }
        }
        if (!eventName || !dataRaw) continue
        try {
          const data = JSON.parse(dataRaw)
          if (eventName === 'meta') callbacks.onMeta?.(data)
          if (eventName === 'chunk') callbacks.onChunk?.(data.text || '')
          if (eventName === 'done') callbacks.onDone?.(data)
          if (eventName === 'error') callbacks.onError?.(data.message || '对话失败')
        } catch {
          // ignore parse errors
        }
      }
    }
  },
}

