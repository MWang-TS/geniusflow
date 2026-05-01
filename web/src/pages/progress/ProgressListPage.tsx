import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Tag, Select, Button, Space, App, Tooltip } from 'antd'
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { processInstanceApi, type ProcessInstanceListItem } from '../../api/process-instance'

const statusMap: Record<string, { color: string; label: string }> = {
  running: { color: 'blue', label: '进行中' },
  terminated: { color: 'red', label: '已终止' },
  completed: { color: 'green', label: '已完成' },
}

const ProgressListPage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState<ProcessInstanceListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [statusFilter, setStatusFilter] = useState<string>('running')

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const res = await processInstanceApi.list({ status: statusFilter, page, pageSize })
      setData(res.data.list || [])
      setPagination(res.data.pagination)
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, message])

  useEffect(() => { fetchData() }, [statusFilter])

  const columns: ColumnsType<ProcessInstanceListItem> = [
    { title: '流程名称', dataIndex: 'definitionName', key: 'definitionName', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => {
        const config = statusMap[v] || { color: 'default', label: v }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    { title: '节点数', dataIndex: 'nodeCount', key: 'nodeCount', width: 70, align: 'center' },
    {
      title: '计划开始', dataIndex: 'plannedStartDate', key: 'plannedStartDate', width: 120,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 120,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('zh-CN') : '-',
    },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 100, render: (v: { name: string } | null) => v?.name || '-' },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions', width: 80,
      render: (_, record) => (
        <Tooltip title="查看甘特图">
          <Button type="primary" size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/progress/${record.id}`)}>
            甘特
          </Button>
        </Tooltip>
      ),
    },
  ]

  return (
    <Card title="进度监控" extra={
      <Space>
        <Select style={{ width: 100 }} value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { label: '进行中', value: 'running' },
            { label: '已终止', value: 'terminated' },
            { label: '已完成', value: 'completed' },
          ]} />
        <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pagination.pageSize)} />
      </Space>
    }>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => fetchData(p, ps) }} />
    </Card>
  )
}

export default ProgressListPage
