import { Module } from '@nestjs/common'
import { ApiKeyController, OpenAiCompatController } from './open-api.controller'
import { OpenApiService } from './open-api.service'
import { PrismaModule } from '../prisma/prisma.module'
import { ApiKeyGuard } from './api-key.guard'
import { SkillChatModule } from '../skill-chat/skill-chat.module'

@Module({
  imports: [PrismaModule, SkillChatModule],
  controllers: [ApiKeyController, OpenAiCompatController],
  providers: [OpenApiService, ApiKeyGuard],
})
export class OpenApiModule {}
