import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { WsGateway } from '../ws/ws.gateway'
import { TaskDefinitionsService } from '../task-definitions/task-definitions.service'
import { SaveNodeInstanceDto, SubmitNodeInstanceDto, UpdateProgressDto } from './dto/node-instance.dto'

type AuthUser = {
  userId: string
  roles?: string[]
}

@Injectable()
export class NodeInstancesService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private wsGateway: WsGateway,
    private taskDefinitionsService: TaskDefinitionsService,
  ) {}

  async findOne(id: string, user: AuthUser) {
    const node = await this.prisma.nodeInstance.findUnique({
      where: { id },
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
          },
        },
        assignee: { select: { id: true, name: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 20 },
        aiReports: { orderBy: { createdAt: 'desc' }, take: 1 },
        instance: {
          select: { id: true, createdBy: true, definition: { select: { id: true, name: true } } },
        },
        tasks: { select: { assigneeUserId: true } },
      },
    })
    if (!node) {
      throw new NotFoundException('节点实例不存在')
    }
    this.assertCanViewNode(node, user)
    const { tasks, ...visibleNode } = node
    return visibleNode
  }

  async save(id: string, dto: SaveNodeInstanceDto, user: AuthUser) {
    const node = await this.prisma.nodeInstance.findUnique({ where: { id } })
    if (!node) throw new NotFoundException('节点实例不存在')
    this.assertCanActOnNode(node, user)
    if (node.status !== 'in_progress') {
      throw new ConflictException('只能保存进行中节点的数据')
    }

    const data: Record<string, unknown> = {}
    if (dto.inputData !== undefined) data.inputData = dto.inputData as any
    if (dto.outputData !== undefined) data.outputData = dto.outputData as any
    if (dto.percentComplete !== undefined) data.percentComplete = dto.percentComplete

    return this.prisma.nodeInstance.update({ where: { id }, data })
  }

  async submit(id: string, dto: SubmitNodeInstanceDto, user: AuthUser) {
    const node = await this.prisma.nodeInstance.findUnique({
      where: { id },
      include: { definition: true, instance: { select: { createdBy: true } } },
    })
    if (!node) throw new NotFoundException('节点实例不存在')
    this.assertCanActOnNode(node, user)
    if (node.status !== 'in_progress') {
      throw new ConflictException('只能提交进行中的节点')
    }

    if (!this.hasOversightAccess(user) && node.assigneeUserId && node.assigneeUserId !== user.userId) {
      throw new ConflictException('只有节点执行人才能提交')
    }

    const data: Record<string, unknown> = {}
    if (dto.inputData !== undefined) data.inputData = dto.inputData as any
    if (dto.outputData !== undefined) data.outputData = dto.outputData as any
    data.percentComplete = 100
    data.actualStartDate = node.actualStartDate || new Date()

    await this.prisma.nodeInstance.update({ where: { id }, data })

    const progressConfig = node.definition.progressConfig as Record<string, unknown> | null
    const needApproval = progressConfig?.needApproval === true

    if (needApproval) {
      const inputSpec = node.definition.inputSpec as Record<string, unknown> | null
      const outputSpec = node.definition.outputSpec as Record<string, unknown> | null

      await this.prisma.nodeInstance.update({
        where: { id },
        data: { status: 'ai_inspecting' },
      })

      await this.prisma.nodeInstanceHistory.create({
        data: {
          nodeInstanceId: id,
          eventType: 'submit',
          actorUserId: user.userId,
          fromStatus: 'in_progress',
          toStatus: 'ai_inspecting',
        },
      })

      await this.queueService.addInspectorJob({
        nodeInstanceId: id,
        processInstanceId: node.instanceId,
        nodeName: node.definition.nodeName,
        inputData: (dto.inputData || {}) as Record<string, unknown>,
        outputData: (dto.outputData || {}) as Record<string, unknown>,
        acceptanceCriteria: (inputSpec?.acceptanceCriteria as string) || '',
        qualityStandard: (outputSpec?.qualityStandard as string) || '',
        userId: user.userId,
      })

      return {
        status: 'ai_inspecting',
        message: '已提交，AI 正在校验中...',
      }
    } else {
      await this.prisma.nodeInstance.update({
        where: { id },
        data: { status: 'completed', actualEndDate: new Date() },
      })

      await this.prisma.nodeInstanceHistory.create({
        data: {
          nodeInstanceId: id,
          eventType: 'submit',
          actorUserId: user.userId,
          fromStatus: 'in_progress',
          toStatus: 'completed',
        },
      })

      await this.advanceProcess(node.instanceId, id)
      return { status: 'completed', message: '提交完成' }
    }
  }

  async updateProgress(id: string, dto: UpdateProgressDto, user: AuthUser) {
    const node = await this.prisma.nodeInstance.findUnique({ where: { id } })
    if (!node) throw new NotFoundException('节点实例不存在')
    this.assertCanActOnNode(node, user)

    return this.prisma.nodeInstance.update({
      where: { id },
      data: { percentComplete: dto.percentComplete },
    })
  }

  private async advanceProcess(instanceId: string, currentNodeInstanceId: string) {
    return this.advanceProcessPublic(instanceId, currentNodeInstanceId)
  }

  async advanceProcessPublic(instanceId: string, currentNodeInstanceId: string) {
    const nodeInstance = await this.prisma.nodeInstance.findUnique({
      where: { id: currentNodeInstanceId },
      include: { definition: true },
    })
    if (!nodeInstance) return

    const definitionNodes = await this.prisma.nodeDefinition.findMany({
      where: { processId: nodeInstance.definition.processId },
      orderBy: { sortOrder: 'asc' },
    })

    const currentIndex = definitionNodes.findIndex(
      (n) => n.id === nodeInstance.definitionId,
    )

    // 循环跳过无执行人的节点（开始/结束等），直到找到有执行人的节点或到达末尾
    let nextIndex = currentIndex + 1
    while (nextIndex < definitionNodes.length) {
      const nextDef = definitionNodes[nextIndex]
      const nextNodeInstance = await this.prisma.nodeInstance.findFirst({
        where: { instanceId, definitionId: nextDef.id },
      })
      if (!nextNodeInstance) break

      await this.prisma.nodeInstance.update({
        where: { id: nextNodeInstance.id },
        data: {
          status: 'in_progress',
          actualStartDate: new Date(),
          plannedStartDate: new Date(),
        },
      })
      await this.prisma.processInstance.update({
        where: { id: instanceId },
        data: { currentNodeId: nextNodeInstance.id },
      })

      if (nextNodeInstance.assigneeUserId) {
        // 有执行人：创建任务后停止，等待执行人操作
        const plannedEnd = nextNodeInstance.plannedEndDate
        await this.prisma.task.create({
          data: {
            nodeInstanceId: nextNodeInstance.id,
            assigneeUserId: nextNodeInstance.assigneeUserId,
            type: 'execute',
            status: 'pending',
            dueDate: plannedEnd || undefined,
          },
        })
        await this.taskDefinitionsService.spawnSubTasksForNodeInstance(
          nextNodeInstance.id,
          nextDef.id,
          nextNodeInstance.assigneeUserId,
          nextNodeInstance.plannedEndDate,
        )
        await this.prisma.nodeInstanceHistory.create({
          data: {
            nodeInstanceId: nextNodeInstance.id,
            eventType: 'create',
            toStatus: 'in_progress',
          },
        })
        return  // 等待执行人，停止自动推进
      } else {
        // 无执行人：自动完成该节点，继续向后推进
        await this.prisma.nodeInstance.update({
          where: { id: nextNodeInstance.id },
          data: { status: 'completed', actualEndDate: new Date() },
        })
        await this.prisma.nodeInstanceHistory.create({
          data: {
            nodeInstanceId: nextNodeInstance.id,
            eventType: 'auto_complete',
            toStatus: 'completed',
          },
        })
        nextIndex++
      }
    }

    // 所有节点都已处理完毕，流程结束
    await this.prisma.processInstance.update({
      where: { id: instanceId },
      data: { status: 'completed' },
    })
  }

  private hasOversightAccess(user: AuthUser) {
    return (user.roles || []).some((role) => role === 'admin' || role === 'manager')
  }

  private assertCanViewNode(node: { assigneeUserId?: string | null; instance?: { createdBy?: string | null }; tasks?: Array<{ assigneeUserId?: string | null }> }, user: AuthUser) {
    if (this.hasOversightAccess(user)) {
      return
    }

    const related =
      node.assigneeUserId === user.userId ||
      node.instance?.createdBy === user.userId ||
      (node.tasks || []).some((task) => task.assigneeUserId === user.userId)

    if (!related) {
      throw new NotFoundException('节点实例不存在')
    }
  }

  private assertCanActOnNode(node: { assigneeUserId?: string | null }, user: AuthUser) {
    if (this.hasOversightAccess(user)) {
      return
    }
    if (node.assigneeUserId !== user.userId) {
      throw new ConflictException('只有节点执行人才能修改任务进度')
    }
  }
}
