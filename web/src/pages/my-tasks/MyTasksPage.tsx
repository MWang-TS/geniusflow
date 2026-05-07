import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Space, Tag, Select, App, Tooltip, Typography, Segmented, Row, Col, Statistic, Empty, Progress } from 'antd'
import { ReloadOutlined, PlayCircleOutlined, ApartmentOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { taskApi, type TaskListItem } from '../../api/task'

const { Text } = Typography

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

const nodeStatusMap: Record<string, { color: string; label: string }> = {
  waiting: { color: 'default', label: '等待中' },
  in_progress: { color: 'blue', label: '执行中' },
  ai_inspecting: { color: 'purple', label: 'AI 质检中' },
  pending_approval: { color: 'orange', label: '待审批' },
  completed: { color: 'green', label: '已完成' },
  rejected: { color: 'red', label: '已驳回' },
}

type BoardViewMode = 'board' | 'list'
type BoardLaneKey = 'pending' | 'in_progress' | 'ai_inspecting' | 'pending_approval' | 'completed' | 'cancelled'

const boardColumns: Array<{ key: BoardLaneKey; title: string; accent: string; icon: React.ReactNode; description: string }> = [
  { key: 'pending', title: '待开始', accent: '#8c8c8c', icon: <ClockCircleOutlined />, description: '已分配但尚未开始的流程任务' },
  { key: 'in_progress', title: '处理中', accent: '#1677ff', icon: <SyncOutlined />, description: '正在执行或审阅中的任务' },
  { key: 'ai_inspecting', title: 'AI质检', accent: '#722ed1', icon: <SyncOutlined spin />, description: '提交后正在经过 AI 督导校验' },
  { key: 'pending_approval', title: '待审批', accent: '#fa8c16', icon: <ApartmentOutlined />, description: '等待主管审批放行' },
  { key: 'completed', title: '已完成', accent: '#389e0d', icon: <CheckCircleOutlined />, description: '流程节点已闭环' },
  { key: 'cancelled', title: '已取消', accent: '#bfbfbf', icon: <ClockCircleOutlined />, description: '已取消或终止的任务' },
]

function getBoardLane(task: TaskListItem): BoardLaneKey {
  if (task.status === 'completed') return 'completed'
  if (task.status === 'cancelled') return 'cancelled'
  if (task.nodeStatus === 'pending_approval') return 'pending_approval'
  if (task.nodeStatus === 'ai_inspecting') return 'ai_inspecting'
  if (task.status === 'in_progress') return 'in_progress'
  return 'pending'
}

function canMoveBetweenLanes(task: TaskListItem, targetLane: BoardLaneKey) {
  const sourceLane = getBoardLane(task)
  return ['pending', 'in_progress'].includes(sourceLane) && ['pending', 'in_progress'].includes(targetLane) && sourceLane !== targetLane
}

const MyTasksPage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0 })
  const [filterType, setFilterType] = useState<string | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [viewMode, setViewMode] = useState<BoardViewMode>('board')
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)

  const fetchData = useCallback(
    async (page = 1, pageSize = pagination.pageSize) => {
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
    [filterType, filterStatus, message, pagination.pageSize],
  )

  useEffect(() => { fetchData(1, pagination.pageSize) }, [filterType, filterStatus])

  const laneBuckets = useMemo(() => {
    return data.reduce<Record<BoardLaneKey, TaskListItem[]>>((acc, item) => {
      acc[getBoardLane(item)].push(item)
      return acc
    }, {
      pending: [],
      in_progress: [],
      ai_inspecting: [],
      pending_approval: [],
      completed: [],
      cancelled: [],
    })
  }, [data])

  const summary = useMemo(() => ({
    total: data.length,
    active: data.filter((item) => ['pending', 'in_progress', 'ai_inspecting', 'pending_approval'].includes(getBoardLane(item))).length,
    waitingApproval: laneBuckets.pending_approval.length,
    completed: laneBuckets.completed.length,
  }), [data, laneBuckets])

  const handleTaskStatusDrop = useCallback(async (taskId: string, targetLane: BoardLaneKey) => {
    const task = data.find((item) => item.id === taskId)
    if (!task) return
    if (!canMoveBetweenLanes(task, targetLane)) {
      message.warning('该卡片当前只能在“待开始”和“处理中”之间拖拽')
      return
    }

    const nextStatus = targetLane as 'pending' | 'in_progress'
    const previousData = data
    setMovingTaskId(taskId)
    setData((current) => current.map((item) => item.id === taskId ? { ...item, status: nextStatus } : item))

    try {
      await taskApi.updateStatus(taskId, nextStatus)
      message.success(nextStatus === 'in_progress' ? '任务已加入处理中' : '任务已退回待开始')
    } catch {
      setData(previousData)
      message.error('更新任务状态失败')
    } finally {
      setMovingTaskId(null)
      setDraggingTaskId(null)
    }
  }, [data, message])

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
      title: '流程阶段',
      dataIndex: 'nodeStatus',
      key: 'nodeStatus',
      width: 110,
      render: (v: string) => {
        const config = nodeStatusMap[v] || { color: 'default', label: v }
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
          {record.status !== 'cancelled' && (
            <Tooltip title={record.type === 'approve' ? '去审批' : '去执行'}>
              <Button type="primary" size="small" icon={<PlayCircleOutlined />}
                onClick={() => navigate(record.actionPath)}>
                {record.type === 'approve' ? '审批' : '执行'}
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const renderTaskCard = (task: TaskListItem) => {
    const lane = getBoardLane(task)
    const taskStatus = statusMap[task.status] || { color: 'default', label: task.status }
    const nodeStatus = nodeStatusMap[task.nodeStatus] || { color: 'default', label: task.nodeStatus }
    const isDraggingEnabled = ['pending', 'in_progress'].includes(lane)

    return (
      <div
        key={task.id}
        draggable={isDraggingEnabled}
        onDragStart={(event) => {
          if (!isDraggingEnabled) return
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', task.id)
          setDraggingTaskId(task.id)
        }}
        onDragEnd={() => setDraggingTaskId(null)}
        style={{
          background: '#fff',
          border: draggingTaskId === task.id ? '1px solid #1677ff' : '1px solid #f0f0f0',
          borderRadius: 16,
          padding: 14,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          opacity: movingTaskId === task.id ? 0.6 : 1,
          cursor: isDraggingEnabled ? 'grab' : 'default',
        }}
      >
        <Space size={[6, 6]} wrap style={{ marginBottom: 10 }}>
          <Tag color={typeMap[task.type]?.color || 'default'}>{typeMap[task.type]?.label || task.type}</Tag>
          <Tag color={taskStatus.color}>{taskStatus.label}</Tag>
          <Tag color={nodeStatus.color}>{nodeStatus.label}</Tag>
        </Space>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{task.nodeName}</div>
        <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: 13, marginBottom: 12 }}>{task.processName}</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text type="secondary">节点进度</Text>
            <Text>{task.percentComplete}%</Text>
          </div>
          <Progress percent={task.percentComplete} size="small" showInfo={false} strokeColor="#1677ff" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
          <span>创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}</span>
          <span>{task.dueDate ? `截止 ${new Date(task.dueDate).toLocaleDateString('zh-CN')}` : '无截止日期'}</span>
        </div>
        <Space>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(task.actionPath)}>
            {task.type === 'approve' ? '进入审批' : '打开任务'}
          </Button>
          <Button onClick={() => navigate(`/instances/${task.processInstanceId}`)}>流程详情</Button>
        </Space>
      </div>
    )
  }

  return (
    <Card
      title="任务看板工作台"
      extra={
        <Space>
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as BoardViewMode)}
            options={[
              { label: '看板', value: 'board' },
              { label: '列表', value: 'list' },
            ]}
          />
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
              { label: '进行中', value: 'in_progress' },
              { label: '已完成', value: 'completed' },
              { label: '已取消', value: 'cancelled' },
            ]} />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pagination.pageSize)} />
        </Space>
      }
    >
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} md={6}><Card size="small"><Statistic title="当前页任务" value={summary.total} /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="活跃任务" value={summary.active} /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="待审批" value={summary.waitingApproval} /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="已完成" value={summary.completed} /></Card></Col>
      </Row>

      {viewMode === 'board' ? (
        data.length === 0 ? (
          <Empty description="当前筛选条件下暂无任务" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
            {boardColumns.map((column) => {
              const items = laneBuckets[column.key]
              return (
                <div
                  key={column.key}
                  onDragOver={(event) => {
                    if (draggingTaskId && ['pending', 'in_progress'].includes(column.key)) {
                      event.preventDefault()
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const taskId = event.dataTransfer.getData('text/plain')
                    if (taskId) {
                      void handleTaskStatusDrop(taskId, column.key)
                    }
                  }}
                  style={{
                    background: '#fafafa',
                    border: `1px solid ${column.accent}22`,
                    borderTop: `4px solid ${column.accent}`,
                    borderRadius: 20,
                    padding: 14,
                    minHeight: 240,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Space>
                      <span style={{ color: column.accent }}>{column.icon}</span>
                      <span style={{ fontWeight: 700 }}>{column.title}</span>
                    </Space>
                    <Tag color="default">{items.length}</Tag>
                  </div>
                  <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginBottom: 12 }}>{column.description}</div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {items.length > 0 ? items.map(renderTaskCard) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无卡片" />}
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => fetchData(p, ps),
          }} />
      )}
    </Card>
  )
}

export default MyTasksPage
