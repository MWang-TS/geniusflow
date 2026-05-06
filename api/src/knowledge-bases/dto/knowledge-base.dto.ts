import { IsString, IsOptional, IsIn, IsObject } from 'class-validator'

const KB_MODES = ['rag', 'wiki'] as const
const KB_CATEGORIES = ['说明书', '会议纪要', '报告手册', '规范', '其他', 'general'] as const

export class CreateKnowledgeBaseDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  @IsIn(KB_MODES)
  mode?: string

  @IsString()
  @IsIn(KB_CATEGORIES)
  type: string

  @IsOptional()
  @IsString()
  description?: string
}

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>
}

export class SearchDto {
  @IsString()
  query: string

  @IsOptional()
  knowledgeBaseIds?: string[]

  topK?: number
}
