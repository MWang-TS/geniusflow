import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Queue from 'bull'

export interface AiInspectorJobData {
  nodeInstanceId: string
  processInstanceId: string
  nodeName: string
  inputData: Record<string, unknown>
  outputData: Record<string, unknown>
  acceptanceCriteria: string
  qualityStandard: string
  userId: string
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private queues: Map<string, Queue.Queue> = new Map()
  private redisUrl: string

  constructor(private configService: ConfigService) {
    this.redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379'
  }

  getQueue(name: string): Queue.Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, this.redisUrl)
      this.queues.set(name, queue)
    }
    return this.queues.get(name)!
  }

  async addInspectorJob(data: AiInspectorJobData) {
    const queue = this.getQueue('ai-inspector')
    return queue.add(data, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
      timeout: 15000,
    })
  }

  async onModuleDestroy() {
    for (const queue of this.queues.values()) {
      await queue.close()
    }
  }
}
