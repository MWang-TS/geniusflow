import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { Response } from 'express'

export interface SkillChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const DEFAULT_SYSTEM_PROMPT = `你是一位企业智能助理，基于企业知识库和技能库回答问题。
请根据提供的知识上下文准确回答用户问题。若知识库中没有相关内容，请如实说明并给出合理建议。
回答时保持专业、简洁，优先引用知识库中的具体内容。`

/** Shape stored in AgentSkill.config for type='tool' */
interface SkillConfig {
  name: string
  description: string
  parameters: Record<string, unknown>
  endpoint?: string
  method?: string
  headers?: Record<string, string>
}

@Injectable()
export class SkillChatService {
  private readonly aiServiceUrl: string

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://ai-service:5000'
  }

  private buildProviderPayload(
    messages: Array<Record<string, unknown>>,
    model: any,
    agentRole: any,
    isAnthropic: boolean,
    tools?: unknown[],
    stream = true,
  ): Record<string, unknown> {
    if (!isAnthropic) {
      const body: Record<string, unknown> = {
        model: model.modelId,
        messages,
        stream,
        temperature: agentRole?.temperature ?? 0.7,
      }
      if (model.maxTokens) body.max_tokens = model.maxTokens
      if (tools?.length) body.tools = tools
      return body
    }

    const system = messages
      .filter((item) => item.role === 'system' && typeof item.content === 'string')
      .map((item) => item.content as string)
      .join('\n\n')

    const anthropicMessages = messages.filter((item) => item.role !== 'system')
    const body: Record<string, unknown> = {
      model: model.modelId,
      messages: anthropicMessages,
      stream,
      temperature: agentRole?.temperature ?? 0.7,
      max_tokens: model.maxTokens ?? 1024,
    }
    if (system) body.system = system
    if (tools?.length) body.tools = tools
    return body
  }

  async chat(
    userId: string,
    userRoles: string[],
    message: string,
    history: SkillChatMessage[],
    knowledgeBaseIds: string[],
    agentRoleId: string | undefined,
    res: Response,
  ) {
    const canUseCustomAgentRole = userRoles.some((role) => role === 'admin' || role === 'designer')
    if (agentRoleId && !canUseCustomAgentRole) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '当前用户无权指定 AI 角色' })}\n\n`)
      res.end()
      return
    }

    // 1. Resolve agent role (including skills)
    const agentRole = agentRoleId
      ? await this.prisma.agentRole.findUnique({
          where: { id: agentRoleId, isEnabled: true },
          include: {
            model: { include: { provider: true } },
            skills: { include: { skill: true } },
          },
        })
      : null

    // 2. Get model (agent role's model > default chat model)
    const model = agentRole?.model && agentRole.model.isEnabled && agentRole.model.provider.isEnabled
      ? agentRole.model
      : await this.prisma.aiModel.findFirst({
          where: { type: 'chat', isDefault: true, isEnabled: true },
          include: { provider: true },
        })

    if (!model || !model.provider.isEnabled) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '未配置可用的AI模型，请在 AI设置 中配置默认聊天模型' })}\n\n`)
      res.end()
      return
    }

    // 3. Search knowledge bases for relevant context (auto-discover all when none specified)
    let knowledgeContext = ''
    let ragKbIds: string[] = []
    let wikiKbIds: string[] = []

    if (knowledgeBaseIds.length === 0) {
      // Auto-discover all enabled KBs
      const allKbs = await this.prisma.knowledgeBase.findMany({ select: { id: true, mode: true } })
      ragKbIds = allKbs.filter((kb) => kb.mode !== 'wiki').map((kb) => kb.id)
      wikiKbIds = allKbs.filter((kb) => kb.mode === 'wiki').map((kb) => kb.id)
    } else {
      const kbs = await this.prisma.knowledgeBase.findMany({
        where: { id: { in: knowledgeBaseIds } },
        select: { id: true, mode: true },
      })
      ragKbIds = kbs.filter((kb) => kb.mode !== 'wiki').map((kb) => kb.id)
      wikiKbIds = kbs.filter((kb) => kb.mode === 'wiki').map((kb) => kb.id)
    }

    const [ragChunks, ...wikiPageSets] = await Promise.all([
      ragKbIds.length > 0 ? this.searchRagKbs(message, ragKbIds) : Promise.resolve([]),
      ...wikiKbIds.map((id) => this.searchWikiKb(message, id)),
    ])

    const contextParts: string[] = []
    if ((ragChunks as string[]).length > 0) {
      contextParts.push((ragChunks as string[]).map((c, i) => `[知识片段 ${i + 1}]\n${c}`).join('\n\n'))
    }
    for (const pages of wikiPageSets as Array<Array<{ title: string; content: string }>>) {
      if (pages.length > 0) {
        contextParts.push(pages.map((p) => `## ${p.title}\n${p.content}`).join('\n\n---\n\n'))
      }
    }
    if (contextParts.length > 0) {
      knowledgeContext =
        '\n\n## 相关知识库内容\n' +
        '> 以下内容来自系统知识库，请优先参考。若知识库内容与问题无关，请直接凭自身知识回答，无需强行引用。\n\n' +
        contextParts.join('\n\n')
    }

    // 4. Build system prompt
    const systemPrompt = (agentRole?.systemPrompt || DEFAULT_SYSTEM_PROMPT) + knowledgeContext

    // 5. Collect enabled tool-type skills linked to this agent role
    const toolSkills = ((agentRole as any)?.skills ?? [])
      .filter((s: any) => s.skill.isEnabled && s.skill.type === 'tool')
      .map((s: any) => s.skill)

    const isAnthropic = model.provider.type === 'anthropic'
    const baseUrl = (model.provider.baseUrl ?? this.defaultBaseUrl(model.provider.type)).replace(/\/$/, '')
    const apiKey = model.provider.apiKey

    const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (isAnthropic) {
      baseHeaders['x-api-key'] = apiKey || ''
      baseHeaders['anthropic-version'] = '2023-06-01'
    } else if (apiKey) {
      baseHeaders['Authorization'] = `Bearer ${apiKey}`
    }

    // 6. Build message history
    const messages: Array<Record<string, unknown>> = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    // 7. Route: with tools → tool-call round-trip; without → direct stream
    if (toolSkills.length > 0) {
      await this.chatWithTools(toolSkills, messages, model, baseUrl, baseHeaders, isAnthropic, agentRole, res)
    } else {
      await this.streamChat(messages, model, baseUrl, baseHeaders, isAnthropic, agentRole, res)
    }
  }

  // ── Build tools array in the format expected by each provider ──────────────

  private buildTools(skills: any[], isAnthropic: boolean): unknown[] {
    return skills.map((skill) => {
      const cfg = skill.config as SkillConfig
      if (isAnthropic) {
        // Anthropic Claude tool format
        return {
          name: cfg.name,
          description: cfg.description,
          input_schema: cfg.parameters ?? { type: 'object', properties: {} },
        }
      }
      // OpenAI / OpenAI-compatible format
      return {
        type: 'function',
        function: {
          name: cfg.name,
          description: cfg.description,
          parameters: cfg.parameters ?? { type: 'object', properties: {} },
        },
      }
    })
  }

  // ── Tool-call round-trip: non-streaming first call, execute tools, stream result ──

  private async chatWithTools(
    toolSkills: any[],
    messages: Array<Record<string, unknown>>,
    model: any,
    baseUrl: string,
    headers: Record<string, string>,
    isAnthropic: boolean,
    agentRole: any,
    res: Response,
  ) {
    const chatUrl = isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`
    const tools = this.buildTools(toolSkills, isAnthropic)

    // First call: non-streaming so we can inspect tool_calls
    const body = this.buildProviderPayload(messages, model, agentRole, isAnthropic, tools, false)

    let firstResponse: globalThis.Response
    try {
      firstResponse = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })
    } catch (e: unknown) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: `AI服务连接失败: ${(e as Error).message}` })}\n\n`)
      res.end()
      return
    }

    if (!firstResponse.ok) {
      // Fall back to streaming without tools
      await this.streamChat(messages, model, baseUrl, headers, isAnthropic, agentRole, res)
      return
    }

    const data = await firstResponse.json() as any

    // Extract tool calls depending on provider
    const toolCalls: any[] = isAnthropic
      ? (data.content ?? []).filter((b: any) => b.type === 'tool_use')
      : (data.choices?.[0]?.message?.tool_calls ?? [])

    if (!toolCalls.length) {
      // No tool calls — emit the text content directly then finish
      const content = isAnthropic
        ? (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
        : (data.choices?.[0]?.message?.content ?? '')
      if (content) res.write(`data: ${JSON.stringify({ type: 'text', content })}\n\n`)
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
      return
    }

    // Append assistant's tool-call turn to the message history
    if (isAnthropic) {
      messages.push({ role: 'assistant', content: data.content })
    } else {
      messages.push({ role: 'assistant', content: null, tool_calls: toolCalls })
    }

    // Execute each tool call
    for (const tc of toolCalls) {
      const toolName: string = isAnthropic ? tc.name : tc.function?.name
      const toolArgs: Record<string, unknown> = isAnthropic ? tc.input : JSON.parse(tc.function?.arguments ?? '{}')
      const toolId: string = tc.id

      // Notify the client so it can show a "calling tool…" indicator
      res.write(`data: ${JSON.stringify({ type: 'tool_call', name: toolName })}\n\n`)

      const skill = toolSkills.find((s) => (s.config as SkillConfig).name === toolName)
      let result = `工具 ${toolName} 执行失败：未找到对应技能`
      if (skill) {
        const cfg = skill.config as SkillConfig
        result = cfg.endpoint
          ? await this.executeToolCall(cfg, toolArgs)
          : JSON.stringify(toolArgs)
      }

      // Append tool result to messages in provider-specific format
      if (isAnthropic) {
        messages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: toolId, content: result }],
        })
      } else {
        messages.push({ role: 'tool', tool_call_id: toolId, content: result })
      }
    }

    // Final streaming call with the full context including tool results
    await this.streamChat(messages, model, baseUrl, headers, isAnthropic, agentRole, res, tools)
  }

  // ── Execute an HTTP tool call defined in the skill config ──────────────────

  private async executeToolCall(cfg: SkillConfig, args: Record<string, unknown>): Promise<string> {
    if (!cfg.endpoint) return 'No endpoint configured'
    try {
      const method = (cfg.method ?? 'POST').toUpperCase()
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(cfg.headers ?? {}),
      }
      const fetchRes = await fetch(cfg.endpoint, {
        method,
        headers: reqHeaders,
        body: method !== 'GET' ? JSON.stringify(args) : undefined,
        signal: AbortSignal.timeout(15000),
      })
      return await fetchRes.text()
    } catch (e: unknown) {
      return `Error: ${(e as Error).message}`
    }
  }

  // ── Streaming LLM call → SSE ───────────────────────────────────────────────

  private async streamChat(
    messages: Array<Record<string, unknown>>,
    model: any,
    baseUrl: string,
    headers: Record<string, string>,
    isAnthropic: boolean,
    agentRole: any,
    res: Response,
    tools?: unknown[],
  ) {
    const chatUrl = isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`
    const body = this.buildProviderPayload(messages, model, agentRole, isAnthropic, tools, true)

    let response: globalThis.Response
    try {
      response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      })
    } catch (e: unknown) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: `AI服务连接失败: ${(e as Error).message}` })}\n\n`)
      res.end()
      return
    }

    if (!response.ok) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: `AI返回错误: HTTP ${response.status}` })}\n\n`)
      res.end()
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
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') continue
        try {
          const chunk = JSON.parse(raw)
          // OpenAI / compatible
          const openaiText = chunk.choices?.[0]?.delta?.content
          // Anthropic streaming
          const anthropicText = chunk.delta?.text
          const content = openaiText ?? anthropicText
          if (content) res.write(`data: ${JSON.stringify({ type: 'text', content })}\n\n`)
        } catch {
          // skip malformed chunks
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
  }

  private async searchRagKbs(query: string, kbIds: string[]): Promise<string[]> {
    try {
      const res = await fetch(`${this.aiServiceUrl}/ai/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, knowledgeBaseIds: kbIds, topK: 6 }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { chunks: Array<{ content: string; score: number }> }
      return data.chunks.filter((c) => c.score > 0.3).map((c) => c.content)
    } catch {
      return []
    }
  }

  private async searchWikiKb(query: string, kbId: string): Promise<Array<{ title: string; content: string }>> {
    try {
      const res = await fetch(`${this.aiServiceUrl}/wiki/pages-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kb_id: kbId, question: query, max_pages: 4, content_max_chars: 2000 }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { pages: Array<{ title: string; slug: string; content: string }> }
      return data.pages
    } catch {
      return []
    }
  }

  private defaultBaseUrl(providerType: string): string {
    switch (providerType) {
      case 'openai': return 'https://api.openai.com/v1'
      case 'anthropic': return 'https://api.anthropic.com/v1'
      case 'ollama': return 'http://localhost:11434/v1'
      default: return 'https://api.openai.com/v1'
    }
  }
}
