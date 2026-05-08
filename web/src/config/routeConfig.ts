/** 系统所有可配置路由定义（用于角色路由权限控制） */
export interface RouteConfig {
  path: string
  label: string
  group?: string
}

export const ALL_ROUTES: RouteConfig[] = [
  { path: '/processes', label: '流程设计', group: '流程' },
  { path: '/instances', label: '流程看板', group: '流程' },
  { path: '/my-tasks', label: '任务看板', group: '任务' },
  { path: '/approvals', label: '审批中心', group: '任务' },
  { path: '/skill-assistant', label: '技能对话', group: 'AI 工作台' },
  { path: '/api-platform', label: 'API 密钥管理', group: 'AI 工作台' },
  { path: '/progress', label: '进度监控', group: '监控' },
  { path: '/knowledge-bases', label: '知识库', group: '资源' },
  { path: '/notifications', label: '通知中心', group: '资源' },
  { path: '/templates', label: '流程模版库', group: '资源' },
  { path: '/admin/users', label: '用户管理', group: '系统管理' },
  { path: '/admin/roles', label: '角色管理', group: '系统管理' },
  { path: '/admin/ai-settings', label: 'AI 配置', group: '系统管理' },
]
