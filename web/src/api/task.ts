import client from './client'

export interface TaskListItem {
  id: string
  nodeInstanceId: string
  processInstanceId: string
  processName: string
  processStatus: string
  nodeName: string
  type: string
  title: string | null
  taskCode: string | null
  status: string
  nodeStatus: string
  percentComplete: number
  dueDate: string | null
  createdAt: string
  actionPath: string
}

export interface ApprovalTaskDetail {
  id: string
  nodeInstanceId: string
  type: string
  status: string
  dueDate: string | null
  nodeInstance: {
    id: string
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
      progressConfig: Record<string, unknown>
    }
    instance: {
      id: string
      definition: { id: string; name: string }
    }
    assignee: { id: string; name: string } | null
    aiReports: Array<{
      id: string
      reportType: string
      content: { passed?: boolean; score?: number; issues?: Array<{ type: string; field: string; message: string; suggestion?: string }>; summary?: string }
      createdAt: string
    }>
    history: Array<{
      id: string
      eventType: string
      actorUserId: string | null
      fromStatus: string | null
      toStatus: string | null
      details: Record<string, unknown> | null
      createdAt: string
    }>
  }
  createdAt: string
}

export const taskApi = {
  list: (params?: { type?: string; status?: string; page?: number; pageSize?: number }) =>
    client.get('/tasks', { params }),

  updateStatus: (id: string, status: 'pending' | 'in_progress') =>
    client.post(`/tasks/${id}/status`, { status }),

  getById: (id: string) =>
    client.get<any, { code: number; data: ApprovalTaskDetail }>(`/tasks/${id}`),

  approve: (id: string, comment: string) =>
    client.post(`/tasks/${id}/approve`, { comment }),

  reject: (id: string, comment: string) =>
    client.post(`/tasks/${id}/reject`, { comment }),
}
