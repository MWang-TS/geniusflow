import { Controller, Post, Body, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common'
import { Request, Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { SkillChatService } from './skill-chat.service'
import { SkillChatDto } from './dto/skill-chat.dto'

@Controller('skill-chat')
@UseGuards(JwtAuthGuard)
export class SkillChatController {
  constructor(private readonly service: SkillChatService) {}

  @Post('chat')
  async chat(
    @Body(new ValidationPipe({ whitelist: true })) dto: SkillChatDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = (req as any).user
    const userId: string = user.userId

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    await this.service.chat(
      userId,
      user.roles ?? [],
      dto.message,
      dto.history ?? [],
      dto.knowledgeBaseIds ?? [],
      dto.agentRoleId,
      res,
    )
  }
}
