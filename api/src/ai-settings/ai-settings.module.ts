import { Module } from '@nestjs/common'
import { AiSettingsController } from './ai-settings.controller'
import { AiSettingsService } from './ai-settings.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [AiSettingsController],
  providers: [AiSettingsService],
  exports: [AiSettingsService],
})
export class AiSettingsModule {}
