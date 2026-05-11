import { Module } from '@nestjs/common'
import { TaskDefinitionsController } from './task-definitions.controller'
import { TaskDefinitionsService } from './task-definitions.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [TaskDefinitionsController],
  providers: [TaskDefinitionsService],
  exports: [TaskDefinitionsService],
})
export class TaskDefinitionsModule {}
