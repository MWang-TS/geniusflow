import { Module } from '@nestjs/common'
import { SkillChatController } from './skill-chat.controller'
import { SkillChatService } from './skill-chat.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [SkillChatController],
  providers: [SkillChatService],
  exports: [SkillChatService],
})
export class SkillChatModule {}
