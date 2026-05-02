import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AiReportsService {
  constructor(private prisma: PrismaService) {}

  async findByNodeInstance(nodeInstanceId: string) {
    const nodeInstance = await this.prisma.nodeInstance.findUnique({
      where: { id: nodeInstanceId },
    })
    if (!nodeInstance) throw new NotFoundException('节点实例不存在')

    const reports = await this.prisma.aiReport.findMany({
      where: { nodeInstanceId },
      orderBy: { createdAt: 'desc' },
    })

    const inspectorReport = reports.find((r) => r.reportType === 'inspector')
    const assistantReport = reports.find((r) => r.reportType === 'assistant')

    return {
      inspectorReport: inspectorReport ? {
        id: inspectorReport.id,
        passed: (inspectorReport.content as any)?.passed,
        score: (inspectorReport.content as any)?.score,
        issues: (inspectorReport.content as any)?.issues || [],
        createdAt: inspectorReport.createdAt,
      } : null,
      assistantReport: assistantReport ? {
        id: assistantReport.id,
        recommendation: (assistantReport.content as any)?.recommendation,
        confidence: (assistantReport.content as any)?.confidence,
        summary: (assistantReport.content as any)?.summary,
        risks: (assistantReport.content as any)?.risks || [],
        createdAt: assistantReport.createdAt,
      } : null,
    }
  }
}
