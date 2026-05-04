import client from './client'

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  knowledgeBaseIds: string[]
  agentRoleId: string | null
  usageCount: number
  lastUsedAt: string | null
  expiresAt: string | null
  isEnabled: boolean
  createdAt: string
}

export interface CreateApiKeyRequest {
  name: string
  knowledgeBaseIds?: string[]
  agentRoleId?: string
  expiresAt?: string
}

export const openApiClient = {
  listKeys: () =>
    client.get<any, ApiKey[]>('/open-api/keys'),

  createKey: (data: CreateApiKeyRequest) =>
    client.post<any, ApiKey & { rawKey: string }>('/open-api/keys', data),

  deleteKey: (id: string) =>
    client.delete<any, { success: boolean }>(`/open-api/keys/${id}`),
}
