import { IsString, IsNotEmpty, IsOptional, IsDateString, IsObject } from 'class-validator'

export class CreateProcessInstanceDto {
  @IsString()
  @IsNotEmpty()
  definitionId: string

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string

  @IsOptional()
  @IsObject()
  nodeAssignees?: Record<string, { assigneeUserId: string }>
}

export class TerminateProcessInstanceDto {
  @IsString()
  @IsNotEmpty()
  reason: string
}
