import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async record(params: {
    userId?: string
    action: string
    resourceType: string
    resourceId?: string
    details?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  }) {
    return this.prisma.auditLog.create({ data: params as any })
  }

  async findAll(query: { page: number; pageSize: number; userId?: string; action?: string; resourceType?: string }) {
    const { page, pageSize, userId, action, resourceType } = query
    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (action) where.action = action
    if (resourceType) where.resourceType = resourceType

    const [list, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return {
      list: list.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.name || null,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        details: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }
}
