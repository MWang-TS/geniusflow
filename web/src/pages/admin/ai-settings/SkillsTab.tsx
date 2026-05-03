import { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, Switch,
  message, Popconfirm
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { aiSettingsApi, type AgentSkill, type SkillType } from '../../../api/ai-settings'

const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  tool: '工具调用',
  retrieval: '知识检索',
  code_execution: '代码执行',
  custom: '自定义',
}

const SKILL_TYPE_COLORS: Record<SkillType, string> = {
  tool: 'blue',
  retrieval: 'green',
  code_execution: 'purple',
  custom: 'default',
}

export default function SkillsTab() {
  const [skills, setSkills] = useState<AgentSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AgentSkill | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await aiSettingsApi.listSkills()
      setSkills(res.data)
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

  const openEdit = (row: AgentSkill) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      type: row.type,
      description: row.description,
      isEnabled: row.isEnabled,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        await aiSettingsApi.updateSkill(editing.id, values)
        message.success('更新成功')
      } else {
        await aiSettingsApi.createSkill(values)
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
      await aiSettingsApi.deleteSkill(id)
      message.success('删除成功')
      load()
    } catch {
      message.error('删除失败')
    }
  }

  const handleToggle = async (row: AgentSkill, checked: boolean) => {
    try {
      await aiSettingsApi.updateSkill(row.id, { isEnabled: checked })
      setSkills(prev => prev.map(s => s.id === row.id ? { ...s, isEnabled: checked } : s))
    } catch {
      message.error('更新失败')
    }
  }

  const columns: ColumnsType<AgentSkill> = [
    {
      title: '技能名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: SkillType) => (
        <Tag color={SKILL_TYPE_COLORS[type]}>{SKILL_TYPE_LABELS[type]}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: '启用',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      render: (v: boolean, row: AgentSkill) => (
        <Switch checked={v} size="small" onChange={checked => handleToggle(row, checked)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, row: AgentSkill) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认删除此技能？" onConfirm={() => handleDelete(row.id)} okText="删除" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加技能</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={skills}
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title={editing ? '编辑技能' : '添加技能'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="技能名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：企业知识库检索" />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="选择技能类型">
              {Object.entries(SKILL_TYPE_LABELS).map(([value, label]) => (
                <Select.Option key={value} value={value}>{label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="描述该技能的用途和功能" />
          </Form.Item>
          <Form.Item label="启用" name="isEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
