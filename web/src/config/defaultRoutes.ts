import type { PlatformMode } from '@/stores/platform-mode.store'

export const MODE_DEFAULT_ROUTES: Record<PlatformMode, string> = {
  workflow: '/my-tasks',
  assistant: '/skill-assistant',
  'api-platform': '/api-platform',
}

export function canAccessRoute(path: string, allowedRoutes: string[] | null) {
  if (allowedRoutes === null) return true
  return allowedRoutes.some((route) => path === route || path.startsWith(route + '/'))
}

export function resolveHomeRoute(mode: PlatformMode, allowedRoutes: string[] | null) {
  const preferred = MODE_DEFAULT_ROUTES[mode]

  if (canAccessRoute(preferred, allowedRoutes)) {
    return preferred
  }

  if (allowedRoutes && allowedRoutes.length > 0) {
    return allowedRoutes[0]
  }

  return preferred
}