import { IsString, IsOptional, IsBoolean, IsInt, IsIn, Min } from 'class-validator'

export class CreateTaskDefinitionDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsIn(['checklist', 'action'])
  taskType?: string

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateTaskDefinitionDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsIn(['checklist', 'action'])
  taskType?: string

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
