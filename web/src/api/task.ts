import client from './client'

export interface TaskListItem {
  id: string
  nodeInstanceId: string
  processInstanceId: string
  processName: string
  nodeName: string
  type: string
  status: string
  dueDate: string | null
  createdAt: string
}

export const taskApi = {
  list: (params?: { type?: string; status?: string; page?: number; pageSize?: number }) =>
    client.get('/tasks', { params }),
}
