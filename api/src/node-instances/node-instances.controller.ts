import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { NodeInstancesService } from './node-instances.service'
import { SaveNodeInstanceDto, SubmitNodeInstanceDto, UpdateProgressDto } from './dto/node-instance.dto'

@Controller('node-instances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NodeInstancesController {
  constructor(private readonly service: NodeInstancesService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post(':id/save')
  save(@Param('id') id: string, @Body() dto: SaveNodeInstanceDto) {
    return this.service.save(id, dto)
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitNodeInstanceDto, @Req() req: any) {
    return this.service.submit(id, dto, req.user.userId)
  }

  @Post(':id/progress')
  updateProgress(@Param('id') id: string, @Body() dto: UpdateProgressDto) {
    return this.service.updateProgress(id, dto)
  }
}
