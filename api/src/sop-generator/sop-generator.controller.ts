import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { SopGeneratorService } from './sop-generator.service'
import { GenerateSopDto, SaveSopDto } from './dto/sop.dto'

@Controller('sop')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SopGeneratorController {
  constructor(private readonly service: SopGeneratorService) {}

  /**
   * Stream SOP generation from AI service via SSE.
   * Requires designer or admin role.
   */
  @Post('generate')
  @Roles('designer', 'admin')
  async generate(
    @Body(new ValidationPipe({ whitelist: true })) dto: GenerateSopDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    await this.service.streamGenerate(dto, res)
  }

  /**
   * Save the generated SOP as a process definition draft.
   * Requires designer or admin role.
   */
  @Post('save')
  @Roles('designer', 'admin')
  async save(
    @Body(new ValidationPipe({ whitelist: true })) dto: SaveSopDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId
    return this.service.saveSop(dto, userId)
  }
}
