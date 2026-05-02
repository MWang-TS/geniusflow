import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Space, Tag, App, Tooltip, Select } from 'antd'
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { taskApi, type TaskListItem } from '../../api/task'

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '待审批' },
  completed: { color: 'success', label: '已处理' },
}

const ApprovalListPage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [filterStatus, setFilterStatus] = useState<string>('pending')

  const fetchData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true)
      try {
        const res = await taskApi.list({ type: 'approve', status: filterStatus, page, pageSize })
        setData(res.data.list || [])
        setPagination(res.data.pagination)
      } catch {
        message.error('加载审批列表失败')
      } finally {
        setLoading(false)
      }
    },
    [filterStatus, message],
  )

  useEffect(() => { fetchData(1, pagination.pageSize) }, [filterStatus])

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
      width: 180,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      width: 80,
      render: (_, record) => (
        <Tooltip title={record.status === 'pending' ? '去审批' : '查看详情'}>
          <Button type={record.status === 'pending' ? 'primary' : 'default'} size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/approvals/${record.id}`)}>
            {record.status === 'pending' ? '审批' : '查看'}
          </Button>
        </Tooltip>
      ),
    },
  ]

  return (
    <Card
      title="审批中心"
      extra={
        <Space>
          <Select style={{ width: 100 }} value={filterStatus}
            onChange={(v) => setFilterStatus(v)}
            options={[
              { label: '待审批', value: 'pending' },
              { label: '已处理', value: 'completed' },
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

export default ApprovalListPage
