/** 系统所有可配置路由定义（用于角色路由权限控制） */
export interface RouteConfig {
  path: string
  label: string
  group?: string
}

export const ALL_ROUTES: RouteConfig[] = [
  { path: '/processes', label: '流程管理', group: '流程' },
  { path: '/instances', label: '流程实例', group: '流程' },
  { path: '/my-tasks', label: '我的任务', group: '任务' },
  { path: '/approvals', label: '审批中心', group: '任务' },
  { path: '/progress', label: '进度监控', group: '监控' },
  { path: '/knowledge-bases', label: '知识库', group: '资源' },
  { path: '/notifications', label: '通知中心', group: '资源' },
  { path: '/templates', label: '模板市场', group: '资源' },
  { path: '/admin/users', label: '用户管理', group: '系统管理' },
  { path: '/admin/roles', label: '角色管理', group: '系统管理' },
  { path: '/admin/ai-settings', label: 'AI 配置', group: '系统管理' },
]
