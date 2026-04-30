import client from './client'
import type { NodeDefinition } from '../types/process'

export interface UpdateNodeDefinitionParams {
  nodeName?: string
  inputSpec?: Record<string, unknown>
  actionSpec?: Record<string, unknown>
  outputSpec?: Record<string, unknown>
  aiConfig?: Record<string, unknown>
  progressConfig?: Record<string, unknown>
}

export const nodeDefinitionApi = {
  getById: (id: string) =>
    client.get<any, { code: number; data: NodeDefinition; message: string }>(
      `/node-definitions/${id}`,
    ),

  update: (id: string, data: UpdateNodeDefinitionParams) =>
    client.put<any, { code: number; data: NodeDefinition; message: string }>(
      `/node-definitions/${id}`,
      data,
    ),
}
