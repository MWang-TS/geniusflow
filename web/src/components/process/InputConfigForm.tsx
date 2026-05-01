import React from 'react'
import { Button, Input, Select, Switch, Space, App } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useProcessDesignStore } from '../../stores/process-design.store'
import type { InputField } from '../../types/process'

interface InputConfigFormProps {
  nodeId: string
  fields?: InputField[]
}

const InputConfigForm: React.FC<InputConfigFormProps> = ({ nodeId, fields = [] }) => {
  const updateNodeData = useProcessDesignStore((s) => s.updateNodeData)
  const { message } = App.useApp()

  const handleAddField = async () => {
    const newField: InputField = { name: `字段${fields.length + 1}`, type: 'text', required: false }
    const updated = [...fields, newField]
    try {
      await updateNodeData(nodeId, {
        inputSpec: { dataSchema: updated },
      })
    } catch {
      message.error('添加失败')
    }
  }

  const handleRemoveField = async (index: number) => {
    const updated = fields.filter((_, i) => i !== index)
    try {
      await updateNodeData(nodeId, {
        inputSpec: { dataSchema: updated },
      })
    } catch {
      message.error('删除失败')
    }
  }

  const handleUpdateField = async (index: number, patch: Partial<InputField>) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    try {
      await updateNodeData(nodeId, {
        inputSpec: { dataSchema: updated },
      })
    } catch {
      message.error('更新失败')
    }
  }

  return (
    <div>
      {fields.map((field, index) => (
        <div
          key={index}
          style={{
            marginBottom: 8,
            padding: '8px 10px',
            background: '#fafafa',
            borderRadius: 6,
            border: '1px solid #f0f0f0',
          }}
        >
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <Input
              size="small"
              placeholder="字段名称"
              value={field.name}
              onChange={(e) => handleUpdateField(index, { name: e.target.value })}
              style={{ flex: 1 }}
            />
            <Select
              size="small"
              value={field.type}
              onChange={(v) => handleUpdateField(index, { type: v as InputField['type'] })}
              style={{ width: 90 }}
              options={[
                { label: '文本', value: 'text' },
                { label: '数字', value: 'number' },
                { label: '文件', value: 'file' },
                { label: '下拉', value: 'select' },
              ]}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveField(index)}
            />
          </div>
          <Space size="small">
            <span style={{ fontSize: 11, color: '#999' }}>必填</span>
            <Switch
              size="small"
              checked={field.required}
              onChange={(v) => handleUpdateField(index, { required: v })}
            />
          </Space>
        </div>
      ))}
      <Button
        type="dashed"
        size="small"
        block
        icon={<PlusOutlined />}
        onClick={handleAddField}
      >
        添加输入字段
      </Button>
    </div>
  )
}

export default InputConfigForm
