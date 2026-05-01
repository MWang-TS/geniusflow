import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { type?: string; status?: string; page: number; pageSize: number }, userId: string) {
    const { type, status, page, pageSize } = query

    const where: Record<string, unknown> = { assigneeUserId: userId }
    if (type) where.type = type
    if (status) where.status = status

    const [list, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          nodeInstance: {
            include: {
              definition: { select: { id: true, nodeName: true, nodeType: true } },
              instance: { include: { definition: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      this.prisma.task.count({ where }),
    ])

    return {
      list: list.map((t) => ({
        id: t.id,
        nodeInstanceId: t.nodeInstanceId,
        processInstanceId: t.nodeInstance.instance.id,
        processName: t.nodeInstance.instance.definition.name,
        nodeName: t.nodeInstance.definition.nodeName,
        type: t.type,
        status: t.status,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }
}
