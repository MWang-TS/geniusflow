import { Module } from '@nestjs/common'
import { ProcessInstancesController } from './process-instances.controller'
import { ProcessInstancesService } from './process-instances.service'
import { TaskDefinitionsModule } from '../task-definitions/task-definitions.module'

@Module({
  imports: [TaskDefinitionsModule],
  controllers: [ProcessInstancesController],
  providers: [ProcessInstancesService],
  exports: [ProcessInstancesService],
})
export class ProcessInstancesModule {}
