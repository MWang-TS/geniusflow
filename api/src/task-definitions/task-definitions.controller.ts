import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { TaskDefinitionsService } from './task-definitions.service'
import { CreateTaskDefinitionDto, UpdateTaskDefinitionDto } from './dto/task-definition.dto'

@Controller('process-definitions/:processId/task-defs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaskDefinitionsController {
  constructor(private readonly service: TaskDefinitionsService) {}

  /** 获取整个流程所有节点的任务定义 */
  @Get()
  findByProcess(@Param('processId') processId: string) {
    return this.service.findByProcess(processId)
  }

  /** 获取特定节点的任务定义 */
  @Get('nodes/:nodeId')
  findByNode(
    @Param('processId') processId: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.service.findByNode(processId, nodeId)
  }

  /** 创建任务定义 */
  @Post('nodes/:nodeId')
  @Roles('designer', 'admin')
  create(
    @Param('processId') processId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: CreateTaskDefinitionDto,
  ) {
    return this.service.create(processId, nodeId, dto)
  }

  /** 更新任务定义 */
  @Put('nodes/:nodeId/:id')
  @Roles('designer', 'admin')
  update(
    @Param('processId') processId: string,
    @Param('nodeId') nodeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDefinitionDto,
  ) {
    return this.service.update(processId, nodeId, id, dto)
  }

  /** 删除任务定义 */
  @Delete('nodes/:nodeId/:id')
  @Roles('designer', 'admin')
  remove(
    @Param('processId') processId: string,
    @Param('nodeId') nodeId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(processId, nodeId, id)
  }

  /** 从检查清单同步为任务定义 */
  @Post('nodes/:nodeId/sync-checklist')
  @Roles('designer', 'admin')
  syncFromChecklist(
    @Param('processId') processId: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.service.syncFromChecklist(processId, nodeId)
  }
}
