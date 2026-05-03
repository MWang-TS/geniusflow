import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'

@Injectable()
export class TemplatesService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async findAll(query: { page: number; pageSize: number; category?: string; keyword?: string }) {
    const { page, pageSize, category, keyword } = query
    const where: Record<string, unknown> = { isTemplate: true }
    if (category) where.category = category
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ]
    }

    const [list, total] = await Promise.all([
      this.prisma.processDefinition.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          nodes: { select: { id: true } },
        },
      }),
      this.prisma.processDefinition.count({ where }),
    ])

    return {
      list: list.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        nodeCount: t.nodes.length,
        isPreset: t.isPreset,
        createdAt: t.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async clone(id: string, userId: string) {
    const template = await this.prisma.processDefinition.findUnique({
      where: { id },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!template) throw new NotFoundException('模板不存在')
    if (!template.isTemplate) throw new NotFoundException('该流程不是模板')

    // Generate a unique clone name by checking for existing copies
    const baseName = `${template.name} (副本)`
    const existing = await this.prisma.processDefinition.findMany({
      where: { name: { startsWith: baseName }, version: 1 },
      select: { name: true },
    })
    const cloneName = existing.length === 0 ? baseName : `${baseName} ${existing.length + 1}`

    // Remap graphJson references to the new IDs
    const origGraph = template.graphJson as { nodes: Array<{ id: string; [k: string]: unknown }>; edges: Array<{ id: string; source: string; target: string; [k: string]: unknown }> }

    // Build a mapping of old node IDs to new unique IDs so that
    // the cloned graphJson references and NodeDefinition PKs stay consistent.
    const nodeIdMap = new Map<string, string>()
    let seq = 0
    const genId = () => `node-${Date.now()}-${(seq++).toString().padStart(4, '0')}-${Math.random().toString(36).slice(2, 8)}`

    // Include all node IDs from both NodeDefinition rows and graphJson nodes
    const allNodeIds = new Set<string>([
      ...template.nodes.map((n) => n.id),
      ...origGraph.nodes.map((n) => n.id),
    ])
    for (const oldId of allNodeIds) {
      nodeIdMap.set(oldId, genId())
    }

    const newGraphJson = {
      nodes: origGraph.nodes.map((n, i) => ({
        ...n,
        id: nodeIdMap.get(n.id) ?? n.id,
        // Ensure position and label exist so the canvas renders correctly
        position: (n.position as object | undefined) ?? { x: 250, y: 50 + i * 120 },
        data: (n.data as object | undefined) ?? { label: (n.nodeName as string | undefined) ?? String(n.type) },
      })),
      edges: origGraph.edges.map((e, i) => ({
        ...e,
        id: `edge-${Date.now()}-${i}`,
        source: nodeIdMap.get(e.source) ?? e.source,
        target: nodeIdMap.get(e.target) ?? e.target,
      })),
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const newDef = await tx.processDefinition.create({
        data: {
          name: cloneName,
          version: 1,
          graphJson: newGraphJson,
          status: 'draft',
          description: template.description,
          category: template.category,
          isTemplate: false,
          isPreset: false,
          createdBy: userId,
        },
      })

      for (const node of template.nodes) {
        const newNodeId = nodeIdMap.get(node.id)!
        await tx.nodeDefinition.create({
          data: {
            id: newNodeId,
            processId: newDef.id,
            nodeName: node.nodeName,
            nodeType: node.nodeType,
            inputSpec: node.inputSpec as object,
            actionSpec: node.actionSpec as object,
            outputSpec: node.outputSpec as object,
            aiConfig: node.aiConfig as object,
            progressConfig: node.progressConfig as object,
            sortOrder: node.sortOrder,
          },
        })
      }

      return newDef
    })

    await this.auditLog.record({
      userId,
      action: 'clone_template',
      resourceType: 'process_definition',
      resourceId: id,
      details: { clonedId: result.id, name: result.name },
    })

    return { id: result.id, name: result.name, status: result.status }
  }
}
