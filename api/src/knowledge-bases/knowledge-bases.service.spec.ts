import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { KnowledgeBasesService } from './knowledge-bases.service'
import { PrismaService } from '../prisma/prisma.service'

// Mock fs so no real disk I/O
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('sample text content'),
  unlinkSync: jest.fn(),
}))

// Prevent fire-and-forget fetch calls from keeping the event loop alive
global.fetch = jest.fn().mockRejectedValue(new Error('fetch not available in tests'))

describe('KnowledgeBasesService', () => {
  let module: TestingModule
  let service: KnowledgeBasesService
  let prisma: any

  const mockKb = {
    id: 'kb-1',
    name: '销售规范',
    type: 'standard',
    description: '销售流程相关规范',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { documents: 3 },
  }

  const mockDoc = {
    id: 'doc-1',
    knowledgeBaseId: 'kb-1',
    fileName: 'spec.txt',
    filePath: '/uploads/kb-1/spec.txt',
    fileSize: BigInt(1024),
    mimeType: 'text/plain',
    parseStatus: 'completed',
    vectorizedStatus: 'completed',
    chunkCount: 5,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    prisma = {
      knowledgeBase: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      knowledgeBaseDocument: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      documentChunk: { deleteMany: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    }

    const configService = { get: jest.fn().mockReturnValue('http://ai-service:5000') }

    module = await Test.createTestingModule({
      providers: [
        KnowledgeBasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile()

    service = module.get<KnowledgeBasesService>(KnowledgeBasesService)
  })

  afterEach(async () => {
    await module?.close()
  })

  describe('findAll', () => {
    it('should return paginated list with documentCount', async () => {
      prisma.knowledgeBase.findMany.mockResolvedValue([mockKb])
      prisma.knowledgeBase.count.mockResolvedValue(1)

      const result = await service.findAll({ page: 1, pageSize: 20 })

      expect(result.list).toHaveLength(1)
      expect(result.list[0].documentCount).toBe(3)
      expect(result.pagination.total).toBe(1)
    })

    it('should filter by type', async () => {
      prisma.knowledgeBase.findMany.mockResolvedValue([])
      prisma.knowledgeBase.count.mockResolvedValue(0)

      await service.findAll({ type: 'standard', page: 1, pageSize: 20 })

      expect(prisma.knowledgeBase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'standard' } }),
      )
    })
  })

  describe('findOne', () => {
    it('should return knowledge base with documentCount', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValue(mockKb)
      const result = await service.findOne('kb-1')
      expect(result.id).toBe('kb-1')
      expect((result as any).documentCount).toBe(3)
    })

    it('should throw NotFoundException when not found', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValue(null)
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('should create a knowledge base', async () => {
      prisma.knowledgeBase.create.mockResolvedValue(mockKb)
      const result = await service.create({ name: '销售规范', type: 'standard' })
      expect(prisma.knowledgeBase.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: '销售规范', type: 'standard' } }),
      )
      expect(result.id).toBe('kb-1')
    })
  })

  describe('update', () => {
    it('should update a knowledge base', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValue(mockKb)
      prisma.knowledgeBase.update.mockResolvedValue({ ...mockKb, name: '更新后名称' })

      const result = await service.update('kb-1', { name: '更新后名称' })
      expect(prisma.knowledgeBase.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'kb-1' } }),
      )
      expect(result.name).toBe('更新后名称')
    })

    it('should throw NotFoundException when not found', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValue(null)
      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('getDocuments', () => {
    it('should return paginated documents for a knowledge base', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValue(mockKb)
      prisma.knowledgeBaseDocument.findMany.mockResolvedValue([mockDoc])
      prisma.knowledgeBaseDocument.count.mockResolvedValue(1)

      const result = await service.getDocuments('kb-1', { page: 1, pageSize: 10 })
      expect(result.list).toHaveLength(1)
      expect(result.list[0].fileName).toBe('spec.txt')
    })

    it('should throw NotFoundException when kb not found', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValue(null)
      await expect(service.getDocuments('missing', { page: 1, pageSize: 10 })).rejects.toThrow(NotFoundException)
    })
  })

  describe('uploadDocument', () => {
    it('should save file metadata and trigger async processing', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValue(mockKb)
      prisma.knowledgeBaseDocument.create.mockResolvedValue(mockDoc)
      prisma.knowledgeBaseDocument.update.mockResolvedValue(mockDoc)

      const file = {
        originalname: 'test.txt',
        buffer: Buffer.from('hello world'),
        size: 11,
        mimetype: 'text/plain',
      }

      const result = await service.uploadDocument('kb-1', file)
      expect(prisma.knowledgeBaseDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            knowledgeBaseId: 'kb-1',
            fileName: 'test.txt',
            parseStatus: 'pending',
            vectorizedStatus: 'pending',
          }),
        }),
      )
      expect(result.id).toBe('doc-1')
    })
  })

  describe('retryVectorize', () => {
    it('should reset status and re-trigger processing', async () => {
      prisma.knowledgeBaseDocument.findFirst.mockResolvedValue(mockDoc)
      prisma.knowledgeBaseDocument.update.mockResolvedValue(mockDoc)
      prisma.documentChunk.deleteMany.mockResolvedValue({})

      const result = await service.retryVectorize('kb-1', 'doc-1')
      expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc-1' } })
      expect(result.message).toContain('重新向量化')
    })

    it('should throw NotFoundException when doc not found', async () => {
      prisma.knowledgeBaseDocument.findFirst.mockResolvedValue(null)
      await expect(service.retryVectorize('kb-1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })
})
