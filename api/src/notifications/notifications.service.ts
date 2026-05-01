import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, query: { page: number; pageSize: number; status?: string }) {
    const { page, pageSize, status } = query
    const where: Record<string, unknown> = { userId }
    if (status) where.status = status

    const [list, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ])

    return {
      list: list.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        channel: n.channel,
        status: n.status,
        relatedResourceType: n.relatedResourceType,
        relatedResourceId: n.relatedResourceId,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, status: 'unread' },
    })
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    })
    if (!notification) throw new NotFoundException('通知不存在')
    return this.prisma.notification.update({
      where: { id },
      data: { status: 'read', readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, status: 'unread' },
      data: { status: 'read', readAt: new Date() },
    })
    return { success: true }
  }

  async create(data: {
    userId: string
    type: string
    title: string
    content?: string
    channel?: string
    relatedResourceType?: string
    relatedResourceId?: string
  }) {
    return this.prisma.notification.create({ data })
  }

  async scanOverdue() {
    const overdueNodes = await this.prisma.nodeInstance.findMany({
      where: {
        status: { in: ['in_progress', 'pending_approval', 'waiting'] },
        plannedEndDate: { lt: new Date() },
      },
      include: {
        instance: {
          select: { id: true, createdBy: true },
        },
        definition: { select: { nodeName: true } },
      },
    })

    for (const node of overdueNodes) {
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          userId: node.instance.createdBy,
          type: 'overdue',
          relatedResourceType: 'node_instance',
          relatedResourceId: node.id,
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      })
      if (existingNotification) continue

      await this.prisma.notification.create({
        data: {
          userId: node.instance.createdBy,
          type: 'overdue',
          title: '节点延期提醒',
          content: `节点「${node.definition.nodeName}」已超过计划结束时间`,
          channel: 'in_app',
          relatedResourceType: 'node_instance',
          relatedResourceId: node.id,
        },
      })
    }

    return { scanned: overdueNodes.length }
  }
}
