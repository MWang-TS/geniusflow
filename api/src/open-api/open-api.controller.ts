import {
  Controller, Get, Post, Delete, Body, Param, Req, Res, UseGuards, ValidationPipe,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { ApiKeyGuard } from './api-key.guard'
import { OpenApiService } from './open-api.service'
import { CreateApiKeyDto, OpenAiChatCompletionDto } from './dto/open-api.dto'

// ── API Key management routes (JWT-protected, for the API Platform UI) ──────
@Controller('open-api')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'designer')
export class ApiKeyController {
  constructor(private readonly service: OpenApiService) {}

  @Post('keys')
  async create(
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateApiKeyDto,
    @Req() req: Request,
  ) {
    const userId: string = (req as any).user.userId
    return this.service.createKey(userId, (req as any).user.roles ?? [], dto)
  }

  @Get('keys')
  async list(@Req() req: Request) {
    const userId: string = (req as any).user.userId
    return this.service.listKeys(userId)
  }

  @Delete('keys/:id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const userId: string = (req as any).user.userId
    return this.service.deleteKey(userId, id)
  }
}

// ── OpenAI-compatible chat endpoint (API key auth, for external integrations) ─
@Controller('open/v1')
@UseGuards(ApiKeyGuard)
export class OpenAiCompatController {
  constructor(private readonly service: OpenApiService) {}

  @Post('chat/completions')
  async chatCompletions(@Body() body: OpenAiChatCompletionDto, @Req() req: Request, @Res() res: Response) {
    const apiKeyRecord = (req as any).apiKey
    const stream = body.stream ?? false

    await this.service.chatCompletions(
      apiKeyRecord,
      body.messages ?? [],
      body.knowledge_base_ids ?? [],
      body.agent_role_id,
      stream,
      res,
    )
  }
}
