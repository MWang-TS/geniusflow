import { Module } from '@nestjs/common'
import { NodeInstancesController } from './node-instances.controller'
import { NodeInstancesService } from './node-instances.service'

@Module({
  controllers: [NodeInstancesController],
  providers: [NodeInstancesService],
  exports: [NodeInstancesService],
})
export class NodeInstancesModule {}
