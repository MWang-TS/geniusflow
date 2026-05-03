import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, Switch,
  message, Popconfirm, Collapse, Typography
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { aiSettingsApi, type AgentRole, type AiModel, type AgentSkill } from '../../../api/ai-settings'

const { Text } = Typography

export default function AgentRolesTab() {
  const [roles, setRoles] = useState<AgentRole[]>([])
  const [models, setModels] = useState<AiModel[]>([])
  const [skills, setSkills] = useState<AgentSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AgentRole | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [rolesRes, modelsRes, skillsRes] = await Promise.all([
        aiSettingsApi.listRoles(),
        aiSettingsApi.listModels({ type: 'chat' }),
        aiSettingsApi.listSkills(),
      ])
      setRoles(rolesRes.data)
      setModels(modelsRes.data)
      setSkills(skillsRes.data)
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
    form.setFieldValue('skillIds', [])
    setModalOpen(true)
  }

  const openEdit = (row: AgentRole) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      description: row.description,
      systemPrompt: row.systemPrompt,
      modelId: row.modelId,
      skillIds: row.skills?.map(s => s.skill.id) ?? [],
      isEnabled: row.isEnabled,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        await aiSettingsApi.updateRole(editing.id, values)
        message.success('更新成功')
      } else {
        await aiSettingsApi.createRole(values)
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
      await aiSettingsApi.deleteRole(id)
      message.success('删除成功')
      load()
    } catch {
      message.error('删除失败')
    }
  }

  const handleToggle = async (row: AgentRole, checked: boolean) => {
    try {
      await aiSettingsApi.updateRole(row.id, { isEnabled: checked })
      setRoles(prev => prev.map(r => r.id === row.id ? { ...r, isEnabled: checked } : r))
    } catch {
      message.error('更新失败')
    }
  }

  const columns: ColumnsType<AgentRole> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space><RobotOutlined style={{ color: '#1677ff' }} />{name}</Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: '绑定模型',
      key: 'model',
      render: (_: unknown, row: AgentRole) => row.model
        ? <Tag color="blue">{row.model.name}</Tag>
        : <span style={{ color: '#bbb' }}>未绑定</span>,
    },
    {
      title: '技能',
      key: 'skills',
      render: (_: unknown, row: AgentRole) => (
        <Space size={4} wrap>
          {row.skills?.length
            ? row.skills.map(s => <Tag key={s.skill.id}>{s.skill.name}</Tag>)
            : <span style={{ color: '#bbb' }}>无</span>
          }
        </Space>
      ),
    },
    {
      title: '启用',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      render: (v: boolean, row: AgentRole) => (
        <Switch checked={v} size="small" onChange={checked => handleToggle(row, checked)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, row: AgentRole) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认删除此角色？" onConfirm={() => handleDelete(row.id)} okText="删除" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加角色</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={roles}
        loading={loading}
        pagination={false}
        size="middle"
        expandable={{
          expandedRowRender: (row: AgentRole) => row.systemPrompt ? (
            <Collapse
              ghost
              items={[{
                key: '1',
                label: <Text type="secondary">系统提示词</Text>,
                children: (
                  <pre style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: 13,
                    margin: 0,
                  }}>
                    {row.systemPrompt}
                  </pre>
                ),
              }]}
            />
          ) : null,
          rowExpandable: (row: AgentRole) => !!row.systemPrompt,
        }}
      />

      <Modal
        title={editing ? '编辑 Agent 角色' : '添加 Agent 角色'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：审批助手" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="简短描述此角色的用途" />
          </Form.Item>
          <Form.Item label="系统提示词" name="systemPrompt">
            <Input.TextArea
              rows={5}
              placeholder="定义 Agent 的行为、身份和约束，例如：你是一个专业的审批助手，负责..."
            />
          </Form.Item>
          <Form.Item label="绑定对话模型" name="modelId">
            <Select allowClear placeholder="选择模型（可选，留空使用系统默认）">
              {models.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="分配技能" name="skillIds">
            <Select mode="multiple" placeholder="选择要赋予此角色的技能（可多选）" optionFilterProp="label">
              {skills.map(s => (
                <Select.Option key={s.id} value={s.id} label={s.name}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="启用" name="isEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
