import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { NodeInstancesService } from './node-instances.service'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { WsGateway } from '../ws/ws.gateway'

describe('NodeInstancesService', () => {
  let module: TestingModule
  let service: NodeInstancesService
  let prisma: any
  let queueService: any
  let wsGateway: any

  const mockNodeDef = {
    id: 'nd-1',
    nodeName: '需求确认',
    nodeType: 'task',
    inputSpec: { acceptanceCriteria: '必须包含客户需求' },
    actionSpec: {},
    outputSpec: { qualityStandard: '完整性 > 80%' },
    aiConfig: {},
    progressConfig: { needApproval: true },
  }

  const mockNode = {
    id: 'ni-1',
    instanceId: 'pi-1',
    definitionId: 'nd-1',
    status: 'in_progress',
    percentComplete: 0,
    inputData: {},
    outputData: {},
    assigneeUserId: 'u-1',
    actualStartDate: null,
    definition: mockNodeDef,
    assignee: { id: 'u-1', name: 'Alice' },
    history: [],
    aiReports: [],
    instance: { id: 'pi-1', definition: { id: 'def-1', name: '测试流程' } },
  }

  beforeEach(async () => {
    prisma = {
      nodeInstance: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...mockNode }),
      },
      nodeInstanceHistory: { create: jest.fn().mockResolvedValue({}) },
      processInstance: { findUnique: jest.fn(), update: jest.fn() },
      nodeDefinition: { findMany: jest.fn() },
      task: { create: jest.fn(), updateMany: jest.fn() },
    }
    queueService = { addInspectorJob: jest.fn().mockResolvedValue(undefined) }
    wsGateway = { notifyUser: jest.fn() }

    module = await Test.createTestingModule({
      providers: [
        NodeInstancesService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueService, useValue: queueService },
        { provide: WsGateway, useValue: wsGateway },
      ],
    }).compile()

    service = module.get<NodeInstancesService>(NodeInstancesService)
  })

  afterEach(async () => {
    await module?.close()
  })

  describe('findOne', () => {
    it('should return node instance with relations', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(mockNode)
      const result = await service.findOne('ni-1')
      expect(result.id).toBe('ni-1')
      expect(prisma.nodeInstance.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ni-1' } }),
      )
    })

    it('should throw NotFoundException when node does not exist', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(null)
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('save', () => {
    it('should save input/output data and progress', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(mockNode)
      prisma.nodeInstance.update.mockResolvedValue({ ...mockNode, percentComplete: 50 })

      const result = await service.save('ni-1', {
        inputData: { field1: 'value1' },
        outputData: {},
        percentComplete: 50,
      })
      expect(prisma.nodeInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ni-1' } }),
      )
      expect(result.percentComplete).toBe(50)
    })

    it('should throw NotFoundException when node does not exist', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(null)
      await expect(service.save('missing', {})).rejects.toThrow(NotFoundException)
    })

    it('should throw ConflictException when node is not in_progress', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue({ ...mockNode, status: 'completed' })
      await expect(service.save('ni-1', {})).rejects.toThrow(ConflictException)
    })
  })

  describe('submit', () => {
    it('should enqueue AI inspector when needApproval is true', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(mockNode)
      prisma.nodeInstance.update.mockResolvedValue({ ...mockNode, status: 'ai_inspecting' })

      const result = await service.submit(
        'ni-1',
        { inputData: { field: 'val' }, outputData: { doc: 'report' } },
        'u-1',
      )

      expect(queueService.addInspectorJob).toHaveBeenCalledWith(
        expect.objectContaining({ nodeInstanceId: 'ni-1' }),
      )
      expect(result.status).toBe('ai_inspecting')
    })

    it('should complete immediately when needApproval is false', async () => {
      const nodeNoApproval = {
        ...mockNode,
        definition: { ...mockNodeDef, progressConfig: { needApproval: false } },
      }
      prisma.nodeInstance.findUnique.mockResolvedValue(nodeNoApproval)

      const instanceForAdvance = {
        id: 'pi-1',
        status: 'running',
        nodeInstances: [],
        definition: { nodes: [] },
      }
      prisma.processInstance.findUnique.mockResolvedValue(instanceForAdvance)
      prisma.processInstance.update.mockResolvedValue({})
      prisma.nodeDefinition.findMany.mockResolvedValue([])

      const result = await service.submit('ni-1', {}, 'u-1')
      expect(queueService.addInspectorJob).not.toHaveBeenCalled()
      expect(result.status).toBe('completed')
    })

    it('should throw ConflictException when node is not in_progress', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue({ ...mockNode, status: 'pending_approval' })
      await expect(service.submit('ni-1', {}, 'u-1')).rejects.toThrow(ConflictException)
    })

    it('should throw ConflictException when submitter is not the assignee', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(mockNode)
      await expect(service.submit('ni-1', {}, 'other-user')).rejects.toThrow(ConflictException)
    })

    it('should throw NotFoundException when node does not exist', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(null)
      await expect(service.submit('missing', {}, 'u-1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateProgress', () => {
    it('should update percent complete', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(mockNode)
      prisma.nodeInstance.update.mockResolvedValue({ ...mockNode, percentComplete: 75 })

      const result = await service.updateProgress('ni-1', { percentComplete: 75 })
      expect(prisma.nodeInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { percentComplete: 75 } }),
      )
      expect(result.percentComplete).toBe(75)
    })

    it('should throw NotFoundException when node does not exist', async () => {
      prisma.nodeInstance.findUnique.mockResolvedValue(null)
      await expect(service.updateProgress('missing', { percentComplete: 50 })).rejects.toThrow(NotFoundException)
    })
  })
})
