import {
  Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesService } from './roles.service'

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  findAll() {
    return this.service.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Body() dto: { name: string; description?: string; permissions?: string[] }, @Req() req: any) {
    return this.service.create(dto, req.user.userId)
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; permissions?: string[] },
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user.userId)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.userId)
  }

  @Get(':id/routes')
  getRoutePermissions(@Param('id') id: string) {
    return this.service.getRoutePermissions(id)
  }

  @Put(':id/routes')
  updateRoutePermissions(
    @Param('id') id: string,
    @Body() dto: { routes: string[] },
    @Req() req: any,
  ) {
    return this.service.updateRoutePermissions(id, dto.routes || [], req.user.userId)
  }
}
