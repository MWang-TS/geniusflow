import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { TasksService } from './tasks.service'

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    return this.service.findAll(
      {
        type,
        status,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      },
      req.user,
    )
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user)
  }

  @Post(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    return this.service.updateStatus(id, status, req.user)
  }

  @Post(':id/approve')
  @Roles('manager', 'admin')
  approve(@Param('id') id: string, @Body('comment') comment: string, @Req() req: any) {
    return this.service.approve(id, comment || '', req.user.userId)
  }

  @Post(':id/reject')
  @Roles('manager', 'admin')
  reject(@Param('id') id: string, @Body('comment') comment: string, @Req() req: any) {
    return this.service.reject(id, comment || '', req.user.userId)
  }
}
