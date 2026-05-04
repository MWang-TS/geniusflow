import client from './client'

export interface SkillChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SkillChatChunk {
  type: 'text' | 'done' | 'error' | 'tool_call'
  content?: string
  name?: string
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

export async function streamSkillChat(
  message: string,
  history: SkillChatMessage[],
  knowledgeBaseIds: string[],
  agentRoleId: string | undefined,
  onChunk: (chunk: SkillChatChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken()
  const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

  const response = await fetch(`${baseURL}/skill-chat/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history, knowledgeBaseIds, agentRoleId }),
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
        onChunk(JSON.parse(data) as SkillChatChunk)
      } catch {
        // skip
      }
    }
  }
}

// ── Agent roles & knowledge bases for the selector ─────────────────────────

export const skillChatApi = {
  listAgentRoles: () =>
    client.get<any, { code: number; data: Array<{ id: string; name: string; description?: string }> }>(
      '/ai-settings/agent-roles',
    ),

  listKnowledgeBases: () =>
    client.get<any, { code: number; data: Array<{ id: string; name: string; type: string }> }>(
      '/knowledge-bases',
    ),
}
