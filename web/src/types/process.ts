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

export interface GraphJson {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface ProcessDefinition {
  id: string
  name: string
  version: number
  status: 'draft' | 'published' | 'archived'
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
  status: 'draft' | 'published' | 'archived'
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

export interface ActionSpec {
  instructions?: string
  requirements?: string
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
    knowledgeBaseId?: string
  }
  assistant?: {
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
