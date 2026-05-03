import {
  Controller, Get, Post, Param, Query, UseGuards, Req,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TemplatesService } from './templates.service'

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      category,
      keyword,
    })
  }

  @Post(':id/clone')
  clone(@Param('id') id: string, @Req() req: any) {
    return this.service.clone(id, req.user.userId)
  }
}
