import client from './client'

export interface CreateProcessInstanceParams {
  definitionId: string
  plannedStartDate?: string
  nodeAssignees?: Record<string, { assigneeUserId: string }>
}

export interface ProcessInstanceListItem {
  id: string
  definitionId: string
  definitionName: string
  status: string
  plannedStartDate: string | null
  actualStartDate: string | null
  currentNodeId: string | null
  nodeCount: number
  createdBy: { id: string; name: string } | null
  createdAt: string
}

export interface ProcessInstanceDetail {
  id: string
  definitionId: string
  status: string
  plannedStartDate: string | null
  actualStartDate: string | null
  currentNodeId: string | null
  definition: { id: string; name: string }
  creator: { id: string; name: string } | null
  nodeInstances: Array<{
    id: string
    status: string
    plannedStartDate: string | null
    plannedEndDate: string | null
    percentComplete: number
    assignee: { id: string; name: string } | null
    definition: { id: string; nodeName: string; nodeType: string }
  }>
  createdAt: string
}

export interface GanttTask {
  id: string
  name: string
  assignee: string | null
  status: string
  percentComplete: number
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  duration: number
  isOverdue: boolean
}

export interface GanttData {
  instanceId: string
  processName: string
  plannedStartDate: string | null
  actualStartDate: string | null
  tasks: GanttTask[]
}

export const processInstanceApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string }) =>
    client.get('/process-instances', { params }),

  getById: (id: string) =>
    client.get(`/process-instances/${id}`),

  create: (data: CreateProcessInstanceParams) =>
    client.post('/process-instances', data),

  terminate: (id: string, reason: string) =>
    client.post(`/process-instances/${id}/terminate`, { reason }),

  getGanttData: (id: string) =>
    client.get<any, { code: number; data: GanttData }>(`/process-instances/${id}/gantt`),

  updateBaseline: (id: string, data: { plannedStartDate?: string; nodeAdjustments?: Array<{ nodeInstanceId: string; plannedStartDate: string; plannedEndDate: string }> }) =>
    client.post(`/process-instances/${id}/baseline`, data),
}
