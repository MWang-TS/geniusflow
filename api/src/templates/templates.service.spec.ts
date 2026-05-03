import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { TemplatesService } from './templates.service'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'

describe('TemplatesService', () => {
  let module: TestingModule
  let service: TemplatesService
  let prisma: any
  let auditLog: any

  const mockNodeDef = {
    id: 'nd-1',
    nodeName: '任务节点',
    nodeType: 'task',
    sortOrder: 0,
    inputSpec: {},
    actionSpec: {},
    outputSpec: {},
    aiConfig: {},
    progressConfig: {},
  }

  const mockTemplate = {
    id: 'tpl-1',
    name: '销售流程模板',
    description: '通用销售跟进流程',
    category: '销售',
    version: 1,
    graphJson: { nodes: [], edges: [] },
    status: 'published',
    isTemplate: true,
    isPreset: true,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    nodes: [mockNodeDef],
  }

  beforeEach(async () => {
    prisma = {
      processDefinition: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    }
    auditLog = { record: jest.fn().mockResolvedValue(undefined) }

    module = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile()

    service = module.get<TemplatesService>(TemplatesService)
  })

  afterEach(async () => {
    await module?.close()
  })

  describe('findAll', () => {
    it('should return paginated template list', async () => {
      const listItem = { ...mockTemplate, nodes: [{ id: 'nd-1' }] }
      prisma.processDefinition.findMany.mockResolvedValue([listItem])
      prisma.processDefinition.count.mockResolvedValue(1)

      const result = await service.findAll({ page: 1, pageSize: 20 })

      expect(result.list).toHaveLength(1)
      expect(result.list[0].id).toBe('tpl-1')
      expect(result.list[0].nodeCount).toBe(1)
      expect(result.pagination.total).toBe(1)
    })

    it('should filter by category', async () => {
      prisma.processDefinition.findMany.mockResolvedValue([])
      prisma.processDefinition.count.mockResolvedValue(0)

      await service.findAll({ page: 1, pageSize: 20, category: '销售' })

      expect(prisma.processDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: '销售', isTemplate: true }),
        }),
      )
    })

    it('should filter by keyword using OR on name and description', async () => {
      prisma.processDefinition.findMany.mockResolvedValue([])
      prisma.processDefinition.count.mockResolvedValue(0)

      await service.findAll({ page: 1, pageSize: 20, keyword: '销售' })

      expect(prisma.processDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: '销售', mode: 'insensitive' } },
              { description: { contains: '销售', mode: 'insensitive' } },
            ],
          }),
        }),
      )
    })

    it('should return correct pagination metadata', async () => {
      prisma.processDefinition.findMany.mockResolvedValue([])
      prisma.processDefinition.count.mockResolvedValue(45)

      const result = await service.findAll({ page: 2, pageSize: 20 })
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 20,
        total: 45,
        totalPages: 3,
      })
    })
  })

  describe('clone', () => {
    it('should throw NotFoundException when template not found', async () => {
      prisma.processDefinition.findUnique.mockResolvedValue(null)
      await expect(service.clone('missing', 'u-1')).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException when definition is not a template', async () => {
      prisma.processDefinition.findUnique.mockResolvedValue({
        ...mockTemplate,
        isTemplate: false,
      })
      await expect(service.clone('tpl-1', 'u-1')).rejects.toThrow(NotFoundException)
    })

    it('should clone template and its nodes', async () => {
      prisma.processDefinition.findUnique.mockResolvedValue(mockTemplate)

      const clonedDef = {
        id: 'new-def-1',
        name: '销售流程模板 (副本)',
        status: 'draft',
      }
      const mockTx = {
        processDefinition: {
          create: jest.fn().mockResolvedValue(clonedDef),
        },
        nodeDefinition: {
          create: jest.fn().mockResolvedValue({}),
        },
      }
      prisma.$transaction.mockImplementation((fn: Function) => fn(mockTx))

      const result = await service.clone('tpl-1', 'u-1')

      expect(mockTx.processDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '销售流程模板 (副本)',
            isTemplate: false,
            isPreset: false,
            createdBy: 'u-1',
          }),
        }),
      )
      expect(mockTx.nodeDefinition.create).toHaveBeenCalledTimes(mockTemplate.nodes.length)
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'clone_template' }),
      )
      expect(result.id).toBe('new-def-1')
    })
  })
})
