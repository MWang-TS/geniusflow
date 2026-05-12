export interface GraphNode {
  id: string
  type: 'start' | 'task' | 'end'
  position: { x: number; y: number }
  data?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
}

export interface ProcessSettings {
  aiConfig?: {
    enabled?: boolean
    knowledgeBaseIds?: string[]
    promptTemplate?: string
  }
}

export interface GraphJson {
  nodes: GraphNode[]
  edges: GraphEdge[]
  processSettings?: ProcessSettings
}

export interface ProcessDefinition {
  id: string
  name: string
  version: number
  status: 'draft' | 'published' | 'stopped' | 'archived'
  graphJson: GraphJson
  nodes: NodeDefinition[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ProcessDefinitionListItem {
  id: string
  name: string
  version: number
  status: 'draft' | 'published' | 'stopped' | 'archived'
  nodeCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface NodeDefinition {
  id: string
  processId: string
  nodeName: string
  nodeType: 'start' | 'task' | 'end'
  inputSpec: InputSpec
  actionSpec: ActionSpec
  outputSpec: OutputSpec
  aiConfig: AiConfig
  progressConfig: ProgressConfig
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface InputSpec {
  dataSchema?: InputField[]
  acceptanceCriteria?: string
  source?: string
  timeConstraint?: { daysFromStart?: number }
}

export interface InputField {
  name: string
  type: 'text' | 'number' | 'file' | 'select'
  required: boolean
  options?: string[]
}

export interface ChecklistItem {
  id: string
  label: string
  required: boolean
}

export interface ActionSpec {
  sopContent?: string         // 操作规范说明（主字段）
  instructions?: string       // 向后兼容别名
  requirements?: string
  checklist?: ChecklistItem[] // 执行检查清单
  aiAssistance?: string[]
  timeConstraint?: { estimatedDays?: number }
}

export interface OutputSpec {
  deliverables?: string[]
  qualityStandard?: string
  acceptanceCondition?: string
  timeConstraint?: { daysFromStart?: number }
}

export interface AiConfig {
  inspector?: {
    enabled?: boolean
    mode?: 'strict' | 'normal' | 'loose'
    promptTemplate?: string
    knowledgeBaseId?: string    // 向后兼容，单选时保留
    knowledgeBaseIds?: string[] // 多选，优先使用
  }
  assistant?: {
    enabled?: boolean
    promptTemplate?: string
  }
  inputAgent?: {
    enabled?: boolean
    promptTemplate?: string
  }
  outputAgent?: {
    enabled?: boolean
    promptTemplate?: string
  }
}

export interface ProgressConfig {
  plannedDuration?: number
  isMilestone?: boolean
  needApproval?: boolean
  requireAiReportBeforeApproval?: boolean
}

export interface PaginatedResponse<T> {
  list: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}
