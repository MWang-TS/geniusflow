import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateProcessInstanceDto } from './dto/create-process-instance.dto'

@Injectable()
export class ProcessInstancesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProcessInstanceDto, userId: string) {
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
        createdBy: userId,
      },
    })

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
      const isFirst = i === 0

      const assigneeUserId = assigneeConfig?.assigneeUserId || null

      const progressConfig = (nodeDef.progressConfig || { plannedDuration: 1 }) as Record<string, unknown>
      const duration = Math.max(1, (progressConfig.plannedDuration as number) || 1)

      const nodePlannedStart = new Date(plannedStart)
      nodePlannedStart.setDate(nodePlannedStart.getDate() + cumulativeDays)
      const nodePlannedEnd = new Date(nodePlannedStart)
      nodePlannedEnd.setDate(nodePlannedEnd.getDate() + duration)

      nodeInstances.push({
        nodeDefId: nodeDef.id,
        assigneeUserId,
        plannedStart: nodePlannedStart,
        plannedEnd: nodePlannedEnd,
        status: isFirst ? 'in_progress' : 'waiting',
      })

      cumulativeDays += duration
    }

    const createdNodes = []
    for (const ni of nodeInstances) {
      const created = await this.prisma.nodeInstance.create({
        data: {
          instanceId: instance.id,
          definitionId: ni.nodeDefId,
          status: ni.status,
          plannedStartDate: ni.plannedStart,
          plannedEndDate: ni.plannedEnd,
          assigneeUserId: ni.assigneeUserId,
        },
        include: { definition: true },
      })
      createdNodes.push(created)

      await this.prisma.nodeInstanceHistory.create({
        data: {
          nodeInstanceId: created.id,
          eventType: 'create',
          toStatus: ni.status,
        },
      })
    }

    const firstNode = createdNodes[0]
    if (firstNode) {
      await this.prisma.processInstance.update({
        where: { id: instance.id },
        data: { currentNodeId: firstNode.id },
      })
    }

    if (firstNode && firstNode.assigneeUserId) {
      const plannedEnd = firstNode.plannedEndDate
      await this.prisma.task.create({
        data: {
          nodeInstanceId: firstNode.id,
          assigneeUserId: firstNode.assigneeUserId,
          type: 'execute',
          status: 'pending',
          dueDate: plannedEnd || undefined,
        },
      })
    }

    return this.findOne(instance.id)
  }

  async findAll(query: { page: number; pageSize: number; status?: string }) {
    const { page, pageSize, status } = query

    const where: Record<string, unknown> = {}
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

  async findOne(id: string) {
    const instance = await this.prisma.processInstance.findUnique({
      where: { id },
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

  async terminate(id: string, reason: string) {
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

    return { success: true, status: 'terminated' }
  }
}
