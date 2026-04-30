import { IsString, IsNotEmpty, IsOptional, IsObject, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateProcessDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsObject()
  graphJson: {
    nodes: Array<{
      id: string
      type: string
      position: { x: number; y: number }
      data?: Record<string, unknown>
    }>
    edges: Array<{
      id: string
      source: string
      target: string
    }>
  }
}

export class UpdateProcessDefinitionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsObject()
  graphJson?: {
    nodes: Array<{
      id: string
      type: string
      position: { x: number; y: number }
      data?: Record<string, unknown>
    }>
    edges: Array<{
      id: string
      source: string
      target: string
    }>
  }
}

export class QueryProcessDefinitionDto {
  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  keyword?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number
}
