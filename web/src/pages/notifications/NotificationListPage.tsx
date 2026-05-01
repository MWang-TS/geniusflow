import React, { useState, useEffect, useCallback } from 'react'
import { Card, List, Button, Tag, Space, App, Typography } from 'antd'
import { CheckOutlined, BellOutlined } from '@ant-design/icons'
import { notificationApi, type NotificationItem } from '../../api/notification'

const { Text } = Typography

const typeLabels: Record<string, string> = {
  overdue: '延期预警',
  system: '系统通知',
}

const NotificationListPage: React.FC = () => {
  const { message } = App.useApp()
  const [data, setData] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const res = await notificationApi.list({ page, pageSize })
      setData(res.data.list || [])
      setPagination(res.data.pagination)
    } catch {
      message.error('加载通知失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => { fetchData() }, [])

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id)
      setData((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read', readAt: new Date().toISOString() } : n)))
    } catch {
      message.error('操作失败')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead()
      setData((prev) => prev.map((n) => ({ ...n, status: 'read', readAt: n.readAt || new Date().toISOString() })))
      message.success('已全部标记为已读')
    } catch {
      message.error('操作失败')
    }
  }

  return (
    <Card title={
      <Space>
        <BellOutlined />
        <span>通知中心</span>
      </Space>
    } extra={
      <Button icon={<CheckOutlined />} onClick={handleMarkAllRead}>全部已读</Button>
    }>
      <List
        dataSource={data}
        loading={loading}
        pagination={{ ...pagination, showSizeChanger: true, onChange: (p, ps) => fetchData(p, ps) }}
        renderItem={(item) => (
          <List.Item
            key={item.id}
            style={{ background: item.status === 'unread' ? '#e6f4ff' : undefined, padding: '12px 16px', borderRadius: 6, marginBottom: 4 }}
            actions={item.status === 'unread' ? [
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleMarkRead(item.id)}>
                标记已读
              </Button>,
            ] : []}
          >
            <List.Item.Meta
              title={
                <Space>
                  {item.status === 'unread' && <Tag color="blue">NEW</Tag>}
                  <Text strong={item.status === 'unread'}>{item.title}</Text>
                  <Tag>{typeLabels[item.type] || item.type}</Tag>
                </Space>
              }
              description={
                <div>
                  {item.content && <div style={{ marginBottom: 4, color: '#666' }}>{item.content}</div>}
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {new Date(item.createdAt).toLocaleString('zh-CN')}
                    {item.readAt && <span style={{ marginLeft: 8 }}>已读于 {new Date(item.readAt).toLocaleString('zh-CN')}</span>}
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )
}

export default NotificationListPage
