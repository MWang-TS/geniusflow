import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth.store'
import { usePlatformModeStore } from '@/stores/platform-mode.store'
import { resolveHomeRoute } from '@/config/defaultRoutes'

const { Title, Text } = Typography

interface LoginForm {
  email: string
  password: string
}

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated, allowedRoutes } = useAuthStore()
  const { mode } = usePlatformModeStore()
  const [loading, setLoading] = useState(false)
  const homeRoute = resolveHomeRoute(mode, allowedRoutes)

  if (isAuthenticated) {
    return <Navigate to={homeRoute} replace />
  }

  const handleLogin = async (values: LoginForm) => {
    setLoading(true)
    try {
      await login(values)
      message.success('登录成功')
      navigate(resolveHomeRoute(mode, useAuthStore.getState().allowedRoutes))
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
