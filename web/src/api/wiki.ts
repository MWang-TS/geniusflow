import client from './client'

export interface WikiRawSource {
  id: string
  knowledgeBaseId: string
  fileName: string
  fileSize: number
  mimeType: string | null
  converterMode: string
  conversionStatus: 'pending' | 'processing' | 'done' | 'failed'
  markdownContent: string | null
  ingestStatus: 'pending' | 'processing' | 'done' | 'failed'
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface WikiPage {
  id: string
  knowledgeBaseId: string
  slug: string
  title: string
  content: string
  pageType: 'concept' | 'entity' | 'source' | 'index' | 'log'
  tags: string[]
  sourceFile: string | null
  createdAt: string
  updatedAt: string
}

export interface WikiQueryResult {
  answer: string
  pages_used: string[]
}

export interface GraphNode {
  id: string
  label: string
  type: string
  size: number
}

export interface GraphEdge {
  source: string
  target: string
  label: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  triple_count: number
}

export interface GraphBuildStatus {
  status: 'idle' | 'queued' | 'building' | 'done' | 'error'
  triple_count: number
  message: string
}

export const wikiApi = {
  // Sources
  getSources: (kbId: string, params?: { page?: number; pageSize?: number }) =>
    client.get<{ list: WikiRawSource[]; pagination: { page: number; pageSize: number; total: number } }>(
      `/wiki/${kbId}/sources`, { params }
    ),

  uploadSource: (kbId: string, fileOrFiles: File | File[]) => {
    const form = new FormData()
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
    files.forEach((file) => form.append('file', file))
    return client.post<WikiRawSource | WikiRawSource[]>(`/wiki/${kbId}/sources`, form)
  },

  uploadSourceText: (kbId: string, title: string, content: string) =>
    client.post<WikiRawSource>(`/wiki/${kbId}/sources/text`, { title, content }),

  deleteSource: (kbId: string, sourceId: string) =>
    client.delete(`/wiki/${kbId}/sources/${sourceId}`),

  convertSource: (kbId: string, sourceId: string) =>
    client.post(`/wiki/${kbId}/sources/${sourceId}/convert`),

  ingestSource: (kbId: string, sourceId: string) =>
    client.post(`/wiki/${kbId}/sources/${sourceId}/ingest`),

  processSource: (kbId: string, sourceId: string) =>
    client.post(`/wiki/${kbId}/sources/${sourceId}/process`),

  // Pages
  getPages: (kbId: string, params?: { page?: number; pageSize?: number; pageType?: string }) =>
    client.get<{ list: WikiPage[]; pagination: { page: number; pageSize: number; total: number } }>(
      `/wiki/${kbId}/pages`, { params }
    ),

  getPage: (kbId: string, slug: string) =>
    client.get<WikiPage>(`/wiki/${kbId}/pages/${encodeURIComponent(slug)}`),

  updatePage: (kbId: string, slug: string, data: { title?: string; content?: string; tags?: string[] }) =>
    client.put<WikiPage>(`/wiki/${kbId}/pages/${slug}`, data),

  deletePage: (kbId: string, slug: string) =>
    client.delete(`/wiki/${kbId}/pages/${slug}`),

  // Query
  query: (kbId: string, question: string, maxPages?: number) =>
    client.post<WikiQueryResult>(`/wiki/${kbId}/query`, { question, maxPages }, { timeout: 120000 }),

  // Lint
  lint: (kbId: string) =>
    client.get<{ orphan_pages: string[]; broken_links: any[]; total_pages: number }>(`/wiki/${kbId}/lint`),

  // Knowledge Graph
  getGraph: (kbId: string) =>
    client.get<GraphData>(`/wiki/${kbId}/graph`),

  buildGraph: (kbId: string) =>
    client.post<GraphBuildStatus>(`/wiki/${kbId}/graph/build`, {}),

  getGraphBuildStatus: (kbId: string) =>
    client.get<GraphBuildStatus>(`/wiki/${kbId}/graph/build/status`),
}
