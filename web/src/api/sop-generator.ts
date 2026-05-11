import client from './client'

export interface SopGenerateParams {
  description: string
  domain?: string
  roleHints?: string[]
  estimatedSteps?: number
  referenceContext?: string
}

export interface SopNode {
  id: string
  type: 'start' | 'end' | 'task' | 'approval'
  label: string
  position: { x: number; y: number }
  assigneeRole?: string
  dueHours?: number
  enableAiInspection?: boolean
  acceptanceCriteria?: string
  sopContent?: string
  checklist?: Array<{ id: string; label: string; required: boolean }>
  inputFields?: Array<{ key: string; label: string; type: string }>
  outputFields?: Array<{ key: string; label: string; type: string }>
}

export interface SopEdge {
  id: string
  source: string
  target: string
}

export interface SopChunk {
  type: 'node' | 'edge' | 'done' | 'error'
  data: SopNode | SopEdge | { processName: string; description: string; nodeCount: number } | { message: string }
}

export interface SaveSopParams {
  processName: string
  description?: string
  nodes: SopNode[]
  edges: SopEdge[]
}

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('auth-storage')
    if (!stored) return null
    return JSON.parse(stored).state?.accessToken ?? null
  } catch {
    return null
  }
}

export async function streamGenerateSop(
  params: SopGenerateParams,
  onChunk: (chunk: SopChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken()
  const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

  const response = await fetch(`${baseURL}/sop/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
    signal,
  })

  if (!response.ok) {
    onChunk({ type: 'error', data: { message: `请求失败: HTTP ${response.status}` } })
    return
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (!payload) continue
      try {
        const chunk: SopChunk = JSON.parse(payload)
        onChunk(chunk)
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export const sopApi = {
  save: (data: SaveSopParams) =>
    client.post<any, { code: number; data: { id: string; name: string }; message: string }>(
      '/sop/save',
      data,
    ),
}
