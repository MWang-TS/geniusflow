import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { NodeDefinitionsService } from './node-definitions.service'
import { UpdateNodeDefinitionDto } from './dto/update-node-definition.dto'

@Controller('node-definitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NodeDefinitionsController {
  constructor(private readonly service: NodeDefinitionsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Put(':id')
  @Roles('designer', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateNodeDefinitionDto) {
    return this.service.update(id, dto)
  }
}
