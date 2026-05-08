import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Space, Tag, App, Tooltip, Modal, Input, Select, Row, Col, Pagination, Spin, Empty, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, ReloadOutlined,
  UploadOutlined, RedoOutlined, DatabaseOutlined, BookOutlined, FileOutlined, EditOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons'
import { knowledgeBaseApi, type KnowledgeBaseItem, type KnowledgeBaseDocument } from '../../api/knowledge-base'

const { Paragraph, Text } = Typography

const CATEGORIES = ['说明书', '会议纪要', '报告手册', '规范', '其他']

const modeMap: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  rag: { color: 'blue', label: 'RAG', icon: <DatabaseOutlined /> },
  wiki: { color: 'purple', label: 'Wiki', icon: <BookOutlined /> },
}

const categoryColors: Record<string, string> = {
  '说明书': 'cyan',
  '会议纪要': 'orange',
  '报告手册': 'geekblue',
  '规范': 'green',
  '其他': 'default',
  'general': 'default',
}

const statusColors: Record<string, string> = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
}
const statusLabels: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
}

const KnowledgeBaseListPage: React.FC = () => {
  const { message, modal } = App.useApp()
  const [data, setData] = useState<KnowledgeBaseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', mode: 'rag', type: '说明书', description: '' })
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailKb] = useState<KnowledgeBaseItem | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [docs, setDocs] = useState<KnowledgeBaseDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsPagination, setDocsPagination] = useState({ page: 1, pageSize: 10, total: 0 })

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const res = await knowledgeBaseApi.list({ type: typeFilter, page, pageSize })
      setData(res.data.list || [])
      setPagination(res.data.pagination)
    } catch {
      message.error('加载知识库列表失败')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, message])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchDocs = useCallback(async (kbId: string, page = 1, pageSize = 10) => {
    setDocsLoading(true)
    try {
      const res = await knowledgeBaseApi.getDocuments(kbId, { page, pageSize })
      setDocs(res.data.list || [])
      setDocsPagination(res.data.pagination)
    } catch {
      setDocs([])
    } finally {
      setDocsLoading(false)
    }
  }, [])

  const handleCreate = async () => {
    try {
      await knowledgeBaseApi.create(createForm)
      message.success('创建成功')
      setCreateOpen(false)
      setCreateForm({ name: '', mode: 'rag', type: '说明书', description: '' })
      fetchData(1, pagination.pageSize)
    } catch {
      message.error('创建失败')
    }
  }

  const handleRenameStart = (item: KnowledgeBaseItem) => {
    setRenamingId(item.id)
    setRenameValue(item.name)
  }

  const handleRenameConfirm = async (id: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) { message.warning('名称不能为空'); return }
    try {
      await knowledgeBaseApi.update(id, { name: trimmed })
      message.success('重命名成功')
      setData(prev => prev.map(kb => kb.id === id ? { ...kb, name: trimmed } : kb))
      setRenamingId(null)
    } catch {
      message.error('重命名失败')
    }
  }

  const handleRenameCancel = () => setRenamingId(null)

  const handleDelete = (id: string, name: string) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除知识库「${name}」吗？将同时删除所有文档。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await knowledgeBaseApi.remove(id)
          message.success('删除成功')
          fetchData(1, pagination.pageSize)
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const handleUpload = async (kbId: string, file: File) => {
    try {
      await knowledgeBaseApi.uploadDocument(kbId, file)
      message.success('上传成功，正在处理中')
      fetchDocs(kbId, 1, docsPagination.pageSize)
    } catch {
      message.error('上传失败')
    }
  }

  const handleReindex = async (kbId: string, docId: string) => {
    try {
      await knowledgeBaseApi.reindex(kbId, docId)
      message.success('已触发重新向量化')
      fetchDocs(kbId, docsPagination.page, docsPagination.pageSize)
    } catch {
      message.error('操作失败')
    }
  }

  const openDetail = (kb: KnowledgeBaseItem) => {
    if (kb.mode === 'wiki') {
      window.location.href = `/knowledge-bases/${kb.id}/wiki`
      return
    }
    window.location.href = `/knowledge-bases/${kb.id}/rag`
  }

  const docColumns: ColumnsType<KnowledgeBaseDocument> = [
    { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
    { title: '大小', dataIndex: 'fileSize', key: 'fileSize', width: 90, render: (v: number) => v > 1024 * 1024 ? `${(v / 1024 / 1024).toFixed(1)} MB` : `${(v / 1024).toFixed(1)} KB` },
    {
      title: '解析', dataIndex: 'parseStatus', key: 'parseStatus', width: 80,
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{statusLabels[v] || v}</Tag>,
    },
    {
      title: '向量化', dataIndex: 'vectorizedStatus', key: 'vectorizedStatus', width: 80,
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{statusLabels[v] || v}</Tag>,
    },
    { title: '分块数', dataIndex: 'chunkCount', key: 'chunkCount', width: 70, align: 'center' },
    { title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'actions', width: 70,
      render: (_, record) => (
        <Tooltip title="重新向量化">
          <Button size="small" icon={<RedoOutlined />} onClick={() => detailKb && handleReindex(detailKb.id, record.id)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <>
      <Card title="知识库" extra={
        <Space>
          <Select placeholder="模式筛选" allowClear style={{ width: 120 }} value={typeFilter}
            onChange={(v) => { setTypeFilter(v); fetchData(1, pagination.pageSize) }}
            options={[
              { label: 'RAG 知识库', value: 'rag' },
              { label: 'Wiki 知识库', value: 'wiki' },
            ]} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建</Button>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pagination.pageSize)} />
        </Space>
      }>
        <Spin spinning={loading}>
          {data.length === 0 && !loading ? (
            <Empty description="暂无知识库" style={{ padding: '60px 0' }} />
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {data.map(item => {
                  const modeCfg = modeMap[item.mode] || { color: 'default', label: item.mode, icon: <DatabaseOutlined /> }
                  return (
                    <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                      <Card
                        hoverable
                        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
                        actions={[
                          <Tooltip title="查看详情" key="view">
                            <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => openDetail(item)}>
                              查看
                            </Button>
                          </Tooltip>,
                          <Tooltip title="删除" key="delete">
                            <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(item.id, item.name)}>
                              删除
                            </Button>
                          </Tooltip>,
                        ]}
                      >
                        <div style={{ flex: 1 }}>
                          {renamingId === item.id ? (
                            <Input
                              size="small"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onPressEnter={() => handleRenameConfirm(item.id)}
                              autoFocus
                              style={{ marginBottom: 8, fontWeight: 600 }}
                              suffix={
                                <Space size={4}>
                                  <CheckOutlined style={{ color: '#52c41a', cursor: 'pointer' }} onClick={() => handleRenameConfirm(item.id)} />
                                  <CloseOutlined style={{ color: '#999', cursor: 'pointer' }} onClick={handleRenameCancel} />
                                </Space>
                              }
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <Text strong style={{ fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</Text>
                              <EditOutlined style={{ color: '#999', cursor: 'pointer', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); handleRenameStart(item) }} />
                            </div>
                          )}
                          <Space style={{ marginBottom: 10 }} wrap>
                            <Tag color={modeCfg.color} icon={modeCfg.icon}>{modeCfg.label}</Tag>
                            <Tag color={categoryColors[item.type] || 'default'}>{item.type}</Tag>
                          </Space>
                          <Paragraph
                            type="secondary"
                            ellipsis={{ rows: 2 }}
                            style={{ marginBottom: 12, fontSize: 13 }}
                          >
                            {item.description || '暂无描述'}
                          </Paragraph>
                        </div>
                        <Space style={{ fontSize: 12, color: '#999' }}>
                          <FileOutlined />
                          <span>{item.documentCount} 个文档</span>
                          <span style={{ marginLeft: 8 }}>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                        </Space>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
              <div style={{ textAlign: 'right', marginTop: 24 }}>
                <Pagination
                  current={pagination.page}
                  pageSize={pagination.pageSize}
                  total={pagination.total}
                  showSizeChanger
                  pageSizeOptions={[12, 24, 48]}
                  showTotal={(t) => `共 ${t} 条`}
                  onChange={(p, ps) => fetchData(p, ps)}
                />
              </div>
            </>
          )}
        </Spin>
      </Card>

      <Modal open={createOpen} title="新建知识库" onCancel={() => setCreateOpen(false)} onOk={handleCreate}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>名称</div>
          <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="输入知识库名称" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>模式</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {([['rag', 'RAG 知识库', '向量检索召回'], ['wiki', 'Wiki 知识库', 'LLM 编译 Wiki 页']] as const).map(([val, label, desc]) => (
              <div
                key={val}
                onClick={() => setCreateForm({ ...createForm, mode: val })}
                style={{
                  flex: 1,
                  border: `2px solid ${createForm.mode === val ? (val === 'wiki' ? '#722ed1' : '#1677ff') : '#d9d9d9'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  background: createForm.mode === val ? (val === 'wiki' ? '#f9f0ff' : '#e6f4ff') : '#fff',
                  transition: 'all 0.2s',
                }}
              >
                {val === 'rag'
                  ? <DatabaseOutlined style={{ fontSize: 20, color: createForm.mode === 'rag' ? '#1677ff' : '#999' }} />
                  : <BookOutlined style={{ fontSize: 20, color: createForm.mode === 'wiki' ? '#722ed1' : '#999' }} />
                }
                <div style={{ fontWeight: 600, marginTop: 4, fontSize: 13 }}>{label}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>文档分类</div>
          <Select
            value={createForm.type}
            onChange={(v) => setCreateForm({ ...createForm, type: v })}
            style={{ width: '100%' }}
            options={CATEGORIES.map((c) => ({ label: c, value: c }))}
          />
        </div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>描述</div>
          <Input.TextArea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="可选描述" rows={3} />
        </div>
      </Modal>

      <Modal open={detailOpen} title={detailKb ? `文档管理 - ${detailKb.name}` : ''}
        onCancel={() => setDetailOpen(false)} footer={null} width={900}>
        {detailKb && (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Tag color={modeMap[detailKb.mode]?.color}>{modeMap[detailKb.mode]?.label ?? detailKb.mode}</Tag>
                <Tag color={categoryColors[detailKb.type] || 'default'}>{detailKb.type}</Tag>
                <span style={{ color: '#666' }}>{detailKb.description || '无描述'}</span>
              </Space>
              <label style={{ cursor: 'pointer' }}>
                <Button icon={<UploadOutlined />} onClick={() => {
                  const input = document.getElementById(`upload-${detailKb.id}`) as HTMLInputElement
                  input?.click()
                }}>上传文档</Button>
                <input id={`upload-${detailKb.id}`} type="file" accept=".txt,.pdf,.docx" style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(detailKb.id, file)
                  }} />
              </label>
            </div>
            <Table rowKey="id" columns={docColumns} dataSource={docs} loading={docsLoading}
              pagination={{ ...docsPagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => fetchDocs(detailKb.id, p, ps) }} />
          </div>
        )}
      </Modal>
    </>
  )
}

export default KnowledgeBaseListPage
