import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditLogService } from '../audit-log/audit-log.service'

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
    })
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })
    if (!role) throw new NotFoundException('角色不存在')
    return {
      ...role,
      users: role.userRoles.map((ur) => ({
        id: ur.user.id,
        name: ur.user.name,
        email: ur.user.email,
      })),
    }
  }

  async create(dto: { name: string; description?: string; permissions?: string[] }, actorUserId: string) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } })
    if (existing) throw new ConflictException('角色名已存在')

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions || [],
      },
    })

    await this.auditLog.record({
      userId: actorUserId,
      action: 'create_role',
      resourceType: 'role',
      resourceId: role.id,
      details: { name: role.name },
    })

    return role
  }

  async update(id: string, dto: { name?: string; description?: string; permissions?: string[] }, actorUserId: string) {
    const role = await this.prisma.role.findUnique({ where: { id } })
    if (!role) throw new NotFoundException('角色不存在')

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name: dto.name } })
      if (existing) throw new ConflictException('角色名已存在')
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
    })

    await this.auditLog.record({
      userId: actorUserId,
      action: 'update_role',
      resourceType: 'role',
      resourceId: id,
      details: dto,
    })

    return updated
  }

  async remove(id: string, actorUserId: string) {
    const role = await this.prisma.role.findUnique({ where: { id } })
    if (!role) throw new NotFoundException('角色不存在')

    const userCount = await this.prisma.userRole.count({ where: { roleId: id } })
    if (userCount > 0) throw new ConflictException('角色下存在用户，无法删除')

    await this.prisma.role.delete({ where: { id } })

    await this.auditLog.record({
      userId: actorUserId,
      action: 'delete_role',
      resourceType: 'role',
      resourceId: id,
      details: { name: role.name },
    })

    return { success: true }
  }

  async getRoutePermissions(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, select: { id: true, name: true, routePermissions: true } })
    if (!role) throw new NotFoundException('角色不存在')
    return role
  }

  async updateRoutePermissions(id: string, routes: string[], actorUserId: string) {
    const role = await this.prisma.role.findUnique({ where: { id } })
    if (!role) throw new NotFoundException('角色不存在')

    const updated = await this.prisma.role.update({
      where: { id },
      data: { routePermissions: routes },
      select: { id: true, name: true, routePermissions: true },
    })

    await this.auditLog.record({
      userId: actorUserId,
      action: 'update_role_routes',
      resourceType: 'role',
      resourceId: id,
      details: { routes },
    })

    return updated
  }

  /** 获取用户可访问的路由（所有角色的路由权限并集；admin角色返回 null 表示全部可见） */
  async getUserRoutePermissions(userId: string): Promise<string[] | null> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true, routePermissions: true } } },
    })

    const roleNames = userRoles.map((ur) => ur.role.name)
    if (roleNames.includes('admin')) return null // admin 全部可见

    const allRoutes = new Set<string>()
    for (const ur of userRoles) {
      const routes = ur.role.routePermissions as string[]
      if (Array.isArray(routes)) {
        routes.forEach((r) => allRoutes.add(r))
      }
    }
    return Array.from(allRoutes)
  }
}
