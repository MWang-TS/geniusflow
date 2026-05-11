import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Tabs,
  Form,
  Input,
  Switch,
  InputNumber,
  Select,
  App,
  Button,
  Space,
  Tooltip,
  Divider,
  Typography,
  Tag,
  Spin,
  Popconfirm,
} from 'antd'
import {
  SettingOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  DeleteOutlined,
  BookOutlined,
  ApiOutlined,
  SyncOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons'
import { useProcessDesignStore } from '../../stores/process-design.store'
import { knowledgeBaseApi, type KnowledgeBaseItem } from '../../api/knowledge-base'
import { taskDefinitionApi, type TaskDefinition } from '../../api/task-definition'
import type { ChecklistItem, ProcessSettings } from '../../types/process'

const { Text } = Typography

interface NodePropertyPanelProps {
  readOnly?: boolean
}

// ─── 流程级 AI 设置面板（无节点选中时显示）─────────────────────
const ProcessAiSettingsPanel: React.FC<{ readOnly: boolean; kbList: KnowledgeBaseItem[] }> = ({ readOnly, kbList }) => {
  const currentProcess = useProcessDesignStore((s) => s.currentProcess)
  const updateProcessSettings = useProcessDesignStore((s) => s.updateProcessSettings)
  const { message } = App.useApp()

  const settings = currentProcess?.graphJson?.processSettings ?? {}
  const aiCfg = settings.aiConfig ?? {}

  const handleChange = useCallback(
    async (patch: ProcessSettings['aiConfig']) => {
      if (readOnly) return
      try {
        await updateProcessSettings({
          ...settings,
          aiConfig: { ...aiCfg, ...patch },
        })
      } catch {
        message.error('保存失败')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(settings), updateProcessSettings, readOnly, message],
  )

  return (
    <Card
      title={<Space><ApiOutlined style={{ color: '#1677ff' }} />流程 AI 设置</Space>}
      size="small"
      style={{ height: '100%' }}
    >
      <div style={{ padding: '8px 0 12px', color: '#8c8c8c', fontSize: 12 }}>
        此处配置对整个流程所有步骤生效，员工执行任意步骤时均可调用 AI 助手获取指导。
      </div>

      <Form layout="vertical" size="small">
        <Form.Item
          label="启用 AI 知识库指导"
          extra="开启后，员工执行步骤时可唤出 AI 助手，默认开启"
        >
          <Switch
            checked={aiCfg.enabled !== false}
            disabled={readOnly}
            onChange={(v) => handleChange({ enabled: v })}
          />
        </Form.Item>

        {aiCfg.enabled !== false && (
          <>
            <Form.Item
              label={<Space><BookOutlined />关联知识库</Space>}
              extra="AI 将基于选中知识库内容为员工提供指导，未选则使用通用知识"
            >
              <Select
                mode="multiple"
                value={aiCfg.knowledgeBaseIds ?? []}
                disabled={readOnly}
                allowClear
                placeholder="选择知识库（可多选）"
                maxTagCount="responsive"
                onChange={(v: string[]) => handleChange({ knowledgeBaseIds: v })}
                options={kbList.map((kb) => ({ label: kb.name, value: kb.id, title: kb.description || kb.name }))}
              />
            </Form.Item>

            <Form.Item
              label="AI 指导提示词"
              extra="引导 AI 以何种风格、重点为员工提供操作建议（留空使用默认）"
            >
              <Input.TextArea
                key={`proc-prompt-${currentProcess?.id}`}
                rows={4}
                disabled={readOnly}
                placeholder={`示例：\n你是一位专业的操作指导员，请根据知识库内容，为正在执行当前步骤的员工提供清晰、具体的操作指导，重点关注正确操作方式和常见错误规避。`}
                defaultValue={aiCfg.promptTemplate ?? ''}
                onBlur={(e) => handleChange({ promptTemplate: e.target.value })}
              />
            </Form.Item>
          </>
        )}

        <Divider style={{ margin: '8px 0' }} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          点击画布中的节点可设置该节点的 SOP 规范和检查清单
        </Text>
      </Form>
    </Card>
  )
}

const NodePropertyPanel: React.FC<NodePropertyPanelProps> = ({ readOnly = false }) => {
  const currentProcess = useProcessDesignStore((s) => s.currentProcess)
  const selectedNodeId = useProcessDesignStore((s) => s.selectedNodeId)
  const updateNodeData = useProcessDesignStore((s) => s.updateNodeData)
  const { message } = App.useApp()
  const [kbList, setKbList] = useState<KnowledgeBaseItem[]>([])
  // 子任务相关状态
  const [taskDefs, setTaskDefs] = useState<TaskDefinition[]>([])
  const [taskDefsLoading, setTaskDefsLoading] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [syncingChecklist, setSyncingChecklist] = useState(false)
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>([])

  const node = currentProcess?.nodes?.find((n) => n.id === selectedNodeId)

  useEffect(() => {
    knowledgeBaseApi.list({ page: 1, pageSize: 100 }).then((r) => {
      setKbList((r.data as any)?.list || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (node) {
      setLocalChecklist(node.actionSpec?.checklist || [])
    }
  }, [node?.id])

  // 加载当前节点的子任务定义
  const loadTaskDefs = useCallback(async () => {
    if (!currentProcess?.id || !selectedNodeId) return
    setTaskDefsLoading(true)
    try {
      const res = await taskDefinitionApi.listByNode(currentProcess.id, selectedNodeId)
      setTaskDefs((res as any)?.data ?? (res as any) ?? [])
    } catch {
      // ignore
    } finally {
      setTaskDefsLoading(false)
    }
  }, [currentProcess?.id, selectedNodeId])

  useEffect(() => {
    if (selectedNodeId) {
      setTaskDefs([])
      loadTaskDefs()
    }
  }, [selectedNodeId, loadTaskDefs])

  const handleAddTaskDef = async () => {
    if (!newTaskTitle.trim() || !currentProcess?.id || !selectedNodeId) return
    setAddingTask(true)
    try {
      await taskDefinitionApi.create(currentProcess.id, selectedNodeId, {
        title: newTaskTitle.trim(),
        taskType: 'action',
      })
      setNewTaskTitle('')
      await loadTaskDefs()
    } catch {
      message.error('创建失败')
    } finally {
      setAddingTask(false)
    }
  }

  const handleDeleteTaskDef = async (id: string) => {
    if (!currentProcess?.id || !selectedNodeId) return
    try {
      await taskDefinitionApi.remove(currentProcess.id, selectedNodeId, id)
      await loadTaskDefs()
    } catch {
      message.error('删除失败')
    }
  }

  const handleToggleRequired = async (id: string, isRequired: boolean) => {
    if (!currentProcess?.id || !selectedNodeId) return
    try {
      await taskDefinitionApi.update(currentProcess.id, selectedNodeId, id, { isRequired })
      setTaskDefs((prev) => prev.map((d) => (d.id === id ? { ...d, isRequired } : d)))
    } catch {
      message.error('保存失败')
    }
  }

  const handleSyncFromChecklist = async () => {
    if (!currentProcess?.id || !selectedNodeId) return
    setSyncingChecklist(true)
    try {
      const res = await taskDefinitionApi.syncFromChecklist(currentProcess.id, selectedNodeId)
      const synced = (res as any)?.data?.synced ?? 0
      message.success(`已同步 ${synced} 个检查项为子任务`)
      await loadTaskDefs()
    } catch {
      message.error('同步失败')
    } finally {
      setSyncingChecklist(false)
    }
  }

  const saveChecklist = useCallback(
    async (items: ChecklistItem[]) => {
      if (!node) return
      try {
        await updateNodeData(node.id, {
          actionSpec: { ...node.actionSpec, checklist: items },
        })
        message.success('保存成功')
      } catch {
        message.error('保存失败')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node?.id, node?.actionSpec, updateNodeData, message],
  )

  // 未选中节点时显示流程级 AI 设置
  if (!node) {
    return <ProcessAiSettingsPanel readOnly={readOnly} kbList={kbList} />
  }

  const isStartOrEnd = node.nodeType === 'start' || node.nodeType === 'end'

  const handleSave = async (field: string, value: unknown) => {
    try {
      await updateNodeData(node.id, { [field]: value })
      message.success('保存成功')
    } catch {
      message.error('保存失败')
    }
  }

  const addChecklistItem = () => {
    const newItem: ChecklistItem = { id: `c_${Date.now()}`, label: '检查项', required: true }
    const updated = [...localChecklist, newItem]
    setLocalChecklist(updated)
    saveChecklist(updated)
  }

  const removeChecklistItem = (id: string) => {
    const updated = localChecklist.filter((item) => item.id !== id)
    setLocalChecklist(updated)
    saveChecklist(updated)
  }

  const toggleChecklistRequired = (id: string, required: boolean) => {
    const updated = localChecklist.map((item) =>
      item.id === id ? { ...item, required } : item,
    )
    setLocalChecklist(updated)
    saveChecklist(updated)
  }

  const updateChecklistLabel = (id: string, label: string) => {
    setLocalChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, label } : item)))
  }

  const saveChecklistLabel = () => {
    saveChecklist(localChecklist)
  }

  // ─── SOP规范 tab ──────────────────────────────────────────────
  const sopTab = (
    <Form layout="vertical" size="small" key={`sop-${node.id}`}>
      <Form.Item label="节点名称">
        <Input
          key={`${node.id}-nodeName`}
          defaultValue={node.nodeName}
          disabled={readOnly}
          onBlur={(e) => !readOnly && handleSave('nodeName', e.target.value)}
        />
      </Form.Item>
      {!isStartOrEnd && (
        <>
          <Form.Item label="操作规范说明" extra="详细描述员工在此步骤应如何正确操作，支持换行分段">
            <Input.TextArea
              key={`${node.id}-sopContent`}
              rows={7}
              disabled={readOnly}
              placeholder={`示例：\n1. 打开系统，进入XX模块\n2. 检查XX配置是否正确\n3. 按照规范填写XX表单\n4. 提交前核对数据准确性`}
              defaultValue={node.actionSpec?.sopContent || node.actionSpec?.instructions || ''}
              onBlur={(e) =>
                !readOnly &&
                handleSave('actionSpec', {
                  ...node.actionSpec,
                  sopContent: e.target.value,
                  instructions: e.target.value,
                })
              }
            />
          </Form.Item>
          <Form.Item label="注意事项" extra="常见错误、风险点或特别提醒">
            <Input.TextArea
              key={`${node.id}-requirements`}
              rows={2}
              disabled={readOnly}
              placeholder="例如：不得跳过第3步，否则会导致数据不一致..."
              defaultValue={node.actionSpec?.requirements || ''}
              onBlur={(e) =>
                !readOnly &&
                handleSave('actionSpec', { ...node.actionSpec, requirements: e.target.value })
              }
            />
          </Form.Item>
          <Form.Item
            label="执行检查清单"
            extra="员工执行时需逐项确认。红色开关=必须完成才能提交"
          >
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 10px', background: '#fafafa' }}>
              {localChecklist.length === 0 && (
                <div style={{ color: '#bfbfbf', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
                  暂无检查项，点击下方按钮添加
                </div>
              )}
              {localChecklist.map((item, index) => (
                <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ color: '#8c8c8c', fontSize: 11, width: 18, flexShrink: 0 }}>{index + 1}.</span>
                  <Tooltip title={item.required ? '必须完成' : '可选完成'}>
                    <Switch
                      size="small"
                      checked={item.required}
                      disabled={readOnly}
                      onChange={(v) => !readOnly && toggleChecklistRequired(item.id, v)}
                      style={{ backgroundColor: item.required ? '#ff4d4f' : '#8c8c8c', flexShrink: 0 }}
                    />
                  </Tooltip>
                  <Input
                    size="small"
                    value={item.label}
                    disabled={readOnly}
                    onChange={(e) => !readOnly && updateChecklistLabel(item.id, e.target.value)}
                    onBlur={() => !readOnly && saveChecklistLabel()}
                    placeholder="检查项描述"
                    style={{ flex: 1 }}
                  />
                  {!readOnly && (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeChecklistItem(item.id)}
                      style={{ flexShrink: 0 }}
                    />
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button
                  type="dashed"
                  size="small"
                  block
                  icon={<PlusOutlined />}
                  onClick={addChecklistItem}
                  style={{ marginTop: localChecklist.length > 0 ? 6 : 0 }}
                >
                  添加检查项
                </Button>
              )}
            </div>
          </Form.Item>
        </>
      )}
    </Form>
  )

  // ─── 高级设置 tab ─────────────────────────────────────────────
  const advancedTab = (
    <Form layout="vertical" size="small" key={`adv-${node.id}`}>
      {!isStartOrEnd && (
        <>
          <Form.Item label="预计工时（天）" extra="仅供参考，不作为流程推进的硬性限制">
            <InputNumber
              min={0.5}
              step={0.5}
              disabled={readOnly}
              style={{ width: '100%' }}
              value={node.progressConfig?.plannedDuration}
              onChange={(v) =>
                !readOnly &&
                handleSave('progressConfig', { ...node.progressConfig, plannedDuration: v ?? 1 })
              }
            />
          </Form.Item>
          <Form.Item label="需要审批" extra="开启后员工完成后需等待主管审批，SOP场景下通常关闭">
            <Switch
              checked={node.progressConfig?.needApproval === true}
              disabled={readOnly}
              onChange={(v) =>
                !readOnly &&
                handleSave('progressConfig', { ...node.progressConfig, needApproval: v })
              }
            />
          </Form.Item>
          {node.progressConfig?.needApproval && (
            <Form.Item label="审批前需AI报告">
              <Switch
                checked={node.progressConfig?.requireAiReportBeforeApproval === true}
                disabled={readOnly}
                onChange={(v) =>
                  !readOnly &&
                  handleSave('progressConfig', {
                    ...node.progressConfig,
                    requireAiReportBeforeApproval: v,
                  })
                }
              />
            </Form.Item>
          )}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#bfbfbf' }}>
            节点ID：{node.id}
          </div>
        </>
      )}
    </Form>
  )

  const tabItems = [{ key: 'sop', label: 'SOP规范', icon: <ThunderboltOutlined />, children: sopTab }]
  if (!isStartOrEnd) {
    // 子任务 Tab
    const taskDefsTab = (
      <div style={{ padding: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            流程发布后，节点激活时自动生成对应任务
          </Text>
          {!readOnly && (
            <Tooltip title="将检查清单项同步为子任务">
              <Button
                size="small"
                icon={<SyncOutlined spin={syncingChecklist} />}
                onClick={handleSyncFromChecklist}
                loading={syncingChecklist}
              >
                从检查清单同步
              </Button>
            </Tooltip>
          )}
        </div>

        {taskDefsLoading ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}><Spin size="small" /></div>
        ) : (
          <>
            {taskDefs.length === 0 && (
              <div style={{ color: '#bfbfbf', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                暂无子任务，添加或从检查清单同步
              </div>
            )}
            {taskDefs.map((def) => (
              <div
                key={def.id}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                  marginBottom: 8,
                  padding: '6px 8px',
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  background: '#fafafa',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
                    {def.taskCode && (
                      <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                        {def.taskCode}
                      </Tag>
                    )}
                    <Tag
                      color={def.taskType === 'checklist' ? 'cyan' : 'orange'}
                      style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}
                    >
                      {def.taskType === 'checklist' ? '检查项' : '操作项'}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: '18px', wordBreak: 'break-word' }}>
                    {def.title}
                  </div>
                </div>
                <Tooltip title={def.isRequired ? '必须完成' : '可选完成'}>
                  <Switch
                    size="small"
                    checked={def.isRequired}
                    disabled={readOnly}
                    onChange={(v) => handleToggleRequired(def.id, v)}
                    style={{ backgroundColor: def.isRequired ? '#ff4d4f' : '#8c8c8c', flexShrink: 0, marginTop: 2 }}
                  />
                </Tooltip>
                {!readOnly && (
                  <Popconfirm
                    title="确认删除此子任务？"
                    onConfirm={() => handleDeleteTaskDef(def.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{ flexShrink: 0, marginTop: 1 }}
                    />
                  </Popconfirm>
                )}
              </div>
            ))}

            {!readOnly && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <Input
                  size="small"
                  placeholder="输入新任务名称..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onPressEnter={handleAddTaskDef}
                  style={{ flex: 1 }}
                />
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddTaskDef}
                  loading={addingTask}
                  disabled={!newTaskTitle.trim()}
                >
                  添加
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    )

    tabItems.push({
      key: 'tasks',
      label: '子任务' + (taskDefs.length > 0 ? ` (${taskDefs.length})` : ''),
      icon: <CheckSquareOutlined />,
      children: taskDefsTab,
    })
    tabItems.push({ key: 'advanced', label: '高级', icon: <SettingOutlined />, children: advancedTab })
  }

  return (
    <Card title="节点属性" size="small" style={{ height: '100%' }}>
      <div style={{ color: '#8c8c8c', marginBottom: 8, fontSize: 12 }}>
        {node.nodeType === 'start' ? '开始节点' : node.nodeType === 'end' ? '结束节点' : 'SOP执行步骤'}
      </div>
      <Tabs
        size="small"
        defaultActiveKey="sop"
        items={tabItems}
        style={{ overflow: 'auto', maxHeight: 'calc(100% - 40px)' }}
      />
    </Card>
  )
}

export default NodePropertyPanel
