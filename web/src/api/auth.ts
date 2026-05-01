import client from './client'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    name: string
    email: string
    roles: string[]
  }
}

export const authApi = {
  login: (data: LoginRequest) =>
    client.post<any, { code: number; data: LoginResponse }>('/auth/login', data),

  refresh: (refreshToken: string) =>
    client.post<any, { code: number; data: { accessToken: string; expiresIn: number } }>('/auth/refresh', { refreshToken }),
}
