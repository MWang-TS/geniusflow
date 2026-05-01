import {
  Controller, Get, Post, Param, Query, UseGuards, Req,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    return this.service.findAll(req.user.userId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      status,
    })
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: any) {
    return this.service.getUnreadCount(req.user.userId)
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.service.markRead(id, req.user.userId)
  }

  @Post('read-all')
  markAllRead(@Req() req: any) {
    return this.service.markAllRead(req.user.userId)
  }

  @Post('scan-overdue')
  scanOverdue() {
    return this.service.scanOverdue()
  }
}
