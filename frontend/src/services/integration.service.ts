import api from './api'

export interface OpenClawIntegrationStatus {
  provider: string
  connected: boolean
  token_hint: string | null
  created_at: string | null
  last_used_at: string | null
  expires_at: string | null
  ingest_url: string
  suggested_mode: 'append_today' | 'create'
}

export interface OpenClawTokenResponse extends OpenClawIntegrationStatus {
  token: string
}

export const integrationService = {
  async getOpenClawStatus(): Promise<OpenClawIntegrationStatus> {
    const { data } = await api.get('/api/v1/integrations/openclaw/status')
    return data
  },

  async createOpenClawToken(): Promise<OpenClawTokenResponse> {
    const { data } = await api.post('/api/v1/integrations/openclaw/token')
    return data
  },

  async revokeOpenClawToken(): Promise<void> {
    await api.delete('/api/v1/integrations/openclaw/token')
  },
}
