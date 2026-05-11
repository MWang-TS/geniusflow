import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { KnowledgeBasesService } from './knowledge-bases.service'
import { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, SearchDto } from './dto/knowledge-base.dto'

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeBasesController {
  constructor(private readonly service: KnowledgeBasesService) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      type,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateKnowledgeBaseDto) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgeBaseDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Get(':id/documents')
  getDocuments(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getDocuments(id, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    })
  }

  @Post(':id/documents')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('未收到文件，请检查上传格式')
    }
    return this.service.uploadDocument(id, file)
  }

  @Post(':id/documents/text')
  @Roles('admin')
  uploadDocumentText(
    @Param('id') id: string,
    @Body() body: { title: string; content: string },
  ) {
    return this.service.uploadDocumentText(id, body.title, body.content)
  }

  @Post(':id/documents/:docId/reindex')
  @Roles('admin')
  retryVectorize(
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.service.retryVectorize(id, docId)
  }

  @Delete(':id/documents/:docId')
  @Roles('admin')
  deleteDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.service.deleteDocument(id, docId)
  }

  @Post(':id/search')
  search(@Param('id') id: string, @Body() dto: SearchDto) {
    return this.service.search(dto)
  }
}
