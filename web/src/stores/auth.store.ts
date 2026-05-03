import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type LoginRequest } from '@/api/auth'
import { rolesApi } from '@/api/roles'

export interface User {
  id: string
  name: string
  email: string
  roles: string[]
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  /** null = admin，全部可见；string[] = 允许访问的路由前缀列表 */
  allowedRoutes: string[] | null
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
  loadRoutePermissions: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      allowedRoutes: null,

      login: async (credentials) => {
        const res = await authApi.login(credentials)
        if (res.code === 0) {
          set({
            user: {
              ...res.data.user,
              roles: res.data.user.roles || [],
            },
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
            isAuthenticated: true,
          })
          // 登录后立即加载路由权限
          await get().loadRoutePermissions()
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          allowedRoutes: null,
        })
      },

      loadRoutePermissions: async () => {
        try {
          const res = await rolesApi.getMyRoutes()
          const data = (res as any)?.data ?? res
          set({ allowedRoutes: data.routes ?? null })
        } catch {
          // 加载失败时不影响已有状态
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        allowedRoutes: state.allowedRoutes,
      }),
    },
  ),
)
