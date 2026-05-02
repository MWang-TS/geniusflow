import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { ProcessInstancesService } from './process-instances.service'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'

describe('ProcessInstancesService', () => {
  let service: ProcessInstancesService
  let prisma: any

  const mockDefinition = {
    id: 'pd-1', name: '测试流程', status: 'published',
    nodes: [{ id: 'nd-1', nodeName: '任务1', nodeType: 'task', sortOrder: 0, progressConfig: { plannedDuration: 2 } }],
  }

  const mockInstance = {
    id: 'pi-1', definitionId: 'pd-1', status: 'running',
    plannedStartDate: new Date(), actualStartDate: new Date(),
    currentNodeId: null, createdBy: 'u-1', createdAt: new Date(),
    definition: { id: 'pd-1', name: '测试流程' },
    creator: { id: 'u-1', name: '测试用户' },
    nodeInstances: [],
  }

  beforeEach(async () => {
    prisma = {
      processDefinition: { findUnique: jest.fn() },
      processInstance: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      nodeInstance: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
      nodeInstanceHistory: { create: jest.fn() },
      task: { create: jest.fn(), updateMany: jest.fn() },
    }
    const mockAuditLog = { record: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessInstancesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile()

    service = module.get<ProcessInstancesService>(ProcessInstancesService)
  })

  describe('create', () => {
    it('should throw if definition not found', async () => {
      prisma.processDefinition.findUnique.mockResolvedValue(null)
      await expect(service.create({ definitionId: 'x' }, 'u-1'))
        .rejects.toThrow(NotFoundException)
    })

    it('should throw if definition not published', async () => {
      prisma.processDefinition.findUnique.mockResolvedValue({ ...mockDefinition, status: 'draft' })
      await expect(service.create({ definitionId: 'pd-1' }, 'u-1'))
        .rejects.toThrow(ConflictException)
    })

    it('should throw if definition has no nodes', async () => {
      prisma.processDefinition.findUnique.mockResolvedValue({ ...mockDefinition, nodes: [] })
      await expect(service.create({ definitionId: 'pd-1' }, 'u-1'))
        .rejects.toThrow(ConflictException)
    })

    it('should create instance with node instances', async () => {
      prisma.processDefinition.findUnique.mockResolvedValue(mockDefinition)
      prisma.processInstance.create.mockResolvedValue({ id: 'pi-1', definitionId: 'pd-1' })
      prisma.nodeInstance.create.mockResolvedValue({ id: 'ni-1', definition: { id: 'nd-1' }, plannedEndDate: new Date() })
      prisma.nodeInstanceHistory.create.mockResolvedValue({})
      prisma.processInstance.findUnique.mockResolvedValue(mockInstance)

      const result = await service.create({ definitionId: 'pd-1' }, 'u-1')
      expect(result.id).toBe('pi-1')
      expect(prisma.processInstance.create).toHaveBeenCalled()
      expect(prisma.nodeInstance.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('findAll', () => {
    it('should return paginated list', async () => {
      prisma.processInstance.findMany.mockResolvedValue([mockInstance])
      prisma.processInstance.count.mockResolvedValue(1)
      const result = await service.findAll({ page: 1, pageSize: 20 })
      expect(result.list).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })
  })

  describe('findOne', () => {
    it('should return instance detail', async () => {
      prisma.processInstance.findUnique.mockResolvedValue(mockInstance)
      const result = await service.findOne('pi-1')
      expect(result.id).toBe('pi-1')
    })

    it('should throw if not found', async () => {
      prisma.processInstance.findUnique.mockResolvedValue(null)
      await expect(service.findOne('pi-1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getGanttData', () => {
    it('should return gantt formatted data', async () => {
      const instWithNodes = {
        ...mockInstance,
        nodeInstances: [{
          id: 'ni-1', status: 'in_progress', percentComplete: 50,
          plannedStartDate: new Date(), plannedEndDate: new Date(Date.now() + 86400000 * 3),
          actualStartDate: new Date(), actualEndDate: null,
          definition: { nodeName: '任务1' }, assignee: { name: '张三' },
        }],
      }
      prisma.processInstance.findUnique.mockResolvedValue(instWithNodes)
      const result = await service.getGanttData('pi-1')
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].name).toBe('任务1')
      expect(result.tasks[0].duration).toBeGreaterThanOrEqual(3)
    })
  })

  describe('terminate', () => {
    it('should terminate running instance', async () => {
      prisma.processInstance.findUnique.mockResolvedValue({ ...mockInstance, definitionId: 'pd-1' })
      prisma.nodeInstance.findMany.mockResolvedValue([{ id: 'ni-1', status: 'in_progress' }])
      const result = await service.terminate('pi-1', 'cancelled', 'u-1')
      expect(result.status).toBe('terminated')
    })

    it('should throw if not running', async () => {
      prisma.processInstance.findUnique.mockResolvedValue({ ...mockInstance, status: 'completed' })
      await expect(service.terminate('pi-1', 'x', 'u-1')).rejects.toThrow(ConflictException)
    })
  })
})
