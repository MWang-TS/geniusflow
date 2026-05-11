import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Space, Tag, Select, App, Tooltip, Segmented, Empty } from 'antd'
import { ReloadOutlined, PlayCircleOutlined, ApartmentOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { taskApi, type TaskListItem } from '../../api/task'

const typeMap: Record<string, { color: string; label: string }> = {
  execute: { color: 'blue', label: 'SOP执行' },
  approve: { color: 'orange', label: '审批确认' },
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
  { key: 'pending', title: '待执行', accent: '#8c8c8c', icon: <ClockCircleOutlined />, description: '已分配但尚未开始的SOP步骤' },
  { key: 'in_progress', title: '执行中', accent: '#1677ff', icon: <SyncOutlined />, description: '正在按SOP规范操作中' },
  { key: 'ai_inspecting', title: 'AI质检', accent: '#722ed1', icon: <SyncOutlined spin />, description: '提交后AI正在校验操作合规性' },
  { key: 'pending_approval', title: '待确认', accent: '#fa8c16', icon: <ApartmentOutlined />, description: '等待主管确认完成' },
  { key: 'completed', title: '已完成', accent: '#389e0d', icon: <CheckCircleOutlined />, description: 'SOP步骤已执行完毕' },
  { key: 'cancelled', title: '已取消', accent: '#bfbfbf', icon: <ClockCircleOutlined />, description: '已取消或终止的步骤' },
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
      title: '任务编号',
      dataIndex: 'taskCode',
      key: 'taskCode',
      width: 150,
      render: (v: string | null) =>
        v ? (
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#1677ff', background: '#e6f4ff', padding: '2px 6px', borderRadius: 4 }}>
            {v}
          </span>
        ) : '-',
    },
    {
      title: '流程名称',
      dataIndex: 'processName',
      key: 'processName',
      ellipsis: true,
    },
    {
      title: '节点',
      dataIndex: 'nodeName',
      key: 'nodeName',
      width: 130,
      ellipsis: true,
    },
    {
      title: '任务名称',
      key: 'taskTitle',
      ellipsis: true,
      render: (_, record) => record.title ?? <span style={{ color: '#bfbfbf' }}>-</span>,
    },
    {
      title: '类型',
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

  const renderTaskCard = (task: TaskListItem, laneAccent: string = '#1677ff') => {
    const lane = getBoardLane(task)
    const taskStatus = statusMap[task.status] || { color: 'default', label: task.status }
    const nodeStatus = nodeStatusMap[task.nodeStatus] || { color: 'default', label: task.nodeStatus }
    const isDraggingEnabled = ['pending', 'in_progress'].includes(lane)
    const isDragging = draggingTaskId === task.id

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
          background: isDragging ? `${laneAccent}12` : 'rgba(255,255,255,0.82)',
          border: isDragging ? `1.5px solid ${laneAccent}55` : '1px solid rgba(0,0,0,0.06)',
          borderRadius: 20,
          padding: '18px 18px 16px',
          boxShadow: isDragging
            ? `0 12px 40px ${laneAccent}33`
            : '0 2px 16px rgba(0,0,0,0.08), 0 0.5px 2px rgba(0,0,0,0.04)',
          opacity: movingTaskId === task.id ? 0.45 : 1,
          cursor: isDraggingEnabled ? 'grab' : 'default',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'box-shadow 0.2s, opacity 0.2s',
        }}
      >
        {/* SF-style accent dot + process name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: laneAccent, flexShrink: 0, boxShadow: `0 0 6px ${laneAccent}88` }} />
          <span style={{ fontSize: 11, color: '#8e8e93', fontWeight: 500, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.processName}
          </span>
        </div>
        {/* taskCode badge */}
        {task.taskCode && (
          <div style={{ marginBottom: 6 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: laneAccent,
              background: `${laneAccent}15`,
              padding: '2px 7px',
              borderRadius: 6,
              letterSpacing: '0.04em',
              fontFamily: 'monospace',
            }}>
              {task.taskCode}
            </span>
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1c1c1e', marginBottom: 4, lineHeight: 1.4, letterSpacing: '-0.015em' }}>
          {task.title ?? task.nodeName}
        </div>
        {task.title && (
          <div style={{ fontSize: 11, color: '#8e8e93', marginBottom: 12 }}>
            {task.nodeName}
          </div>
        )}
        {!task.title && <div style={{ marginBottom: 12 }} />}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[typeMap[task.type]?.label || task.type, taskStatus.label, nodeStatus.label].map((label) => (
            <span key={label} style={{
              background: 'rgba(0,0,0,0.05)',
              color: '#3c3c43',
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 99,
              letterSpacing: '0.01em',
            }}>{label}</span>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#aeaeb2', fontWeight: 500 }}>节点进度</span>
            <span style={{ fontSize: 11, color: laneAccent, fontWeight: 700 }}>{task.percentComplete}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${task.percentComplete}%`, borderRadius: 99, background: `linear-gradient(90deg, ${laneAccent}bb, ${laneAccent})`, transition: 'width 0.4s ease' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: '#aeaeb2' }}>
            {new Date(task.createdAt).toLocaleDateString('zh-CN')}
          </span>
          {task.dueDate ? (
            <span style={{ fontSize: 11, color: '#FF9F0A', fontWeight: 700, background: '#FF9F0A15', padding: '2px 8px', borderRadius: 99 }}>
              截止 {new Date(task.dueDate).toLocaleDateString('zh-CN')}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: '#c7c7cc' }}>无截止</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate(task.actionPath)}
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${laneAccent}dd 0%, ${laneAccent} 100%)`,
              border: 'none',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: `0 4px 14px ${laneAccent}44`,
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            {task.type === 'approve' ? '进入审批' : '打开任务'}
          </button>
          <button
            onClick={() => navigate(`/instances/${task.processInstanceId}`)}
            style={{
              background: 'rgba(0,0,0,0.05)',
              border: 'none',
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#3c3c43',
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            详情
          </button>
        </div>
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 18,
        marginBottom: 32,
        padding: '0 2px',
      }}>
        {[
          { title: '当前页任务', value: summary.total, color: '#4F8CFF', bg: 'linear-gradient(135deg, #fafdff 0%, #e3f0ff 100%)', shadow: '0 8px 32px #4f8cff22' },
          { title: '活跃任务', value: summary.active, color: '#34C759', bg: 'linear-gradient(135deg, #fafdff 0%, #e6fff3 100%)', shadow: '0 8px 32px #34c75922' },
          { title: '待审批', value: summary.waitingApproval, color: '#FFB800', bg: 'linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%)', shadow: '0 8px 32px #ffb80022' },
          { title: '已完成', value: summary.completed, color: '#5856D6', bg: 'linear-gradient(135deg, #f7f6fd 0%, #eae6ff 100%)', shadow: '0 8px 32px #5856d622' },
        ].map((stat) => (
          <div key={stat.title} style={{
            background: stat.bg,
            borderRadius: 22,
            padding: '22px 24px',
            border: 'none',
            boxShadow: stat.shadow,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'box-shadow 0.2s',
          }}>
            <div style={{ fontSize: 13, color: stat.color, fontWeight: 700, marginBottom: 10, letterSpacing: '0.01em', opacity: 0.85 }}>
              {stat.title}
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: stat.color, lineHeight: 1.1, fontFeatureSettings: '"tnum"', textShadow: `0 2px 12px ${stat.color}22` }}>
              {stat.value}
            </div>
            <div style={{
              position: 'absolute',
              right: -30,
              bottom: -30,
              width: 80,
              height: 80,
              background: stat.color,
              opacity: 0.07,
              borderRadius: '50%',
              filter: 'blur(2px)',
            }} />
          </div>
        ))}
      </div>

      {viewMode === 'board' ? (
        data.length === 0 ? (
          <Empty description="当前筛选条件下暂无任务" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, alignItems: 'start' }}>
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
                    background: 'rgba(242,242,247,0.72)',
                    border: '1px solid rgba(0,0,0,0.07)',
                    borderRadius: 24,
                    padding: '16px 14px 20px',
                    minHeight: 300,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                    padding: '0 4px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: `${column.accent}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: column.accent,
                        fontSize: 16,
                      }}>{column.icon}</div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1c1c1e', letterSpacing: '-0.01em' }}>{column.title}</span>
                    </div>
                    <span style={{
                      background: column.accent,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 10px',
                      borderRadius: 99,
                      minWidth: 26,
                      textAlign: 'center',
                      display: 'inline-block',
                      boxShadow: `0 2px 8px ${column.accent}44`,
                    }}>{items.length}</span>
                  </div>
                  <div style={{ color: '#8e8e93', fontSize: 11, marginBottom: 14, paddingLeft: 4, letterSpacing: '0.01em' }}>
                    {column.description}
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {items.length > 0
                      ? items.map((task) => renderTaskCard(task, column.accent))
                      : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无卡片" style={{ padding: '20px 0' }} />}
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
