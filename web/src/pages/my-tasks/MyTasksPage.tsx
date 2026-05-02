import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Space, Tag, Select, App, Tooltip } from 'antd'
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { taskApi, type TaskListItem } from '../../api/task'

const typeMap: Record<string, { color: string; label: string }> = {
  execute: { color: 'blue', label: '执行' },
  approve: { color: 'orange', label: '审批' },
}

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待处理' },
  in_progress: { color: 'blue', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  cancelled: { color: 'default', label: '已取消' },
}

const MyTasksPage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [filterType, setFilterType] = useState<string | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()

  const fetchData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true)
      try {
        const res = await taskApi.list({ type: filterType, status: filterStatus, page, pageSize })
        setData(res.data.list || [])
        setPagination(res.data.pagination)
      } catch {
        message.error('加载任务列表失败')
      } finally {
        setLoading(false)
      }
    },
    [filterType, filterStatus, message],
  )

  useEffect(() => { fetchData(1, pagination.pageSize) }, [filterType, filterStatus])

  const columns: ColumnsType<TaskListItem> = [
    {
      title: '流程名称',
      dataIndex: 'processName',
      key: 'processName',
      ellipsis: true,
    },
    {
      title: '节点名称',
      dataIndex: 'nodeName',
      key: 'nodeName',
      width: 160,
      ellipsis: true,
    },
    {
      title: '任务类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => {
        const config = typeMap[v] || { color: 'default', label: v }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => {
        const config = statusMap[v] || { color: 'default', label: v }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          {record.type === 'execute' && record.status !== 'cancelled' && (
            <Tooltip title="去执行">
              <Button type="primary" size="small" icon={<PlayCircleOutlined />}
                onClick={() => navigate(`/my-tasks/${record.nodeInstanceId}/execute`)}>
                执行
              </Button>
            </Tooltip>
          )}
          {record.type === 'approve' && record.status === 'pending' && (
            <Tooltip title="去审批">
              <Button type="primary" size="small" icon={<PlayCircleOutlined />}
                onClick={() => navigate(`/approvals/${record.nodeInstanceId}`)}>
                审批
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="我的任务"
      extra={
        <Space>
          <Select placeholder="任务类型" allowClear style={{ width: 100 }}
            value={filterType}
            onChange={(v) => setFilterType(v)}
            options={[
              { label: '执行', value: 'execute' },
              { label: '审批', value: 'approve' },
            ]} />
          <Select placeholder="状态" allowClear style={{ width: 100 }}
            value={filterStatus}
            onChange={(v) => setFilterStatus(v)}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '已完成', value: 'completed' },
            ]} />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pagination.pageSize)} />
        </Space>
      }
    >
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => fetchData(p, ps),
        }} />
    </Card>
  )
}

export default MyTasksPage
