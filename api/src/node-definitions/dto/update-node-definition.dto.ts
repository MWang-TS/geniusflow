import { IsString, IsOptional, IsObject, IsNumber, IsBoolean, IsArray } from 'class-validator'

export class UpdateNodeDefinitionDto {
  @IsOptional()
  @IsString()
  nodeName?: string

  @IsOptional()
  @IsObject()
  inputSpec?: {
    dataSchema?: Array<{ name: string; type: string; required: boolean; options?: string[] }>
    acceptanceCriteria?: string
    source?: string
    timeConstraint?: { daysFromStart?: number }
  }

  @IsOptional()
  @IsObject()
  actionSpec?: {
    instructions?: string
    requirements?: string
    aiAssistance?: string[]
    timeConstraint?: { estimatedDays?: number }
  }

  @IsOptional()
  @IsObject()
  outputSpec?: {
    deliverables?: string[]
    qualityStandard?: string
    acceptanceCondition?: string
    timeConstraint?: { daysFromStart?: number }
  }

  @IsOptional()
  @IsObject()
  aiConfig?: {
    inspector?: {
      enabled?: boolean
      mode?: string
      promptTemplate?: string
      knowledgeBaseId?: string
    }
    assistant?: {
      enabled?: boolean
      promptTemplate?: string
    }
  }

  @IsOptional()
  @IsObject()
  progressConfig?: {
    plannedDuration?: number
    isMilestone?: boolean
    needApproval?: boolean
    requireAiReportBeforeApproval?: boolean
  }
}
