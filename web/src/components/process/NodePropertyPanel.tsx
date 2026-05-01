import React from 'react'
import {
  Card,
  Tabs,
  Form,
  Input,
  Switch,
  InputNumber,
  Empty,
  Select,
  App,
} from 'antd'
import {
  SettingOutlined,
  ImportOutlined,
  ThunderboltOutlined,
  ExportOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { useProcessDesignStore } from '../../stores/process-design.store'
import InputConfigForm from './InputConfigForm'

const NodePropertyPanel: React.FC = () => {
  const currentProcess = useProcessDesignStore((s) => s.currentProcess)
  const selectedNodeId = useProcessDesignStore((s) => s.selectedNodeId)
  const updateNodeData = useProcessDesignStore((s) => s.updateNodeData)
  const { message } = App.useApp()

  const node = currentProcess?.nodes?.find((n) => n.id === selectedNodeId)

  if (!node) {
    return (
      <Card title="节点属性" size="small" style={{ height: '100%' }}>
        <Empty description="请选择节点" />
      </Card>
    )
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

  const basicTab = (
    <Form layout="vertical" size="small" key="basic">
      <Form.Item label="节点名称">
        <Input
          value={node.nodeName}
          onChange={(e) => handleSave('nodeName', e.target.value)}
          onBlur={(e) => handleSave('nodeName', e.target.value)}
        />
      </Form.Item>
      {!isStartOrEnd && (
        <>
          <Form.Item label="计划工期（天）">
            <InputNumber
              min={0.5}
              step={0.5}
              style={{ width: '100%' }}
              value={node.progressConfig?.plannedDuration}
              onChange={(v) =>
                handleSave('progressConfig', {
                  ...node.progressConfig,
                  plannedDuration: v ?? 2,
                })
              }
            />
          </Form.Item>
          <Form.Item label="是否需要审批">
            <Switch
              checked={node.progressConfig?.needApproval !== false}
              onChange={(v) =>
                handleSave('progressConfig', {
                  ...node.progressConfig,
                  needApproval: v,
                })
              }
            />
          </Form.Item>
          <Form.Item label="审批前是否需要 AI 报告">
            <Switch
              checked={node.progressConfig?.requireAiReportBeforeApproval === true}
              onChange={(v) =>
                handleSave('progressConfig', {
                  ...node.progressConfig,
                  requireAiReportBeforeApproval: v,
                })
              }
            />
          </Form.Item>
        </>
      )}
    </Form>
  )

  const inputTab = (
    <div key="input" style={{ paddingTop: 4 }}>
      <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 500, color: '#666' }}>输入字段</div>
      <InputConfigForm
        nodeId={node.id}
        fields={node.inputSpec?.dataSchema || []}
      />
      <Form layout="vertical" size="small" style={{ marginTop: 12 }}>
        <Form.Item label="验收标准">
          <Input.TextArea
            rows={3}
            value={node.inputSpec?.acceptanceCriteria || ''}
            onChange={(e) =>
              handleSave('inputSpec', {
                ...node.inputSpec,
                acceptanceCriteria: e.target.value,
              })
            }
          />
        </Form.Item>
        <Form.Item label="来源时间约束（从流程开始第几天）">
          <InputNumber
            min={0}
            style={{ width: '100%' }}
            value={node.inputSpec?.timeConstraint?.daysFromStart}
            onChange={(v) =>
              handleSave('inputSpec', {
                ...node.inputSpec,
                timeConstraint: { daysFromStart: v ?? 1 },
              })
            }
          />
        </Form.Item>
      </Form>
    </div>
  )

  const actionTab = (
    <Form layout="vertical" size="small" key="action">
      <Form.Item label="行动说明">
        <Input.TextArea
          rows={6}
          value={node.actionSpec?.instructions || ''}
          onChange={(e) =>
            handleSave('actionSpec', {
              ...node.actionSpec,
              instructions: e.target.value,
            })
          }
        />
      </Form.Item>
      <Form.Item label="行动要求">
        <Input.TextArea
          rows={2}
          value={node.actionSpec?.requirements || ''}
          onChange={(e) =>
            handleSave('actionSpec', {
              ...node.actionSpec,
              requirements: e.target.value,
            })
          }
        />
      </Form.Item>
    </Form>
  )

  const outputTab = (
    <Form layout="vertical" size="small" key="output">
      <Form.Item label="交付物（一行一个）">
        <Input.TextArea
          rows={3}
          value={
            Array.isArray(node.outputSpec?.deliverables)
              ? node.outputSpec.deliverables.join('\n')
              : ''
          }
          placeholder="需求调研报告&#10;竞品分析报告"
          onChange={(e) =>
            handleSave('outputSpec', {
              ...node.outputSpec,
              deliverables: e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </Form.Item>
      <Form.Item label="质量标准">
        <Input.TextArea
          rows={2}
          value={node.outputSpec?.qualityStandard || ''}
          onChange={(e) =>
            handleSave('outputSpec', {
              ...node.outputSpec,
              qualityStandard: e.target.value,
            })
          }
        />
      </Form.Item>
    </Form>
  )

  const aiTab = (
    <Form layout="vertical" size="small" key="ai">
      <Form.Item label="启用 AI 督导">
        <Switch
          checked={node.aiConfig?.inspector?.enabled === true}
          onChange={(v) =>
            handleSave('aiConfig', {
              ...node.aiConfig,
              inspector: { ...node.aiConfig?.inspector, enabled: v },
            })
          }
        />
      </Form.Item>
      {node.aiConfig?.inspector?.enabled && (
        <Form.Item label="督导模式">
          <Select
            value={node.aiConfig?.inspector?.mode || 'normal'}
            onChange={(v) =>
              handleSave('aiConfig', {
                ...node.aiConfig,
                inspector: { ...node.aiConfig?.inspector, mode: v },
              })
            }
            options={[
              { label: '宽松', value: 'loose' },
              { label: '标准', value: 'normal' },
              { label: '严格', value: 'strict' },
            ]}
          />
        </Form.Item>
      )}
      <Form.Item label="启用审批助理">
        <Switch
          checked={node.aiConfig?.assistant?.enabled === true}
          onChange={(v) =>
            handleSave('aiConfig', {
              ...node.aiConfig,
              assistant: { ...node.aiConfig?.assistant, enabled: v },
            })
          }
        />
      </Form.Item>
    </Form>
  )

  const tabItems = [
    { key: 'basic', label: '基本', icon: <SettingOutlined />, children: basicTab },
  ]

  if (!isStartOrEnd) {
    tabItems.push(
      { key: 'input', label: '输入', icon: <ImportOutlined />, children: inputTab },
      { key: 'action', label: '行动', icon: <ThunderboltOutlined />, children: actionTab },
      { key: 'output', label: '输出', icon: <ExportOutlined />, children: outputTab },
      { key: 'ai', label: 'AI', icon: <RobotOutlined />, children: aiTab },
    )
  }

  return (
    <Card title="节点属性" size="small" style={{ height: '100%' }}>
      <div style={{ color: '#999', marginBottom: 12, fontSize: 12 }}>
        节点类型：{node.nodeType === 'start' ? '开始' : node.nodeType === 'end' ? '结束' : '任务'}
        {' | '}
        节点ID：{node.id}
      </div>
      <Tabs
        size="small"
        items={tabItems}
        style={{ overflow: 'auto', maxHeight: 'calc(100% - 50px)' }}
      />
    </Card>
  )
}

export default NodePropertyPanel
