import { Injectable, NotFoundException, ConflictException, HttpException, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as https from 'https'
import * as http from 'http'
import * as dns from 'dns'
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateModelDto,
  UpdateModelDto,
  CreateSkillDto,
  UpdateSkillDto,
  CreateAgentRoleDto,
  UpdateAgentRoleDto,
  CreateFallbackDto,
  UpdateFallbackDto,
  ReorderFallbacksDto,
} from './dto/ai-settings.dto'

@Injectable()
export class AiSettingsService {
  constructor(private prisma: PrismaService) {}

  // ──── Providers ────────────────────────────────────────────────────────────

  async listProviders() {
    const providers = await this.prisma.aiProvider.findMany({
      orderBy: { createdAt: 'asc' },
      include: { models: { orderBy: { createdAt: 'asc' } } },
    })
    return providers.map((p) => this.safeProvider(p as any))
  }

  async createProvider(dto: CreateProviderDto) {
    const existing = await this.prisma.aiProvider.findUnique({ where: { name: dto.name } })
    if (existing) throw new ConflictException('已存在同名 Provider')
    const created = await this.prisma.aiProvider.create({
      data: {
        name: dto.name,
        type: dto.type,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey,
        isEnabled: dto.isEnabled ?? true,
        extra: (dto.extra ?? {}) as any,
      },
    })
    return this.safeProvider(created as any)
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    await this.getProvider(id)
    const updated = await this.prisma.aiProvider.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        ...(dto.apiKey !== undefined && { apiKey: dto.apiKey }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.extra !== undefined && { extra: dto.extra as any }),
      },
    })
    return this.safeProvider(updated as any)
  }

  async deleteProvider(id: string) {
    await this.getProvider(id)
    await this.prisma.aiProvider.delete({ where: { id } })
    return { success: true }
  }

  private async getProvider(id: string) {
    const p = await this.prisma.aiProvider.findUnique({ where: { id } })
    if (!p) throw new NotFoundException('Provider 不存在')
    return p
  }

  async testProvider(id: string): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const provider = await this.getProvider(id)
    if (!provider.isEnabled) {
      throw new HttpException('Provider 已禁用', HttpStatus.BAD_REQUEST)
    }
    if (!provider.apiKey && provider.type !== 'ollama') {
      return { ok: false, error: 'API Key 未配置' }
    }

    const baseUrl = (provider.baseUrl ?? this.defaultBaseUrl(provider.type as string)).replace(/\/$/, '')
    const authHeader: Record<string, string> = provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}
    const start = Date.now()

    const endpoints: Array<{ path: string; method?: string; body?: string }> = [
      { path: '/models' },
      { path: '/chat/completions', method: 'POST',
        body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }) },
    ]

    let lastError = ''
    for (const ep of endpoints) {
      try {
        const { status } = await this.ipv4Request(baseUrl, ep.path, {
          method: ep.method,
          headers: authHeader,
          body: ep.body,
          timeoutMs: 10000,
        })
        const latencyMs = Date.now() - start
        if (status === 200 || status === 401 || status === 403) {
          return { ok: status === 200, latencyMs, error: status === 200 ? undefined : `HTTP ${status} — API Key 无效或权限不足` }
        }
        if (status === 404) { lastError = `HTTP 404`; continue }
        return { ok: false, latencyMs, error: `HTTP ${status}` }
      } catch (e: unknown) {
        lastError = (e as Error).message
      }
    }
    return { ok: false, latencyMs: Date.now() - start, error: lastError }
  }

  async fetchProviderModels(id: string): Promise<{ models: string[] }> {
    const provider = await this.getProvider(id)
    if (!provider.isEnabled) {
      throw new HttpException('Provider 已禁用', HttpStatus.BAD_REQUEST)
    }

    // Anthropic has no public models listing endpoint — return a static curated list
    if (provider.type === 'anthropic') {
      return {
        models: [
          'claude-opus-4-5',
          'claude-sonnet-4-5',
          'claude-haiku-3-5',
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-haiku-20240307',
        ],
      }
    }

    const baseUrl = (provider.baseUrl ?? this.defaultBaseUrl(provider.type as string)).replace(/\/$/, '')
    const authHeader: Record<string, string> = provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}
    try {
      const { status, body } = await this.ipv4Request(baseUrl, '/models', {
        headers: authHeader,
        timeoutMs: 10000,
      })
      if (status !== 200) {
        throw new HttpException(`提供商返回错误: HTTP ${status}`, HttpStatus.BAD_GATEWAY)
      }
      const json = JSON.parse(body) as Record<string, unknown>

      // OpenAI-compatible format: { data: [{ id, ... }] }
      if (Array.isArray(json.data)) {
        const models = (json.data as Array<Record<string, unknown>>)
          .map((m) => m.id as string)
          .filter(Boolean)
          .sort()
        return { models }
      }

      // Ollama native format: { models: [{ name }] }
      if (Array.isArray(json.models)) {
        const models = (json.models as Array<Record<string, unknown>>)
          .map((m) => (m.name ?? m.id) as string)
          .filter(Boolean)
          .sort()
        return { models }
      }

      return { models: [] }
    } catch (e: unknown) {
      if (e instanceof HttpException) throw e
      throw new HttpException(`获取模型列表失败: ${(e as Error).message}`, HttpStatus.BAD_GATEWAY)
    }
  }

  /** 强制 IPv4 的 HTTP/HTTPS 请求，避免 Docker 容器 IPv6 不通的问题 */
  private ipv4Request(
    baseUrl: string,
    path: string,
    opts: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number } = {},
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(baseUrl + path)
      const isHttps = parsed.protocol === 'https:'
      const mod = isHttps ? https : http
      const { method = 'GET', headers = {}, body, timeoutMs = 10000 } = opts

      const doConnect = (addr: string) => {
        const extraHeaders: Record<string, string> = body
          ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) }
          : {}
        const req = mod.request(
          {
            host: addr,
            port: Number(parsed.port) || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method,
            headers: { Host: parsed.hostname, ...headers, ...extraHeaders },
            servername: parsed.hostname,
            timeout: timeoutMs,
          },
          (res) => {
            const chunks: Buffer[] = []
            res.on('data', (d: Buffer) => chunks.push(d))
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }))
          },
        )
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
        req.on('error', reject)
        if (body) req.write(body)
        req.end()
      }

      dns.resolve4(parsed.hostname, (err, addrs) => {
        if (err || !addrs?.length) {
          dns.lookup(parsed.hostname, { family: 4 }, (err2, addr) => {
            if (err2) return reject(err2)
            doConnect(addr)
          })
        } else {
          doConnect(addrs[0])
        }
      })
    })
  }

  private defaultBaseUrl(type: string): string {
    const map: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      ollama: 'http://localhost:11434/v1',
    }
    return map[type] ?? 'https://api.openai.com/v1'
  }

  // ──── Models ───────────────────────────────────────────────────────────────

  async listModels(type?: string, providerId?: string) {
    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (providerId) where.providerId = providerId
    const models = await this.prisma.aiModel.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
      include: { provider: true },
    })
    return models.map((m) => this.safeModel(m as any))
  }

  async createModel(dto: CreateModelDto) {
    await this.getProvider(dto.providerId)
    // If setting as default, clear existing defaults of same type
    if (dto.isDefault) {
      await this.prisma.aiModel.updateMany({
        where: { type: dto.type, isDefault: true },
        data: { isDefault: false },
      })
    }
    const created = await this.prisma.aiModel.create({
      data: {
        providerId: dto.providerId,
        name: dto.name,
        modelId: dto.modelId,
        type: dto.type,
        isDefault: dto.isDefault ?? false,
        contextWindow: dto.contextWindow,
        maxTokens: dto.maxTokens,
        isEnabled: dto.isEnabled ?? true,
        extra: (dto.extra ?? {}) as any,
      },
      include: { provider: true },
    })
    return this.safeModel(created as any)
  }

  async updateModel(id: string, dto: UpdateModelDto) {
    await this.getModel(id)
    if (dto.isDefault) {
      const model = await this.getModel(id)
      await this.prisma.aiModel.updateMany({
        where: { type: model.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }
    const updated = await this.prisma.aiModel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.modelId !== undefined && { modelId: dto.modelId }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.contextWindow !== undefined && { contextWindow: dto.contextWindow }),
        ...(dto.maxTokens !== undefined && { maxTokens: dto.maxTokens }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.extra !== undefined && { extra: dto.extra as any }),
      },
      include: { provider: true },
    })
    return this.safeModel(updated as any)
  }

  async deleteModel(id: string) {
    await this.getModel(id)
    await this.prisma.aiModel.delete({ where: { id } })
    return { success: true }
  }

  private async getModel(id: string) {
    const m = await this.prisma.aiModel.findUnique({ where: { id } })
    if (!m) throw new NotFoundException('Model 不存在')
    return m
  }

  // ──── Skills ───────────────────────────────────────────────────────────────

  async listSkills() {
    return this.prisma.agentSkill.findMany({ orderBy: { createdAt: 'asc' } })
  }

  async createSkill(dto: CreateSkillDto) {
    const existing = await this.prisma.agentSkill.findUnique({ where: { name: dto.name } })
    if (existing) throw new ConflictException('已存在同名技能')
    return this.prisma.agentSkill.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        config: (dto.config ?? {}) as any,
        isEnabled: dto.isEnabled ?? true,
      },
    })
  }

  async updateSkill(id: string, dto: UpdateSkillDto) {
    await this.getSkill(id)
    return this.prisma.agentSkill.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.config !== undefined && { config: dto.config as any }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    })
  }

  async deleteSkill(id: string) {
    await this.getSkill(id)
    await this.prisma.agentSkill.delete({ where: { id } })
    return { success: true }
  }

  private async getSkill(id: string) {
    const s = await this.prisma.agentSkill.findUnique({ where: { id } })
    if (!s) throw new NotFoundException('技能不存在')
    return s
  }

  // ──── Agent Roles ──────────────────────────────────────────────────────────

  async listAgentRoles() {
    const roles = await this.prisma.agentRole.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        model: { include: { provider: true } },
        skills: { include: { skill: true } },
      },
    })
    return roles.map((r) => this.safeRole(r as any))
  }

  async createAgentRole(dto: CreateAgentRoleDto) {
    const existing = await this.prisma.agentRole.findUnique({ where: { name: dto.name } })
    if (existing) throw new ConflictException('已存在同名角色')
    const { skillIds, ...rest } = dto
    const role = await this.prisma.agentRole.create({
      data: {
        name: rest.name,
        description: rest.description,
        systemPrompt: rest.systemPrompt,
        modelId: rest.modelId,
        temperature: rest.temperature ?? 0.7,
        maxTokens: rest.maxTokens,
        isEnabled: rest.isEnabled ?? true,
      },
    })
    if (skillIds?.length) {
      await this.prisma.agentRoleSkill.createMany({
        data: skillIds.map((skillId) => ({ agentRoleId: role.id, skillId })),
      })
    }
    return this.getAgentRole(role.id)
  }

  async updateAgentRole(id: string, dto: UpdateAgentRoleDto) {
    await this.getAgentRole(id)
    const { skillIds, ...rest } = dto
    await this.prisma.agentRole.update({
      where: { id },
      data: {
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.description !== undefined && { description: rest.description }),
        ...(rest.systemPrompt !== undefined && { systemPrompt: rest.systemPrompt }),
        ...(rest.modelId !== undefined && { modelId: rest.modelId }),
        ...(rest.temperature !== undefined && { temperature: rest.temperature }),
        ...(rest.maxTokens !== undefined && { maxTokens: rest.maxTokens }),
        ...(rest.isEnabled !== undefined && { isEnabled: rest.isEnabled }),
      },
    })
    if (skillIds !== undefined) {
      await this.prisma.agentRoleSkill.deleteMany({ where: { agentRoleId: id } })
      if (skillIds.length) {
        await this.prisma.agentRoleSkill.createMany({
          data: skillIds.map((skillId) => ({ agentRoleId: id, skillId })),
        })
      }
    }
    return this.getAgentRole(id)
  }

  async deleteAgentRole(id: string) {
    await this.getAgentRole(id)
    await this.prisma.agentRole.delete({ where: { id } })
    return { success: true }
  }

  async getAgentRole(id: string) {
    const r = await this.prisma.agentRole.findUnique({
      where: { id },
      include: {
        model: { include: { provider: true } },
        skills: { include: { skill: true } },
      },
    })
    if (!r) throw new NotFoundException('角色不存在')
    return this.safeRole(r as any)
  }

  // ──── ModelFallbackChain ───────────────────────────────────────────────────

  async listFallbacks(modelType?: string) {
    const items = await this.prisma.modelFallbackChain.findMany({
      where: modelType ? { modelType } : undefined,
      orderBy: [{ modelType: 'asc' }, { sortOrder: 'asc' }],
      include: { model: { include: { provider: true } } },
    })
    return items.map((f) => this.safeFallback(f as any))
  }

  async createFallback(dto: CreateFallbackDto) {
    // Determine next sortOrder if not provided
    let sortOrder = dto.sortOrder
    if (sortOrder === undefined) {
      const last = await this.prisma.modelFallbackChain.findFirst({
        where: { modelType: dto.modelType },
        orderBy: { sortOrder: 'desc' },
      })
      sortOrder = last ? last.sortOrder + 1 : 0
    }
    const created = await this.prisma.modelFallbackChain.create({
      data: {
        modelType: dto.modelType,
        modelId: dto.modelId,
        sortOrder,
        isEnabled: dto.isEnabled ?? true,
        note: dto.note,
      },
      include: { model: { include: { provider: true } } },
    })
    return this.safeFallback(created as any)
  }

  async updateFallback(id: string, dto: UpdateFallbackDto) {
    const existing = await this.prisma.modelFallbackChain.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Fallback 条目不存在')
    const updated = await this.prisma.modelFallbackChain.update({
      where: { id },
      data: {
        ...(dto.modelId !== undefined && { modelId: dto.modelId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
      include: { model: { include: { provider: true } } },
    })
    return this.safeFallback(updated as any)
  }

  async deleteFallback(id: string) {
    const existing = await this.prisma.modelFallbackChain.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Fallback 条目不存在')
    await this.prisma.modelFallbackChain.delete({ where: { id } })
    return { success: true }
  }

  /** Reorder an entire fallback chain — two-phase update to avoid unique(modelType, sortOrder) conflicts */
  async reorderFallbacks(dto: ReorderFallbacksDto) {
    const OFFSET = 100_000 // temporary offset outside normal range
    await this.prisma.$transaction([
      // Phase 1: shift all to offset range so no collision during phase 2
      ...dto.ids.map((id, index) =>
        this.prisma.modelFallbackChain.update({
          where: { id },
          data: { sortOrder: OFFSET + index },
        }),
      ),
      // Phase 2: assign final sequential values
      ...dto.ids.map((id, index) =>
        this.prisma.modelFallbackChain.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    ])
    return this.listFallbacks(dto.modelType)
  }

  // ──── Export / Import ──────────────────────────────────────────────────────

  /** Export all AI settings as a portable JSON snapshot (API keys included). */
  async exportConfig() {
    const [providers, models, skills, roles, fallbacks] = await Promise.all([
      this.prisma.aiProvider.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.aiModel.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.agentSkill.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.agentRole.findMany({
        orderBy: { createdAt: 'asc' },
        include: { skills: { include: { skill: true } } },
      }),
      this.prisma.modelFallbackChain.findMany({
        orderBy: [{ modelType: 'asc' }, { sortOrder: 'asc' }],
        include: { model: true },
      }),
    ])

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      providers: providers.map((p) => ({
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        isEnabled: p.isEnabled,
        extra: p.extra,
      })),
      models: models.map((m) => {
        const providerName = providers.find((p) => p.id === m.providerId)?.name ?? ''
        return {
          providerName,
          modelId: m.modelId,
          name: m.name,
          type: m.type,
          isDefault: m.isDefault,
          isEnabled: m.isEnabled,
          contextWindow: m.contextWindow,
          maxTokens: m.maxTokens,
        }
      }),
      skills: skills.map((s) => ({
        name: s.name,
        description: s.description,
        type: s.type,
        config: s.config,
        isEnabled: s.isEnabled,
      })),
      agentRoles: (roles as any[]).map((r) => ({
        name: r.name,
        description: r.description,
        systemPrompt: r.systemPrompt,
        modelName: r.modelId ? models.find((m) => m.id === r.modelId)?.name ?? null : null,
        temperature: r.temperature,
        maxTokens: r.maxTokens,
        isEnabled: r.isEnabled,
        skillNames: r.skills.map((rs: any) => rs.skill.name),
      })),
      fallbacks: fallbacks.map((f: any) => ({
        modelType: f.modelType,
        modelName: f.model?.name ?? '',
        sortOrder: f.sortOrder,
        isEnabled: f.isEnabled,
        note: f.note,
      })),
    }
  }

  /** Upsert AI settings from a JSON snapshot. Returns a summary of created/updated counts. */
  async importConfig(data: ReturnType<typeof this.exportConfig> extends Promise<infer T> ? T : never) {
    const summary = { providers: 0, models: 0, skills: 0, agentRoles: 0, fallbacks: 0 }
    const importedModels = data.models ?? []
    const defaultTypes = [...new Set(importedModels.filter((m) => m.isDefault).map((m) => m.type))]
    const assignedDefaults = new Set<string>()

    // 1. Providers (upsert by name)
    const providerNameToId: Record<string, string> = {}
    for (const p of data.providers ?? []) {
      const upserted = await this.prisma.aiProvider.upsert({
        where: { name: p.name },
        create: {
          name: p.name,
          type: p.type,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
          isEnabled: p.isEnabled ?? true,
          extra: (p.extra ?? {}) as any,
        },
        update: {
          type: p.type,
          baseUrl: p.baseUrl,
          ...(p.apiKey && { apiKey: p.apiKey }),
          extra: (p.extra ?? {}) as any,
        },
      })
      providerNameToId[p.name] = upserted.id
      summary.providers++
    }

    // 2. Models (find by providerId+modelId+type, else create)
    const modelNameToId: Record<string, string> = {}
    if (defaultTypes.length) {
      await this.prisma.aiModel.updateMany({
        where: { type: { in: defaultTypes }, isDefault: true },
        data: { isDefault: false },
      })
    }

    for (const m of importedModels) {
      const providerId = providerNameToId[m.providerName]
      if (!providerId) continue
      const isDefault = !!m.isDefault && !assignedDefaults.has(m.type)
      if (isDefault) assignedDefaults.add(m.type)
      const existing = await this.prisma.aiModel.findFirst({
        where: { providerId, modelId: m.modelId, type: m.type },
      })
      let record: any
      if (existing) {
        record = await this.prisma.aiModel.update({
          where: { id: existing.id },
          data: {
            name: m.name,
            isDefault,
            contextWindow: m.contextWindow,
            maxTokens: m.maxTokens,
          },
        })
      } else {
        record = await this.prisma.aiModel.create({
          data: {
            providerId,
            modelId: m.modelId,
            name: m.name,
            type: m.type,
            isDefault,
            isEnabled: m.isEnabled ?? true,
            contextWindow: m.contextWindow,
            maxTokens: m.maxTokens,
          },
        })
      }
      modelNameToId[m.name] = record.id
      summary.models++
    }

    // 3. Skills (upsert by name)
    const skillNameToId: Record<string, string> = {}
    for (const s of data.skills ?? []) {
      const upserted = await this.prisma.agentSkill.upsert({
        where: { name: s.name },
        create: {
          name: s.name,
          description: s.description,
          type: s.type,
          config: (s.config ?? {}) as any,
          isEnabled: s.isEnabled ?? true,
        },
        update: {
          description: s.description,
          type: s.type,
          config: (s.config ?? {}) as any,
        },
      })
      skillNameToId[s.name] = upserted.id
      summary.skills++
    }

    // 4. Agent Roles (upsert by name)
    for (const r of data.agentRoles ?? []) {
      const modelId = r.modelName ? modelNameToId[r.modelName] ?? null : null
      const upserted = await this.prisma.agentRole.upsert({
        where: { name: r.name },
        create: {
          name: r.name,
          description: r.description,
          systemPrompt: r.systemPrompt,
          modelId,
          temperature: r.temperature ?? 0.7,
          maxTokens: r.maxTokens,
          isEnabled: r.isEnabled ?? true,
        },
        update: {
          description: r.description,
          systemPrompt: r.systemPrompt,
          modelId,
          temperature: r.temperature ?? 0.7,
          maxTokens: r.maxTokens,
        },
      })
      // Sync skills
      if (r.skillNames?.length) {
        await this.prisma.agentRoleSkill.deleteMany({ where: { agentRoleId: upserted.id } })
        const validSkillIds = r.skillNames.map((n: string) => skillNameToId[n]).filter(Boolean)
        if (validSkillIds.length) {
          await this.prisma.agentRoleSkill.createMany({
            data: validSkillIds.map((skillId: string) => ({ agentRoleId: upserted.id, skillId })),
            skipDuplicates: true,
          })
        }
      }
      summary.agentRoles++
    }

    // 5. Fallback chains (delete existing, recreate)
    if (data.fallbacks?.length) {
      const modelTypes = [...new Set(data.fallbacks.map((f: any) => f.modelType))]
      await this.prisma.modelFallbackChain.deleteMany({
        where: { modelType: { in: modelTypes } },
      })
      for (const f of data.fallbacks) {
        const modelId = modelNameToId[f.modelName]
        if (!modelId) continue
        await this.prisma.modelFallbackChain.create({
          data: {
            modelType: f.modelType,
            modelId,
            sortOrder: f.sortOrder,
            isEnabled: f.isEnabled ?? true,
            note: f.note,
          },
        })
        summary.fallbacks++
      }
    }

    return { success: true, summary }
  }

  // ──── Sanitization helpers (strip sensitive fields from responses) ─────────

  private safeProvider(p: Record<string, unknown>): Record<string, unknown> {
    const { apiKey, ...rest } = p
    return { ...rest, hasApiKey: !!apiKey }
  }

  private safeModel(m: Record<string, unknown>): Record<string, unknown> {
    if (!m) return m
    if (m.provider && typeof m.provider === 'object') {
      return { ...m, provider: this.safeProvider(m.provider as Record<string, unknown>) }
    }
    return m
  }

  private safeRole(r: Record<string, unknown>): Record<string, unknown> {
    if (!r) return r
    if (r.model && typeof r.model === 'object') {
      return { ...r, model: this.safeModel(r.model as Record<string, unknown>) }
    }
    return r
  }

  private safeFallback(f: Record<string, unknown>): Record<string, unknown> {
    if (!f) return f
    if (f.model && typeof f.model === 'object') {
      return { ...f, model: this.safeModel(f.model as Record<string, unknown>) }
    }
    return f
  }

  // ──── MinerU System Config ─────────────────────────────────────────────────

  async getMineruConfig() {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'mineru_api_key' } })
    return {
      hasKey: !!(cfg?.value),
      apiKey: cfg?.value ? '***' + cfg.value.slice(-4) : '',
    }
  }

  async saveMineruConfig(apiKey: string) {
    await this.prisma.systemConfig.upsert({
      where: { key: 'mineru_api_key' },
      create: { key: 'mineru_api_key', value: apiKey },
      update: { value: apiKey },
    })
    return { success: true }
  }
}
