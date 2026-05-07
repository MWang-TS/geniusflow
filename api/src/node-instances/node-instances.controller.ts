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
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user)
  }

  @Post(':id/save')
  save(@Param('id') id: string, @Body() dto: SaveNodeInstanceDto, @Req() req: any) {
    return this.service.save(id, dto, req.user)
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitNodeInstanceDto, @Req() req: any) {
    return this.service.submit(id, dto, req.user)
  }

  @Post(':id/progress')
  updateProgress(@Param('id') id: string, @Body() dto: UpdateProgressDto, @Req() req: any) {
    return this.service.updateProgress(id, dto, req.user)
  }
}
