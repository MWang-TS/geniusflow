import client from './client'

export interface TemplateItem {
  id: string
  name: string
  description: string | null
  category: string | null
  nodeCount: number
  isPreset: boolean
  createdAt: string
}

export const templateApi = {
  list: (params?: { page?: number; pageSize?: number; category?: string; keyword?: string }) =>
    client.get('/templates', { params }),

  clone: (id: string) =>
    client.post(`/templates/${id}/clone`),
}
