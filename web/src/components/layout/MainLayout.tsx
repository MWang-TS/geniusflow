import { useState, useMemo } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme, Dropdown, Avatar, Space, Typography } from 'antd'
import {
  NodeIndexOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  BarChartOutlined,
  BookOutlined,
  AppstoreOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  ProjectOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth.store'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const MainLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, allowedRoutes } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([]) 
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const isRouteVisible = (path: string) => {
    if (allowedRoutes === null) return true // admin 全部可见
    return allowedRoutes.some((r) => path === r || path.startsWith(r + '/'))
  }

  const allMenuItems = [
    {
      key: '/processes',
      icon: <NodeIndexOutlined />,
      label: '流程管理',
    },
    {
      key: '/instances',
      icon: <ProjectOutlined />,
      label: '流程实例',
    },
    {
      key: '/my-tasks',
      icon: <CheckSquareOutlined />,
      label: '我的任务',
    },
    {
      key: '/approvals',
      icon: <FileTextOutlined />,
      label: '审批中心',
    },
    {
      key: '/progress',
      icon: <BarChartOutlined />,
      label: '进度监控',
    },
    {
      key: '/knowledge-bases',
      icon: <BookOutlined />,
      label: '知识库',
    },
    {
      key: '/notifications',
      icon: <BellOutlined />,
      label: '通知中心',
    },
    {
      key: '/templates',
      icon: <AppstoreOutlined />,
      label: '模板市场',
    },
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

  const menuItems = useMemo(() => {
    return allMenuItems
      .map((item) => {
        if (item.children) {
          const visibleChildren = item.children.filter((c) => isRouteVisible(c.key))
          if (visibleChildren.length === 0) return null
          return { ...item, children: visibleChildren }
        }
        return isRouteVisible(item.key) ? item : null
      })
      .filter(Boolean) as typeof allMenuItems
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedRoutes])

  const getSelectedKey = () => {
    const path = location.pathname
    if (path.startsWith('/processes')) return '/processes'
    if (path.startsWith('/instances')) return '/instances'
    if (path.startsWith('/my-tasks')) return '/my-tasks'
    if (path.startsWith('/approvals')) return '/approvals'
    if (path.startsWith('/knowledge-bases')) return '/knowledge-bases'
    if (path.startsWith('/notifications')) return '/notifications'
    if (path.startsWith('/progress')) return '/progress'
    if (path.startsWith('/templates')) return '/templates'
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
          justifyContent: 'flex-end',
        }}>
          <Dropdown menu={{ items: userMenuItems }}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <Text>{user?.name}</Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout