import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { TasksService } from './tasks.service'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'
import { NodeInstancesService } from '../node-instances/node-instances.service'

describe('TasksService', () => {
  let service: TasksService
  let prisma: any

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
      const result = await service.findAll({ page: 1, pageSize: 20 }, 'u-1')
      expect(result.list).toHaveLength(1)
      expect(result.list[0].processName).toBe('测试流程')
    })
  })

  describe('findOne', () => {
    it('should return task detail', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask)
      const result = await service.findOne('t-1')
      expect(result.id).toBe('t-1')
    })

    it('should throw if not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null)
      await expect(service.findOne('t-1')).rejects.toThrow(NotFoundException)
    })

    it('should throw if not approve type', async () => {
      prisma.task.findUnique.mockResolvedValue({ ...mockTask, type: 'execute' })
      await expect(service.findOne('t-1')).rejects.toThrow(ConflictException)
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
