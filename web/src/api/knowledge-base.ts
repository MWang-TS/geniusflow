import client from './client'

export interface KnowledgeBaseItem {
  id: string
  name: string
  mode: string
  type: string
  description: string | null
  documentCount: number
  settings: RagSettings | null
  createdAt: string
  updatedAt: string
}

export interface RagSettings {
  chunkSize?: number
  chunkOverlap?: number
  topK?: number
  similarityThreshold?: number
}

export interface KnowledgeBaseDocument {
  id: string
  fileName: string
  fileSize: number
  mimeType: string | null
  parseStatus: string
  vectorizedStatus: string
  chunkCount: number
  errorMessage: string | null
  createdAt: string
}

export interface SearchChunk {
  chunkId: string
  documentId: string
  content: string
  score: number
}

export const knowledgeBaseApi = {
  list: (params?: { type?: string; page?: number; pageSize?: number }) =>
    client.get('/knowledge-bases', { params }),

  getById: (id: string) =>
    client.get(`/knowledge-bases/${id}`),

  create: (data: { name: string; mode: string; type: string; description?: string }) =>
    client.post('/knowledge-bases', data),

  update: (id: string, data: { name?: string; description?: string; settings?: Record<string, unknown> }) =>
    client.put(`/knowledge-bases/${id}`, data),

  remove: (id: string) =>
    client.delete(`/knowledge-bases/${id}`),

  getDocuments: (id: string, params?: { page?: number; pageSize?: number }) =>
    client.get(`/knowledge-bases/${id}/documents`, { params }),

  uploadDocument: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    // Do NOT set Content-Type manually; axios will set multipart/form-data with the correct boundary
    return client.post(`/knowledge-bases/${id}/documents`, form)
  },

  uploadDocumentText: (id: string, title: string, content: string) =>
    client.post(`/knowledge-bases/${id}/documents/text`, { title, content }),

  deleteDocument: (id: string, docId: string) =>
    client.delete(`/knowledge-bases/${id}/documents/${docId}`),

  reindex: (id: string, docId: string) =>
    client.post(`/knowledge-bases/${id}/documents/${docId}/reindex`),

  search: (id: string, query: string, topK?: number) =>
    client.post(`/knowledge-bases/${id}/search`, { query, topK: topK || 5 }),
}
