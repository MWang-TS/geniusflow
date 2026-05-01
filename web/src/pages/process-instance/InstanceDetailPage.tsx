import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Spin, Button, App, Steps, Tabs } from 'antd'
import { ArrowLeftOutlined, LoadingOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { processInstanceApi, type ProcessInstanceDetail, type GanttData } from '../../api/process-instance'
import GanttChart from '../../components/common/GanttChart'

const statusMap: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  waiting: { color: 'default', label: '等待中', icon: <ClockCircleOutlined /> },
  in_progress: { color: 'blue', label: '进行中', icon: <LoadingOutlined /> },
  ai_inspecting: { color: 'purple', label: 'AI校验中', icon: <LoadingOutlined /> },
  pending_approval: { color: 'orange', label: '待审批', icon: <ClockCircleOutlined /> },
  completed: { color: 'green', label: '已完成', icon: <CheckCircleOutlined /> },
  rejected: { color: 'red', label: '已终止', icon: <ClockCircleOutlined /> },
}

const InstanceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [instance, setInstance] = useState<ProcessInstanceDetail | null>(null)
  const [ganttData, setGanttData] = useState<GanttData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    processInstanceApi.getById(id)
      .then((r) => setInstance(r.data))
      .catch(() => message.error('加载失败'))
      .finally(() => setLoading(false))
  }, [id])

  const loadGantt = useCallback(() => {
    if (!id) return
    processInstanceApi.getGanttData(id)
      .then((r) => setGanttData(r.data))
      .catch(() => {})
  }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!instance) return <div style={{ textAlign: 'center', padding: 60 }}>实例不存在</div>

  const stepItems = instance.nodeInstances.map((n) => {
    const config = statusMap[n.status] || { color: 'default', label: n.status, icon: null }
    return {
      title: n.definition?.nodeName || '未知节点',
      description: (
        <div>
          <Tag color={config.color}>{config.label}</Tag>
          {n.assignee && <span style={{ fontSize: 12, color: '#999' }}>执行人: {n.assignee.name}</span>}
        </div>
      ),
      status: n.status === 'completed' ? 'finish' as const
        : n.status === 'in_progress' ? 'process' as const
        : n.status === 'rejected' ? 'error' as const
        : 'wait' as const,
    }
  })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 0' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/instances')}
        style={{ marginBottom: 16 }}>返回列表</Button>

      <Card title="流程实例详情">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="流程名称">{instance.definition?.name}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusMap[instance.status]?.color}>{statusMap[instance.status]?.label || instance.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="计划开始">{instance.plannedStartDate ? new Date(instance.plannedStartDate).toLocaleDateString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label="实际开始">{instance.actualStartDate ? new Date(instance.actualStartDate).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label="创建人">{instance.creator?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(instance.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs defaultActiveKey="steps" items={[
          {
            key: 'steps',
            label: '节点进度',
            children: (
              <Steps
                direction="vertical"
                size="small"
                current={instance.nodeInstances.findIndex((n) => n.status === 'in_progress')}
                items={stepItems}
              />
            ),
          },
          {
            key: 'gantt',
            label: '甘特图',
            children: ganttData
              ? <GanttChart tasks={ganttData.tasks} projectStart={ganttData.plannedStartDate} />
              : (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Button onClick={loadGantt}>加载甘特图</Button>
                </div>
              ),
          },
        ]} />
      </Card>
    </div>
  )
}

export default InstanceDetailPage
