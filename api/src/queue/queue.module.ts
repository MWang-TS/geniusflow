import { Module } from '@nestjs/common'
import { QueueService } from './queue.service'
import { AiInspectorProcessor } from './ai-inspector.processor'
import { WsModule } from '../ws/ws.module'

@Module({
  imports: [WsModule],
  providers: [QueueService, AiInspectorProcessor],
  exports: [QueueService],
})
export class QueueModule {}
