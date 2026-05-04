import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SkillChatService } from '../skill-chat/skill-chat.service'
import { CreateApiKeyDto } from './dto/open-api.dto'
import { Response } from 'express'
import * as crypto from 'crypto'

@Injectable()
export class OpenApiService {
  constructor(
    private prisma: PrismaService,
    private skillChatService: SkillChatService,
  ) {}

  // ──── API Key management ────────────────────────────────────────────────────

  async createKey(userId: string, userRoles: string[], dto: CreateApiKeyDto) {
    const canBindAgentRole = userRoles.some((role) => role === 'admin' || role === 'designer')

    if (dto.agentRoleId && !canBindAgentRole) {
      throw new NotFoundException('无权绑定指定 AI 角色')
    }

    if (dto.agentRoleId) {
      const role = await this.prisma.agentRole.findFirst({
        where: { id: dto.agentRoleId, isEnabled: true },
        select: { id: true },
      })
      if (!role) {
        throw new NotFoundException('AI 角色不存在或已禁用')
      }
    }

    if (dto.knowledgeBaseIds?.length) {
      const matched = await this.prisma.knowledgeBase.count({
        where: { id: { in: dto.knowledgeBaseIds } },
      })
      if (matched !== dto.knowledgeBaseIds.length) {
        throw new NotFoundException('部分知识库不存在')
      }
    }

    const rawKey = `gf_sk_${crypto.randomBytes(24).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.slice(0, 14) // "gf_sk_" + first 8 hex chars

    const record = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash,
        keyPrefix,
        userId,
        knowledgeBaseIds: (dto.knowledgeBaseIds ?? []) as any,
        agentRoleId: dto.agentRoleId ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    })

    // Return the full raw key only on creation — never stored in plain text
    return { ...this.safeKey(record), rawKey }
  }

  async listKeys(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return keys.map(this.safeKey)
  }

  async revokeKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id: keyId, userId } })
    if (!key) throw new NotFoundException('API 密钥不存在')
    await this.prisma.apiKey.update({ where: { id: keyId }, data: { isEnabled: false } })
    return { success: true }
  }

  async deleteKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id: keyId, userId } })
    if (!key) throw new NotFoundException('API 密钥不存在')
    await this.prisma.apiKey.delete({ where: { id: keyId } })
    return { success: true }
  }

  // ──── OpenAI-compatible chat endpoint ──────────────────────────────────────

  async chatCompletions(
    apiKeyRecord: any,
    messages: Array<{ role: string; content: string }>,
    knowledgeBaseIds: string[],
    agentRoleId: string | undefined,
    stream: boolean,
    res: Response,
  ) {
    // Merge API key scopes with request params (key scope takes priority if set)
    const effectiveKbIds = (apiKeyRecord.knowledgeBaseIds as string[]).length > 0
      ? (apiKeyRecord.knowledgeBaseIds as string[])
      : knowledgeBaseIds

    const effectiveRoleId = apiKeyRecord.agentRoleId ?? agentRoleId

    // Extract the last user message for the skill-chat service
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) {
      if (stream) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: '消息列表中缺少 user 角色的消息' })}\n\n`)
        res.end()
      } else {
        res.status(400).json({ error: { message: 'No user message found', type: 'invalid_request_error' } })
      }
      return
    }

    const history = messages
      .slice(0, messages.lastIndexOf(lastUserMsg))
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders()

      // Wrap SkillChatService SSE output in OpenAI-compatible format
      const fakeRes = this.buildOpenAiStreamWrapper(res)
      await this.skillChatService.chat(
        apiKeyRecord.userId,
        apiKeyRecord.user.userRoles?.map((item: any) => item.role.name) ?? [],
        lastUserMsg.content,
        history,
        effectiveKbIds,
        effectiveRoleId,
        fakeRes,
      )
    } else {
      // Non-streaming: collect the full response then return as JSON
      const state = { chunks: [] as string[], error: null as string | null }
      const fakeRes = this.buildCollectorResponse(state)
      await this.skillChatService.chat(
        apiKeyRecord.userId,
        apiKeyRecord.user.userRoles?.map((item: any) => item.role.name) ?? [],
        lastUserMsg.content,
        history,
        effectiveKbIds,
        effectiveRoleId,
        fakeRes as any,
      )
      if (state.error) {
        res.status(502).json({
          error: { message: state.error, type: 'api_error' },
        })
        return
      }

      const content = state.chunks.join('')
      const completionId = `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 29)}`
      res.json({
        id: completionId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'geniusflow',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      })
    }
  }

  /** Wraps the express Response to translate our SSE format → OpenAI SSE format */
  private buildOpenAiStreamWrapper(res: Response): any {
    const completionId = `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 29)}`
    const created = Math.floor(Date.now() / 1000)

    return {
      write: (data: string) => {
        if (!data.startsWith('data: ')) return
        const payload = data.slice(6).trim()
        try {
          const chunk = JSON.parse(payload)
          if (chunk.type === 'text' && chunk.content) {
            const openAiChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: 'geniusflow',
              choices: [{ index: 0, delta: { content: chunk.content }, finish_reason: null }],
            }
            res.write(`data: ${JSON.stringify(openAiChunk)}\n\n`)
          } else if (chunk.type === 'done') {
            const finalChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: 'geniusflow',
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            }
            res.write(`data: ${JSON.stringify(finalChunk)}\n\n`)
            res.write('data: [DONE]\n\n')
          } else if (chunk.type === 'error') {
            res.write(`data: ${JSON.stringify({ error: { message: chunk.content, type: 'api_error' } })}\n\n`)
            res.write('data: [DONE]\n\n')
          }
        } catch {
          // ignore malformed
        }
      },
      end: () => res.end(),
      setHeader: () => {},
      flushHeaders: () => {},
    }
  }

  /** Collects streamed text chunks into an array for non-streaming mode */
  private buildCollectorResponse(state: { chunks: string[]; error: string | null }): Partial<Response> {
    return {
      write: (data: string) => {
        if (!data.startsWith('data: ')) return true
        const payload = data.slice(6).trim()
        try {
          const chunk = JSON.parse(payload)
          if (chunk.type === 'text' && chunk.content) state.chunks.push(chunk.content)
          if (chunk.type === 'error' && chunk.content) state.error = chunk.content
        } catch { /* ignore */ }
        return true
      },
      end: () => {},
      setHeader: () => {},
      flushHeaders: () => {},
    } as any
  }

  private safeKey(key: any) {
    const { keyHash: _kh, ...rest } = key
    return rest
  }
}
