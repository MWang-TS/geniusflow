import React from 'react'
import { Navigate } from 'react-router-dom'
import { Result } from 'antd'
import { useAuthStore } from '@/stores/auth.store'

interface RouteGuardProps {
  roles?: string[]
  children: React.ReactNode
}

const RouteGuard: React.FC<RouteGuardProps> = ({ roles, children }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.some((role) => user?.roles?.includes(role))) {
    return <Result status="403" title="403" subTitle="抱歉，您没有权限访问此页面。" />
  }

  return <>{children}</>
}

export default RouteGuard
