import { Module } from '@nestjs/common'
import { NodeInstancesController } from './node-instances.controller'
import { NodeInstancesService } from './node-instances.service'
import { QueueModule } from '../queue/queue.module'
import { WsModule } from '../ws/ws.module'

@Module({
  imports: [QueueModule, WsModule],
  controllers: [NodeInstancesController],
  providers: [NodeInstancesService],
  exports: [NodeInstancesService],
})
export class NodeInstancesModule {}
