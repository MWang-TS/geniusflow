import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AiAssistantController } from './ai-assistant.controller'
import { AiAssistantService } from './ai-assistant.service'

@Module({
  imports: [ConfigModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
