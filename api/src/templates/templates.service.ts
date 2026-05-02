import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { page: number; pageSize: number; category?: string }) {
    const { page, pageSize, category } = query
    const where: Record<string, unknown> = { isTemplate: true }
    if (category) where.category = category

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

    const cloneName = `${template.name} (副本)`
    const newDef = await this.prisma.processDefinition.create({
      data: {
        name: cloneName,
        version: 1,
        graphJson: template.graphJson as object,
        status: 'draft',
        description: template.description,
        category: template.category,
        isTemplate: false,
        isPreset: false,
        createdBy: userId,
      },
    })

    for (const node of template.nodes) {
      await this.prisma.nodeDefinition.create({
        data: {
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

    return { id: newDef.id, name: newDef.name, status: newDef.status }
  }
}
