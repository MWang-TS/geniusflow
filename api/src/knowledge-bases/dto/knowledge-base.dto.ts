import { IsString, IsOptional, IsIn } from 'class-validator'

export class CreateKnowledgeBaseDto {
  @IsString()
  name: string

  @IsString()
  @IsIn(['standard', 'expertise'])
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
}

export class SearchDto {
  @IsString()
  query: string

  @IsOptional()
  knowledgeBaseIds?: string[]

  topK?: number
}
