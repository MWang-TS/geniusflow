import client from './client'

export interface UserItem {
  id: string
  name: string
  email: string
  status: string
  roles: Array<{ id: string; name: string }>
  createdAt: string
}

export const usersApi = {
  list: (params?: { page?: number; pageSize?: number; keyword?: string }) =>
    client.get('/users', { params }),

  getById: (id: string) =>
    client.get(`/users/${id}`),

  create: (data: { name: string; email: string; password: string; roleIds?: string[] }) =>
    client.post('/users', data),

  update: (id: string, data: { name?: string; email?: string; password?: string; status?: string; roleIds?: string[] }) =>
    client.put(`/users/${id}`, data),

  remove: (id: string) =>
    client.delete(`/users/${id}`),
}
