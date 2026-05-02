import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'
import { NodeInstancesService } from '../node-instances/node-instances.service'

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private nodeInstancesService: NodeInstancesService,
    private auditLog: AuditLogService,
  ) {}

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

  async findOne(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        nodeInstance: {
          include: {
            definition: {
              select: {
                id: true,
                nodeName: true,
                nodeType: true,
                inputSpec: true,
                actionSpec: true,
                outputSpec: true,
                aiConfig: true,
                progressConfig: true,
              },
            },
            instance: {
              include: { definition: { select: { id: true, name: true } } },
            },
            assignee: { select: { id: true, name: true } },
            aiReports: { orderBy: { createdAt: 'desc' }, take: 3 },
            history: { orderBy: { createdAt: 'desc' }, take: 20 },
          },
        },
      },
    })
    if (!task) throw new NotFoundException('审批任务不存在')
    if (task.type !== 'approve') throw new ConflictException('该任务不是审批任务')
    return task
  }

  async approve(taskId: string, comment: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { nodeInstance: { include: { instance: { select: { id: true } } } } },
    })
    if (!task) throw new NotFoundException('审批任务不存在')
    if (task.type !== 'approve') throw new ConflictException('该任务不是审批任务')
    if (task.status !== 'pending') throw new ConflictException('该任务已处理')

    const nodeInstanceId = task.nodeInstanceId

    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: taskId },
        data: { status: 'completed', completedAt: new Date() },
      }),
      this.prisma.nodeInstance.update({
        where: { id: nodeInstanceId },
        data: { status: 'completed', actualEndDate: new Date() },
      }),
      this.prisma.nodeInstanceHistory.create({
        data: {
          nodeInstanceId,
          eventType: 'approve',
          actorUserId: userId,
          fromStatus: 'pending_approval',
          toStatus: 'completed',
          details: { comment } as any,
        },
      }),
    ])

    await this.nodeInstancesService.advanceProcessPublic(
      task.nodeInstance.instance.id,
      nodeInstanceId,
    )

    await this.auditLog.record({
      userId,
      action: 'approve',
      resourceType: 'node_instance',
      resourceId: nodeInstanceId,
      details: { comment, instanceId: task.nodeInstance.instance.id },
    })

    return { status: 'completed', message: '审批通过' }
  }

  async reject(taskId: string, comment: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { nodeInstance: true },
    })
    if (!task) throw new NotFoundException('审批任务不存在')
    if (task.type !== 'approve') throw new ConflictException('该任务不是审批任务')
    if (task.status !== 'pending') throw new ConflictException('该任务已处理')

    const nodeInstanceId = task.nodeInstanceId

    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: taskId },
        data: { status: 'completed', completedAt: new Date() },
      }),
      this.prisma.nodeInstance.update({
        where: { id: nodeInstanceId },
        data: { status: 'in_progress', percentComplete: 0 },
      }),
      this.prisma.nodeInstanceHistory.create({
        data: {
          nodeInstanceId,
          eventType: 'reject',
          actorUserId: userId,
          fromStatus: 'pending_approval',
          toStatus: 'in_progress',
          details: { comment } as any,
        },
      }),
    ])

    await this.auditLog.record({
      userId,
      action: 'reject',
      resourceType: 'node_instance',
      resourceId: nodeInstanceId,
      details: { comment },
    })

    return { status: 'in_progress', message: '已驳回，等待员工修改后重新提交' }
  }
}
