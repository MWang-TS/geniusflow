import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Tag, Space, App, Input, Modal, Form, Select, Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { usersApi, type UserItem } from '../../api/users'

const statusTags: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '正常' },
  inactive: { color: 'red', label: '禁用' },
}

const UserManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [data, setData] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const res = await usersApi.list({ page, pageSize })
      setData(res.data.list || [])
      setPagination(res.data.pagination)
    } catch {
      message.error('加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => { fetchData() }, [])

  const handleCreate = () => {
    setEditingUser(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (user: UserItem) => {
    setEditingUser(user)
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      status: user.status,
      roleIds: user.roles.map((r) => r.id),
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (editingUser) {
        await usersApi.update(editingUser.id, values)
        message.success('用户更新成功')
      } else {
        await usersApi.create(values)
        message.success('用户创建成功')
      }
      setModalOpen(false)
      fetchData(pagination.page, pagination.pageSize)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await usersApi.remove(id)
      message.success('用户已删除')
      fetchData(pagination.page, pagination.pageSize)
    } catch {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<UserItem> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 200 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => {
        const cfg = statusTags[v] || { color: 'default', label: v }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '角色', dataIndex: 'roles', key: 'roles', width: 200,
      render: (v: Array<{ id: string; name: string }>) => v?.map((r) => <Tag key={r.id}>{r.name}</Tag>),
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions', width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card title="用户管理" extra={
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建用户</Button>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pagination.pageSize)} />
        </Space>
      }>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => fetchData(p, ps) }} />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
              <Input.Password />
            </Form.Item>
          )}
          {editingUser && (
            <Form.Item name="password" label="密码（留空不修改）">
              <Input.Password />
            </Form.Item>
          )}
          {editingUser && (
            <Form.Item name="status" label="状态">
              <Select options={[
                { label: '正常', value: 'active' },
                { label: '禁用', value: 'inactive' },
              ]} />
            </Form.Item>
          )}
          <Form.Item name="roleIds" label="角色">
            <Select mode="multiple" placeholder="选择角色" options={[
              { label: '设计者', value: 'designer' },
              { label: '员工', value: 'employee' },
              { label: '管理者', value: 'manager' },
              { label: '管理员', value: 'admin' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default UserManagementPage
