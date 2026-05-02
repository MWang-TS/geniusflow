import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async findAll(query: { page: number; pageSize: number; keyword?: string }) {
    const { page, pageSize, keyword } = query
    const where: Record<string, unknown> = {}
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { email: { contains: keyword } },
      ]
    }

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          userRoles: {
            include: {
              role: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ])

    return {
      list: list.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        roles: u.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
        createdAt: u.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!user) throw new NotFoundException('用户不存在')
    return {
      ...user,
      roles: user.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
    }
  }

  async create(dto: { name: string; email: string; password: string; roleIds?: string[] }, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('邮箱已被注册')

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    })

    if (dto.roleIds?.length) {
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
        })),
      })
    }

    await this.auditLog.record({
      userId: actorUserId,
      action: 'create_user',
      resourceType: 'user',
      resourceId: user.id,
      details: { name: user.name, email: user.email },
    })

    return this.findOne(user.id)
  }

  async update(id: string, dto: { name?: string; email?: string; password?: string; status?: string; roleIds?: string[] }, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')

    const data: Record<string, unknown> = {}
    if (dto.name) data.name = dto.name
    if (dto.email) {
      if (dto.email !== user.email) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
        if (existing) throw new ConflictException('邮箱已被占用')
      }
      data.email = dto.email
    }
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10)
    if (dto.status) data.status = dto.status

    await this.prisma.user.update({ where: { id }, data })

    if (dto.roleIds !== undefined) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } })
      if (dto.roleIds.length > 0) {
        await this.prisma.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
        })
      }
    }

    await this.auditLog.record({
      userId: actorUserId,
      action: 'update_user',
      resourceType: 'user',
      resourceId: id,
      details: { ...dto, password: dto.password ? '***' : undefined },
    })

    return this.findOne(id)
  }

  async remove(id: string, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')
    await this.prisma.user.delete({ where: { id } })

    await this.auditLog.record({
      userId: actorUserId,
      action: 'delete_user',
      resourceType: 'user',
      resourceId: id,
      details: { name: user.name, email: user.email },
    })

    return { success: true }
  }
}
