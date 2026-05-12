import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { ProcessDefinitionsService } from './process-definitions.service'
import { CreateProcessDefinitionDto, UpdateProcessDefinitionDto, QueryProcessDefinitionDto } from './dto/create-process-definition.dto'

@Controller('process-definitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcessDefinitionsController {
  constructor(private readonly service: ProcessDefinitionsService) {}

  @Get()
  findAll(@Query() query: QueryProcessDefinitionDto) {
    return this.service.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  @Roles('designer', 'admin')
  create(@Body() dto: CreateProcessDefinitionDto, @Req() req: any) {
    return this.service.create(dto, req.user.userId)
  }

  @Put(':id')
  @Roles('designer', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateProcessDefinitionDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @Roles('designer', 'admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Post(':id/publish')
  @Roles('designer', 'admin')
  publish(@Param('id') id: string, @Req() req: any) {
    return this.service.publish(id, req.user.userId)
  }

  @Post(':id/stop')
  @Roles('designer', 'admin')
  stop(@Param('id') id: string, @Req() req: any) {
    return this.service.stop(id, req.user.userId)
  }

  @Post(':id/reopen')
  @Roles('designer', 'admin')
  reopen(@Param('id') id: string, @Req() req: any) {
    return this.service.reopen(id, req.user.userId)
  }
}
