import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography, Segmented } from 'antd'
import { UserOutlined, LockOutlined, NodeIndexOutlined, RobotOutlined, ApiOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth.store'
import { usePlatformModeStore, PLATFORM_MODES, type PlatformMode } from '@/stores/platform-mode.store'

const { Title, Text } = Typography

const MODE_DEFAULT_ROUTES: Record<PlatformMode, string> = {
  workflow: '/processes',
  assistant: '/skill-assistant',
  'api-platform': '/api-platform',
}

const MODE_ICONS: Record<PlatformMode, React.ReactNode> = {
  workflow: <NodeIndexOutlined />,
  assistant: <RobotOutlined />,
  'api-platform': <ApiOutlined />,
}

interface LoginForm {
  email: string
  password: string
}

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuthStore()
  const { mode, setMode } = usePlatformModeStore()
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={MODE_DEFAULT_ROUTES[mode]} replace />
  }

  const handleLogin = async (values: LoginForm) => {
    setLoading(true)
    try {
      await login(values)
      message.success('登录成功')
      navigate(MODE_DEFAULT_ROUTES[mode])
    } catch (error: any) {
      const msg = error?.response?.data?.message || '登录失败，请检查邮箱和密码'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f0f2f5'
    }}>
      <Card style={{ width: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>GeniusFlow</Title>
          <Text type="secondary">AI 驱动流程管理平台</Text>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>选择使用模式</div>
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as PlatformMode)}
            options={PLATFORM_MODES.map((m) => ({
              value: m.key,
              label: m.shortLabel,
              icon: MODE_ICONS[m.key],
            }))}
            style={{ width: '100%' }}
          />
        </div>
        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="邮箱"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default LoginPage
