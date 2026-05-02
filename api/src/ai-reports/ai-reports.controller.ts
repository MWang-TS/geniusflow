import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AiReportsService } from './ai-reports.service'

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiReportsController {
  constructor(private readonly service: AiReportsService) {}

  @Get('reports/:nodeInstanceId')
  findByNodeInstance(@Param('nodeInstanceId') nodeInstanceId: string) {
    return this.service.findByNodeInstance(nodeInstanceId)
  }
}
