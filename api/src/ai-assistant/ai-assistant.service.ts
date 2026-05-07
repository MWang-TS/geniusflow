import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { Response } from 'express'

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const SYSTEM_PROMPT = `你是 GeniusFlow 工作流管理系统的智能助手。你能够：
1. 解答用户关于系统功能和操作方法的问题
2. 查询用户权限范围内的信息（流程、任务、通知等）
3. 帮助用户了解流程执行情况

## 系统功能说明
- **流程设计**（/processes）：创建和管理业务流程定义，支持多节点配置
- **流程实例**（/instances）：启动和跟踪流程执行情况
- **我的任务**（/my-tasks）：查看并完成分配给自己的任务节点
- **审批**（/approvals）：处理需要审批的节点
- **知识库**（/knowledge-bases）：管理和检索知识文档
- **进度看板**（/progress）：查看流程进度和统计
- **通知**（/notifications）：系统消息和提醒
- **模板市场**（/templates）：使用预制的流程模板
- **用户管理**（/admin/users）：管理系统用户（仅管理员）
- **AI设置**（/admin/ai-settings）：配置AI模型和提供商（仅管理员）

## 角色权限
- **employee（员工）**：执行任务、查看自己的流程
- **manager（管理者）**：审批、查看所有流程
- **designer（设计者）**：设计和发布流程
- **admin（管理员）**：全部权限

回答时请简洁准确，对于查询类请求优先调用工具获取实时数据。`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_my_tasks',
      description: '获取当前用户的待办任务列表',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed'],
            description: '任务状态筛选，不传则查询所有',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_process_instances',
      description: '查询流程实例列表，可按状态筛选',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['running', 'completed', 'cancelled'],
            description: '流程状态',
          },
          limit: {
            type: 'number',
            description: '返回数量，默认10',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_process_definitions',
      description: '获取可用的流程定义列表',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'published', 'archived'],
            description: '定义状态，不传则查询所有',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_notifications',
      description: '获取当前用户的通知消息',
      parameters: {
        type: 'object',
        properties: {
          unreadOnly: {
            type: 'boolean',
            description: '是否只查未读，默认false',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_instance_detail',
      description: '获取某个流程实例的详细执行情况',
      parameters: {
        type: 'object',
        properties: {
          instanceId: {
            type: 'string',
            description: '流程实例ID',
          },
        },
        required: ['instanceId'],
      },
    },
  },
]

