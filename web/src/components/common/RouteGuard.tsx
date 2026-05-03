import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Result } from 'antd'
import { useAuthStore } from '@/stores/auth.store'

interface RouteGuardProps {
  roles?: string[]
  children: React.ReactNode
}

const RouteGuard: React.FC<RouteGuardProps> = ({ roles, children }) => {
  const { isAuthenticated, user, allowedRoutes } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.some((role) => user?.roles?.includes(role))) {
    return <Result status="403" title="403" subTitle="抱歉，您没有权限访问此页面。" />
  }

  // allowedRoutes === null 表示 admin，全部可见；非 null 则检查当前路径
  if (allowedRoutes !== null) {
    const path = location.pathname
    const allowed = allowedRoutes.some((r) => path === r || path.startsWith(r + '/'))
    // admin 页面以外的路由都需要权限，admin 本身已通过 roles 检查保护
    const isAdminPath = path.startsWith('/admin')
    if (!isAdminPath && !allowed && path !== '/') {
      return <Result status="403" title="403" subTitle="抱歉，您没有权限访问此页面。" />
    }
  }

  return <>{children}</>
}

export default RouteGuard
