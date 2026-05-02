import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Tag, Space, App, Input, Modal, Form, Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { rolesApi, type RoleItem, type RoleDetail } from '../../api/roles'

const RoleManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [data, setData] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [roleDetail, setRoleDetail] = useState<RoleDetail | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await rolesApi.list()
      setData(res.data || [])
    } catch {
      message.error('加载角色列表失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => { fetchData() }, [])

  const handleCreate = () => {
    setEditingRole(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (role: RoleItem) => {
    setEditingRole(role)
    form.setFieldsValue({ name: role.name, description: role.description })
    setModalOpen(true)
  }

  const handleViewUsers = async (id: string) => {
    try {
      const res = await rolesApi.getById(id)
      setRoleDetail(res.data)
      setDetailModalOpen(true)
    } catch {
      message.error('加载角色详情失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (editingRole) {
        await rolesApi.update(editingRole.id, values)
        message.success('角色更新成功')
      } else {
        await rolesApi.create(values)
        message.success('角色创建成功')
      }
      setModalOpen(false)
      fetchData()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await rolesApi.remove(id)
      message.success('角色已删除')
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败')
    }
  }

  const columns: ColumnsType<RoleItem> = [
    { title: '角色名', dataIndex: 'name', key: 'name', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true, render: (v: string | null) => v || '-' },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleViewUsers(record.id)}>用户</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该角色？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card title="角色管理" extra={
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建角色</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} />
        </Space>
      }>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />
      </Card>

      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="角色名" rules={[{ required: true, message: '请输入角色名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`角色 [${roleDetail?.name}] 的用户列表`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
      >
        {roleDetail?.users.length ? (
          <Table rowKey="id" dataSource={roleDetail.users} pagination={false} size="small"
            columns={[
              { title: '姓名', dataIndex: 'name' },
              { title: '邮箱', dataIndex: 'email' },
            ]} />
        ) : (
          <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>暂无用户</div>
        )}
      </Modal>
    </>
  )
}

export default RoleManagementPage
