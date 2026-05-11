import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'
import { CreateProcessDefinitionDto, UpdateProcessDefinitionDto, QueryProcessDefinitionDto } from './dto/create-process-definition.dto'

@Injectable()
export class ProcessDefinitionsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async create(dto: CreateProcessDefinitionDto, userId: string) {
    const { name, graphJson } = dto

    const existing = await this.prisma.processDefinition.findFirst({
      where: { name, status: 'draft' },
    })
    if (existing) {
      throw new ConflictException('已存在同名的草稿流程')
    }

    // 自动生成 SOP 编号 (SOP-001, SOP-002, ...)
    const count = await this.prisma.processDefinition.count()
    const sopCode = `SOP-${String(count + 1).padStart(3, '0')}`

    const definition = await this.prisma.processDefinition.create({
      data: {
        name,
        graphJson: graphJson as any,
        status: 'draft',
        version: 1,
        sopCode,
        createdBy: userId,
      },
    })

    await this.syncNodeDefinitions(definition.id, graphJson)

    return this.findOne(definition.id)
  }

  async findAll(query: QueryProcessDefinitionDto) {
    const { status, keyword, page = 1, pageSize = 20 } = query
    const pageNum = Math.max(1, page)
    const size = Math.min(100, Math.max(1, pageSize))

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (keyword) {
      where.name = { contains: keyword, mode: 'insensitive' }
    }

    const [list, total] = await Promise.all([
      this.prisma.processDefinition.findMany({
        where,
        skip: (pageNum - 1) * size,
        take: size,
        orderBy: { updatedAt: 'desc' },
        include: {
          nodes: true,
          creator: { select: { id: true, name: true } },
        },
      }),
      this.prisma.processDefinition.count({ where }),
    ])

    return {
      list: list.map((d) => ({
        id: d.id,
        name: d.name,
        version: d.version,
        status: d.status,
        nodeCount: d.nodes.length,
        createdBy: d.creator,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      pagination: {
        page: pageNum,
        pageSize: size,
        total,
        totalPages: Math.ceil(total / size),
      },
    }
  }

  async findOne(id: string) {
    const definition = await this.prisma.processDefinition.findUnique({
      where: { id },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!definition) {
      throw new NotFoundException('流程定义不存在')
    }
    return definition
  }

  async update(id: string, dto: UpdateProcessDefinitionDto) {
    const definition = await this.findOne(id)

    if (definition.status !== 'draft') {
      throw new ConflictException('只有草稿状态的流程可以编辑')
    }

    const data: Record<string, unknown> = {}
    if (dto.name) data.name = dto.name
    if (dto.graphJson) data.graphJson = dto.graphJson as any

    await this.prisma.processDefinition.update({
      where: { id },
      data,
    })

    if (dto.graphJson) {
      await this.syncNodeDefinitions(id, dto.graphJson)
    }

    return this.findOne(id)
  }

  async remove(id: string) {
    const definition = await this.findOne(id)

    if (definition.status === 'published') {
      throw new ConflictException('已发布的流程不能删除，请先归档')
    }

    await this.prisma.processDefinition.delete({ where: { id } })
    return { success: true }
  }

  async publish(id: string, userId: string) {
    const definition = await this.findOne(id)

    if (definition.status === 'published') {
      throw new ConflictException('该流程已发布')
    }

    this.validateGraph(definition.graphJson as { nodes: Array<{ type: string }>; edges: Array<{ source: string; target: string }> })

    await this.prisma.processDefinition.update({
      where: { id },
      data: { status: 'published' },
    })

    await this.auditLog.record({
      userId,
      action: 'publish_process',
      resourceType: 'process_definition',
      resourceId: id,
      details: { name: definition.name, version: definition.version },
    })

    return {
      id: definition.id,
      version: definition.version,
      status: 'published',
    }
  }

  private validateGraph(graphJson: { nodes: Array<{ id?: string; type: string; data?: { label?: string } }>; edges: Array<{ source: string; target: string }> }) {
    const { nodes, edges } = graphJson

    const hasStart = nodes.some((n) => n.type === 'start')
    const hasEnd = nodes.some((n) => n.type === 'end')
    if (!hasStart) throw new ConflictException('流程缺少开始节点')
    if (!hasEnd) throw new ConflictException('流程缺少结束节点')

    const connectedNodeIds = new Set<string>()
    edges.forEach((e) => {
      connectedNodeIds.add(e.source)
      connectedNodeIds.add(e.target)
    })

    const orphanNodes = nodes.filter(
      (n) => n.type !== 'start' && n.type !== 'end' && !connectedNodeIds.has(n.id!),
    )
    if (orphanNodes.length > 0) {
      const labels = orphanNodes.map((n) => `"${n.data?.label || n.id}"`).join('、')
      throw new ConflictException(`存在未连接的孤立节点: ${labels}`)
    }
  }

  private async syncNodeDefinitions(
    processId: string,
    graphJson: { nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data?: { label?: string } }> },
  ) {
    const graphNodeIds = graphJson.nodes.map((n) => n.id)

    const existingNodes = await this.prisma.nodeDefinition.findMany({
      where: { processId },
    })
    const existingNodeIds = existingNodes.map((n) => n.id)

    const toDelete = existingNodes.filter((n) => !graphNodeIds.includes(n.id))
    if (toDelete.length > 0) {
      await this.prisma.nodeDefinition.deleteMany({
        where: { id: { in: toDelete.map((n) => n.id) } },
      })
    }

    for (let i = 0; i < graphJson.nodes.length; i++) {
      const node = graphJson.nodes[i]
      const defaultNodeData = this.getDefaultNodeData(node.type)
      const label = node.data?.label || defaultNodeData.nodeName

      const upsertData = {
        processId,
        nodeName: label,
        nodeType: node.type,
        sortOrder: i,
        inputSpec: defaultNodeData.inputSpec,
        actionSpec: defaultNodeData.actionSpec,
        outputSpec: defaultNodeData.outputSpec,
        aiConfig: defaultNodeData.aiConfig,
        progressConfig: defaultNodeData.progressConfig,
      }

      if (existingNodeIds.includes(node.id)) {
        const existing = existingNodes.find((n) => n.id === node.id)!
        await this.prisma.nodeDefinition.update({
          where: { id: node.id },
          data: {
            ...upsertData,
            inputSpec: existing.inputSpec ?? upsertData.inputSpec,
            actionSpec: existing.actionSpec ?? upsertData.actionSpec,
            outputSpec: existing.outputSpec ?? upsertData.outputSpec,
            aiConfig: existing.aiConfig ?? upsertData.aiConfig,
            progressConfig: existing.progressConfig ?? upsertData.progressConfig,
          },
        })
      } else {
        await this.prisma.nodeDefinition.create({
          data: { id: node.id, ...upsertData },
        })
      }
    }
  }

  private getDefaultNodeData(type: string) {
    switch (type) {
      case 'start':
        return {
          nodeName: '开始',
          inputSpec: {},
          actionSpec: {},
          outputSpec: {},
          aiConfig: { inspector: { enabled: false }, assistant: { enabled: false } },
          progressConfig: { plannedDuration: 0, isMilestone: false, needApproval: false, requireAiReportBeforeApproval: false },
        }
      case 'end':
        return {
          nodeName: '结束',
          inputSpec: {},
          actionSpec: {},
          outputSpec: {},
          aiConfig: { inspector: { enabled: false }, assistant: { enabled: false } },
          progressConfig: { plannedDuration: 0, isMilestone: false, needApproval: false, requireAiReportBeforeApproval: false },
        }
      case 'task':
      default:
        return {
          nodeName: '新任务',
          inputSpec: { dataSchema: [], acceptanceCriteria: '', source: 'manual', timeConstraint: { daysFromStart: 1 } },
          actionSpec: { instructions: '请在此填写行动说明', requirements: '', aiAssistance: [], timeConstraint: { estimatedDays: 1 } },
          outputSpec: { deliverables: [], qualityStandard: '', acceptanceCondition: '', timeConstraint: { daysFromStart: 2 } },
          aiConfig: { inspector: { enabled: false, mode: 'normal', promptTemplate: '' }, assistant: { enabled: false, promptTemplate: '' } },
          progressConfig: { plannedDuration: 2, isMilestone: false, needApproval: true, requireAiReportBeforeApproval: false },
        }
    }
  }
}
