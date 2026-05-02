import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { AuthService } from './auth.service'
import { PrismaService } from '../prisma/prisma.service'

describe('AuthService', () => {
  let service: AuthService
  let prisma: any
  let jwtService: any

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test',
    passwordHash: 'hashed',
    userRoles: [{ role: { name: 'employee' } }, { role: { name: 'manager' } }],
  }

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } }
    jwtService = { sign: jest.fn().mockReturnValue('token'), verify: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)

      const result = await service.login({ email: 'test@test.com', password: 'pass' })

      expect(result.accessToken).toBe('token')
      expect(result.refreshToken).toBe('token')
      expect(result.user.roles).toEqual(['employee', 'manager'])
    })

    it('should throw on user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.login({ email: 'x@x.com', password: 'pass' }))
        .rejects.toThrow(UnauthorizedException)
    })

    it('should throw on wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)
      await expect(service.login({ email: 'test@test.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException)
    })
  })

  describe('refresh', () => {
    it('should return new access token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1', email: 'e', roles: ['employee'] })
      const result = await service.refresh('valid-token')
      expect(result.accessToken).toBe('token')
    })

    it('should throw on invalid token', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error() })
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException)
    })
  })
})
