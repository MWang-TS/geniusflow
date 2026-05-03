import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, Switch,
  message, Popconfirm, Tooltip
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ApiOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { aiSettingsApi, type AiProvider, type ProviderType } from '../../../api/ai-settings'

const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  openai: 'OpenAI',
  azure_openai: 'Azure OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama',
  custom: '自定义',
}

const PROVIDER_TYPE_COLORS: Record<ProviderType, string> = {
  openai: 'green',
  azure_openai: 'blue',
  anthropic: 'purple',
  ollama: 'orange',
  custom: 'default',
}

export default function ProvidersTab() {
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [loading, setLoading] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AiProvider | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await aiSettingsApi.listProviders()
      setProviders(res.data)
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldValue('isEnabled', true)
    setModalOpen(true)
  }

  const openEdit = (row: AiProvider) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      type: row.type,
      baseUrl: row.baseUrl,
      apiKey: '',
      isEnabled: row.isEnabled,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (!values.apiKey) delete values.apiKey
      if (editing) {
        await aiSettingsApi.updateProvider(editing.id, values)
        message.success('更新成功')
      } else {
        await aiSettingsApi.createProvider(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error('保存失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await aiSettingsApi.deleteProvider(id)
      message.success('删除成功')
      load()
    } catch {
      message.error('删除失败')
    }
  }

  const handleTest = async (row: AiProvider) => {
    setTestingId(row.id)
    try {
      const res = await aiSettingsApi.testProvider(row.id)
      const data = (res as any).data ?? res
      if (data.ok) {
        message.success(`连接成功 (${data.latencyMs ?? 0}ms)`)
      } else {
        message.error(`连接失败: ${data.error ?? '未知错误'}`)
      }
    } catch {
      message.error('测试请求失败')
    } finally {
      setTestingId(null)
    }
  }

  const handleToggle = async (row: AiProvider, checked: boolean) => {
    try {
      await aiSettingsApi.updateProvider(row.id, { isEnabled: checked })
      setProviders(prev => prev.map(p => p.id === row.id ? { ...p, isEnabled: checked } : p))
    } catch {
      message.error('更新失败')
    }
  }

  const columns: ColumnsType<AiProvider> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: ProviderType) => (
        <Tag color={PROVIDER_TYPE_COLORS[type]}>{PROVIDER_TYPE_LABELS[type]}</Tag>
      ),
    },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'API Key',
      key: 'apiKey',
      render: (_: unknown, row: AiProvider) => (
        row.hasApiKey ? <Tooltip title="已配置"><KeyOutlined style={{ color: '#52c41a' }} /></Tooltip>
          : <span style={{ color: '#bbb' }}>未配置</span>
      ),
    },
    {
      title: '模型数',
      key: 'modelCount',
      render: (_: unknown, row: AiProvider) => row.models?.length ?? 0,
    },
    {
      title: '启用',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      render: (v: boolean, row: AiProvider) => (
        <Switch checked={v} size="small" onChange={checked => handleToggle(row, checked)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, row: AiProvider) => (
        <Space>
          <Button size="small" icon={<ApiOutlined />} loading={testingId === row.id} onClick={() => handleTest(row)}>测试</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认删除此提供商？" onConfirm={() => handleDelete(row.id)} okText="删除" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加提供商</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={providers}
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title={editing ? '编辑提供商' : '添加提供商'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：OpenAI 官方" />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="选择提供商类型">
              {Object.entries(PROVIDER_TYPE_LABELS).map(([value, label]) => (
                <Select.Option key={value} value={value}>{label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Base URL" name="baseUrl">
            <Input placeholder="例如：https://api.openai.com/v1（可留空使用默认）" />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="apiKey"
            extra={editing ? '留空则保持现有 Key 不变' : undefined}
          >
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>
          <Form.Item label="启用" name="isEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
