import client from './client'

export interface NotificationItem {
  id: string
  type: string
  title: string
  content: string | null
  channel: string
  status: string
  relatedResourceType: string | null
  relatedResourceId: string | null
  readAt: string | null
  createdAt: string
}

export const notificationApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string }) =>
    client.get('/notifications', { params }),

  getUnreadCount: () =>
    client.get('/notifications/unread-count'),

  markRead: (id: string) =>
    client.post(`/notifications/${id}/read`),

  markAllRead: () =>
    client.post('/notifications/read-all'),
}
