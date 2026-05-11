import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Tag,
  Button,
  Space,
  Spin,
  App,
  Checkbox,
  Typography,
  Alert,
  Input,
  Badge,
  Progress,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  RobotOutlined,
  WarningOutlined,
  BookOutlined,
} from '@ant-design/icons'
import { nodeInstanceApi, type NodeInstanceDetail } from '../../api/node-instance'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useAuthStore } from '../../stores/auth.store'
import AiInspectionOverlay, { type AiInspectionResult } from '../../components/common/AiInspectionOverlay'
import { useAiAssistantStore } from '../../stores/ai-assistant.store'
import type { ChecklistItem } from '../../types/process'

const { Text, Paragraph } = Typography

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
  const { message, modal } = App.useApp()
  const token = useAuthStore((s) => s.accessToken)
  const { socket } = useWebSocket(token)
  const sendToAiAssistant = useAiAssistantStore((s) => s.sendMessage)

  const [node, setNode] = useState<NodeInstanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [checkState, setCheckState] = useState<Record<string, boolean>>({})
  const [completionNote, setCompletionNote] = useState('')
  const [aiResult, setAiResult] = useState<AiInspectionResult | null>(null)
  const [showAiOverlay, setShowAiOverlay] = useState(false)

  // WebSocket: AI inspection result
  useEffect(() => {
    if (!socket.current || !nodeInstanceId) return
    const s = socket.current
    const handleAiResult = (data: AiInspectionResult) => {
      if (data.nodeInstanceId !== nodeInstanceId) return
      setAiResult(data)
      setShowAiOverlay(true)
      if (data.passed) {
        setNode((prev) => prev ? { ...prev, status: 'pending_approval' } : prev)
      } else {
        setNode((prev) => prev ? { ...prev, status: 'in_progress' } : prev)
      }
    }
    s.on('ai:result', handleAiResult)
    return () => { s.off('ai:result', handleAiResult) }
  }, [socket, nodeInstanceId])

  // Load node
  useEffect(() => {
    if (!nodeInstanceId) return
    nodeInstanceApi.getById(nodeInstanceId)
      .then((r) => {
        const detail = r.data
        setNode(detail)
        const savedChecks = (detail.outputData as Record<string, unknown>)?.checklist_checks
        if (savedChecks && typeof savedChecks === 'object') {
          setCheckState(savedChecks as Record<string, boolean>)
        }
      })
      .catch(() => message.error('加载节点失败'))
      .finally(() => setLoading(false))
  }, [nodeInstanceId])

  const saveCheckState = useCallback(
    async (newState: Record<string, boolean>) => {
      if (!nodeInstanceId || !node) return
      try {
        await nodeInstanceApi.save(nodeInstanceId, {
          outputData: { ...(node.outputData || {}), checklist_checks: newState },
        })
      } catch {
        // Silent fail for autosave
      }
    },
    [nodeInstanceId, node],
  )

  const handleCheckChange = useCallback(
    async (itemId: string, checked: boolean) => {
      const newState = { ...checkState, [itemId]: checked }
      setCheckState(newState)
      await saveCheckState(newState)
    },
    [checkState, saveCheckState],
  )

  const handleAskAi = useCallback(() => {
    if (!node) return
    const actionSpec = node.definition.actionSpec as Record<string, unknown>
    const nodeName = node.definition.nodeName
    const sopContent = (actionSpec.sopContent || actionSpec.instructions) as string | undefined
    const requirements = actionSpec.requirements as string | undefined
    const checklist = (actionSpec.checklist || []) as ChecklistItem[]
    const nl = '\n'

    const parts: string[] = [
      `我正在执行SOP步骤【${nodeName}】，请根据知识库为我提供具体操作指导。`,
    ]
    if (sopContent) parts.push(`**操作规范：**${nl}${sopContent}`)
    if (requirements) parts.push(`**注意事项：**${nl}${requirements}`)
    if (checklist.length > 0) {
      const unchecked = checklist.filter((item) => !checkState[item.id])
      if (unchecked.length > 0) {
        parts.push(
          `**我尚未完成的检查项：**${nl}${unchecked.map((i) => `- ${i.label}`).join(nl)}`,
        )
        parts.push('请重点为我讲解这些检查项的正确操作方法。')
      }
    }
    sendToAiAssistant(parts.join(`${nl}${nl}`))
  }, [node, checkState, sendToAiAssistant])

  const handleComplete = useCallback(async () => {
    if (!nodeInstanceId || !node) return

    const checklist = (node.definition.actionSpec.checklist || []) as ChecklistItem[]
    const unfinishedRequired = checklist.filter((i) => i.required && !checkState[i.id])

    if (unfinishedRequired.length > 0) {
      message.warning(`请先完成以下必填检查项：${unfinishedRequired.map((i) => i.label).join('、')}`)
      return
    }

    modal.confirm({
      title: '确认完成此步骤？',
      content: completionNote
        ? `完成备注：${completionNote}`
        : '确认后此步骤将标记为已完成，流程自动推进到下一步。',
      okText: '确认完成',
      cancelText: '取消',
      onOk: async () => {
        setSubmitting(true)
        try {
          const res = await nodeInstanceApi.submit(nodeInstanceId, {
            outputData: {
              ...(node.outputData || {}),
              checklist_checks: checkState,
              completion_note: completionNote || undefined,
            },
            percentComplete: 100,
          })
          if (res.data?.status === 'ai_inspecting') {
            setShowAiOverlay(true)
            message.info('已提交，AI正在校验中...')
          } else {
            message.success('步骤已完成，流程已推进')
            navigate('/my-tasks')
          }
        } catch {
          message.error('提交失败，请重试')
        } finally {
          setSubmitting(false)
        }
      },
    })
  }, [nodeInstanceId, node, checkState, completionNote, modal, message, navigate])

  const handleAiOverlayClose = useCallback(() => {
    setShowAiOverlay(false)
    if (aiResult?.passed) navigate('/my-tasks')
  }, [aiResult, navigate])

  const handleRetry = useCallback(() => {
    setShowAiOverlay(false)
    setAiResult(null)
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!node) return <div style={{ textAlign: 'center', padding: 60 }}>节点不存在</div>

  const def = node.definition
  const actionSpec = def.actionSpec as Record<string, unknown>
  const sopContent = (actionSpec.sopContent || actionSpec.instructions) as string | undefined
  const requirements = actionSpec.requirements as string | undefined
  const checklist = (actionSpec.checklist || []) as ChecklistItem[]
  const aiEnabled = (def.aiConfig as Record<string, unknown>)?.assistant as Record<string, unknown> | undefined
  const isEditable = node.status === 'in_progress'

  const requiredItems = checklist.filter((i) => i.required)
  const checkedRequired = requiredItems.filter((i) => checkState[i.id])
  const allRequiredDone = requiredItems.length === 0 || checkedRequired.length === requiredItems.length
  const totalChecked = checklist.filter((i) => checkState[i.id]).length
  const progressPercent = checklist.length > 0
    ? Math.round((totalChecked / checklist.length) * 100)
    : allRequiredDone ? 100 : 0

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 0' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/my-tasks')}
        style={{ marginBottom: 16 }}
      >
        返回任务看板
      </Button>

      {/* 标题卡片 */}
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
              {node.instance?.definition?.name}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{def.nodeName}</div>
          </div>
          <Space>
            {node.assignee && (
              <Tag>{node.assignee.name}</Tag>
            )}
            <Tag color={statusMap[node.status]?.color || 'default'}>
              {statusMap[node.status]?.label || node.status}
            </Tag>
          </Space>
        </div>
        {checklist.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Progress
              percent={progressPercent}
              size="small"
              format={() => `${totalChecked}/${checklist.length} 项已完成`}
              strokeColor={allRequiredDone ? '#52c41a' : '#1677ff'}
            />
          </div>
        )}
      </Card>

      {/* SOP操作规范 */}
      {sopContent ? (
        <Card
          title={
            <Space>
              <BookOutlined style={{ color: '#1677ff' }} />
              <span>SOP操作规范</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          headStyle={{ borderBottom: '2px solid #1677ff', paddingBottom: 8 }}
        >
          <Paragraph
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 14,
              lineHeight: 2,
              color: '#262626',
              margin: 0,
            }}
          >
            {sopContent}
          </Paragraph>
          {requirements && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              message="注意事项"
              description={requirements}
            />
          )}
        </Card>
      ) : (
        !requirements && (
          <Card style={{ marginBottom: 16, background: '#fafafa' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              此步骤尚未配置操作规范，请联系流程管理员完善SOP内容。
            </Text>
          </Card>
        )
      )}

      {/* 执行检查清单 */}
      {checklist.length > 0 && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>执行检查清单</span>
              <Badge
                count={`${checkedRequired.length}/${requiredItems.length}`}
                style={{
                  backgroundColor: allRequiredDone ? '#52c41a' : '#faad14',
                  fontSize: 11,
                }}
              />
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checklist.map((item) => {
              const checked = !!checkState[item.id]
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: `1px solid ${checked ? '#b7eb8f' : '#f0f0f0'}`,
                    background: checked ? '#f6ffed' : '#fff',
                    cursor: isEditable ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => isEditable && handleCheckChange(item.id, !checked)}
                >
                  <div style={{ paddingTop: 2 }}>
                    {checked ? (
                      <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
                    ) : (
                      <Checkbox
                        checked={false}
                        disabled={!isEditable}
                        onChange={(e) => handleCheckChange(item.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        fontSize: 14,
                        color: checked ? '#52c41a' : '#262626',
                        textDecoration: checked ? 'line-through' : 'none',
                        fontWeight: item.required ? 500 : 400,
                      }}
                    >
                      {item.label}
                    </span>
                    {item.required && !checked && (
                      <Tag color="red" style={{ marginLeft: 8, fontSize: 11 }}>必须</Tag>
                    )}
                    {!item.required && (
                      <Tag color="default" style={{ marginLeft: 8, fontSize: 11 }}>可选</Tag>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* AI指导 */}
      {(aiEnabled?.enabled || checklist.length > 0 || sopContent) && (
        <Card style={{ marginBottom: 16, background: '#f0f7ff', border: '1px solid #bae0ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, color: '#1677ff', marginBottom: 4 }}>
                <RobotOutlined /> AI操作指导
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                遇到操作疑问？让AI基于知识库为你提供指导
              </Text>
            </div>
            <Button
              icon={<RobotOutlined />}
              type="primary"
              ghost
              onClick={handleAskAi}
              style={{ borderColor: '#1677ff' }}
            >
              向AI提问
            </Button>
          </div>
        </Card>
      )}

      {/* 完成确认 */}
      {isEditable && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#595959' }}>完成备注（可选）</Text>
            <Input.TextArea
              rows={2}
              placeholder="记录执行过程中的关键信息、发现的问题或改进建议..."
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleFilled />}
              onClick={handleComplete}
              loading={submitting}
              disabled={!allRequiredDone}
              style={{
                minWidth: 160,
                background: allRequiredDone ? '#52c41a' : undefined,
                borderColor: allRequiredDone ? '#52c41a' : undefined,
              }}
            >
              {allRequiredDone ? '完成此步骤' : `还需完成 ${requiredItems.length - checkedRequired.length} 个必填项`}
            </Button>
          </div>
        </Card>
      )}

      {/* 已完成状态 */}
      {node.status === 'completed' && (
        <Alert
          type="success"
          showIcon
          message="此步骤已完成"
          description={
            completionNote
              ? `完成备注：${completionNote}`
              : '员工已完成此SOP步骤的所有检查项。'
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {node.status === 'pending_approval' && (
        <Alert
          type="info"
          showIcon
          message="等待审批中"
          description="此步骤已完成，正在等待主管审批确认。"
          style={{ marginBottom: 16 }}
        />
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
