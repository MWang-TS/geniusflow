import client from './client'

export interface RoleItem {
  id: string
  name: string
  description: string | null
  permissions: unknown
  createdAt: string
}

export interface RoleDetail extends RoleItem {
  users: Array<{ id: string; name: string; email: string }>
}

export const rolesApi = {
  list: () =>
    client.get('/roles'),

  getById: (id: string) =>
    client.get(`/roles/${id}`),

  create: (data: { name: string; description?: string; permissions?: string[] }) =>
    client.post('/roles', data),

  update: (id: string, data: { name?: string; description?: string; permissions?: string[] }) =>
    client.put(`/roles/${id}`, data),

  remove: (id: string) =>
    client.delete(`/roles/${id}`),
}
