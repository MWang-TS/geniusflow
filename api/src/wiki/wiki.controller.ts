import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UploadedFiles, UseInterceptors,
  UseGuards, Query,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { WikiService } from './wiki.service'
import { WikiQueryDto } from './dto/wiki.dto'

@Controller('wiki')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WikiController {
  constructor(private wikiService: WikiService) {}

  // ----- Sources -----

  @Get(':kbId/sources')
  async getSources(
    @Param('kbId') kbId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.wikiService.getSources(kbId, { page: +page, pageSize: +pageSize })
  }

  @Post(':kbId/sources')
  @Roles('admin', 'designer')
  @UseInterceptors(FilesInterceptor('file'))
  async uploadSource(
    @Param('kbId') kbId: string,
    @UploadedFiles() files: { originalname: string; buffer: Buffer; size: number; mimetype: string }[],
  ) {
    if (files.length <= 1) {
      return this.wikiService.uploadSource(kbId, files[0])
    }
    return this.wikiService.uploadSources(kbId, files)
  }

  @Post(':kbId/sources/text')
  @Roles('admin', 'designer')
  async uploadSourceText(
    @Param('kbId') kbId: string,
    @Body() body: { title: string; content: string },
  ) {
    return this.wikiService.uploadSourceText(kbId, body.title, body.content)
  }

  @Delete(':kbId/sources/:sourceId')
  @Roles('admin')
  async deleteSource(
    @Param('kbId') kbId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.wikiService.deleteSource(kbId, sourceId)
  }

  @Post(':kbId/sources/:sourceId/convert')
  @Roles('admin', 'designer')
  async convertSource(
    @Param('kbId') kbId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.wikiService.convertSource(kbId, sourceId)
  }

  @Post(':kbId/sources/:sourceId/ingest')
  @Roles('admin', 'designer')
  async ingestSource(
    @Param('kbId') kbId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.wikiService.ingestSource(kbId, sourceId)
  }

  // Convenience: convert then ingest in one call
  @Post(':kbId/sources/:sourceId/process')
  @Roles('admin', 'designer')
  async processSource(
    @Param('kbId') kbId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.wikiService.processSource(kbId, sourceId)
  }

  // ----- Pages -----

  @Get(':kbId/pages')
  async getPages(
    @Param('kbId') kbId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 50,
    @Query('pageType') pageType?: string,
  ) {
    return this.wikiService.getPages(kbId, { page: +page, pageSize: +pageSize, pageType })
  }

  @Get(':kbId/pages/:slug')
  async getPage(
    @Param('kbId') kbId: string,
    @Param('slug') slug: string,
  ) {
    return this.wikiService.getPage(kbId, slug)
  }

  @Put(':kbId/pages/:slug')
  @Roles('admin', 'designer')
  async updatePage(
    @Param('kbId') kbId: string,
    @Param('slug') slug: string,
    @Body() body: { title?: string; content?: string; tags?: string[] },
  ) {
    return this.wikiService.updatePage(kbId, slug, body)
  }

  @Delete(':kbId/pages/:slug')
  @Roles('admin')
  async deletePage(
    @Param('kbId') kbId: string,
    @Param('slug') slug: string,
  ) {
    return this.wikiService.deletePage(kbId, slug)
  }

  // ----- Query -----

  @Post(':kbId/query')
  async queryWiki(
    @Param('kbId') kbId: string,
    @Body() dto: WikiQueryDto,
  ) {
    return this.wikiService.query(kbId, dto.question, dto.maxPages)
  }

  // ----- Lint -----

  @Get(':kbId/lint')
  async lintWiki(@Param('kbId') kbId: string) {
    return this.wikiService.lint(kbId)
  }

  // ----- Knowledge Graph -----

  @Get(':kbId/graph')
  async getGraph(@Param('kbId') kbId: string) {
    return this.wikiService.getGraph(kbId)
  }

  @Get(':kbId/graph/build/status')
  async getGraphBuildStatus(@Param('kbId') kbId: string) {
    return this.wikiService.getGraphBuildStatus(kbId)
  }

  @Post(':kbId/graph/build')
  @Roles('admin', 'designer')
  async buildGraph(@Param('kbId') kbId: string) {
    return this.wikiService.buildGraph(kbId)
  }
}
