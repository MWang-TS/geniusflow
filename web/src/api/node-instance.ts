import client from './client'

export interface SaveNodeInstanceParams {
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  percentComplete?: number
}

export const nodeInstanceApi = {
  getById: (id: string) =>
    client.get(`/node-instances/${id}`),

  save: (id: string, data: SaveNodeInstanceParams) =>
    client.post(`/node-instances/${id}/save`, data),

  submit: (id: string, data: SaveNodeInstanceParams) =>
    client.post(`/node-instances/${id}/submit`, data),

  updateProgress: (id: string, percentComplete: number) =>
    client.post(`/node-instances/${id}/progress`, { percentComplete }),
}
