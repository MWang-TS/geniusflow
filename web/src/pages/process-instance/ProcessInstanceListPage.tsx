import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Space, Tag, Select, App, Popconfirm, Tooltip } from 'antd'
import { ReloadOutlined, StopOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { processInstanceApi, type ProcessInstanceListItem } from '../../api/process-instance'

const statusMap: Record<string, { color: string; label: string }> = {
  running: { color: 'blue', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  terminated: { color: 'red', label: '已终止' },
  paused: { color: 'orange', label: '已暂停' },
}

const ProcessInstanceListPage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState<ProcessInstanceListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [status, setStatus] = useState<string | undefined>()

  const fetchData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true)
      try {
        const res = await processInstanceApi.list({ page, pageSize, status })
        setData(res.data.list)
        setPagination(res.data.pagination)
      } catch {
        message.error('加载流程实例列表失败')
      } finally {
        setLoading(false)
      }
    },
    [status, message],
  )

  useEffect(() => { fetchData() }, [])

  const handleTerminate = async (id: string) => {
    try {
      await processInstanceApi.terminate(id, '手动终止')
      message.success('已终止')
      fetchData(pagination.page, pagination.pageSize)
    } catch {
      message.error('终止失败')
    }
  }

  const columns: ColumnsType<ProcessInstanceListItem> = [
    {
      title: '流程名称',
      dataIndex: 'definitionName',
      key: 'definitionName',
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
      title: '节点数',
      dataIndex: 'nodeCount',
      key: 'nodeCount',
      width: 80,
    },
    {
      title: '计划开始',
      dataIndex: 'plannedStartDate',
      key: 'plannedStartDate',
      width: 120,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '创建人',
      key: 'createdBy',
      width: 100,
      render: (_, r) => r.createdBy?.name || '-',
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
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/instances/${record.id}`)} />
          </Tooltip>
          {record.status === 'running' && (
            <Popconfirm title="确认终止此流程实例？" onConfirm={() => handleTerminate(record.id)}>
              <Tooltip title="终止">
                <Button type="link" size="small" danger icon={<StopOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="流程实例"
      extra={
        <Space>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/instances/new')}>
            发起流程
          </Button>
          <Select placeholder="状态筛选" allowClear style={{ width: 120 }} value={status}
            onChange={(v) => { setStatus(v); setTimeout(() => fetchData(1, pagination.pageSize), 0) }}
            options={[
              { label: '进行中', value: 'running' },
              { label: '已完成', value: 'completed' },
              { label: '已终止', value: 'terminated' },
            ]} />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pagination.pageSize)} />
        </Space>
      }
    >
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => fetchData(p, ps) }} />
    </Card>
  )
}

export default ProcessInstanceListPage
