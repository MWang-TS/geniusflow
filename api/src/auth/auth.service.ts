import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.userRoles.map((ur) => ur.role.name),
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      expiresIn: 7200,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: payload.roles,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      return {
        accessToken: this.jwtService.sign({
          sub: payload.sub,
          email: payload.email,
          roles: payload.roles,
        }),
        expiresIn: 7200,
      };
    } catch {
      throw new UnauthorizedException('Token 无效或已过期');
    }
  }

  /** 获取用户可访问的路由列表（admin 返回 null 表示全部可见） */
  async getUserRoutePermissions(userId: string): Promise<{ routes: string[] | null }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true, routePermissions: true } } },
    });

    const roleNames = userRoles.map((ur) => ur.role.name);
    if (roleNames.includes('admin')) {
      return { routes: null }; // null = 全部可见
    }

    const allRoutes = new Set<string>();
    for (const ur of userRoles) {
      const routes = ur.role.routePermissions as string[];
      if (Array.isArray(routes)) {
        routes.forEach((r) => allRoutes.add(r));
      }
    }
    return { routes: Array.from(allRoutes) };
  }
}
