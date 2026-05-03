import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Bull from 'bull'
import { PrismaService } from '../prisma/prisma.service'
import { WsGateway } from '../ws/ws.gateway'
import { QueueService, type AiInspectorJobData } from './queue.service'

interface InspectorIssue {
  type: 'error' | 'warning'
  field: string
  message: string
  suggestion?: string
}

interface InspectorResult {
  passed: boolean
  score: number
  issues: InspectorIssue[]
  summary: string
}

@Injectable()
export class AiInspectorProcessor {
  private readonly logger = new Logger(AiInspectorProcessor.name)
  private aiServiceUrl: string

  constructor(
    private queueService: QueueService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private wsGateway: WsGateway,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:5000'
  }

  onModuleInit() {
    const queue = this.queueService.getQueue('ai-inspector')
    queue.process(2, async (job: Bull.Job<AiInspectorJobData>) => {
      return this.processInspectorJob(job)
    })

    queue.on('completed', (job: Bull.Job<AiInspectorJobData>, result: InspectorResult) => {
      this.logger.log(`AI inspection completed for node ${job.data.nodeInstanceId}: passed=${result.passed}`)
    })

    queue.on('failed', (job: Bull.Job<AiInspectorJobData>, err: Error) => {
      this.logger.error(`AI inspection failed for node ${job.data.nodeInstanceId}: ${err.message}`)
      this.handleFallback(job.data).catch((e) =>
        this.logger.error(`Fallback failed: ${e.message}`),
      )
    })
  }

  private async processInspectorJob(job: Bull.Job<AiInspectorJobData>): Promise<InspectorResult> {
    const { nodeName, inputData, outputData, acceptanceCriteria, qualityStandard } = job.data

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      const response = await fetch(`${this.aiServiceUrl}/ai/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeName,
          inputData,
          outputData,
          acceptanceCriteria: acceptanceCriteria || '无特定要求',
          qualityStandard: qualityStandard || '无特定要求',
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`)
      }

      const result: InspectorResult = await response.json()

      await this.saveAiReport(job.data.nodeInstanceId, result)

      if (result.passed) {
        await this.handlePassed(job.data)
      } else {
        await this.handleRejected(job.data, result)
      }

      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (err instanceof DOMException && err.name === 'AbortError') {
        await this.handleFallback(job.data)
        return {
          passed: true,
          score: 0,
          issues: [{ type: 'warning', field: 'system', message: 'AI 校验超时，已降级处理' }],
          summary: 'AI 校验超时，请人工审核',
        }
      }
      throw new Error(`AI inspection failed: ${message}`)
    }
  }

  private async handlePassed(data: AiInspectorJobData) {
    const { nodeInstanceId, processInstanceId, userId } = data

    await this.prisma.nodeInstance.update({
      where: { id: nodeInstanceId },
      data: { status: 'pending_approval', actualEndDate: new Date() },
    })

    await this.prisma.nodeInstanceHistory.create({
      data: {
        nodeInstanceId,
        eventType: 'ai_pass',
        fromStatus: 'ai_inspecting',
        toStatus: 'pending_approval',
        details: { message: 'AI 督导通过' },
      },
    })

    const taskNode = await this.prisma.nodeInstance.findUnique({
      where: { id: nodeInstanceId },
      include: {
        definition: { select: { progressConfig: true } },
        instance: { select: { createdBy: true } },
      },
    })

    if (taskNode) {
      await this.prisma.task.updateMany({
        where: { nodeInstanceId, type: 'execute', status: 'pending' },
        data: { status: 'completed' },
      })
      await this.prisma.task.create({
        data: {
          nodeInstanceId,
          assigneeUserId: taskNode.instance.createdBy,
          type: 'approve',
          status: 'pending',
        },
      })
    }

    this.wsGateway.notifyUser(userId, 'ai:result', {
      nodeInstanceId,
      status: 'pending_approval',
      passed: true,
      message: 'AI 督导通过，已提交审批',
    })
  }

  private async handleRejected(data: AiInspectorJobData, result: InspectorResult) {
    const { nodeInstanceId, userId } = data

    await this.prisma.nodeInstance.update({
      where: { id: nodeInstanceId },
      data: { status: 'in_progress', percentComplete: 0 },
    })

    await this.prisma.nodeInstanceHistory.create({
      data: {
        nodeInstanceId,
        eventType: 'ai_reject',
        fromStatus: 'ai_inspecting',
        toStatus: 'in_progress',
        details: {
          message: 'AI 督导拦截',
          issues: result.issues,
          summary: result.summary,
        } as any,
      },
    })

    this.wsGateway.notifyUser(userId, 'ai:result', {
      nodeInstanceId,
      status: 'in_progress',
      passed: false,
      score: result.score,
      issues: result.issues,
      summary: result.summary,
      message: 'AI 督导未通过，请根据意见修改',
    })
  }

  private async handleFallback(data: AiInspectorJobData) {
    const { nodeInstanceId, processInstanceId, userId } = data

    await this.prisma.nodeInstance.update({
      where: { id: nodeInstanceId },
      data: { status: 'pending_approval', actualEndDate: new Date() },
    })

    await this.prisma.nodeInstanceHistory.create({
      data: {
        nodeInstanceId,
        eventType: 'ai_fallback',
        fromStatus: 'ai_inspecting',
        toStatus: 'pending_approval',
        details: { message: 'AI 校验失败，已降级为人工审核' },
      },
    })

    const taskNode = await this.prisma.nodeInstance.findUnique({
      where: { id: nodeInstanceId },
      include: { instance: { select: { createdBy: true } } },
    })

    if (taskNode) {
      await this.prisma.task.create({
        data: {
          nodeInstanceId,
          assigneeUserId: taskNode.instance.createdBy,
          type: 'approve',
          status: 'pending',
        },
      })
    }

    this.wsGateway.notifyUser(userId, 'ai:result', {
      nodeInstanceId,
      status: 'pending_approval',
      passed: true,
      isFallback: true,
      message: 'AI 校验超时，已降级为人工审核',
    })
  }

  private async saveAiReport(nodeInstanceId: string, result: InspectorResult) {
    await this.prisma.aiReport.create({
      data: {
        nodeInstanceId,
        reportType: 'inspection',
        content: result as any,
      },
    })
  }
}
