import client from './client'
import type {
  ProcessDefinition,
  ProcessDefinitionListItem,
  PaginatedResponse,
} from '../types/process'

export interface CreateProcessDefinitionParams {
  name: string
  graphJson: {
    nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data?: Record<string, unknown> }>
    edges: Array<{ id: string; source: string; target: string }>
  }
}

export interface UpdateProcessDefinitionParams {
  name?: string
  graphJson?: {
    nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data?: Record<string, unknown> }>
    edges: Array<{ id: string; source: string; target: string }>
  }
}

export interface QueryProcessDefinitionsParams {
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export const processDefinitionApi = {
  list: (params?: QueryProcessDefinitionsParams) =>
    client.get<any, { code: number; data: PaginatedResponse<ProcessDefinitionListItem>; message: string }>(
      '/process-definitions',
      { params },
    ),

  getById: (id: string) =>
    client.get<any, { code: number; data: ProcessDefinition; message: string }>(
      `/process-definitions/${id}`,
    ),

  create: (data: CreateProcessDefinitionParams) =>
    client.post<any, { code: number; data: ProcessDefinition; message: string }>(
      '/process-definitions',
      data,
    ),

  update: (id: string, data: UpdateProcessDefinitionParams) =>
    client.put<any, { code: number; data: ProcessDefinition; message: string }>(
      `/process-definitions/${id}`,
      data,
    ),

  remove: (id: string) =>
    client.delete<any, { code: number; data: { success: boolean }; message: string }>(
      `/process-definitions/${id}`,
    ),

  publish: (id: string) =>
    client.post<any, { code: number; data: { id: string; version: number; status: string }; message: string }>(
      `/process-definitions/${id}/publish`,
    ),
}
