import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { TasksService } from './tasks.service'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'
import { NodeInstancesService } from '../node-instances/node-instances.service'

describe('TasksService', () => {
  let service: TasksService
  let prisma: any
  const employeeUser = { userId: 'u-1', roles: ['employee'] }
  const managerUser = { userId: 'u-manager', roles: ['manager'] }

  const mockTask = {
    id: 't-1', nodeInstanceId: 'ni-1', assigneeUserId: 'u-1',
    type: 'approve', status: 'pending', dueDate: null, completedAt: null, createdAt: new Date(),
    nodeInstance: {
      id: 'ni-1', status: 'pending_approval',
      definition: { id: 'nd-1', nodeName: '审批节点', nodeType: 'task' },
      instance: { id: 'pi-1', definition: { id: 'pd-1', name: '测试流程' } },
      assignee: null, aiReports: [], history: [],
    },
  }

  beforeEach(async () => {
    prisma = {
      task: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      nodeInstance: { update: jest.fn() },
      nodeInstanceHistory: { create: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(typeof ops === 'function' ? [ops({ task: prisma.task, nodeInstance: prisma.nodeInstance, nodeInstanceHistory: prisma.nodeInstanceHistory })] : ops)),
    }
    const mockAuditLog = { record: jest.fn().mockResolvedValue(undefined) }
    const mockNodeInstance = { advanceProcessPublic: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: NodeInstancesService, useValue: mockNodeInstance },
      ],
    }).compile()

    service = module.get<TasksService>(TasksService)
  })

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask])
      prisma.task.count.mockResolvedValue(1)
      const result = await service.findAll({ page: 1, pageSize: 20 }, employeeUser)
      expect(result.list).toHaveLength(1)
      expect(result.list[0].processName).toBe('测试流程')
      expect(result.list[0].actionPath).toBe('/approvals/t-1')
    })

    it('should allow managers to query all tasks', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask])
      prisma.task.count.mockResolvedValue(1)

      await service.findAll({ page: 1, pageSize: 20 }, managerUser)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      )
    })
  })

  describe('updateStatus', () => {
    it('should update task status for the assignee', async () => {
      prisma.task.findUnique.mockResolvedValue({
        ...mockTask,
        type: 'execute',
        nodeInstance: { ...mockTask.nodeInstance, status: 'in_progress' },
      })
      prisma.task.update.mockResolvedValue({ ...mockTask, status: 'in_progress' })

      const result = await service.updateStatus('t-1', 'in_progress', employeeUser)

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { status: 'in_progress' },
      })
      expect(result.status).toBe('in_progress')
    })

    it('should reject unsupported target status', async () => {
      await expect(service.updateStatus('t-1', 'completed', employeeUser)).rejects.toThrow(ConflictException)
    })

    it('should reject status update for other users', async () => {
      prisma.task.findUnique.mockResolvedValue({
        ...mockTask,
        type: 'execute',
        nodeInstance: { ...mockTask.nodeInstance, status: 'in_progress' },
      })

      await expect(service.updateStatus('t-1', 'in_progress', { userId: 'u-2', roles: ['employee'] })).rejects.toThrow(ConflictException)
    })
  })

  describe('findOne', () => {
    it('should return task detail', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask)
      const result = await service.findOne('t-1', employeeUser)
      expect(result.id).toBe('t-1')
    })

    it('should throw if not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null)
      await expect(service.findOne('t-1', employeeUser)).rejects.toThrow(NotFoundException)
    })

    it('should throw if not approve type', async () => {
      prisma.task.findUnique.mockResolvedValue({ ...mockTask, type: 'execute' })
      await expect(service.findOne('t-1', employeeUser)).rejects.toThrow(ConflictException)
    })

    it('should hide unrelated tasks from normal employees', async () => {
      prisma.task.findUnique.mockResolvedValue({ ...mockTask, assigneeUserId: 'u-2' })

      await expect(service.findOne('t-1', employeeUser)).rejects.toThrow(NotFoundException)
    })
  })

  describe('approve', () => {
    it('should approve task and complete node', async () => {
      const taskWithInstance = {
        ...mockTask,
        nodeInstance: { ...mockTask.nodeInstance, instance: { id: 'pi-1' } },
      }
      prisma.task.findUnique.mockResolvedValue(taskWithInstance)
      prisma.$transaction.mockResolvedValue([{}, {}, {}])

      const result = await service.approve('t-1', 'approved', 'u-1')
      expect(result.status).toBe('completed')
    })

    it('should throw if task not pending', async () => {
      prisma.task.findUnique.mockResolvedValue({ ...mockTask, status: 'completed' })
      await expect(service.approve('t-1', 'ok', 'u-1')).rejects.toThrow(ConflictException)
    })
  })

  describe('reject', () => {
    it('should reject task and reset node to in_progress', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask)
      prisma.$transaction.mockResolvedValue([{}, {}, {}])

      const result = await service.reject('t-1', 'needs work', 'u-1')
      expect(result.status).toBe('in_progress')
    })
  })
})
