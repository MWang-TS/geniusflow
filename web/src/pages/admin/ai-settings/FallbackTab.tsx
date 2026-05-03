import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Space, Tag, Switch, Modal, Form, Select, Input,
  message, Popconfirm, Tabs, Tooltip, Typography, Alert,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  aiSettingsApi,
  type ModelFallbackChain,
  type AiModel,
  type FallbackModelType,
} from '../../../api/ai-settings'

const { Text } = Typography

const MODEL_TYPE_OPTIONS: { value: FallbackModelType; label: string }[] = [
  { value: 'chat', label: '对话模型 (Chat)' },
  { value: 'embedding', label: '嵌入模型 (Embedding)' },
]

interface FallbackListProps {
  modelType: FallbackModelType
  chatModels: AiModel[]
}

function FallbackList({ modelType, chatModels }: FallbackListProps) {
  const [items, setItems] = useState<ModelFallbackChain[]>([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await aiSettingsApi.listFallbacks(modelType)
      setItems((res as any).data ?? res)
    } catch {
      message.error('加载 Fallback 链失败')
    } finally {
      setLoading(false)
    }
  }, [modelType])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await aiSettingsApi.createFallback({ modelType, ...values })
      message.success('添加成功')
      setAddOpen(false)
      form.resetFields()
      load()
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error('添加失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await aiSettingsApi.deleteFallback(id)
      message.success('删除成功')
      load()
    } catch {
      message.error('删除失败')
    }
  }

  const handleToggle = async (item: ModelFallbackChain, checked: boolean) => {
    try {
      await aiSettingsApi.updateFallback(item.id, { isEnabled: checked })
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isEnabled: checked } : i)))
    } catch {
      message.error('更新失败')
    }
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newItems.length) return
    ;[newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]]
    try {
      await aiSettingsApi.reorderFallbacks(modelType, newItems.map((i) => i.id))
      setItems(newItems.map((item, idx) => ({ ...item, sortOrder: idx })))
    } catch {
      message.error('排序失败')
    }
  }

  const columns: ColumnsType<ModelFallbackChain> = [
    {
      title: '顺序',
      key: 'order',
      width: 80,
      render: (_: unknown, _row: ModelFallbackChain, index: number) => (
        <Text type="secondary">#{index + 1}</Text>
      ),
    },
    {
      title: '模型',
      key: 'model',
      render: (_: unknown, row: ModelFallbackChain) => (
        <Space direction="vertical" size={0}>
          <Text>{row.model?.name ?? row.modelId}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <code>{row.model?.modelId}</code>
            {row.model?.provider && (
              <Tag style={{ marginLeft: 6 }} color="blue">{row.model.provider.name}</Tag>
            )}
          </Text>
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: '启用',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 70,
      render: (v: boolean, row: ModelFallbackChain) => (
        <Switch checked={v} size="small" onChange={(checked) => handleToggle(row, checked)} />
      ),
    },
    {
      title: '调整',
      key: 'move',
      width: 90,
      render: (_: unknown, _row: ModelFallbackChain, index: number) => (
        <Space>
          <Tooltip title="上移">
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              onClick={() => handleMove(index, 'up')}
            />
          </Tooltip>
          <Tooltip title="下移">
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index === items.length - 1}
              onClick={() => handleMove(index, 'down')}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, row: ModelFallbackChain) => (
        <Popconfirm
          title="确认从 Fallback 链中移除此模型？"
          onConfirm={() => handleDelete(row.id)}
          okText="删除"
          okType="danger"
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">
          当主模型调用失败时，按顺序尝试以下备用模型
        </Text>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => setAddOpen(true)}>
          添加备用模型
        </Button>
      </div>

      {items.length === 0 && !loading && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="尚未配置备用模型"
          description="添加备用模型后，当主调用失败时将自动切换，提高服务可用性。"
          style={{ marginBottom: 12 }}
        />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={false}
        size="small"
        rowClassName={(_, index) => index === 0 ? 'fallback-primary-row' : ''}
      />

      <Modal
        title="添加备用模型"
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => { setAddOpen(false); form.resetFields() }}
        okText="添加"
        cancelText="取消"
        width={440}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="模型"
            name="modelId"
            rules={[{ required: true, message: '请选择模型' }]}
          >
            <Select
              placeholder="选择备用模型"
              showSearch
              optionFilterProp="label"
              options={chatModels.map((m) => ({
                value: m.id,
                label: `${m.name} (${m.modelId}) — ${m.provider?.name ?? ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input placeholder="可选：说明此备用模型的用途" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function FallbackTab() {
  const [chatModels, setChatModels] = useState<AiModel[]>([])
  const [embeddingModels, setEmbeddingModels] = useState<AiModel[]>([])

  useEffect(() => {
    Promise.all([
      aiSettingsApi.listModels({ type: 'chat' }),
      aiSettingsApi.listModels({ type: 'embedding' }),
    ]).then(([chatRes, embedRes]) => {
      setChatModels((chatRes as any).data ?? chatRes)
      setEmbeddingModels((embedRes as any).data ?? embedRes)
    })
  }, [])

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">
          参考 <strong>tse-doctor</strong> 的 Fallback Chain 设计：为每种模型类型配置有序的备用模型列表。
          当主模型（或 Agent 角色绑定的模型）调用失败时，AI 服务会依次尝试备用链中的模型。
        </Typography.Text>
      </div>
      <Tabs
        items={MODEL_TYPE_OPTIONS.map((opt) => ({
          key: opt.value,
          label: opt.label,
          children: (
            <FallbackList
              modelType={opt.value}
              chatModels={opt.value === 'chat' ? chatModels : embeddingModels}
            />
          ),
        }))}
      />
    </div>
  )
}
