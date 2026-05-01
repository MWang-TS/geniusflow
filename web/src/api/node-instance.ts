import client from './client'

export interface SaveNodeInstanceParams {
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  percentComplete?: number
}

export interface NodeInstanceDetail {
  id: string
  instanceId: string
  definitionId: string
  status: string
  inputData: Record<string, unknown> | null
  outputData: Record<string, unknown> | null
  percentComplete: number
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  definition: {
    id: string
    nodeName: string
    nodeType: string
    inputSpec: Record<string, unknown>
    actionSpec: Record<string, unknown>
    outputSpec: Record<string, unknown>
    aiConfig: Record<string, unknown>
  }
  assignee: { id: string; name: string } | null
  history: Array<{
    id: string
    eventType: string
    actorUserId: string | null
    fromStatus: string | null
    toStatus: string | null
    details: Record<string, unknown> | null
    createdAt: string
  }>
  aiReports: Array<{
    id: string
    reportType: string
    content: Record<string, unknown>
    createdAt: string
  }>
  instance: {
    id: string
    definition: { id: string; name: string }
  }
  createdAt: string
}

export const nodeInstanceApi = {
  getById: (id: string) =>
    client.get<any, { code: number; data: NodeInstanceDetail }>(`/node-instances/${id}`),

  save: (id: string, data: SaveNodeInstanceParams) =>
    client.post(`/node-instances/${id}/save`, data),

  submit: (id: string, data: SaveNodeInstanceParams) =>
    client.post(`/node-instances/${id}/submit`, data),

  updateProgress: (id: string, percentComplete: number) =>
    client.post(`/node-instances/${id}/progress`, { percentComplete }),
}
