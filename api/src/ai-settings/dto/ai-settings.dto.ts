import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsEnum, Min, Max } from 'class-validator'

// ──── Provider ────────────────────────────────────────────────────────────────

export enum ProviderType {
  OPENAI = 'openai',
  AZURE_OPENAI = 'azure_openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
  CUSTOM = 'custom',
}

export class CreateProviderDto {
  @IsString()
  name: string

  @IsEnum(ProviderType)
  type: ProviderType

  @IsOptional()
  @IsString()
  baseUrl?: string

  @IsOptional()
  @IsString()
  apiKey?: string

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType

  @IsOptional()
  @IsString()
  baseUrl?: string

  @IsOptional()
  @IsString()
  apiKey?: string

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>
}

// ──── Model ───────────────────────────────────────────────────────────────────

export enum ModelType {
  CHAT = 'chat',
  EMBEDDING = 'embedding',
  RERANK = 'rerank',
}

export class CreateModelDto {
  @IsString()
  providerId: string

  @IsString()
  name: string

  @IsString()
  modelId: string

  @IsEnum(ModelType)
  type: ModelType

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @IsOptional()
  @IsNumber()
  contextWindow?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>
}

export class UpdateModelDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  modelId?: string

  @IsOptional()
  @IsEnum(ModelType)
  type?: ModelType

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @IsOptional()
  @IsNumber()
  contextWindow?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>
}

// ──── Skill ───────────────────────────────────────────────────────────────────

export enum SkillType {
  TOOL = 'tool',
  RETRIEVAL = 'retrieval',
  CODE_EXECUTION = 'code_execution',
  CUSTOM = 'custom',
}

export class CreateSkillDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(SkillType)
  type: SkillType

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean
}

export class UpdateSkillDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(SkillType)
  type?: SkillType

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean
}

// ──── AgentRole ───────────────────────────────────────────────────────────────

export class CreateAgentRoleDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  systemPrompt?: string

  @IsOptional()
  @IsString()
  modelId?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  skillIds?: string[]
}

export class UpdateAgentRoleDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  systemPrompt?: string

  @IsOptional()
  @IsString()
  modelId?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  skillIds?: string[]
}

// ──── ModelFallbackChain ──────────────────────────────────────────────────────

export enum FallbackModelType {
  CHAT = 'chat',
  EMBEDDING = 'embedding',
}

export class CreateFallbackDto {
  @IsEnum(FallbackModelType)
  modelType: FallbackModelType

  @IsString()
  modelId: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  @IsString()
  note?: string
}

export class UpdateFallbackDto {
  @IsOptional()
  @IsString()
  modelId?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  @IsString()
  note?: string
}

export class ReorderFallbacksDto {
  @IsEnum(FallbackModelType)
  modelType: FallbackModelType

  /** Ordered list of fallback IDs from first-try to last-try */
  ids: string[]
}
