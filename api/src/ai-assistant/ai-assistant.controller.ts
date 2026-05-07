import { Controller, Post, Body, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common'
import { Request, Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AiAssistantService } from './ai-assistant.service'
import { ChatRequestDto } from './dto/chat.dto'

@Controller('ai-assistant')
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
  constructor(private readonly service: AiAssistantService) {}

  @Post('chat')
  async chat(
    @Body(new ValidationPipe({ whitelist: true })) dto: ChatRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = (req as any).user
    const userId: string = user.userId
    const roles: string[] = user.roles ?? []

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    await this.service.chat(userId, roles, dto.message, dto.history ?? [], dto.knowledgeBaseIds ?? [], res)
  }
}
