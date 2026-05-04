import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as crypto from 'crypto'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const authHeader: string | undefined = request.headers['authorization']

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少 API 密钥')
    }

    const rawKey = authHeader.slice(7).trim()
    if (!rawKey) throw new UnauthorizedException('API 密钥为空')

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            userRoles: { include: { role: { select: { name: true } } } },
          },
        },
      },
    })

    if (!apiKey || !apiKey.isEnabled) {
      throw new UnauthorizedException('API 密钥无效或已禁用')
    }

    if (!apiKey.user || apiKey.user.status !== 'active') {
      throw new UnauthorizedException('API 密钥所属用户已被禁用')
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API 密钥已过期')
    }

    // Attach key context to request
    request.apiKey = apiKey

    // Async usage tracking (fire-and-forget)
    this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    }).catch(() => {})

    return true
  }
}
