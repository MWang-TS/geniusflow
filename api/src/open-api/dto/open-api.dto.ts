import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator'

export class CreateApiKeyDto {
  @IsString()
  name: string

  /** Knowledge base IDs this key is allowed to query */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeBaseIds?: string[]

  /** Optionally bind to an agent role */
  @IsOptional()
  @IsString()
  agentRoleId?: string

  /** ISO date string for expiry; omit for non-expiring key */
  @IsOptional()
  @IsDateString()
  expiresAt?: string
}

export class OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class OpenAiChatCompletionDto {
  model: string
  messages: OpenAiChatMessage[]
  stream?: boolean
  /** GeniusFlow extension: knowledge base IDs to query */
  knowledge_base_ids?: string[]
  /** GeniusFlow extension: agent role ID */
  agent_role_id?: string
}
