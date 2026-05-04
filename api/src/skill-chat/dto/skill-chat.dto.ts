import { IsString, IsArray, IsOptional, ValidateNested, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'

export class SkillChatHistoryItem {
  @IsEnum(['user', 'assistant'])
  role: 'user' | 'assistant'

  @IsString()
  content: string
}

export class SkillChatDto {
  @IsString()
  message: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillChatHistoryItem)
  history?: SkillChatHistoryItem[]

  /** IDs of knowledge bases to query for RAG context */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeBaseIds?: string[]

  /** Optional AgentRole ID — determines system prompt and model */
  @IsOptional()
  @IsString()
  agentRoleId?: string
}
