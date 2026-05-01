import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Spin, Button, App } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { processInstanceApi, type GanttData } from '../../api/process-instance'
import GanttChart from '../../components/common/GanttChart'

const ProgressDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [ganttData, setGanttData] = useState<GanttData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    processInstanceApi.getGanttData(id)
      .then((r) => setGanttData(r.data))
      .catch(() => message.error('加载甘特图失败'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!ganttData) return <div style={{ textAlign: 'center', padding: 60 }}>数据不存在</div>

  const completedCount = ganttData.tasks.filter((t) => t.status === 'completed').length
  const totalCount = ganttData.tasks.length
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div style={{ maxWidth: '100%', padding: '24px 0' }}>
      <Button type="text" icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/progress')}
        style={{ marginBottom: 16 }}>返回列表</Button>

      <Card title={
        <span>流程进度 - {ganttData.processName}</span>
      }>
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="计划开始">
            {ganttData.plannedStartDate ? new Date(ganttData.plannedStartDate).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="实际开始">
            {ganttData.actualStartDate ? new Date(ganttData.actualStartDate).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="整体进度">{overallProgress}%（{completedCount}/{totalCount}）</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="甘特图" style={{ marginTop: 16 }}>
        <GanttChart tasks={ganttData.tasks} projectStart={ganttData.plannedStartDate} />
      </Card>
    </div>
  )
}

export default ProgressDetailPage
