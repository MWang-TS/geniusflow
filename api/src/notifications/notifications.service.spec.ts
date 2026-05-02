import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { PrismaService } from '../prisma/prisma.service'

describe('NotificationsService', () => {
  let service: NotificationsService
  let prisma: any

  const mockNotification = {
    id: 'n-1', userId: 'u-1', type: 'overdue', title: 'test',
    content: 'body', channel: 'in_app', status: 'unread',
    relatedResourceType: 'node_instance', relatedResourceId: 'ni-1',
    readAt: null, createdAt: new Date(),
  }

  beforeEach(async () => {
    prisma = {
      notification: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
      nodeInstance: { findMany: jest.fn() },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<NotificationsService>(NotificationsService)
  })

  describe('findAll', () => {
    it('should return paginated list', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification])
      prisma.notification.count.mockResolvedValue(1)
      const result = await service.findAll('u-1', { page: 1, pageSize: 20 })
      expect(result.list).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })
  })

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      prisma.notification.count.mockResolvedValue(3)
      const result = await service.getUnreadCount('u-1')
      expect(result).toBe(3)
    })
  })

  describe('markRead', () => {
    it('should mark as read', async () => {
      prisma.notification.findFirst.mockResolvedValue(mockNotification)
      prisma.notification.update.mockResolvedValue({ ...mockNotification, status: 'read' })
      const result = await service.markRead('n-1', 'u-1')
      expect(result.status).toBe('read')
    })

    it('should throw if not found', async () => {
      prisma.notification.findFirst.mockResolvedValue(null)
      await expect(service.markRead('n-1', 'u-1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('markAllRead', () => {
    it('should mark all as read', async () => {
      const result = await service.markAllRead('u-1')
      expect(result.success).toBe(true)
      expect(prisma.notification.updateMany).toHaveBeenCalled()
    })
  })

  describe('scanOverdue', () => {
    it('should create notifications for overdue nodes', async () => {
      const overdueNode = {
        id: 'ni-1',
        instance: { id: 'pi-1', createdBy: 'u-1' },
        definition: { nodeName: '测试节点' },
      }
      prisma.nodeInstance.findMany.mockResolvedValue([overdueNode])
      prisma.notification.findFirst.mockResolvedValue(null)
      prisma.notification.create.mockResolvedValue(mockNotification)

      const result = await service.scanOverdue()
      expect(result.scanned).toBe(1)
      expect(prisma.notification.create).toHaveBeenCalledTimes(1)
    })

    it('should skip if already notified within 24h', async () => {
      const overdueNode = {
        id: 'ni-1',
        instance: { id: 'pi-1', createdBy: 'u-1' },
        definition: { nodeName: '测试节点' },
      }
      prisma.nodeInstance.findMany.mockResolvedValue([overdueNode])
      prisma.notification.findFirst.mockResolvedValue({ id: 'existing' })

      const result = await service.scanOverdue()
      expect(result.scanned).toBe(1)
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })
  })
})
