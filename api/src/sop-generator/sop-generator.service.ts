import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { Response } from 'express'
import { SaveSopDto, GenerateSopDto } from './dto/sop.dto'
import { AuditLogService } from '../audit-log/audit-log.service'

@Injectable()
export class SopGeneratorService {
  private readonly aiServiceUrl: string

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private auditLog: AuditLogService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://ai-service:5000'
  }

  /**
   * Proxy the SSE stream from AI service to the client response.
   */
  async streamGenerate(dto: GenerateSopDto, res: Response): Promise<void> {
    const aiUrl = `${this.aiServiceUrl}/ai/sop/generate`

    const upstream = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: dto.description,
        domain: dto.domain ?? '通用',
        roleHints: dto.roleHints ?? [],
        estimatedSteps: dto.estimatedSteps ?? 6,
        referenceContext: dto.referenceContext ?? null,
      }),
    })

    if (!upstream.ok) {
      res.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'AI 服务调用失败' } })}\n\n`)
      res.end()
      return
    }

    const reader = upstream.body!.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
    } finally {
      res.end()
    }
  }

  /**
   * Save the generated SOP as a ProcessDefinition draft with NodeDefinitions.
   */
  async saveSop(dto: SaveSopDto, userId: string) {
    const { processName, nodes, edges } = dto

    if (!nodes || nodes.length === 0) {
      throw new BadRequestException('节点列表不能为空')
    }

    // Build ReactFlow-compatible graphJson
    const graphJson = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          label: n.label,
          assigneeRole: n.assigneeRole,
          dueHours: n.dueHours,
          enableAiInspection: n.enableAiInspection ?? false,
          acceptanceCriteria: n.acceptanceCriteria ?? '',
          inputSpec: (n.inputFields ?? []).map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: false,
          })),
          outputSpec: (n.outputFields ?? []).map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
          })),
        },
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    }

    // Ensure unique name for the draft
    const existing = await this.prisma.processDefinition.findFirst({
      where: { name: processName, status: 'draft' },
    })

    const finalName = existing ? `${processName}（AI生成）` : processName

    const definition = await this.prisma.processDefinition.create({
      data: {
        name: finalName,
        graphJson: graphJson as any,
        status: 'draft',
        version: 1,
        description: dto.description ?? null,
        createdBy: userId,
      },
    })

    // Sync NodeDefinitions
    await this._syncNodeDefinitions(definition.id, nodes, edges)

    await this.auditLog.record({
      userId,
      action: 'ai_generate_sop',
      resourceType: 'process_definition',
      resourceId: definition.id,
      details: { name: finalName, nodeCount: nodes.length },
    })

    return { id: definition.id, name: finalName }
  }

  private async _syncNodeDefinitions(
    processId: string,
    nodes: SaveSopDto['nodes'],
    edges: SaveSopDto['edges'],
  ) {
    const taskNodes = nodes.filter((n) => n.type === 'task' || n.type === 'approval')

    const records = taskNodes.map((n, idx) => ({
      id: n.id,
      processId,
      nodeName: n.label,
      nodeType: n.type,
      inputSpec: (n.inputFields ?? []).map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: false,
      })) as any,
      outputSpec: (n.outputFields ?? []).map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
      })) as any,
      actionSpec: {
        assigneeRole: n.assigneeRole ?? '',
        dueHours: n.dueHours ?? 48,
        sopContent: n.sopContent ?? '',
        instructions: n.sopContent ?? '',
        checklist: (n.checklist ?? []).map((c, i) => ({
          id: c.id || `c_${n.id}_${i + 1}`,
          label: c.label,
          required: c.required ?? true,
        })),
      } as any,
      aiConfig: {
        enabled: n.enableAiInspection ?? false,
        acceptanceCriteria: n.acceptanceCriteria ?? '',
        knowledgeBaseIds: [],
      } as any,
      progressConfig: {} as any,
      sortOrder: idx,
    }))

    if (records.length > 0) {
      await this.prisma.nodeDefinition.createMany({ data: records, skipDuplicates: true })
    }
  }
}
