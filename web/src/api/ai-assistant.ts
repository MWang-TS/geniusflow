export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatChunk {
  type: 'text' | 'tool_start' | 'done' | 'error'
  content?: string
  tools?: string[]
}

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('auth-storage')
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return parsed.state?.accessToken ?? null
  } catch {
    return null
  }
}

export async function streamChat(
  message: string,
  history: ChatMessage[],
  onChunk: (chunk: ChatChunk) => void,
  signal?: AbortSignal,
  knowledgeBaseIds?: string[],
): Promise<void> {
  const token = getToken()
  const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

  const response = await fetch(`${baseURL}/ai-assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history, knowledgeBaseIds: knowledgeBaseIds ?? [] }),
    signal,
  })

  if (!response.ok) {
    onChunk({ type: 'error', content: `请求失败: HTTP ${response.status}` })
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
      const data = line.slice(6).trim()
      if (!data) continue
      try {
        const chunk: ChatChunk = JSON.parse(data)
        onChunk(chunk)
      } catch {
        // skip
      }
    }
  }
}
