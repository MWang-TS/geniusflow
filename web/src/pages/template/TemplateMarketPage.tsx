import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Tag, Space, App, Input } from 'antd'
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { templateApi, type TemplateItem } from '../../api/template'

const TemplateMarketPage: React.FC = () => {
  const { message } = App.useApp()
  const [data, setData] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [cloning, setCloning] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const res = await templateApi.list({ page, pageSize })
      setData(res.data.list || [])
      setPagination(res.data.pagination)
    } catch {
      message.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => { fetchData() }, [])

  const handleSearch = (value: string) => {
    const filtered = data.filter((t) =>
      t.name.toLowerCase().includes(value.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(value.toLowerCase()))
    )
    if (!value) {
      fetchData()
    } else {
      setData(filtered)
    }
    setKeyword(value)
  }

  const handleClone = async (id: string) => {
    setCloning(id)
    try {
      await templateApi.clone(id)
      message.success('模板复制成功，请在流程管理中查看')
    } catch {
      message.error('复制失败')
    } finally {
      setCloning(null)
    }
  }

  const columns: ColumnsType<TemplateItem> = [
    {
      title: '模板名称', dataIndex: 'name', key: 'name', ellipsis: true,
      render: (v: string, r) => (
        <Space>
          <span>{v}</span>
          {r.isPreset && <Tag color="blue">官方</Tag>}
        </Space>
      ),
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true, render: (v: string | null) => v || '-' },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (v: string | null) => v || '-' },
    { title: '节点数', dataIndex: 'nodeCount', key: 'nodeCount', width: 80, align: 'center' },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<CopyOutlined />}
          loading={cloning === record.id}
          onClick={() => handleClone(record.id)}
        >
          复制到我的流程
        </Button>
      ),
    },
  ]

  return (
    <Card title="模板市场" extra={
      <Space>
        <Input.Search placeholder="搜索模板" style={{ width: 200 }} value={keyword} onChange={(e) => handleSearch(e.target.value)} />
        <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pagination.pageSize)} />
      </Space>
    }>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => fetchData(p, ps) }} />
    </Card>
  )
}

export default TemplateMarketPage
