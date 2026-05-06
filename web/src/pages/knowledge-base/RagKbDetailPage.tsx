import { useState, useEffect, useCallback } from 'react'
import {
  Card, Tabs, Table, Button, Space, Tag, App, Tooltip, Typography,
  Upload, Form, InputNumber, Slider, Divider, Spin, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd'
import {
  ArrowLeftOutlined, RedoOutlined, DeleteOutlined,
  SaveOutlined, InboxOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { knowledgeBaseApi, type KnowledgeBaseItem, type KnowledgeBaseDocument, type RagSettings } from '../../api/knowledge-base'

const { Title, Text } = Typography
const { Dragger } = Upload
const statusLabels: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
}

const categoryColors: Record<string, string> = {
  '说明书': 'cyan', '会议纪要': 'orange', '报告手册': 'geekblue',
  '规范': 'green', '其他': 'default', 'general': 'default',
}

const DEFAULT_SETTINGS: RagSettings = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.75,
}

export default function RagKbDetailPage() {
  const { kbId } = useParams<{ kbId: string }>()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const [kb, setKb] = useState<KnowledgeBaseItem | null>(null)
  const [kbLoading, setKbLoading] = useState(true)
  const [docs, setDocs] = useState<KnowledgeBaseDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [uploading, setUploading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsForm] = Form.useForm<RagSettings>()

  const fetchKb = useCallback(async () => {
    if (!kbId) return
    setKbLoading(true)
    try {
      const res = await knowledgeBaseApi.getById(kbId)
      const data = res.data
      setKb(data)
      settingsForm.setFieldsValue({
        chunkSize: data.settings?.chunkSize ?? DEFAULT_SETTINGS.chunkSize,
        chunkOverlap: data.settings?.chunkOverlap ?? DEFAULT_SETTINGS.chunkOverlap,
        topK: data.settings?.topK ?? DEFAULT_SETTINGS.topK,
        similarityThreshold: data.settings?.similarityThreshold ?? DEFAULT_SETTINGS.similarityThreshold,
      })
    } catch {
      message.error('加载知识库信息失败')
    } finally {
      setKbLoading(false)
    }
  }, [kbId, message, settingsForm])

  const fetchDocs = useCallback(async (page = 1, pageSize = 20) => {
    if (!kbId) return
    setDocsLoading(true)
    try {
      const res = await knowledgeBaseApi.getDocuments(kbId, { page, pageSize })
      setDocs(res.data.list || [])
      setPagination(res.data.pagination)
    } catch {
      message.error('加载文档列表失败')
    } finally {
      setDocsLoading(false)
    }
  }, [kbId, message])

  useEffect(() => {
    fetchKb()
    fetchDocs()
  }, [fetchKb, fetchDocs])

  const handleUpload = async (file: File) => {
    if (!kbId) return false
    setUploading(true)
    try {
      await knowledgeBaseApi.uploadDocument(kbId, file)
      message.success(`「${file.name}」上传成功，正在处理中`)
      fetchDocs(1, pagination.pageSize)
    } catch {
      message.error('上传失败')
    } finally {
      setUploading(false)
    }
    return false // prevent ant design auto-upload
  }

  const handleReindex = async (docId: string) => {
    if (!kbId) return
    try {
      await knowledgeBaseApi.reindex(kbId, docId)
      message.success('已触发重新向量化')
      fetchDocs(pagination.page, pagination.pageSize)
    } catch {
      message.error('操作失败')
    }
  }

  const handleDelete = (doc: KnowledgeBaseDocument) => {
    modal.confirm({
      title: '确认删除',
      content: `删除「${doc.fileName}」后无法恢复，同时删除所有分块数据。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await knowledgeBaseApi.deleteDocument(kbId!, doc.id)
          message.success('删除成功')
          fetchDocs(1, pagination.pageSize)
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const handleSaveSettings = async () => {
    const values = await settingsForm.validateFields()
    setSettingsSaving(true)
    try {
      await knowledgeBaseApi.update(kbId!, { settings: values as Record<string, unknown> })
      message.success('RAG 参数已保存')
      fetchKb()
    } catch {
      message.error('保存失败')
    } finally {
      setSettingsSaving(false)
    }
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: '.pdf,.docx,.doc,.txt,.md,.pptx,.xlsx,.csv',
    showUploadList: false,
    beforeUpload: (file) => {
      handleUpload(file)
      return false
    },
  }

  const docColumns: ColumnsType<KnowledgeBaseDocument> = [
    {
      title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true,
      render: (v: string) => <Text style={{ wordBreak: 'break-all' }}>{v}</Text>,
    },
    {
      title: '大小', dataIndex: 'fileSize', key: 'fileSize', width: 90,
      render: (v: number) => v > 1024 * 1024 ? `${(v / 1024 / 1024).toFixed(1)} MB` : `${(v / 1024).toFixed(1)} KB`,
    },
    {
      title: '解析', dataIndex: 'parseStatus', key: 'parseStatus', width: 90,
      render: (v: string) => <Badge status={v === 'processing' ? 'processing' : v === 'completed' ? 'success' : v === 'failed' ? 'error' : 'default'} text={statusLabels[v] || v} />,
    },
    {
      title: '向量化', dataIndex: 'vectorizedStatus', key: 'vectorizedStatus', width: 90,
      render: (v: string) => <Badge status={v === 'processing' ? 'processing' : v === 'completed' ? 'success' : v === 'failed' ? 'error' : 'default'} text={statusLabels[v] || v} />,
    },
    { title: '分块数', dataIndex: 'chunkCount', key: 'chunkCount', width: 70, align: 'center' },
    {
      title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="重新向量化">
            <Button size="small" icon={<RedoOutlined />} onClick={() => handleReindex(record.id)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  if (kbLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge-bases')}>返回</Button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Title level={4} style={{ margin: 0 }}>{kb?.name}</Title>
            <Tag color="blue">RAG</Tag>
            <Tag color={categoryColors[kb?.type || ''] || 'default'}>{kb?.type}</Tag>
          </div>
          {kb?.description && <Text type="secondary" style={{ fontSize: 13 }}>{kb.description}</Text>}
        </div>
      </div>

      <Tabs
        defaultActiveKey="docs"
        size="large"
        items={[
          {
            key: 'docs',
            label: `文档管理（${kb?.documentCount ?? 0}）`,
            children: (
              <div>
                {/* Upload area */}
                <Card style={{ marginBottom: 16 }}>
                  <Dragger {...uploadProps} disabled={uploading} style={{ padding: '8px 0' }}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ color: '#1677ff' }} />
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 500 }}>拖拽文件到此处，或点击选择文件</p>
                    <p style={{ color: '#888', fontSize: 13 }}>
                      支持 PDF、Word、TXT、Markdown、PPT、Excel、CSV，单文件最大 50MB
                    </p>
                    {uploading && <p style={{ color: '#1677ff' }}>上传中...</p>}
                  </Dragger>
                </Card>

                {/* Document table */}
                <Card
                  extra={
                    <Button icon={<RedoOutlined />} size="small" onClick={() => fetchDocs(pagination.page, pagination.pageSize)}>
                      刷新
                    </Button>
                  }
                >
                  <Table
                    rowKey="id"
                    columns={docColumns}
                    dataSource={docs}
                    loading={docsLoading}
                    pagination={{
                      current: pagination.page,
                      pageSize: pagination.pageSize,
                      total: pagination.total,
                      showSizeChanger: true,
                      showTotal: (t) => `共 ${t} 个文档`,
                      onChange: (p, ps) => fetchDocs(p, ps),
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'settings',
            label: 'RAG 参数',
            children: (
              <Card style={{ maxWidth: 640 }}>
                <Form form={settingsForm} layout="vertical" initialValues={DEFAULT_SETTINGS}>
                  <Divider orientation="left">分块设置</Divider>

                  <Form.Item
                    name="chunkSize"
                    label="分块大小（tokens）"
                    tooltip="每个文本分块包含的最大 token 数，过大会降低召回精度，过小可能丢失上下文"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={100} max={8000} step={100} style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item
                    name="chunkOverlap"
                    label="分块重叠（tokens）"
                    tooltip="相邻分块之间的重叠 token 数，有助于保持上下文连贯性"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} max={2000} step={50} style={{ width: '100%' }} />
                  </Form.Item>

                  <Divider orientation="left">检索设置</Divider>

                  <Form.Item
                    name="topK"
                    label="召回数量（Top-K）"
                    tooltip="每次检索最多返回的分块数量"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={20} style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item
                    name="similarityThreshold"
                    label={
                      <span>
                        相似度阈值&nbsp;
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          (低于此值的结果将被过滤)
                        </Text>
                      </span>
                    }
                    tooltip="0~1 之间，越高要求越严格，建议 0.6~0.8"
                  >
                    <Slider min={0} max={1} step={0.05} marks={{ 0: '0', 0.5: '0.5', 1: '1' }} />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={settingsSaving}
                      onClick={handleSaveSettings}
                    >
                      保存参数
                    </Button>
                    <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                      参数修改后，对新上传的文档生效；已有文档需重新向量化
                    </Text>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}
