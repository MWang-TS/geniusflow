import client from './client'

export const usersApi = {
  list: () => client.get('/users'),
}
