import { IsString, IsNotEmpty, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class GenerateSopDto {
  @IsString()
  @IsNotEmpty()
  description: string

  @IsOptional()
  @IsString()
  domain?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleHints?: string[]

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(15)
  estimatedSteps?: number

  @IsOptional()
  @IsString()
  referenceContext?: string
}

export class SaveSopDto {
  @IsString()
  @IsNotEmpty()
  processName: string

  @IsOptional()
  @IsString()
  description?: string

  @IsArray()
  nodes: Array<{
    id: string
    type: string
    label: string
    position: { x: number; y: number }
    assigneeRole?: string
    dueHours?: number
    enableAiInspection?: boolean
    acceptanceCriteria?: string
    sopContent?: string
    checklist?: Array<{ id: string; label: string; required: boolean }>
    inputFields?: Array<{ key: string; label: string; type: string }>
    outputFields?: Array<{ key: string; label: string; type: string }>
  }>

  @IsArray()
  edges: Array<{ id: string; source: string; target: string }>
}
