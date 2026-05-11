import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTaskDefinitionDto, UpdateTaskDefinitionDto } from './dto/task-definition.dto'

@Injectable()
export class TaskDefinitionsService {
  constructor(private prisma: PrismaService) {}

  /** 列出某节点下所有任务定义 */
  async findByNode(processDefId: string, nodeDefId: string) {
    await this.assertNodeBelongs(processDefId, nodeDefId)
    const defs = await this.prisma.taskDefinition.findMany({
      where: { processDefId, nodeDefId },
      orderBy: { sortOrder: 'asc' },
    })
    const process = await this.prisma.processDefinition.findUnique({
      where: { id: processDefId },
      select: { sopCode: true },
    })
    const node = await this.prisma.nodeDefinition.findUnique({
      where: { id: nodeDefId },
      select: { sortOrder: true },
    })
    return defs.map((d, idx) => ({
      ...d,
      taskCode: this.buildTaskCode(
        process?.sopCode ?? null,
        node?.sortOrder ?? 0,
        d.sortOrder ?? idx,
      ),
    }))
  }

  /** 列出整个流程所有节点的任务定义（按节点分组） */
  async findByProcess(processDefId: string) {
    const [defs, process, nodes] = await Promise.all([
      this.prisma.taskDefinition.findMany({
        where: { processDefId },
        orderBy: [{ nodeDefId: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.processDefinition.findUnique({
        where: { id: processDefId },
        select: { sopCode: true },
      }),
      this.prisma.nodeDefinition.findMany({
        where: { processId: processDefId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, nodeName: true, nodeType: true, sortOrder: true },
      }),
    ])

    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    return defs.map((d) => {
      const node = nodeMap.get(d.nodeDefId)
      return {
        ...d,
        nodeName: node?.nodeName ?? '',
        nodeType: node?.nodeType ?? 'task',
        taskCode: this.buildTaskCode(
          process?.sopCode ?? null,
          node?.sortOrder ?? 0,
          d.sortOrder,
        ),
      }
    })
  }

  async create(processDefId: string, nodeDefId: string, dto: CreateTaskDefinitionDto) {
    await this.assertNodeBelongs(processDefId, nodeDefId)

    const count = await this.prisma.taskDefinition.count({ where: { nodeDefId } })
    return this.prisma.taskDefinition.create({
      data: {
        processDefId,
        nodeDefId,
        title: dto.title,
        description: dto.description,
        taskType: dto.taskType ?? 'checklist',
        isRequired: dto.isRequired ?? true,
        sortOrder: dto.sortOrder ?? count,
      },
    })
  }

  async update(processDefId: string, nodeDefId: string, id: string, dto: UpdateTaskDefinitionDto) {
    await this.assertTaskDefBelongs(processDefId, nodeDefId, id)
    return this.prisma.taskDefinition.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.taskType !== undefined && { taskType: dto.taskType }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    })
  }

  async remove(processDefId: string, nodeDefId: string, id: string) {
    await this.assertTaskDefBelongs(processDefId, nodeDefId, id)
    await this.prisma.taskDefinition.delete({ where: { id } })
    return { success: true }
  }

  /** 从节点的检查清单（actionSpec.checklist）批量同步为任务定义 */
  async syncFromChecklist(processDefId: string, nodeDefId: string) {
    await this.assertNodeBelongs(processDefId, nodeDefId)

    const node = await this.prisma.nodeDefinition.findUnique({
      where: { id: nodeDefId },
      select: { actionSpec: true },
    })
    if (!node) throw new NotFoundException('节点不存在')

    const checklist: Array<{ id: string; label: string; required: boolean }> =
      (node.actionSpec as any)?.checklist ?? []

    if (checklist.length === 0) {
      return { synced: 0 }
    }

    // 删除已有的 checklist 类型任务定义，重新从检查清单生成
    await this.prisma.taskDefinition.deleteMany({
      where: { nodeDefId, taskType: 'checklist' },
    })

    const created = await Promise.all(
      checklist.map((item, idx) =>
        this.prisma.taskDefinition.create({
          data: {
            processDefId,
            nodeDefId,
            title: item.label,
            taskType: 'checklist',
            isRequired: item.required,
            sortOrder: idx,
          },
        }),
      ),
    )

    return { synced: created.length }
  }

  /** 当节点实例被激活时，从该节点的 TaskDefinition 生成子任务 */
  async spawnSubTasksForNodeInstance(
    nodeInstanceId: string,
    nodeDefId: string,
    assigneeUserId: string,
    dueDate: Date | null,
  ) {
    // 获取该节点的所有任务定义
    const taskDefs = await this.prisma.taskDefinition.findMany({
      where: { nodeDefId },
      orderBy: { sortOrder: 'asc' },
      include: {
        processDef: { select: { sopCode: true } },
        nodeDef: { select: { sortOrder: true } },
      },
    })

    if (taskDefs.length === 0) return []

    const created = await Promise.all(
      taskDefs.map((def) => {
        const taskCode = this.buildTaskCode(
          def.processDef?.sopCode ?? null,
          def.nodeDef?.sortOrder ?? 0,
          def.sortOrder,
        )
        return this.prisma.task.create({
          data: {
            nodeInstanceId,
            assigneeUserId,
            type: def.taskType,
            title: def.title,
            taskCode,
            taskDefId: def.id,
            status: 'pending',
            dueDate: dueDate ?? undefined,
          },
        })
      }),
    )

    return created
  }

  /** 生成任务编码  SOP-001-N02-T01 */
  buildTaskCode(sopCode: string | null, nodeOrder: number, taskOrder: number): string {
    const s = sopCode ?? 'SOP-???'
    const n = String(nodeOrder + 1).padStart(2, '0')
    const t = String(taskOrder + 1).padStart(2, '0')
    return `${s}-N${n}-T${t}`
  }

  private async assertNodeBelongs(processDefId: string, nodeDefId: string) {
    const node = await this.prisma.nodeDefinition.findFirst({
      where: { id: nodeDefId, processId: processDefId },
    })
    if (!node) throw new NotFoundException('节点不存在或不属于该流程')
    return node
  }

  private async assertTaskDefBelongs(processDefId: string, nodeDefId: string, id: string) {
    const def = await this.prisma.taskDefinition.findFirst({
      where: { id, processDefId, nodeDefId },
    })
    if (!def) throw new NotFoundException('任务定义不存在')
    return def
  }
}
