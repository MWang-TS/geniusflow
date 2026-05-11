import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Space, Tag, Select, App, Popconfirm, Tooltip, Segmented, Spin, Empty, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, StopOutlined, EyeOutlined, PlayCircleOutlined, ApartmentOutlined, UserOutlined, BarChartOutlined } from '@ant-design/icons'
import { processInstanceApi, type ProcessInstanceListItem, type ProcessInstanceDetail } from '../../api/process-instance'

const { Text } = Typography

const statusMap: Record<string, { color: string; label: string }> = {
  running: { color: 'blue', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  terminated: { color: 'red', label: '已终止' },
  paused: { color: 'orange', label: '已暂停' },
}

const nodeStatusMap: Record<string, { color: string; label: string }> = {
  waiting: { color: 'default', label: '等待中' },
  in_progress: { color: 'blue', label: '执行中' },
  ai_inspecting: { color: 'purple', label: 'AI质检' },
  pending_approval: { color: 'orange', label: '待审批' },
  completed: { color: 'green', label: '已完成' },
  rejected: { color: 'red', label: '已驳回' },
}

const nodeStatusBorderColor: Record<string, string> = {
  default: '#d9d9d9',
  blue: '#1677ff',
  purple: '#722ed1',
  orange: '#fa8c16',
  green: '#389e0d',
  red: '#ff4d4f',
}

type ViewMode = 'board' | 'list'

const ProcessInstanceListPage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState<ProcessInstanceListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [status, setStatus] = useState<string | undefined>()
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [details, setDetails] = useState<Record<string, ProcessInstanceDetail>>({})
  const [detailsLoading, setDetailsLoading] = useState(false)

  const fetchData = useCallback(
    async (page = 1, pageSize = 20, mode = viewMode) => {
      setLoading(true)
      try {
        const res = await processInstanceApi.list({ page, pageSize, status })
        const list: ProcessInstanceListItem[] = res.data.list
        setData(list)
        setPagination(res.data.pagination)

        if (mode === 'board' && list.length > 0) {
          setDetailsLoading(true)
          const results = await Promise.allSettled(
            list.map((item) => processInstanceApi.getById(item.id))
          )
          const detailMap: Record<string, ProcessInstanceDetail> = {}
          results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
              detailMap[list[i].id] = result.value.data
            }
          })
          setDetails(detailMap)
          setDetailsLoading(false)
        }
      } catch {
        message.error('加载流程实例列表失败')
      } finally {
        setLoading(false)
      }
    },
    [status, viewMode, message],
  )

  useEffect(() => { fetchData(1, 20, viewMode) }, [status, viewMode])

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
      title: 'SOP流程名称',
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
          <Tooltip title="甘特图">
            <Button type="link" size="small" icon={<BarChartOutlined />}
              onClick={() => navigate(`/progress/${record.id}`)} />
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

  const renderNodeCard = (node: ProcessInstanceDetail['nodeInstances'][number]) => {
    const ns = nodeStatusMap[node.status] || { color: 'default', label: node.status }
    const borderColor = nodeStatusBorderColor[ns.color] ?? '#d9d9d9'
    const isActive = ['blue', 'purple', 'orange'].includes(ns.color)
    return (
      <div
        key={node.id}
        style={{
          minWidth: 180,
          maxWidth: 220,
          background: 'rgba(255,255,255,0.80)',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 20,
          padding: '16px 16px 14px',
          boxShadow: isActive
            ? `0 8px 30px ${borderColor}28, 0 1px 6px rgba(0,0,0,0.04)`
            : '0 2px 12px rgba(0,0,0,0.06)',
          flexShrink: 0,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'box-shadow 0.2s',
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: 'inline-block',
            background: `${borderColor}18`,
            color: borderColor,
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 99,
            letterSpacing: '0.01em',
          }}>{ns.label}</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, wordBreak: 'break-all', color: '#1c1c1e', lineHeight: 1.4, letterSpacing: '-0.01em' }}>
          {node.definition.nodeName}
        </div>
        {node.assignee && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8e8e93', marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
              <UserOutlined style={{ fontSize: 11 }} />
            </div>
            <span>{node.assignee.name}</span>
          </div>
        )}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aeaeb2', marginBottom: 5 }}>
            <span>进度</span>
            <span style={{ color: borderColor, fontWeight: 700 }}>{node.percentComplete}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${node.percentComplete}%`, borderRadius: 99, background: `linear-gradient(90deg, ${borderColor}aa, ${borderColor})`, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
    )
  }

  const renderInstanceRow = (instance: ProcessInstanceListItem) => {
    const sc = statusMap[instance.status] || { color: 'default', label: instance.status }
    const detail = details[instance.id]
    const nodes = detail?.nodeInstances ?? []
    const accentColors: Record<string, string> = {
      running: '#1677ff',
      completed: '#10b981',
      terminated: '#ff4d4f',
      paused: '#f59e0b',
    }
    const accent = accentColors[instance.status] || '#8c8c8c'

    return (
      <div
        key={instance.id}
        style={{
          background: 'rgba(255,255,255,0.80)',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 24,
          marginBottom: 20,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          background: `linear-gradient(135deg, ${accent}10 0%, rgba(242,242,247,0.7) 100%)`,
        }}>
          <Space size={12} wrap>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ApartmentOutlined style={{ color: accent, fontSize: 18 }} />
            </div>
            <Text strong style={{ fontSize: 16, color: '#1c1c1e', letterSpacing: '-0.015em' }}>{instance.definitionName}</Text>
            <span style={{ background: `${accent}18`, color: accent, fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 99 }}>{sc.label}</span>
            {instance.createdBy && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <UserOutlined style={{ marginRight: 4 }} />
                {instance.createdBy.name}
              </Text>
            )}
            {instance.plannedStartDate && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                计划开始：{new Date(instance.plannedStartDate).toLocaleDateString('zh-CN')}
              </Text>
            )}
          </Space>
          <Space>
            <button onClick={() => navigate(`/instances/${instance.id}`)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#3c3c43', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><EyeOutlined /> 详情</button>
            <button onClick={() => navigate(`/progress/${instance.id}`)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#3c3c43', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><BarChartOutlined /> 甘特图</button>
            {instance.status === 'running' && (
              <Popconfirm title="确认终止此流程实例？" onConfirm={() => handleTerminate(instance.id)}>
                <button style={{ background: '#FF3B3015', border: 'none', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#FF3B30', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><StopOutlined /> 终止</button>
              </Popconfirm>
            )}
          </Space>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {detailsLoading && !detail ? (
            <Spin size="small" />
          ) : nodes.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>暂无节点信息</Text>
          ) : (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
              {nodes.map(renderNodeCard)}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card
      title="流程看板"
      extra={
        <Space>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/instances/new')}>
            发起流程
          </Button>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { label: '看板', value: 'board' },
              { label: '列表', value: 'list' },
            ]}
          />
          <Select placeholder="状态筛选" allowClear style={{ width: 120 }} value={status}
            onChange={(v) => setStatus(v)}
            options={[
              { label: '进行中', value: 'running' },
              { label: '已完成', value: 'completed' },
              { label: '已终止', value: 'terminated' },
            ]} />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(pagination.page, pagination.pageSize)} />
        </Space>
      }
    >
      <Spin spinning={loading}>
        {viewMode === 'board' ? (
          data.length === 0 && !loading ? (
            <Empty description="暂无流程实例" style={{ padding: '60px 0' }} />
          ) : (
            <div>{data.map(renderInstanceRow)}</div>
          )
        ) : (
          <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
            pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => fetchData(p, ps) }} />
        )}
      </Spin>
    </Card>
  )
}

export default ProcessInstanceListPage
