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

export const processInstanceApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string }) =>
    client.get('/process-instances', { params }),

  getById: (id: string) =>
    client.get(`/process-instances/${id}`),

  create: (data: CreateProcessInstanceParams) =>
    client.post('/process-instances', data),

  terminate: (id: string, reason: string) =>
    client.post(`/process-instances/${id}/terminate`, { reason }),
}
