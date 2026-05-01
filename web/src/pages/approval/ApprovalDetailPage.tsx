import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Spin, App, Collapse,
  List, Typography, Progress, Input, Steps, Form,
} from 'antd'
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined,
  FileTextOutlined, BulbOutlined, HistoryOutlined, EyeOutlined,
} from '@ant-design/icons'
import { taskApi, type ApprovalTaskDetail } from '../../api/task'

const { Text } = Typography
const { TextArea } = Input

const statusMap: Record<string, { color: string; label: string }> = {
  in_progress: { color: 'blue', label: '进行中' },
  pending_approval: { color: 'orange', label: '待审批' },
  completed: { color: 'green', label: '已完成' },
  ai_inspecting: { color: 'purple', label: 'AI校验中' },
}

const ApprovalDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [detail, setDetail] = useState<ApprovalTaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!taskId) return
    taskApi.getById(taskId)
      .then((r) => setDetail(r.data))
      .catch(() => message.error('加载审批详情失败'))
      .finally(() => setLoading(false))
  }, [taskId])

  const handleApprove = useCallback(async () => {
    if (!taskId) return
    setProcessing(true)
    try {
      await taskApi.approve(taskId, comment || '同意通过')
      message.success('审批通过')
      navigate('/approvals')
    } catch {
      message.error('操作失败')
    } finally {
      setProcessing(false)
    }
  }, [taskId, comment, navigate, message])

  const handleReject = useCallback(async () => {
    if (!taskId) return
    if (!comment.trim()) {
      message.warning('请填写驳回原因')
      return
    }
    setProcessing(true)
    try {
      await taskApi.reject(taskId, comment)
      message.success('已驳回')
      navigate('/approvals')
    } catch {
      message.error('操作失败')
    } finally {
      setProcessing(false)
    }
  }, [taskId, comment, navigate, message])

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!detail) return <div style={{ textAlign: 'center', padding: 60 }}>审批任务不存在</div>

  const ni = detail.nodeInstance
  const def = ni.definition
  const aiReport = ni.aiReports?.[0]
  const isPending = detail.status === 'pending' && ni.status === 'pending_approval'

  const inputSchema = (def.inputSpec as Record<string, unknown>)?.dataSchema as any[] | undefined
  const outputSchema = (def.outputSpec as Record<string, unknown>)?.deliverables as string[] | undefined
  const actionSpec = def.actionSpec as Record<string, unknown>

  const inputData = (ni.inputData as Record<string, unknown>) || {}
  const outputData = (ni.outputData as Record<string, unknown>) || {}

  const historyItems = (ni.history || []).map((h) => {
    const eventLabels: Record<string, string> = {
      submit: '提交',
      ai_pass: 'AI通过',
      ai_reject: 'AI拦截',
      ai_fallback: 'AI降级',
      approve: '审批通过',
      reject: '审批驳回',
    }
    const fromLabel = statusMap[h.fromStatus || '']?.label || h.fromStatus
    const toLabel = statusMap[h.toStatus || '']?.label || h.toStatus
    return {
      title: `${eventLabels[h.eventType] || h.eventType}: ${fromLabel} → ${toLabel}`,
      description: new Date(h.createdAt).toLocaleString('zh-CN'),
    }
  })

  const collapseItems = [
    {
      key: 'input',
      label: <span><FileTextOutlined /> 输入阶段 - 执行人填写的原始数据</span>,
      children: inputSchema && inputSchema.length > 0 ? (
        <List size="small" dataSource={inputSchema}
          renderItem={(field: any) => (
            <List.Item>
              <div>
                <Text strong>{field.name}</Text>
                <Tag color={field.required ? 'red' : 'default'} style={{ marginLeft: 8 }}>
                  {field.required ? '必填' : '选填'}
                </Tag>
                <div style={{ marginTop: 4 }}>
                  <Text>{inputData[field.name] != null ? String(inputData[field.name]) : <Text type="secondary">未填写</Text>}</Text>
                </div>
              </div>
            </List.Item>
          )} />
      ) : <Text type="secondary">无输入字段</Text>,
    },
    {
      key: 'action',
      label: <span><BulbOutlined /> 行动阶段 - 执行要求</span>,
      children: (
        <div>
          {actionSpec?.instructions != null && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>行动说明</Text>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '10px 14px', marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                {String(actionSpec.instructions)}
              </div>
            </div>
          )}
          {actionSpec?.requirements != null && (
            <div>
              <Text strong>质量要求</Text>
              <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '10px 14px', marginTop: 4, fontSize: 13 }}>
                {String(actionSpec.requirements)}
              </div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Text strong>完成进度: {ni.percentComplete}%</Text>
            <Progress percent={ni.percentComplete} size="small" />
          </div>
        </div>
      ),
    },
    {
      key: 'output',
      label: <span><EyeOutlined /> 输出阶段 - 交付物</span>,
      children: outputSchema && outputSchema.length > 0 ? (
        <List size="small" dataSource={outputSchema}
          renderItem={(name: string) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <Text strong>{name}</Text>
                <div style={{ marginTop: 4 }}>
                  <Text>{outputData[name] != null ? String(outputData[name]) : <Text type="secondary">未填写</Text>}</Text>
                </div>
              </div>
            </List.Item>
          )} />
      ) : <Text type="secondary">无输出字段</Text>,
    },
  ]

  if (aiReport) {
    const content = aiReport.content
    collapseItems.push({
      key: 'ai-report',
      label: <span><BulbOutlined /> AI 督导报告</span>,
      children: (
        <div>
          {content.score !== undefined && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>质量评分: </Text>
              <Tag color={content.passed ? 'green' : 'red'}>{content.score} 分</Tag>
              {content.passed === false && <Tag color="red">未通过</Tag>}
            </div>
          )}
          {content.issues && content.issues.length > 0 && (
            <List size="small" dataSource={content.issues}
              renderItem={(issue) => (
                <List.Item>
                  <div>
                    <Tag color={issue.type === 'error' ? 'red' : 'orange'}>
                      {issue.type === 'error' ? '错误' : '提醒'}
                    </Tag>
                    <Text strong>{issue.field}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Text>{issue.message}</Text>
                    </div>
                    {issue.suggestion && (
                      <Text type="secondary" style={{ fontSize: 12 }}>建议: {issue.suggestion}</Text>
                    )}
                  </div>
                </List.Item>
              )} />
          )}
          {content.summary && (
            <div style={{ background: '#f5f5f5', borderRadius: 6, padding: 10, marginTop: 8 }}>
              <Text type="secondary">总结: {content.summary}</Text>
            </div>
          )}
        </div>
      ),
    })
  }

  collapseItems.push({
    key: 'history',
    label: <span><HistoryOutlined /> 操作历史</span>,
    children: historyItems.length > 0 ? (
      <Steps direction="vertical" size="small" items={historyItems} />
    ) : <Text type="secondary">暂无操作记录</Text>,
  })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 0' }}>
      <Button type="text" icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/approvals')}
        style={{ marginBottom: 16 }}>返回审批列表</Button>

      <Card title={
        <Space>
          <span>{ni.instance?.definition?.name} / {def?.nodeName}</span>
          <Tag color={statusMap[ni.status]?.color || 'default'}>
            {statusMap[ni.status]?.label || ni.status}
          </Tag>
        </Space>
      }>
        <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="执行人">{ni.assignee?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="计划开始">
            {ni.plannedStartDate ? new Date(ni.plannedStartDate).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="计划结束">
            {ni.plannedEndDate ? new Date(ni.plannedEndDate).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Collapse defaultActiveKey={['input', 'action', 'output']} items={collapseItems} />
      </Card>

      {isPending && (
        <Card style={{ marginTop: 16 }} title="审批操作">
          <Form.Item label="审批意见" style={{ marginBottom: 12 }}>
            <TextArea rows={3} placeholder="请输入审批意见（驳回时必填）"
              value={comment} onChange={(e) => setComment(e.target.value)} />
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Space size="large">
              <Button type="primary" size="large" icon={<CheckOutlined />}
                loading={processing} onClick={handleApprove}>
                审批通过
              </Button>
              <Button danger size="large" icon={<CloseOutlined />}
                loading={processing} onClick={handleReject}>
                驳回修改
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {!isPending && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ textAlign: 'center', color: '#999', padding: '12px 0' }}>
            该审批任务已处理
          </div>
        </Card>
      )}
    </div>
  )
}

export default ApprovalDetailPage
