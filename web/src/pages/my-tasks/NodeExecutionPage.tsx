import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Collapse, Descriptions, Tag, Slider, Button, Space, Spin, App, Divider } from 'antd'
import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons'
import { nodeInstanceApi, type NodeInstanceDetail } from '../../api/node-instance'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useAuthStore } from '../../stores/auth.store'
import DynamicFormFill from '../../components/common/DynamicFormFill'
import AiInspectionOverlay, { type AiInspectionResult } from '../../components/common/AiInspectionOverlay'

const statusMap: Record<string, { color: string; label: string }> = {
  waiting: { color: 'default', label: '等待中' },
  in_progress: { color: 'blue', label: '进行中' },
  ai_inspecting: { color: 'purple', label: 'AI校验中' },
  pending_approval: { color: 'orange', label: '待审批' },
  completed: { color: 'green', label: '已完成' },
}

const NodeExecutionPage: React.FC = () => {
  const { nodeInstanceId } = useParams<{ nodeInstanceId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const token = useAuthStore((s) => s.accessToken)
  const { socket } = useWebSocket(token)

  const [node, setNode] = useState<NodeInstanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({})
  const [outputValues, setOutputValues] = useState<Record<string, unknown>>({})
  const [percentComplete, setPercentComplete] = useState(0)
  const [aiResult, setAiResult] = useState<AiInspectionResult | null>(null)
  const [showAiOverlay, setShowAiOverlay] = useState(false)

  useEffect(() => {
    if (!socket.current || !nodeInstanceId) return
    const s = socket.current

    const handleAiResult = (data: AiInspectionResult) => {
      if (data.nodeInstanceId !== nodeInstanceId) return
      setAiResult(data)
      if (data.passed) {
        setNode((prev) => prev ? { ...prev, status: 'pending_approval' } : prev)
      } else {
        setNode((prev) => prev ? { ...prev, status: 'in_progress' } : prev)
      }
    }

    s.on('ai:result', handleAiResult)
    return () => {
      s.off('ai:result', handleAiResult)
    }
  }, [socket, nodeInstanceId])

  useEffect(() => {
    if (!nodeInstanceId) return
    nodeInstanceApi.getById(nodeInstanceId)
      .then((r) => {
        const detail = r.data
        setNode(detail)
        setInputValues((detail.inputData as Record<string, unknown>) || {})
        setOutputValues((detail.outputData as Record<string, unknown>) || {})
        setPercentComplete(detail.percentComplete || 0)
      })
      .catch(() => message.error('加载节点失败'))
      .finally(() => setLoading(false))
  }, [nodeInstanceId])

  const handleSave = useCallback(async () => {
    if (!nodeInstanceId) return
    setSaving(true)
    try {
      await nodeInstanceApi.save(nodeInstanceId, {
        inputData: inputValues,
        outputData: outputValues,
        percentComplete,
      })
      message.success('保存成功')
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }, [nodeInstanceId, inputValues, outputValues, percentComplete, message])

  const handleProgressChange = useCallback(
    async (val: number) => {
      const prev = percentComplete
      setPercentComplete(val)
      if (!nodeInstanceId) return
      try {
        await nodeInstanceApi.updateProgress(nodeInstanceId, val)
      } catch {
        setPercentComplete(prev)
        message.error('进度更新失败')
      }
    },
    [nodeInstanceId, percentComplete, message],
  )

  const handleSubmit = useCallback(async () => {
    if (!nodeInstanceId) return
    setSubmitting(true)
    try {
      const res = await nodeInstanceApi.submit(nodeInstanceId, {
        inputData: inputValues,
        outputData: outputValues,
        percentComplete: 100,
      })
      if (res.data?.status === 'ai_inspecting') {
        setShowAiOverlay(true)
        message.info('已提交，AI 正在校验中...')
      } else {
        message.success(res.data?.message || '提交完成')
        navigate('/my-tasks')
      }
    } catch {
      message.error('提交失败')
    } finally {
      setSubmitting(false)
    }
  }, [nodeInstanceId, inputValues, outputValues, navigate, message])

  const handleAiOverlayClose = useCallback(() => {
    setShowAiOverlay(false)
    if (aiResult?.passed) {
      navigate('/my-tasks')
    }
  }, [aiResult, navigate])

  const handleRetry = useCallback(() => {
    setShowAiOverlay(false)
    setAiResult(null)
    setPercentComplete(0)
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!node) return <div style={{ textAlign: 'center', padding: 60 }}>节点不存在</div>

  const def = node.definition
  const inputSchema = (def.inputSpec as Record<string, unknown>)?.dataSchema as any[]
  const outputSchema = (def.outputSpec as Record<string, unknown>)?.deliverables as string[] | undefined
  const actionSpec = def.actionSpec as Record<string, unknown>
  const isEditable = node.status === 'in_progress'

  const outputFields = (outputSchema || []).map((name) => ({
    name,
    type: 'text' as const,
    required: true,
  }))

  const collapseItems = [
    {
      key: 'input',
      label: '一、输入阶段 - 填写工作数据',
      children: (
        <DynamicFormFill
          fields={inputSchema || []}
          values={inputValues}
          onChange={setInputValues}
          readonly={!isEditable}
        />
      ),
    },
    {
      key: 'action',
      label: '二、行动阶段 - 执行任务',
      children: (
        <div>
          {actionSpec?.instructions != null && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>行动说明</div>
              <div style={{
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 6,
                padding: '12px 16px',
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                lineHeight: 1.8,
              }}>
                {String(actionSpec.instructions)}
              </div>
            </div>
          )}
          {actionSpec?.requirements != null && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>质量要求</div>
              <div style={{
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: 6,
                padding: '12px 16px',
                fontSize: 13,
                lineHeight: 1.8,
              }}>
                {String(actionSpec.requirements)}
              </div>
            </div>
          )}
          <Divider />
          <div style={{ fontWeight: 500, marginBottom: 8 }}>完成进度</div>
          <div style={{ padding: '0 8px' }}>
            <Slider
              value={percentComplete}
              onChange={handleProgressChange}
              disabled={!isEditable}
              min={0}
              max={100}
              marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'output',
      label: '三、输出阶段 - 提交交付物',
      children: (
        <DynamicFormFill
          fields={outputFields}
          values={outputValues}
          onChange={setOutputValues}
          readonly={!isEditable}
        />
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 0' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-tasks')}
        style={{ marginBottom: 16 }}>返回任务列表</Button>

      <Card title={
        <Space>
          <span>{node.instance?.definition?.name} / {def?.nodeName}</span>
          <Tag color={statusMap[node.status]?.color || 'default'}>
            {statusMap[node.status]?.label || node.status}
          </Tag>
        </Space>
      }>
        <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="计划开始">
            {node.plannedStartDate ? new Date(node.plannedStartDate).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="计划结束">
            {node.plannedEndDate ? new Date(node.plannedEndDate).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="执行人">{node.assignee?.name || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Collapse defaultActiveKey={['input', 'action', 'output']} items={collapseItems} />
      </Card>

      {isEditable && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Space size="large">
            <Button icon={<SaveOutlined />} size="large" onClick={handleSave} loading={saving}>
              保存草稿
            </Button>
            <Button type="primary" icon={<SendOutlined />} size="large"
              onClick={handleSubmit} loading={submitting}>
              提交节点
            </Button>
          </Space>
        </div>
      )}

      <AiInspectionOverlay
        visible={showAiOverlay}
        result={aiResult}
        onClose={handleAiOverlayClose}
        onRetry={handleRetry}
      />
    </div>
  )
}

export default NodeExecutionPage
