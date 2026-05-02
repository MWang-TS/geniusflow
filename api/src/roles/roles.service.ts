import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

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

  async create(dto: { name: string; description?: string; permissions?: string[] }) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } })
    if (existing) throw new ConflictException('角色名已存在')

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions || [],
      },
    })
  }

  async update(id: string, dto: { name?: string; description?: string; permissions?: string[] }) {
    const role = await this.prisma.role.findUnique({ where: { id } })
    if (!role) throw new NotFoundException('角色不存在')

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name: dto.name } })
      if (existing) throw new ConflictException('角色名已存在')
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
    })
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } })
    if (!role) throw new NotFoundException('角色不存在')

    const userCount = await this.prisma.userRole.count({ where: { roleId: id } })
    if (userCount > 0) throw new ConflictException('角色下存在用户，无法删除')

    await this.prisma.role.delete({ where: { id } })
    return { success: true }
  }
}
