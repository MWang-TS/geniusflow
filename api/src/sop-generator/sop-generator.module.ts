import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SopGeneratorController } from './sop-generator.controller'
import { SopGeneratorService } from './sop-generator.service'
import { AuditLogModule } from '../audit-log/audit-log.module'

@Module({
  imports: [ConfigModule, AuditLogModule],
  controllers: [SopGeneratorController],
  providers: [SopGeneratorService],
})
export class SopGeneratorModule {}
