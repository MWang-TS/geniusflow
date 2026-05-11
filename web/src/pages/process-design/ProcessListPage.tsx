import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  App,
  Popconfirm,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { processDefinitionApi } from '../../api/process-definition'
import type { ProcessDefinitionListItem } from '../../types/process'

const statusMap: Record<string, { color: string; label: string }> = {
  draft: { color: 'orange', label: '草稿' },
  published: { color: 'green', label: '已发布' },
  archived: { color: 'default', label: '已归档' },
}

const ProcessListPage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [data, setData] = useState<ProcessDefinitionListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string | undefined>()

  const fetchData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true)
      try {
        const res = await processDefinitionApi.list({
          page,
          pageSize,
          keyword: keyword || undefined,
          status,
        })
        setData(res.data.list)
        setPagination({
          page: res.data.pagination.page,
          pageSize: res.data.pagination.pageSize,
          total: res.data.pagination.total,
        })
      } catch {
        message.error('加载流程列表失败')
      } finally {
        setLoading(false)
      }
    },
    [keyword, status, message],
  )

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreate = () => {
    navigate('/processes/new/edit')
  }

  const handleEdit = (id: string) => {
    navigate(`/processes/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    try {
      await processDefinitionApi.remove(id)
      message.success('删除成功')
      fetchData(pagination.page, pagination.pageSize)
    } catch {
      message.error('删除失败')
    }
  }

  const handlePublish = async (id: string) => {
    try {
      await processDefinitionApi.publish(id)
      message.success('发布成功')
      fetchData(pagination.page, pagination.pageSize)
    } catch {
      message.error('发布失败')
    }
  }

  const columns: ColumnsType<ProcessDefinitionListItem> = [
    {
      title: '流程名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => `v${v}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const config = statusMap[v] || { color: 'default', label: v }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '节点数',
      dataIndex: 'nodeCount',
      key: 'nodeCount',
      width: 80,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.id)}
              disabled={record.status === 'published'}
            />
          </Tooltip>
          {record.status === 'draft' && (
            <Tooltip title="发布">
              <Button
                type="link"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handlePublish(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'draft' && (
            <Popconfirm
              title="确认删除？"
              description="删除后不可恢复"
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="SOP流程库"
      extra={
        <Space>
          <Input.Search
            placeholder="搜索流程名称"
            allowClear
            style={{ width: 220 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => fetchData(1, pagination.pageSize)}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setTimeout(() => fetchData(1, pagination.pageSize), 0)
            }}
            options={[
              { label: '草稿', value: 'draft' },
              { label: '已发布', value: 'published' },
              { label: '已归档', value: 'archived' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(pagination.page, pagination.pageSize)} />
          <Button icon={<ThunderboltOutlined />} onClick={() => navigate('/sop-generator')}>
            AI 生成 SOP
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建SOP流程
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => fetchData(page, pageSize),
        }}
      />
    </Card>
  )
}

export default ProcessListPage
