import { useState, useMemo } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme, Dropdown, Space, Typography } from 'antd'
import {
  NodeIndexOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  BookOutlined,
  AppstoreOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  ProjectOutlined,
  RobotOutlined,
  ApiOutlined,
  MessageOutlined,
  KeyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth.store'
import { usePlatformModeStore } from '@/stores/platform-mode.store'
import ModeSwitcher from './ModeSwitcher'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const MainLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, allowedRoutes } = useAuthStore()
  const { mode } = usePlatformModeStore()
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([]) 
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const isRouteVisible = (path: string) => {
    if (allowedRoutes === null) return true // admin 全部可见
    return allowedRoutes.some((r) => path === r || path.startsWith(r + '/'))
  }

  const workflowMenuItems = [
    { key: '/my-tasks', icon: <CheckSquareOutlined />, label: '任务看板' },
    { key: '/processes', icon: <NodeIndexOutlined />, label: '流程设计' },
    { key: '/sop-generator', icon: <ThunderboltOutlined />, label: 'AI 生成 SOP' },
    { key: '/instances', icon: <ProjectOutlined />, label: '流程看板' },
    { key: '/approvals', icon: <FileTextOutlined />, label: '审批中心' },
    { key: '/knowledge-bases', icon: <BookOutlined />, label: '知识库' },
    { key: '/notifications', icon: <BellOutlined />, label: '通知中心' },
    { key: '/templates', icon: <AppstoreOutlined />, label: '流程模版库' },
    {
      key: '/admin',
      icon: <SettingOutlined />,
      label: '系统管理',
      children: [
        { key: '/admin/users', label: '用户管理' },
        { key: '/admin/roles', label: '角色管理' },
        { key: '/admin/ai-settings', label: 'AI 配置' },
      ],
    },
  ]

  const assistantMenuItems = [
    { key: '/skill-assistant', icon: <MessageOutlined />, label: '技能对话' },
    { key: '/knowledge-bases', icon: <BookOutlined />, label: '知识库管理' },
    { key: '/admin/ai-settings', icon: <RobotOutlined />, label: 'AI 角色配置' },
  ]

  const apiPlatformMenuItems = [
    { key: '/api-platform', icon: <KeyOutlined />, label: 'API 密钥管理' },
    { key: '/knowledge-bases', icon: <BookOutlined />, label: '知识库管理' },
    { key: '/templates', icon: <AppstoreOutlined />, label: '流程模版库' },
    { key: '/admin/ai-settings', icon: <ApiOutlined />, label: 'AI 角色配置' },
  ]

  const allMenuItems =
    mode === 'workflow'
      ? workflowMenuItems
      : mode === 'assistant'
        ? assistantMenuItems
        : apiPlatformMenuItems

  const menuItems = useMemo(() => {
    return allMenuItems
      .map((item: any) => {
        if (item.children) {
          const visibleChildren = item.children.filter((c: any) => isRouteVisible(c.key))
          if (visibleChildren.length === 0) return null
          return { ...item, children: visibleChildren }
        }
        return isRouteVisible(item.key) ? item : null
      })
      .filter(Boolean) as typeof allMenuItems
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedRoutes, mode])

  const getSelectedKey = () => {
    const path = location.pathname
    if (path.startsWith('/processes')) return '/processes'
    if (path.startsWith('/instances')) return '/instances'
    if (path.startsWith('/my-tasks')) return '/my-tasks'
    if (path.startsWith('/approvals')) return '/approvals'
    if (path.startsWith('/knowledge-bases')) return '/knowledge-bases'
    if (path.startsWith('/notifications')) return '/notifications'
    if (path.startsWith('/progress')) return '/instances'
    if (path.startsWith('/templates')) return '/templates'
    if (path.startsWith('/skill-assistant')) return '/skill-assistant'
    if (path.startsWith('/api-platform')) return '/api-platform'
    if (path.startsWith('/admin/users')) return '/admin/users'
    if (path.startsWith('/admin/roles')) return '/admin/roles'
    if (path.startsWith('/admin/ai-settings')) return '/admin/ai-settings'
    if (path.startsWith('/admin')) return '/admin/users'
    return path
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 14 : 18,
          fontWeight: 'bold'
        }}>
          {collapsed ? 'GF' : 'GeniusFlow'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div />
          <Space size={8}>
            <ModeSwitcher />
            <Dropdown menu={{ items: userMenuItems }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#1677ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 16,
                  flexShrink: 0,
                }}>
                  <UserOutlined />
                </div>
                <Text>{user?.name}</Text>
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout