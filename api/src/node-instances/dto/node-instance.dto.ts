import { IsObject, IsOptional, IsNumber, Min, Max } from 'class-validator'

export class SaveNodeInstanceDto {
  @IsOptional()
  @IsObject()
  inputData?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  outputData?: Record<string, unknown>

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentComplete?: number
}

export class SubmitNodeInstanceDto {
  @IsOptional()
  @IsObject()
  inputData?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  outputData?: Record<string, unknown>

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentComplete?: number
}

export class UpdateProgressDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  percentComplete: number
}
