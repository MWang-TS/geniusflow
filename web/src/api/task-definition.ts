import client from './client'

export interface TaskDefinition {
  id: string
  processDefId: string
  nodeDefId: string
  title: string
  description?: string | null
  taskType: 'checklist' | 'action'
  isRequired: boolean
  sortOrder: number
  taskCode?: string
  nodeName?: string
  createdAt: string
  updatedAt: string
}

export interface CreateTaskDefinitionPayload {
  title: string
  description?: string
  taskType?: 'checklist' | 'action'
  isRequired?: boolean
  sortOrder?: number
}

export interface UpdateTaskDefinitionPayload {
  title?: string
  description?: string
  taskType?: 'checklist' | 'action'
  isRequired?: boolean
  sortOrder?: number
}

export const taskDefinitionApi = {
  /** 获取整个流程所有节点的任务定义 */
  listByProcess: (processId: string) =>
    client.get<any, { code: number; data: TaskDefinition[] }>(
      `/process-definitions/${processId}/task-defs`,
    ),

  /** 获取特定节点的任务定义 */
  listByNode: (processId: string, nodeId: string) =>
    client.get<any, { code: number; data: TaskDefinition[] }>(
      `/process-definitions/${processId}/task-defs/nodes/${nodeId}`,
    ),

  /** 创建任务定义 */
  create: (processId: string, nodeId: string, data: CreateTaskDefinitionPayload) =>
    client.post<any, { code: number; data: TaskDefinition }>(
      `/process-definitions/${processId}/task-defs/nodes/${nodeId}`,
      data,
    ),

  /** 更新任务定义 */
  update: (processId: string, nodeId: string, id: string, data: UpdateTaskDefinitionPayload) =>
    client.put<any, { code: number; data: TaskDefinition }>(
      `/process-definitions/${processId}/task-defs/nodes/${nodeId}/${id}`,
      data,
    ),

  /** 删除任务定义 */
  remove: (processId: string, nodeId: string, id: string) =>
    client.delete(`/process-definitions/${processId}/task-defs/nodes/${nodeId}/${id}`),

  /** 从检查清单同步为任务定义 */
  syncFromChecklist: (processId: string, nodeId: string) =>
    client.post<any, { code: number; data: { synced: number } }>(
      `/process-definitions/${processId}/task-defs/nodes/${nodeId}/sync-checklist`,
    ),
}
