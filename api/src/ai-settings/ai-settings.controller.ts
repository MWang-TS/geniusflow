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
  Res,
} from '@nestjs/common'
import { Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { AiSettingsService } from './ai-settings.service'
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateModelDto,
  UpdateModelDto,
  CreateSkillDto,
  UpdateSkillDto,
  CreateAgentRoleDto,
  UpdateAgentRoleDto,
  CreateFallbackDto,
  UpdateFallbackDto,
  ReorderFallbacksDto,
} from './dto/ai-settings.dto'

@Controller('ai-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiSettingsController {
  constructor(private readonly service: AiSettingsService) {}

  // ──── Providers ────────────────────────────────────────────────────────────

  @Get('providers')
  listProviders() {
    return this.service.listProviders()
  }

  @Post('providers')
  createProvider(@Body() dto: CreateProviderDto) {
    return this.service.createProvider(dto)
  }

  @Put('providers/:id')
  updateProvider(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.service.updateProvider(id, dto)
  }

  @Delete('providers/:id')
  deleteProvider(@Param('id') id: string) {
    return this.service.deleteProvider(id)
  }

  @Post('providers/:id/test')
  testProvider(@Param('id') id: string) {
    return this.service.testProvider(id)
  }

  @Get('providers/:id/models')
  fetchProviderModels(@Param('id') id: string) {
    return this.service.fetchProviderModels(id)
  }

  // ──── Models ───────────────────────────────────────────────────────────────

  @Get('models')
  listModels(@Query('type') type?: string, @Query('providerId') providerId?: string) {
    return this.service.listModels(type, providerId)
  }

  @Post('models')
  createModel(@Body() dto: CreateModelDto) {
    return this.service.createModel(dto)
  }

  @Put('models/:id')
  updateModel(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    return this.service.updateModel(id, dto)
  }

  @Delete('models/:id')
  deleteModel(@Param('id') id: string) {
    return this.service.deleteModel(id)
  }

  @Post('models/:id/set-default')
  setDefaultModel(@Param('id') id: string) {
    return this.service.updateModel(id, { isDefault: true })
  }

  // ──── Skills ───────────────────────────────────────────────────────────────

  @Get('skills')
  @Roles('admin', 'designer')
  listSkills() {
    return this.service.listSkills()
  }

  @Post('skills')
  createSkill(@Body() dto: CreateSkillDto) {
    return this.service.createSkill(dto)
  }

  @Put('skills/:id')
  updateSkill(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return this.service.updateSkill(id, dto)
  }

  @Delete('skills/:id')
  deleteSkill(@Param('id') id: string) {
    return this.service.deleteSkill(id)
  }

  // ──── Agent Roles ──────────────────────────────────────────────────────────

  @Get('agent-roles')
  @Roles('admin', 'designer')
  listAgentRoles() {
    return this.service.listAgentRoles()
  }

  @Post('agent-roles')
  createAgentRole(@Body() dto: CreateAgentRoleDto) {
    return this.service.createAgentRole(dto)
  }

  @Put('agent-roles/:id')
  updateAgentRole(@Param('id') id: string, @Body() dto: UpdateAgentRoleDto) {
    return this.service.updateAgentRole(id, dto)
  }

  @Delete('agent-roles/:id')
  deleteAgentRole(@Param('id') id: string) {
    return this.service.deleteAgentRole(id)
  }

  // ──── ModelFallbackChain ─────────────────────────────────────────────

  @Get('fallbacks')
  @Roles('admin', 'designer')
  listFallbacks(@Query('type') type?: string) {
    return this.service.listFallbacks(type)
  }

  @Post('fallbacks')
  createFallback(@Body() dto: CreateFallbackDto) {
    return this.service.createFallback(dto)
  }

  @Put('fallbacks/reorder')
  reorderFallbacks(@Body() dto: ReorderFallbacksDto) {
    return this.service.reorderFallbacks(dto)
  }

  @Put('fallbacks/:id')
  updateFallback(@Param('id') id: string, @Body() dto: UpdateFallbackDto) {
    return this.service.updateFallback(id, dto)
  }

  @Delete('fallbacks/:id')
  deleteFallback(@Param('id') id: string) {
    return this.service.deleteFallback(id)
  }

  // ──── Export / Import ─────────────────────────────────────────────────────

  @Get('export')
  async exportConfig(@Res() res: Response) {
    const data = await this.service.exportConfig()
    const filename = `geniusflow-ai-settings-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(JSON.stringify(data, null, 2))
  }

  @Post('import')
  importConfig(@Body() data: any) {
    return this.service.importConfig(data)
  }
}
