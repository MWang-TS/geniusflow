import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'
import { TaskDefinitionsService } from '../task-definitions/task-definitions.service'
import { CreateProcessInstanceDto } from './dto/create-process-instance.dto'

type AuthUser = {
  userId: string
  roles?: string[]
}

@Injectable()
export class ProcessInstancesService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private taskDefinitionsService: TaskDefinitionsService,
  ) {}

  async create(dto: CreateProcessInstanceDto, user: AuthUser) {
    const definition = await this.prisma.processDefinition.findUnique({
      where: { id: dto.definitionId },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!definition) {
      throw new NotFoundException('流程定义不存在')
    }
    if (definition.status !== 'published') {
      throw new ConflictException('只能实例化已发布的流程')
    }
    if (definition.nodes.length === 0) {
      throw new ConflictException('流程没有节点，无法实例化')
    }

    const plannedStart = dto.plannedStartDate
      ? new Date(dto.plannedStartDate)
      : new Date()
    plannedStart.setHours(0, 0, 0, 0)

    const instance = await this.prisma.processInstance.create({
      data: {
        definitionId: definition.id,
        status: 'running',
        plannedStartDate: plannedStart,
        actualStartDate: new Date(),
        createdBy: user.userId,
      },
    })

    // 找到第一个有执行人的节点索引；开始/结束等无执行人的节点自动跳过
    const firstAssigneeIndex = definition.nodes.findIndex(
      (n) => !!(dto.nodeAssignees?.[n.id]?.assigneeUserId),
    )
    // 如果没有任何节点有执行人，从 0 开始（流程将全部自动完成）
    const effectiveFirstIndex = firstAssigneeIndex >= 0 ? firstAssigneeIndex : 0

    let cumulativeDays = 0
    const nodeInstances: Array<{
      nodeDefId: string
      assigneeUserId: string | null
      plannedStart: Date
      plannedEnd: Date
      status: string
    }> = []

    for (let i = 0; i < definition.nodes.length; i++) {
      const nodeDef = definition.nodes[i]
      const assigneeConfig = dto.nodeAssignees?.[nodeDef.id]

      const assigneeUserId = assigneeConfig?.assigneeUserId || null

      const progressConfig = (nodeDef.progressConfig || { plannedDuration: 1 }) as Record<string, unknown>
      const duration = Math.max(1, (progressConfig.plannedDuration as number) || 1)

      const nodePlannedStart = new Date(plannedStart)
      nodePlannedStart.setDate(nodePlannedStart.getDate() + cumulativeDays)
      const nodePlannedEnd = new Date(nodePlannedStart)
      nodePlannedEnd.setDate(nodePlannedEnd.getDate() + duration)

      // 无执行人且在第一个有执行人节点之前的节点 → 自动完成（跳过）
      let status: string
      if (i < effectiveFirstIndex) {
        status = 'completed'
      } else if (i === effectiveFirstIndex) {
        status = 'in_progress'
      } else {
        status = 'waiting'
      }

      nodeInstances.push({
        nodeDefId: nodeDef.id,
        assigneeUserId,
        plannedStart: nodePlannedStart,
        plannedEnd: nodePlannedEnd,
        status,
      })

      cumulativeDays += duration
    }

    const createdNodes = []
    for (let i = 0; i < nodeInstances.length; i++) {
      const ni = nodeInstances[i]
      const created = await this.prisma.nodeInstance.create({
        data: {
          instanceId: instance.id,
          definitionId: ni.nodeDefId,
          status: ni.status,
          plannedStartDate: ni.plannedStart,
          plannedEndDate: ni.plannedEnd,
          assigneeUserId: ni.assigneeUserId,
          ...(ni.status === 'completed' ? { actualStartDate: new Date(), actualEndDate: new Date() } : {}),
        },
        include: { definition: true },
      })
      createdNodes.push(created)

      await this.prisma.nodeInstanceHistory.create({
        data: {
          nodeInstanceId: created.id,
          eventType: i < effectiveFirstIndex ? 'auto_complete' : 'create',
          toStatus: ni.status,
        },
      })
    }

    // currentNodeId 指向第一个 in_progress 节点
    const firstActiveNode = createdNodes[effectiveFirstIndex] ?? createdNodes[0]
    if (firstActiveNode) {
      await this.prisma.processInstance.update({
        where: { id: instance.id },
        data: { currentNodeId: firstActiveNode.id },
      })
    }

    if (firstActiveNode && firstActiveNode.assigneeUserId) {
      const plannedEnd = firstActiveNode.plannedEndDate
      await this.prisma.task.create({
        data: {
          nodeInstanceId: firstActiveNode.id,
          assigneeUserId: firstActiveNode.assigneeUserId,
          type: 'execute',
          status: 'pending',
          dueDate: plannedEnd || undefined,
        },
      })
      // 从任务定义生成子任务
      await this.taskDefinitionsService.spawnSubTasksForNodeInstance(
        firstActiveNode.id,
        firstActiveNode.definition.id,
        firstActiveNode.assigneeUserId,
        firstActiveNode.plannedEndDate,
      )
    }

    const result = await this.findOne(instance.id, user)
    await this.auditLog.record({
      userId: user.userId,
      action: 'create_instance',
      resourceType: 'process_instance',
      resourceId: instance.id,
      details: { definitionId: definition.id, definitionName: definition.name },
    })
    return result
  }

  async findAll(query: { page: number; pageSize: number; status?: string }, user: AuthUser) {
    const { page, pageSize, status } = query

    const where: Record<string, unknown> = this.buildVisibilityWhere(user)
    if (status) where.status = status

    const [list, total] = await Promise.all([
      this.prisma.processInstance.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          definition: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          nodeInstances: { select: { id: true, status: true } },
        },
      }),
      this.prisma.processInstance.count({ where }),
    ])

    return {
      list: list.map((i) => ({
        id: i.id,
        definitionId: i.definitionId,
        definitionName: i.definition.name,
        status: i.status,
        plannedStartDate: i.plannedStartDate,
        actualStartDate: i.actualStartDate,
        currentNodeId: i.currentNodeId,
        nodeCount: i.nodeInstances.length,
        createdBy: i.creator,
        createdAt: i.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async findOne(id: string, user: AuthUser) {
    const instance = await this.prisma.processInstance.findFirst({
      where: { id, ...this.buildVisibilityWhere(user) },
      include: {
        definition: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        nodeInstances: {
          orderBy: { createdAt: 'asc' },
          include: {
            definition: {
              select: { id: true, nodeName: true, nodeType: true },
            },
            assignee: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!instance) {
      throw new NotFoundException('流程实例不存在')
    }
    return instance
  }

  async getGanttData(id: string, user: AuthUser) {
    const instance = await this.prisma.processInstance.findFirst({
      where: { id, ...this.buildVisibilityWhere(user) },
      include: {
        definition: { select: { name: true } },
        nodeInstances: {
          orderBy: { createdAt: 'asc' },
          include: {
            definition: { select: { nodeName: true } },
            assignee: { select: { name: true } },
          },
        },
      },
    })
    if (!instance) throw new NotFoundException('流程实例不存在')

    return {
      instanceId: instance.id,
      processName: instance.definition.name,
      plannedStartDate: instance.plannedStartDate,
      actualStartDate: instance.actualStartDate,
      tasks: instance.nodeInstances.map((n) => {
        const start = n.plannedStartDate ? new Date(n.plannedStartDate) : null
        const end = n.plannedEndDate ? new Date(n.plannedEndDate) : null
        const actualStart = n.actualStartDate ? new Date(n.actualStartDate) : null
        const actualEnd = n.actualEndDate ? new Date(n.actualEndDate) : null

        return {
          id: n.id,
          name: n.definition.nodeName,
          assignee: n.assignee?.name || null,
          status: n.status,
          percentComplete: n.percentComplete,
          plannedStartDate: start,
          plannedEndDate: end,
          actualStartDate: actualStart,
          actualEndDate: actualEnd,
          duration: end && start ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 0,
          isOverdue: end && n.status !== 'completed' && n.status !== 'rejected'
            ? new Date() > end
            : false,
        }
      }),
    }
  }

  async updateBaseline(id: string, dto: { plannedStartDate?: string; nodeAdjustments?: Array<{ nodeInstanceId: string; plannedStartDate: string; plannedEndDate: string }> }, user: AuthUser) {
    const instance = await this.prisma.processInstance.findUnique({ where: { id } })
    if (!instance) throw new NotFoundException('流程实例不存在')

    if (dto.plannedStartDate) {
      await this.prisma.processInstance.update({
        where: { id },
        data: { plannedStartDate: new Date(dto.plannedStartDate) },
      })
    }

    if (dto.nodeAdjustments) {
      for (const adj of dto.nodeAdjustments) {
        await this.prisma.nodeInstance.update({
          where: { id: adj.nodeInstanceId },
          data: {
            plannedStartDate: new Date(adj.plannedStartDate),
            plannedEndDate: new Date(adj.plannedEndDate),
          },
        })
      }
    }

    return this.getGanttData(id, user)
  }

  async terminate(id: string, reason: string, userId: string) {
    const instance = await this.prisma.processInstance.findUnique({
      where: { id },
    })
    if (!instance) {
      throw new NotFoundException('流程实例不存在')
    }
    if (instance.status !== 'running') {
      throw new ConflictException('只能终止进行中的流程')
    }

    await this.prisma.processInstance.update({
      where: { id },
      data: { status: 'terminated' },
    })

    await this.prisma.task.updateMany({
      where: { nodeInstance: { instanceId: id }, status: 'pending' },
      data: { status: 'cancelled' },
    })

    const activeNodes = await this.prisma.nodeInstance.findMany({
      where: {
        instanceId: id,
        status: { in: ['waiting', 'in_progress', 'pending_approval'] },
      },
    })

    await this.prisma.nodeInstance.updateMany({
      where: {
        instanceId: id,
        status: { in: ['waiting', 'in_progress', 'pending_approval'] },
      },
      data: { status: 'rejected' },
    })

    for (const node of activeNodes) {
      await this.prisma.nodeInstanceHistory.create({
        data: {
          nodeInstanceId: node.id,
          eventType: 'terminate',
          fromStatus: node.status,
          toStatus: 'rejected',
          details: { reason },
        },
      })
    }

    await this.auditLog.record({
      userId,
      action: 'terminate_instance',
      resourceType: 'process_instance',
      resourceId: id,
      details: { reason, definitionId: instance.definitionId },
    })

    return { success: true, status: 'terminated' }
  }

  private hasOversightAccess(user: AuthUser) {
    return (user.roles || []).some((role) => role === 'admin' || role === 'manager')
  }

  private buildVisibilityWhere(user: AuthUser) {
    if (this.hasOversightAccess(user)) {
      return {}
    }

    return {
      OR: [
        { createdBy: user.userId },
        { nodeInstances: { some: { assigneeUserId: user.userId } } },
        { nodeInstances: { some: { tasks: { some: { assigneeUserId: user.userId } } } } },
      ],
    }
  }
}