@Injectable()
export class AiAssistantService {
  private readonly aiServiceUrl: string

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://ai-service:5000'
  }

  async chat(
    userId: string,
    userRoles: string[],
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    knowledgeBaseIds: string[] = [],
    res: Response,
  ) {
    // Get default chat model
    const model = await this.prisma.aiModel.findFirst({
      where: { type: 'chat', isDefault: true, isEnabled: true },
      include: { provider: true },
    })

    if (!model || !model.provider.isEnabled) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '未配置可用的AI模型，请在 AI设置 中配置默认聊天模型' })}\n\n`)
      res.end()
      return
    }

    const baseUrl = (model.provider.baseUrl ?? this.defaultBaseUrl(model.provider.type)).replace(/\/$/, '')
    const apiKey = model.provider.apiKey

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })

    const userContext = `当前用户：${user?.name || userId}（${userRoles.join('、')}）`

    // RAG: search knowledge bases if provided
    let knowledgeContext = ''
    if (knowledgeBaseIds.length > 0) {
      try {
        const searchRes = await fetch(`${this.aiServiceUrl}/ai/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: message, knowledgeBaseIds, topK: 6 }),
          signal: AbortSignal.timeout(10000),
        })
        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as { chunks: Array<{ content: string; score: number }> }
          const relevantChunks = searchData.chunks.filter((c) => c.score > 0.3)
          if (relevantChunks.length > 0) {
            knowledgeContext = '\n\n## 相关知识库内容\n' + relevantChunks.map((c, i) => `[知识片段 ${i + 1}]\n${c.content}`).join('\n\n')
          }
        }
      } catch {
        // RAG failure is non-fatal
      }
    }

    const systemPrompt = `${SYSTEM_PROMPT}\n\n${userContext}${knowledgeContext}`

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    await this.runAgentic(messages, model, baseUrl, apiKey, userId, userRoles, res)
  }

  private async runAgentic(
    messages: Message[],
    model: any,
    baseUrl: string,
    apiKey: string | null,
    userId: string,
    userRoles: string[],
    res: Response,
    depth = 0,
  ) {
    if (depth > 5) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
      return
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    // Anthropic needs different headers
    if (model.provider.type === 'anthropic') {
      headers['x-api-key'] = apiKey || ''
      headers['anthropic-version'] = '2023-06-01'
      delete headers['Authorization']
    }

    const body: Record<string, unknown> = {
      model: model.modelId,
      messages,
      stream: true,
      tools: TOOLS,
      tool_choice: 'auto',
    }
    if (model.maxTokens) body.max_tokens = model.maxTokens

    const chatUrl = model.provider.type === 'anthropic'
      ? `${baseUrl}/messages`
      : `${baseUrl}/chat/completions`

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
      const err = await response.text()
      res.write(`data: ${JSON.stringify({ type: 'error', content: `AI返回错误: HTTP ${response.status}` })}\n\n`)
      res.end()
      return
    }

    // Stream and collect tool calls
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    const pendingToolCalls: Record<string, { id: string; name: string; args: string }> = {}

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const chunk = JSON.parse(data)
          const delta = chunk.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            fullContent += delta.content
            res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`)
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!pendingToolCalls[idx]) {
                pendingToolCalls[idx] = { id: tc.id || '', name: '', args: '' }
              }
              if (tc.id) pendingToolCalls[idx].id = tc.id
              if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name
              if (tc.function?.arguments) pendingToolCalls[idx].args += tc.function.arguments
            }
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    const toolCalls = Object.values(pendingToolCalls).filter((t) => t.name)
    if (toolCalls.length === 0) {
      // No tool calls — done
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
      return
    }

    // Notify client about tool execution
    res.write(`data: ${JSON.stringify({ type: 'tool_start', tools: toolCalls.map((t) => t.name) })}\n\n`)

    // Execute tools and continue
    const assistantMsg: Message = {
      role: 'assistant',
      content: fullContent || null,
      tool_calls: toolCalls.map((t) => ({
        id: t.id,
        type: 'function' as const,
        function: { name: t.name, arguments: t.args },
      })),
    }
    messages.push(assistantMsg)

    for (const tc of toolCalls) {
      let result: unknown
      try {
        const args = JSON.parse(tc.args || '{}')
        result = await this.executeTool(tc.name, args, userId, userRoles)
      } catch (e: unknown) {
        result = { error: (e as Error).message }
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.name,
        content: JSON.stringify(result),
      })
    }

    await this.runAgentic(messages, model, baseUrl, apiKey, userId, userRoles, res, depth + 1)
  }

  private async executeTool(name: string, args: Record<string, unknown>, userId: string, userRoles: string[]) {
    const isAdmin = userRoles.includes('admin')
    const isManager = userRoles.includes('manager')

    switch (name) {
      case 'get_my_tasks': {
        const where: Record<string, unknown> = { assigneeUserId: userId }
        if (args.status) where.status = args.status
        const tasks = await this.prisma.task.findMany({
          where,
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            nodeInstance: {
              include: {
                definition: { select: { nodeName: true, nodeType: true } },
                instance: { include: { definition: { select: { name: true } } } },
              },
            },
          },
        })
        return tasks.map((t) => ({
          id: t.id,
          processName: t.nodeInstance.instance.definition.name,
          nodeName: t.nodeInstance.definition.nodeName,
          type: t.type,
          status: t.status,
          dueDate: t.dueDate,
          createdAt: t.createdAt,
        }))
      }

      case 'get_process_instances': {
        const limit = (args.limit as number) || 10
        const where: Record<string, unknown> = {}
        // Non-admin/manager users can only see their own
        if (!isAdmin && !isManager) where.createdBy = userId
        if (args.status) where.status = args.status
        const instances = await this.prisma.processInstance.findMany({
          where,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            definition: { select: { name: true } },
            creator: { select: { name: true } },
          },
        })
        return instances.map((i) => ({
          id: i.id,
          processName: (i as any).definition?.name,
          status: i.status,
          createdBy: (i as any).creator?.name,
          createdAt: i.createdAt,
          actualStartDate: i.actualStartDate,
        }))
      }

      case 'get_process_definitions': {
        const where: Record<string, unknown> = {}
        if (args.status) where.status = args.status
        else where.status = 'published'
        const defs = await this.prisma.processDefinition.findMany({
          where,
          take: 20,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, status: true, description: true, updatedAt: true },
        })
        return defs
      }

      case 'get_notifications': {
        const where: Record<string, unknown> = { userId }
        if (args.unreadOnly) where.status = 'unread'
        const notifications = await this.prisma.notification.findMany({
          where,
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, content: true, status: true, type: true, createdAt: true },
        })
        return notifications
      }

      case 'get_instance_detail': {
        const instanceId = args.instanceId as string
        const instance = await this.prisma.processInstance.findUnique({
          where: { id: instanceId },
          include: {
            definition: { select: { name: true } },
            nodeInstances: {
              include: {
                definition: { select: { nodeName: true, nodeType: true } },
                assignee: { select: { name: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
        if (!instance) return { error: '实例不存在' }
        // Permission check
        if (!isAdmin && !isManager && (instance as any).createdBy !== userId) {
          return { error: '无权限查看此流程实例' }
        }
        return {
          id: instance.id,
          processName: (instance as any).definition?.name,
          status: instance.status,
          createdAt: instance.createdAt,
          nodes: instance.nodeInstances.map((n) => ({
            nodeName: n.definition.nodeName,
            nodeType: n.definition.nodeType,
            status: n.status,
            assignee: n.assignee?.name,
            actualStartDate: n.actualStartDate,
            actualEndDate: n.actualEndDate,
          })),
        }
      }

      default:
        return { error: `未知工具: ${name}` }
    }
  }

  private defaultBaseUrl(type: string): string {
    const map: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      ollama: 'http://localhost:11434/v1',
    }
    return map[type] ?? 'https://api.openai.com/v1'
  }
}
