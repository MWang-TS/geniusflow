import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { ProcessInstancesService } from './process-instances.service'
import { CreateProcessInstanceDto, TerminateProcessInstanceDto } from './dto/create-process-instance.dto'

@Controller('process-instances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcessInstancesController {
  constructor(private readonly service: ProcessInstancesService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: string) {
    return this.service.findAll({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      status,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  @Roles('designer', 'manager', 'admin')
  create(@Body() dto: CreateProcessInstanceDto, @Req() req: any) {
    return this.service.create(dto, req.user.userId)
  }

  @Post(':id/terminate')
  @Roles('manager', 'admin')
  terminate(@Param('id') id: string, @Body() dto: TerminateProcessInstanceDto) {
    return this.service.terminate(id, dto.reason)
  }
}
