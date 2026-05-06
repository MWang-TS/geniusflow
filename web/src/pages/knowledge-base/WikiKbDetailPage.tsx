import { useState, useEffect, useCallback } from 'react'
import {
  Card, Tabs, Table, Button, Space, Tag, App, Tooltip, Upload,
  Typography, Input, Drawer, Spin, Alert, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, UploadOutlined, PlayCircleOutlined, DeleteOutlined,
  ReloadOutlined, FileTextOutlined, ReadOutlined, SearchOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { wikiApi, type WikiRawSource, type WikiPage } from '../../api/wiki'
import { knowledgeBaseApi } from '../../api/knowledge-base'
import WikiPageRenderer from './WikiPageRenderer'

const { Text } = Typography

const convStatusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待解析' },
  processing: { color: 'processing', label: '解析中' },
  done: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
}

const ingestStatusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待编译' },
  processing: { color: 'processing', label: '编译中' },
  done: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
}

const pageTypeMap: Record<string, { color: string; label: string }> = {
  index: { color: 'gold', label: '目录' },
  concept: { color: 'blue', label: '概念' },
  entity: { color: 'green', label: '实体' },
  source: { color: 'cyan', label: '来源' },
  log: { color: 'purple', label: '日志' },
}

export default function WikiKbDetailPage() {
  const { kbId } = useParams<{ kbId: string }>()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const [kbName, setKbName] = useState('')
  const [kbDesc, setKbDesc] = useState('')
  const [activeTab, setActiveTab] = useState('sources')

  // Sources
  const [sources, setSources] = useState<WikiRawSource[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourcesPagination, setSourcesPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // Pages
  const [pages, setPages] = useState<WikiPage[]>([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const [pagesPagination, setPagesPagination] = useState({ page: 1, pageSize: 50, total: 0 })
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null)
  const [pageDrawerOpen, setPageDrawerOpen] = useState(false)

  // Query
  const [queryOpen, setQueryOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [querying, setQuerying] = useState(false)
  const [queryAnswer, setQueryAnswer] = useState('')
  const [queryPagesUsed, setQueryPagesUsed] = useState<string[]>([])

  useEffect(() => {
    if (!kbId) return
    knowledgeBaseApi.getById(kbId).then((res: any) => {
      const d = res?.data ?? res
      setKbName(d.name)
      setKbDesc(d.description || '')
    }).catch(() => {})
    fetchSources()
  }, [kbId])

  const fetchSources = useCallback(async (page = 1, pageSize = 20) => {
    if (!kbId) return
    setSourcesLoading(true)
    try {
      const res = await wikiApi.getSources(kbId, { page, pageSize })
      const d = (res as any)?.data ?? res
      setSources(d.list || [])
      setSourcesPagination(d.pagination)
    } catch {
      message.error('加载来源文档失败')
    } finally {
      setSourcesLoading(false)
    }
  }, [kbId])

  const fetchPages = useCallback(async (page = 1, pageSize = 50) => {
    if (!kbId) return
    setPagesLoading(true)
    try {
      const res = await wikiApi.getPages(kbId, { page, pageSize })
      const d = (res as any)?.data ?? res
      setPages(d.list || [])
      setPagesPagination(d.pagination)
    } catch {
      message.error('加载 Wiki 页面失败')
    } finally {
      setPagesLoading(false)
    }
  }, [kbId])

  useEffect(() => {
    if (activeTab === 'pages') fetchPages()
  }, [activeTab])

  const handleUpload = async (file: File) => {
    if (!kbId) return false
    try {
      await wikiApi.uploadSource(kbId, file)
      message.success('上传成功')
      fetchSources()
    } catch {
      message.error('上传失败')
    }
    return false
  }

  const handleProcess = async (sourceId: string) => {
    if (!kbId) return
    setProcessingIds((prev) => new Set(prev).add(sourceId))
    try {
      await wikiApi.processSource(kbId, sourceId)
      message.success('解析并编译成功')
      fetchSources()
      if (activeTab === 'pages') fetchPages()
    } catch (err: any) {
      message.error(err?.response?.data?.message || '处理失败')
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(sourceId); return s })
    }
  }

  const handleDeleteSource = (sourceId: string, fileName: string) => {
    modal.confirm({
      title: '确认删除',
      content: `删除来源文件「${fileName}」？`,
      okType: 'danger',
      onOk: async () => {
        if (!kbId) return
        await wikiApi.deleteSource(kbId, sourceId)
        message.success('已删除')
        fetchSources()
      },
    })
  }

  const openPage = async (slug: string) => {
    if (!kbId) return
    try {
      const res = await wikiApi.getPage(kbId, slug)
      const d = (res as any)?.data ?? res
      setSelectedPage(d)
      setPageDrawerOpen(true)
    } catch {
      message.error('加载页面失败')
    }
  }

  const handleQuery = async () => {
    if (!question.trim() || !kbId) return
    setQuerying(true)
    setQueryAnswer('')
    setQueryPagesUsed([])
    try {
      const res = await wikiApi.query(kbId, question)
      const d = (res as any)?.data ?? res
      setQueryAnswer(d.answer)
      setQueryPagesUsed(d.pages_used || [])
    } catch {
      message.error('查询失败，请稍后重试')
    } finally {
      setQuerying(false)
    }
  }

  const sourceColumns: ColumnsType<WikiRawSource> = [
    { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
    {
      title: '大小', dataIndex: 'fileSize', key: 'fileSize', width: 90,
      render: (v: number) => v > 1024 * 1024 ? `${(v / 1024 / 1024).toFixed(1)} MB` : `${(v / 1024).toFixed(1)} KB`,
    },
    {
      title: '解析状态', dataIndex: 'conversionStatus', key: 'conversionStatus', width: 100,
      render: (v: string) => {
        const c = convStatusMap[v] || { color: 'default', label: v }
        return <Tag color={c.color}>{c.label}</Tag>
      },
    },
    {
      title: '解析方式', dataIndex: 'converterMode', key: 'converterMode', width: 130,
      render: (v: string) => {
        const labels: Record<string, string> = { markitdown: 'markitdown（本地）', mineru_lite: 'MinerU 轻量版', mineru_precision: 'MinerU Precision' }
        return <Text type="secondary" style={{ fontSize: 12 }}>{labels[v] || v}</Text>
      },
    },
    {
      title: '编译状态', dataIndex: 'ingestStatus', key: 'ingestStatus', width: 100,
      render: (v: string) => {
        const c = ingestStatusMap[v] || { color: 'default', label: v }
        return <Tag color={c.color}>{c.label}</Tag>
      },
    },
    { title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="解析 → 编译 Wiki">
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={processingIds.has(record.id)}
              disabled={record.ingestStatus === 'processing' || record.conversionStatus === 'processing'}
              onClick={() => handleProcess(record.id)}
            >处理</Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteSource(record.id, record.fileName)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const pageColumns: ColumnsType<WikiPage> = [
    {
      title: '页面标题', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (v: string, record) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openPage(record.slug)}>{v}</Button>
      ),
    },
    {
      title: '类型', dataIndex: 'pageType', key: 'pageType', width: 80,
      render: (v: string) => {
        const c = pageTypeMap[v] || { color: 'default', label: v }
        return <Tag color={c.color}>{c.label}</Tag>
      },
    },
    {
      title: '标签', dataIndex: 'tags', key: 'tags', ellipsis: true,
      render: (v: string[]) => v?.map((t) => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>),
    },
    { title: '来源文件', dataIndex: 'sourceFile', key: 'sourceFile', width: 160, ellipsis: true, render: (v: string | null) => v || '-' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'actions', width: 60,
      render: (_, record) => (
        <Tooltip title="查看">
          <Button size="small" icon={<ReadOutlined />} onClick={() => openPage(record.slug)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge-bases')} type="text" />
            <FileTextOutlined style={{ color: '#722ed1' }} />
            <span>{kbName || 'Wiki 知识库'}</span>
            <Tag color="purple">Wiki</Tag>
            {kbDesc && <Text type="secondary" style={{ fontWeight: 'normal', fontSize: 13 }}>{kbDesc}</Text>}
          </Space>
        }
        extra={
          <Button icon={<SearchOutlined />} onClick={() => setQueryOpen(true)}>智能问答</Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'sources',
              label: <span><UploadOutlined /> 原始文档</span>,
              children: (
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                    <Upload showUploadList={false} beforeUpload={(f) => { handleUpload(f); return false; }} accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.html">
                      <Button icon={<UploadOutlined />} type="primary">上传文档</Button>
                    </Upload>
                    <Button icon={<ReloadOutlined />} onClick={() => fetchSources()}>刷新</Button>
                  </div>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="上传文档后点击「处理」按钮，系统将自动解析文档并编译为 Wiki 页面。支持 PDF、Word、PowerPoint、Excel、Markdown 等格式。"
                  />
                  <Table
                    rowKey="id"
                    columns={sourceColumns}
                    dataSource={sources}
                    loading={sourcesLoading}
                    pagination={{
                      ...sourcesPagination,
                      showSizeChanger: true,
                      showTotal: (t) => `共 ${t} 条`,
                      onChange: (p, ps) => fetchSources(p, ps),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'pages',
              label: (
                <span>
                  <ReadOutlined /> Wiki 页面
                  {pages.length > 0 && <Badge count={pages.length} style={{ marginLeft: 6, backgroundColor: '#722ed1' }} />}
                </span>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <Button icon={<ReloadOutlined />} onClick={() => fetchPages()}>刷新</Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={pageColumns}
                    dataSource={pages}
                    loading={pagesLoading}
                    pagination={{
                      ...pagesPagination,
                      showSizeChanger: true,
                      showTotal: (t) => `共 ${t} 条`,
                      onChange: (p, ps) => fetchPages(p, ps),
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Wiki Page Viewer Drawer */}
      <Drawer
        open={pageDrawerOpen}
        onClose={() => setPageDrawerOpen(false)}
        title={selectedPage ? `${selectedPage.title}` : 'Wiki 页面'}
        width={700}
        extra={
          selectedPage && (
            <Space>
              <Tag color={pageTypeMap[selectedPage.pageType]?.color}>
                {pageTypeMap[selectedPage.pageType]?.label || selectedPage.pageType}
              </Tag>
              {selectedPage.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
            </Space>
          )
        }
      >
        {selectedPage && (
          <WikiPageRenderer
            content={selectedPage.content}
            onLinkClick={(slug) => { setPageDrawerOpen(false); setTimeout(() => openPage(slug), 100) }}
          />
        )}
      </Drawer>

      {/* Query Drawer */}
      <Drawer
        open={queryOpen}
        onClose={() => setQueryOpen(false)}
        title="Wiki 智能问答"
        width={680}
      >
        <div style={{ marginBottom: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="输入问题，从 Wiki 知识库中获取答案..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPressEnter={handleQuery}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery} loading={querying}>
              提问
            </Button>
          </Space.Compact>
        </div>

        {querying && <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="正在查阅 Wiki..." /></div>}

        {queryAnswer && !querying && (
          <div>
            {queryPagesUsed.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>参考页面：</Text>
                {queryPagesUsed.map((s) => (
                  <Button
                    key={s}
                    type="link"
                    size="small"
                    style={{ fontSize: 12, padding: '0 4px' }}
                    onClick={() => { setQueryOpen(false); setTimeout(() => openPage(s), 100) }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            )}
            <WikiPageRenderer content={queryAnswer} onLinkClick={(slug) => { setQueryOpen(false); setTimeout(() => openPage(slug), 100) }} />
          </div>
        )}
      </Drawer>
    </>
  )
}
