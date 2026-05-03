import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, Switch,
  message, Popconfirm, Tooltip, AutoComplete, Spin
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled, SyncOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { aiSettingsApi, type AiModel, type AiProvider, type ModelType } from '../../../api/ai-settings'

const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  chat: '对话',
  embedding: '向量嵌入',
  rerank: '重排序',
}

const MODEL_TYPE_COLORS: Record<ModelType, string> = {
  chat: 'blue',
  embedding: 'green',
  rerank: 'orange',
}

interface ModelsTabProps {
  lockedType?: ModelType
}

export default function ModelsTab({ lockedType }: ModelsTabProps = {}) {
  const [models, setModels] = useState<AiModel[]>([])
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<ModelType | undefined>()
  const [filterProvider, setFilterProvider] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AiModel | null>(null)
  const [form] = Form.useForm()
  const [providerModelOptions, setProviderModelOptions] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [modelsRes, providersRes] = await Promise.all([
        aiSettingsApi.listModels({ type: lockedType ?? filterType, providerId: filterProvider }),
        aiSettingsApi.listProviders(),
      ])
      setModels(modelsRes.data)
      setProviders(providersRes.data)
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [lockedType, filterType, filterProvider])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldValue('isEnabled', true)
    form.setFieldValue('isDefault', false)
    if (lockedType) form.setFieldValue('type', lockedType)
    setProviderModelOptions([])
    setModalOpen(true)
  }

  const handleProviderChange = (providerId: string) => {
    form.setFieldValue('modelId', undefined)
    setProviderModelOptions([])
    if (providerId) fetchModelsFromProvider(providerId)
  }

  const fetchModelsFromProvider = async (providerId: string) => {
    setFetchingModels(true)
    try {
      const res = await aiSettingsApi.fetchProviderModels(providerId)
      setProviderModelOptions(res.data.models)
      if (res.data.models.length === 0) message.info('该提供商未返回可用模型')
    } catch {
      message.error('获取模型列表失败')
    } finally {
      setFetchingModels(false)
    }
  }

  const openEdit = (row: AiModel) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      modelId: row.modelId,
      type: row.type,
      providerId: row.providerId,
      isEnabled: row.isEnabled,
      isDefault: row.isDefault,
    })
    setProviderModelOptions([])
    // Pre-fetch models for the current provider so the autocomplete has suggestions
    if (row.providerId) fetchModelsFromProvider(row.providerId)
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        await aiSettingsApi.updateModel(editing.id, values)
        message.success('更新成功')
      } else {
        await aiSettingsApi.createModel(values)
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
      await aiSettingsApi.deleteModel(id)
      message.success('删除成功')
      load()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await aiSettingsApi.setDefaultModel(id)
      message.success('已设为默认')
      load()
    } catch {
      message.error('设置失败')
    }
  }

  const handleToggle = async (row: AiModel, checked: boolean) => {
    try {
      await aiSettingsApi.updateModel(row.id, { isEnabled: checked })
      setModels(prev => prev.map(m => m.id === row.id ? { ...m, isEnabled: checked } : m))
    } catch {
      message.error('更新失败')
    }
  }

  const columns: ColumnsType<AiModel> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: AiModel) => (
        <Space>
          {name}
          {row.isDefault && <Tooltip title="默认模型"><StarFilled style={{ color: '#faad14' }} /></Tooltip>}
        </Space>
      ),
    },
    {
      title: '模型 ID',
      dataIndex: 'modelId',
      key: 'modelId',
      render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: ModelType) => (
        <Tag color={MODEL_TYPE_COLORS[type]}>{MODEL_TYPE_LABELS[type]}</Tag>
      ),
    },
    {
      title: '提供商',
      key: 'provider',
      render: (_: unknown, row: AiModel) => row.provider?.name ?? row.providerId,
    },
    {
      title: '启用',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      render: (v: boolean, row: AiModel) => (
        <Switch checked={v} size="small" onChange={checked => handleToggle(row, checked)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, row: AiModel) => (
        <Space>
          {!row.isDefault && (
            <Tooltip title="设为默认">
              <Button size="small" icon={<StarOutlined />} onClick={() => handleSetDefault(row.id)} />
            </Tooltip>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认删除此模型？" onConfirm={() => handleDelete(row.id)} okText="删除" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <Space>
          {!lockedType && (
            <Select
              allowClear
              placeholder="筛选类型"
              style={{ width: 140 }}
              value={filterType}
              onChange={v => setFilterType(v)}
            >
              {Object.entries(MODEL_TYPE_LABELS).map(([value, label]) => (
                <Select.Option key={value} value={value}>{label}</Select.Option>
              ))}
            </Select>
          )}
          <Select
            allowClear
            placeholder="筛选提供商"
            style={{ width: 160 }}
            value={filterProvider}
            onChange={v => setFilterProvider(v)}
          >
            {providers.map(p => (
              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
            ))}
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加模型</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={models}
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title={editing ? '编辑模型' : '添加模型'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="显示名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：GPT-4o" />
          </Form.Item>
          <Form.Item label="提供商" name="providerId" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select placeholder="选择提供商" onChange={handleProviderChange}>
              {providers.map(p => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={
              <Space>
                模型 ID
                {fetchingModels && <Spin size="small" />}
                {!fetchingModels && providerModelOptions.length > 0 && (
                  <Tag color="blue">{providerModelOptions.length} 个可用</Tag>
                )}
                <Tooltip title="重新从提供商获取模型列表">
                  <Button
                    type="link"
                    size="small"
                    icon={<SyncOutlined />}
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => {
                      const pid = form.getFieldValue('providerId')
                      if (pid) fetchModelsFromProvider(pid)
                      else message.warning('请先选择提供商')
                    }}
                  >
                    刷新列表
                  </Button>
                </Tooltip>
              </Space>
            }
            name="modelId"
            rules={[{ required: true, message: '请输入或选择模型 ID' }]}
          >
            <AutoComplete
              placeholder="例如：gpt-4o"
              options={providerModelOptions.map(m => ({ value: m, label: m }))}
              filterOption={(input, option) =>
                (option?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            >
              <Input />
            </AutoComplete>
          </Form.Item>
          {!lockedType && (
            <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
              <Select placeholder="选择模型类型">
                {Object.entries(MODEL_TYPE_LABELS).map(([value, label]) => (
                  <Select.Option key={value} value={value}>{label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
          {lockedType && (
            <Form.Item name="type" hidden>
              <Input />
            </Form.Item>
          )}
          <Form.Item label="启用" name="isEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="设为默认" name="isDefault" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
