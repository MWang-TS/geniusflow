import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card, Tabs, Table, Button, Space, Tag, App, Tooltip, Upload,
  Typography, Input, Drawer, Spin, Alert, Badge, Empty, Modal, Form,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, UploadOutlined, PlayCircleOutlined, DeleteOutlined,
  ReloadOutlined, FileTextOutlined, ReadOutlined, SearchOutlined, ShareAltOutlined,
  FormOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { wikiApi, type WikiRawSource, type WikiPage, type GraphData, type GraphNode, type GraphBuildStatus } from '../../api/wiki'
import { knowledgeBaseApi } from '../../api/knowledge-base'
import WikiPageRenderer from './WikiPageRenderer'
import WikiForceGraph from '../../components/WikiForceGraph'

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
  const [selectedSourceKeys, setSelectedSourceKeys] = useState<string[]>([])
  const [selectedPageKeys, setSelectedPageKeys] = useState<string[]>([])

  // Pages
  const [pages, setPages] = useState<WikiPage[]>([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const [pagesPagination, setPagesPagination] = useState({ page: 1, pageSize: 50, total: 0 })
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null)
  const [pageDrawerOpen, setPageDrawerOpen] = useState(false)

  // Graph
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphBuilding, setGraphBuilding] = useState(false)
  const [graphBuildMsg, setGraphBuildMsg] = useState('')
  const graphPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const [graphSize, setGraphSize] = useState({ w: 900, h: 580 })
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphNode | null>(null)
  const [graphNodeDrawerOpen, setGraphNodeDrawerOpen] = useState(false)

  // Text input modal
  const [textModalOpen, setTextModalOpen] = useState(false)
  const [textSubmitting, setTextSubmitting] = useState(false)
  const [textForm] = Form.useForm<{ title: string; content: string }>()

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

  const handleTextSubmit = async () => {
    if (!kbId) return
    try {
      const values = await textForm.validateFields()
      setTextSubmitting(true)
      await wikiApi.uploadSourceText(kbId, values.title, values.content)
      message.success('文本已添加，可点击「处理」解析为 Wiki 页面')
      textForm.resetFields()
      setTextModalOpen(false)
      fetchSources()
    } catch (err: any) {
      if (err?.errorFields) return // form validation error
      message.error(err?.response?.data?.message || '提交失败')
    } finally {
      setTextSubmitting(false)
    }
  }

  const handleUpload = async (files: File[]) => {
    if (!kbId) return false
    try {
      const res = await wikiApi.uploadSource(kbId, files)
      const uploaded = Array.isArray((res as any)?.data) ? (res as any).data : [(res as any)?.data ?? res]
      message.success(`上传成功（${files.length} 个文件），正在自动处理…`)
      fetchSources()
      // Auto-process each uploaded source
      const ids: string[] = uploaded.map((s: any) => s?.id).filter(Boolean)
      ids.forEach((id) => setProcessingIds((prev) => new Set(prev).add(id)))
      await Promise.allSettled(ids.map((id) => wikiApi.processSource(kbId, id)))
      ids.forEach((id) => setProcessingIds((prev) => { const s = new Set(prev); s.delete(id); return s }))
      fetchSources()
      if (activeTab === 'pages') fetchPages()
    } catch (err: any) {
      const rawMessage = err?.response?.data?.message
      const detail = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage
      message.error(detail || '上传失败')
    }
    return false
  }

  const handleProcessAll = async () => {
    if (!kbId) return
    const pending = sources.filter(
      (s) => s.conversionStatus !== 'done' || s.ingestStatus !== 'done'
    )
    if (!pending.length) { message.info('没有待处理的文件'); return }
    pending.forEach((s) => setProcessingIds((prev) => new Set(prev).add(s.id)))
    await Promise.allSettled(pending.map((s) => wikiApi.processSource(kbId, s.id)))
    pending.forEach((s) => setProcessingIds((prev) => { const set = new Set(prev); set.delete(s.id); return set }))
    fetchSources()
    fetchPages()
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

  const handleBatchDelete = () => {
    if (!selectedSourceKeys.length) return
    modal.confirm({
      title: '确认批量删除',
      content: `将删除已选的 ${selectedSourceKeys.length} 个文件，无法恢复？`,
      okType: 'danger',
      onOk: async () => {
        if (!kbId) return
        await Promise.all(selectedSourceKeys.map((id) => wikiApi.deleteSource(kbId, id)))
        message.success(`已删除 ${selectedSourceKeys.length} 个文件`)
        setSelectedSourceKeys([])
        fetchSources()
      },
    })
  }

  const handleBatchDeletePages = () => {
    if (!selectedPageKeys.length) return
    modal.confirm({
      title: '确认批量删除',
      content: `将删除已选的 ${selectedPageKeys.length} 个 Wiki 页面，无法恢复？`,
      okType: 'danger',
      onOk: async () => {
        if (!kbId) return
        const slugsToDelete = pages
          .filter((p) => selectedPageKeys.includes(p.id))
          .map((p) => p.slug)
        await Promise.all(slugsToDelete.map((slug) => wikiApi.deletePage(kbId, slug)))
        message.success(`已删除 ${selectedPageKeys.length} 个页面`)
        setSelectedPageKeys([])
        fetchPages()
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
      message.error('页面不存在或加载失败：' + slug)
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

  const fetchGraph = useCallback(async () => {
    if (!kbId) return
    setGraphLoading(true)
    try {
      const res = await wikiApi.getGraph(kbId)
      const d = (res as any)?.data ?? res
      if (d.nodes?.length) setGraphData(d)
    } catch { /* no graph yet */ } finally {
      setGraphLoading(false)
    }
  }, [kbId])

  const handleBuildGraph = async () => {
    if (!kbId) return
    setGraphBuilding(true)
    setGraphBuildMsg('正在提交构建任务...')
    try {
      const res = await wikiApi.buildGraph(kbId)
      const status: GraphBuildStatus = (res as any)?.data ?? res
      if (status.status === 'error') {
        message.error('图谱构建失败: ' + status.message)
        setGraphBuilding(false)
        return
      }
      // Start polling status
      setGraphBuildMsg(status.message || '构建中，请稍候...')
      if (graphPollRef.current) clearInterval(graphPollRef.current)
      const pollStart = Date.now()
      graphPollRef.current = setInterval(async () => {
        // Stop polling after 10 minutes to avoid infinite loop
        if (Date.now() - pollStart > 10 * 60 * 1000) {
          clearInterval(graphPollRef.current!)
          graphPollRef.current = null
          setGraphBuilding(false)
          message.error('图谱构建超时，请重试')
          return
        }
        try {
          const pollRes = await wikiApi.getGraphBuildStatus(kbId)
          const s: GraphBuildStatus = (pollRes as any)?.data ?? pollRes
          setGraphBuildMsg(s.message || '构建中...')
          if (s.status === 'done') {
            clearInterval(graphPollRef.current!)
            graphPollRef.current = null
            setGraphBuilding(false)
            message.success(`知识图谱构建完成，共 ${s.triple_count} 条关系`)
            fetchGraph()
          } else if (s.status === 'error') {
            clearInterval(graphPollRef.current!)
            graphPollRef.current = null
            setGraphBuilding(false)
            message.error('图谱构建失败: ' + s.message)
          } else if (s.status === 'idle') {
            // AI service restarted — build state lost
            clearInterval(graphPollRef.current!)
            graphPollRef.current = null
            setGraphBuilding(false)
            message.error('构建任务异常中断（服务重启），请重新触发构建')
          }
        } catch { /* ignore poll errors */ }
      }, 5000)
    } catch (err: any) {
      message.error(err?.response?.data?.message || '图谱构建请求失败')
      setGraphBuilding(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'graph') fetchGraph()
  }, [activeTab])

  // Cleanup graph polling on unmount
  useEffect(() => {
    return () => { if (graphPollRef.current) clearInterval(graphPollRef.current) }
  }, [])

  useEffect(() => {
    if (!graphContainerRef.current) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setGraphSize({ w: Math.max(400, width), h: Math.max(400, height - 60) })
    })
    obs.observe(graphContainerRef.current)
    return () => obs.disconnect()
  }, [activeTab])

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
        const labels: Record<string, string> = {
          markitdown: 'markitdown（本地）',
          mineru_lite: 'MinerU 轻量版',
          mineru_precision: 'MinerU Precision',
          passthrough: 'Markdown（直通）',
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>{labels[v] || v || '-'}</Text>
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
                  <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Upload
                      multiple
                      showUploadList={false}
                      beforeUpload={(file, fileList) => {
                        const isLastSelected = file.uid === fileList[fileList.length - 1]?.uid
                        if (isLastSelected) {
                          handleUpload(fileList as unknown as File[])
                        }
                        return false
                      }}
                      accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.html"
                    >
                      <Button icon={<UploadOutlined />} type="primary">上传文档</Button>
                    </Upload>
                    <Button icon={<FormOutlined />} onClick={() => { textForm.resetFields(); setTextModalOpen(true) }}>输入文本</Button>
                    <Button icon={<ReloadOutlined />} onClick={() => fetchSources()}>刷新</Button>
                    <Button
                      icon={<PlayCircleOutlined />}
                      onClick={handleProcessAll}
                      disabled={sources.every((s) => s.conversionStatus === 'done' && s.ingestStatus === 'done')}
                    >全部处理</Button>
                    {selectedSourceKeys.length > 0 && (
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleBatchDelete}
                      >
                        删除已选 ({selectedSourceKeys.length})
                      </Button>
                    )}
                  </div>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="上传文档后系统将自动处理。Markdown 文件无需额外转换，直接编译为 Wiki 页面。支持 PDF、Word、PowerPoint、Excel、Markdown 等格式。"
                  />
                  <Table
                    rowKey="id"
                    rowSelection={{
                      selectedRowKeys: selectedSourceKeys,
                      onChange: (keys) => setSelectedSourceKeys(keys as string[]),
                    }}
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
                  <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Button icon={<ReloadOutlined />} onClick={() => fetchPages()}>刷新</Button>
                    {selectedPageKeys.length > 0 && (
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleBatchDeletePages}
                      >
                        删除已选 ({selectedPageKeys.length})
                      </Button>
                    )}
                  </div>
                  <Table
                    rowKey="id"
                    rowSelection={{
                      selectedRowKeys: selectedPageKeys,
                      onChange: (keys) => setSelectedPageKeys(keys as string[]),
                    }}
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
            {
              key: 'graph',
              label: <span><ShareAltOutlined /> 知识图谱</span>,
              children: (
                <div ref={graphContainerRef} style={{ minHeight: 640 }}>
                  <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Button
                      type="primary"
                      icon={<ShareAltOutlined />}
                      onClick={handleBuildGraph}
                      loading={graphBuilding}
                    >
                      {graphData ? '重新构建图谱' : '构建知识图谱'}
                    </Button>
                    {graphData && (
                      <Button icon={<ReloadOutlined />} onClick={fetchGraph} loading={graphLoading}>刷新</Button>
                    )}
                    {graphData && (
                      <Tag color="purple">{graphData.nodes.length} 个节点 / {graphData.edges.length} 条关系</Tag>
                    )}
                  </div>
                  {graphBuilding && (
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message={graphBuildMsg || '正在用 AI 提取实体关系，请稍候…'}
                      description="构建完成后图谱将自动刷新，期间可查看旧图谱数据。"
                    />
                  )}
                  {!graphBuilding && graphLoading && (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="加载图谱数据..." /></div>
                  )}
                  {!graphBuilding && !graphLoading && !graphData && (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无知识图谱，请先上传并处理文档，然后点击「构建知识图谱」"
                    />
                  )}
                  {graphData && graphData.nodes.length > 0 && (
                    <WikiForceGraph
                      nodes={graphData.nodes}
                      edges={graphData.edges}
                      width={graphSize.w}
                      height={graphSize.h}
                      onNodeClick={(node: GraphNode) => {
                        setSelectedGraphNode(node)
                        setGraphNodeDrawerOpen(true)
                      }}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Graph Node Detail Drawer */}
      <Drawer
        open={graphNodeDrawerOpen}
        onClose={() => setGraphNodeDrawerOpen(false)}
        title={selectedGraphNode ? `Wiki 页面：${selectedGraphNode.label}` : 'Wiki 页面'}
        width={440}
        extra={
          selectedGraphNode && (
            <Button type="primary" size="small" onClick={() => {
              setGraphNodeDrawerOpen(false)
              openPage(selectedGraphNode.id)
            }}>查看页面</Button>
          )
        }
      >
        {selectedGraphNode && graphData && (() => {
          const nodeLabel = (id: string) => graphData.nodes.find(n => n.id === id)?.label || id
          const outEdges = graphData.edges.filter(e => e.source === selectedGraphNode.id)
          const inEdges = graphData.edges.filter(e => e.target === selectedGraphNode.id)
          return (
            <div>
              <Space style={{ marginBottom: 16 }}>
                <Tag color={pageTypeMap[selectedGraphNode.type]?.color || 'purple'}>
                  {pageTypeMap[selectedGraphNode.type]?.label || selectedGraphNode.type}
                </Tag>
                <Tag color="blue">关联页面数：{outEdges.length + inEdges.length}</Tag>
              </Space>
              {outEdges.length > 0 && (
                <>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>引用页面（→）</Text>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={outEdges.map((e, i) => ({ key: i, rel: e.label, target: nodeLabel(e.target), targetId: e.target }))}
                    columns={[
                      { title: '关系', dataIndex: 'rel', key: 'rel', width: 100 },
                      {
                        title: '目标页面', dataIndex: 'target', key: 'target',
                        render: (v: string, row: any) => (
                          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => {
                            setGraphNodeDrawerOpen(false); openPage(row.targetId)
                          }}>{v}</Button>
                        ),
                      },
                    ]}
                    style={{ marginBottom: 16 }}
                  />
                </>
              )}
              {inEdges.length > 0 && (
                <>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>被引用（←）</Text>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={inEdges.map((e, i) => ({ key: i, source: nodeLabel(e.source), sourceId: e.source, rel: e.label }))}
                    columns={[
                      {
                        title: '来源页面', dataIndex: 'source', key: 'source',
                        render: (v: string, row: any) => (
                          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => {
                            setGraphNodeDrawerOpen(false); openPage(row.sourceId)
                          }}>{v}</Button>
                        ),
                      },
                      { title: '关系', dataIndex: 'rel', key: 'rel', width: 100 },
                    ]}
                  />
                </>
              )}
              {outEdges.length === 0 && inEdges.length === 0 && (
                <Empty description="该页面暂无与其他页面的引用关系" />
              )}
            </div>
          )
        })()}
      </Drawer>

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
            onLinkClick={(slug) => { openPage(slug) }}
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
            <WikiPageRenderer content={queryAnswer} onLinkClick={(slug) => { setQueryOpen(false); openPage(slug) }} />
          </div>
        )}
      </Drawer>

      {/* Text Input Modal */}
      <Modal
        open={textModalOpen}
        title="输入文本内容"
        okText="提交"
        cancelText="取消"
        confirmLoading={textSubmitting}
        onOk={handleTextSubmit}
        onCancel={() => { setTextModalOpen(false); textForm.resetFields() }}
        width={720}
        destroyOnClose
      >
        <Form form={textForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="文档标题（将作为文件名保存）" maxLength={100} />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容（支持 Markdown 格式）"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea
              rows={16}
              placeholder="在此粘贴或输入文本内容，支持 Markdown 格式…"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
