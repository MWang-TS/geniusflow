import client from './client'

export type ProviderType = 'openai' | 'azure_openai' | 'anthropic' | 'ollama' | 'custom'
export type ModelType = 'chat' | 'embedding' | 'rerank'
export type SkillType = 'tool' | 'retrieval' | 'code_execution' | 'custom'
export type FallbackModelType = 'chat' | 'embedding'

export interface AiProvider {
  id: string
  name: string
  type: ProviderType
  baseUrl?: string
  hasApiKey: boolean
  isEnabled: boolean
  config?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  models?: AiModel[]
}

export interface AiModel {
  id: string
  name: string
  modelId: string
  type: ModelType
  providerId: string
  provider?: AiProvider
  isDefault: boolean
  isEnabled: boolean
  config?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface AgentSkill {
  id: string
  name: string
  description?: string
  type: SkillType
  config?: Record<string, unknown>
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentRole {
  id: string
  name: string
  description?: string
  systemPrompt?: string
  modelId?: string
  model?: AiModel
  config?: Record<string, unknown>
  isEnabled: boolean
  createdAt: string
  updatedAt: string
  skills?: Array<{ id: string; skillId: string; skill: AgentSkill }>
}

export interface ModelFallbackChain {
  id: string
  modelType: FallbackModelType
  sortOrder: number
  modelId: string
  model?: AiModel
  isEnabled: boolean
  note?: string
  createdAt: string
  updatedAt: string
}

export const aiSettingsApi = {
  // Providers
  listProviders: () => client.get<AiProvider[]>('/ai-settings/providers'),
  getProvider: (id: string) => client.get<AiProvider>(`/ai-settings/providers/${id}`),
  createProvider: (data: Partial<AiProvider>) => client.post<AiProvider>('/ai-settings/providers', data),
  updateProvider: (id: string, data: Partial<AiProvider>) => client.put<AiProvider>(`/ai-settings/providers/${id}`, data),
  deleteProvider: (id: string) => client.delete(`/ai-settings/providers/${id}`),
  fetchProviderModels: (id: string) => client.get<{ models: string[] }>(`/ai-settings/providers/${id}/models`),

  // Models
  listModels: (params?: { providerId?: string; type?: ModelType }) =>
    client.get<AiModel[]>('/ai-settings/models', { params }),
  getModel: (id: string) => client.get<AiModel>(`/ai-settings/models/${id}`),
  createModel: (data: Partial<AiModel>) => client.post<AiModel>('/ai-settings/models', data),
  updateModel: (id: string, data: Partial<AiModel>) => client.put<AiModel>(`/ai-settings/models/${id}`, data),
  deleteModel: (id: string) => client.delete(`/ai-settings/models/${id}`),
  setDefaultModel: (id: string) => client.post(`/ai-settings/models/${id}/set-default`),

  // Agent Skills
  listSkills: () => client.get<AgentSkill[]>('/ai-settings/skills'),
  getSkill: (id: string) => client.get<AgentSkill>(`/ai-settings/skills/${id}`),
  createSkill: (data: Partial<AgentSkill>) => client.post<AgentSkill>('/ai-settings/skills', data),
  updateSkill: (id: string, data: Partial<AgentSkill>) => client.put<AgentSkill>(`/ai-settings/skills/${id}`, data),
  deleteSkill: (id: string) => client.delete(`/ai-settings/skills/${id}`),

  // Agent Roles
  listRoles: () => client.get<AgentRole[]>('/ai-settings/agent-roles'),
  getRole: (id: string) => client.get<AgentRole>(`/ai-settings/agent-roles/${id}`),
  createRole: (data: Partial<AgentRole> & { skillIds?: string[] }) =>
    client.post<AgentRole>('/ai-settings/agent-roles', data),
  updateRole: (id: string, data: Partial<AgentRole> & { skillIds?: string[] }) =>
    client.put<AgentRole>(`/ai-settings/agent-roles/${id}`, data),
  deleteRole: (id: string) => client.delete(`/ai-settings/agent-roles/${id}`),

  // Fallback Chains
  listFallbacks: (type?: FallbackModelType) =>
    client.get<ModelFallbackChain[]>('/ai-settings/fallbacks', { params: type ? { type } : undefined }),
  createFallback: (data: { modelType: FallbackModelType; modelId: string; note?: string }) =>
    client.post<ModelFallbackChain>('/ai-settings/fallbacks', data),
  updateFallback: (id: string, data: { modelId?: string; isEnabled?: boolean; note?: string }) =>
    client.put<ModelFallbackChain>(`/ai-settings/fallbacks/${id}`, data),
  deleteFallback: (id: string) => client.delete(`/ai-settings/fallbacks/${id}`),
  reorderFallbacks: (modelType: FallbackModelType, ids: string[]) =>
    client.put<ModelFallbackChain[]>('/ai-settings/fallbacks/reorder', { modelType, ids }),

  // Provider Test
  testProvider: (id: string) =>
    client.post<{ ok: boolean; latencyMs?: number; error?: string }>(`/ai-settings/providers/${id}/test`),

  // Export / Import
  exportConfig: () => client.get<any>('/ai-settings/export'),
  importConfig: (data: any) => client.post<{ success: boolean; summary: Record<string, number> }>('/ai-settings/import', data),
}
