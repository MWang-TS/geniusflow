import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layout,
  Form,
  Input,
  Select,
  Slider,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  App,
  Divider,
  Badge,
  Card,
  Upload,
  Tooltip,
} from 'antd'
import {
  SendOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  NodeIndexOutlined,
  UploadOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { streamGenerateSop, sopApi, type SopNode, type SopEdge } from '@/api/sop-generator'

const ACCEPT_DOC_TYPES = '.txt,.md,.pdf,.docx'

const { Sider, Content } = Layout
const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

const DOMAIN_OPTIONS = [
  '软件研发', '市场营销', '采购管理', '销售管理', '项目管理',
  '人力资源', '财务管理', '客户服务', '质量管理', '生产制造', '通用',
]

const NODE_TYPE_COLORS: Record<string, string> = {
  start: '#52c41a',
  end: '#ff4d4f',
  task: '#1677ff',
  approval: '#fa8c16',
}

const NODE_TYPE_LABELS: Record<string, string> = {
  start: '开始',
  end: '结束',
  task: '任务',
  approval: '审批',
}

function buildFlowNodes(sopNodes: SopNode[]): Node[] {
  return sopNodes.map((n) => ({
    id: n.id,
    type: 'default',
    position: n.position,
    data: { label: n.label },
    style: {
      background: NODE_TYPE_COLORS[n.type] ?? '#1677ff',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontWeight: 600,
      fontSize: 13,
      minWidth: 100,
    },
  }))
}

function buildFlowEdges(sopEdges: SopEdge[]): Edge[] {
  return sopEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: '#1677ff' },
  }))
}

type GenerateStatus = 'idle' | 'generating' | 'done' | 'error'

const SopGeneratorPage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [sopNodes, setSopNodes] = useState<SopNode[]>([])
  const [sopEdges, setSopEdges] = useState<SopEdge[]>([])
  const [flowNodes, setFlowNodes] = useState<Node[]>([])
  const [flowEdges, setFlowEdges] = useState<Edge[]>([])
  const [processName, setProcessName] = useState('')
  const [processDesc, setProcessDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [roleTag, setRoleTag] = useState('')
  const [roleTags, setRoleTags] = useState<string[]>([])
  const [extracting, setExtracting] = useState(false)
  const [docFileName, setDocFileName] = useState('')

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    const values = await form.validateFields()

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setSopNodes([])
    setSopEdges([])
    setFlowNodes([])
    setFlowEdges([])
    setProcessName('')
    setProcessDesc('')
    setStatus('generating')

    try {
      await streamGenerateSop(
        {
          description: values.description,
          domain: values.domain ?? '通用',
          roleHints: roleTags,
          estimatedSteps: values.estimatedSteps ?? 6,
        },
        (chunk) => {
          if (chunk.type === 'node') {
            const node = chunk.data as SopNode
            setSopNodes((prev) => {
              const next = [...prev, node]
              setFlowNodes(buildFlowNodes(next))
              return next
            })
          } else if (chunk.type === 'edge') {
            const edge = chunk.data as SopEdge
            setSopEdges((prev) => {
              const next = [...prev, edge]
              setFlowEdges(buildFlowEdges(next))
              return next
            })
          } else if (chunk.type === 'done') {
            const d = chunk.data as { processName: string; description: string; nodeCount: number }
            setProcessName(d.processName)
            setProcessDesc(d.description)
            setStatus('done')
          } else if (chunk.type === 'error') {
            const d = chunk.data as { message: string }
            message.error(d.message)
            setStatus('error')
          }
        },
        abortRef.current.signal,
      )
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        message.error('生成失败，请重试')
        setStatus('error')
      }
    }
  }, [form, roleTags, message])

  const handleReset = () => {
    abortRef.current?.abort()
    setSopNodes([])
    setSopEdges([])
    setFlowNodes([])
    setFlowEdges([])
    setProcessName('')
    setProcessDesc('')
    setStatus('idle')
  }

  const handleSave = async () => {
    if (!processName || sopNodes.length === 0) return
    setSaving(true)
    try {
      const res = await sopApi.save({
        processName,
        description: processDesc,
        nodes: sopNodes,
        edges: sopEdges,
      })
      message.success('已保存为草稿，正在跳转编辑器…')
      navigate(`/processes/${res.data.id}/edit`)
    } catch {
      message.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDocUpload = useCallback(async (file: File) => {
    setExtracting(true)
    setDocFileName(file.name)
    try {
      const result = await sopApi.extractDoc(file)
      form.setFieldValue('description', result.text)
      message.success(`已从「${file.name}」提取 ${result.length.toLocaleString()} 个字符`)
    } catch (err: any) {
      message.error(err?.message || '文档解析失败')
      setDocFileName('')
    } finally {
      setExtracting(false)
    }
    return false // prevent antd auto-upload
  }, [form, message])

  const addRoleTag = () => {
    const v = roleTag.trim()
    if (v && !roleTags.includes(v)) {
      setRoleTags((prev) => [...prev, v])
    }
    setRoleTag('')
  }

  const removeRoleTag = (tag: string) => {
    setRoleTags((prev) => prev.filter((t) => t !== tag))
  }

  const isGenerating = status === 'generating'
  const isDone = status === 'done'
  const hasResult = sopNodes.length > 0

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      {/* ─── Left Panel ─── */}
      <Sider
        width={340}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          padding: '20px 16px',
          overflow: 'auto',
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Space align="center">
            <RobotOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={5} style={{ margin: 0 }}>
              AI 生成 SOP 流程
            </Title>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            用自然语言描述业务场景，AI 将自动生成完整的标准操作流程
          </Text>
        </Space>

        <Divider style={{ margin: '16px 0' }} />

        <Form form={form} layout="vertical" size="small">
          <Form.Item
            label={
              <Space size={4}>
                <span>流程描述</span>
                <Tooltip title="支持直接粘贴长文本，或上传 txt / md / pdf / docx 文档自动提取内容">
                  <Upload
                    accept={ACCEPT_DOC_TYPES}
                    showUploadList={false}
                    beforeUpload={handleDocUpload}
                  >
                    <Button
                      size="small"
                      icon={extracting ? <Spin size="small" /> : <UploadOutlined />}
                      disabled={extracting}
                      style={{ fontSize: 12 }}
                    >
                      {extracting ? '解析中…' : '导入文档'}
                    </Button>
                  </Upload>
                </Tooltip>
                {docFileName && (
                  <Tag
                    icon={<FileTextOutlined />}
                    color="blue"
                    closable
                    onClose={() => setDocFileName('')}
                    style={{ fontSize: 11 }}
                  >
                    {docFileName}
                  </Tag>
                )}
              </Space>
            }
            name="description"
            rules={[{ required: true, message: '请描述业务场景' }, { min: 10, message: '描述至少10个字' }]}
          >
            <TextArea
              placeholder="粘贴业务场景描述，或点击「导入文档」上传 txt / md / pdf / docx 文件（支持上万字的复杂流程）"
              rows={8}
              style={{ fontSize: 12 }}
            />
          </Form.Item>

          <Form.Item label="业务领域" name="domain" initialValue="软件研发">
            <Select placeholder="选择业务领域">
              {DOMAIN_OPTIONS.map((d) => (
                <Option key={d} value={d}>
                  {d}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="涉及角色（可选）">
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <Input.Search
                placeholder="输入角色名后回车添加"
                value={roleTag}
                onChange={(e) => setRoleTag(e.target.value)}
                onSearch={addRoleTag}
                onPressEnter={addRoleTag}
                enterButton="添加"
                size="small"
              />
              <Space wrap size={4}>
                {roleTags.map((t) => (
                  <Tag
                    key={t}
                    closable
                    onClose={() => removeRoleTag(t)}
                    color="blue"
                    style={{ fontSize: 12 }}
                  >
                    {t}
                  </Tag>
                ))}
              </Space>
            </Space>
          </Form.Item>

          <Form.Item
            label={`预期节点数：${form.getFieldValue('estimatedSteps') ?? 6}`}
            name="estimatedSteps"
            initialValue={6}
          >
            <Slider min={3} max={15} marks={{ 3: '3', 6: '6', 10: '10', 15: '15' }} />
          </Form.Item>
        </Form>

        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            block
            loading={isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? '生成中…' : '开始生成'}
          </Button>

          {hasResult && (
            <Button icon={<ReloadOutlined />} block onClick={handleReset} disabled={isGenerating}>
              重新生成
            </Button>
          )}
        </Space>

        {/* Status indicator */}
        {isGenerating && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              正在生成节点…（{sopNodes.length} 个）
            </Text>
          </div>
        )}

        {isDone && (
          <Card size="small" style={{ marginTop: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Space direction="vertical" size={4}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text strong style={{ fontSize: 13 }}>
                  {processName}
                </Text>
              </Space>
              {processDesc && (
                <Paragraph style={{ fontSize: 12, margin: 0 }} type="secondary">
                  {processDesc}
                </Paragraph>
              )}
              <Text style={{ fontSize: 12 }}>
                共 {sopNodes.length} 个节点
              </Text>
            </Space>
          </Card>
        )}

        {status === 'error' && (
          <Card size="small" style={{ marginTop: 16, background: '#fff2f0', borderColor: '#ffccc7' }}>
            <Space>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <Text type="danger" style={{ fontSize: 13 }}>
                生成失败，请检查 AI 配置后重试
              </Text>
            </Space>
          </Card>
        )}

        {/* Node legend */}
        {hasResult && (
          <>
            <Divider style={{ margin: '16px 0 8px' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>节点类型</Text>
            <Space wrap size={6} style={{ marginTop: 6 }}>
              {Object.entries(NODE_TYPE_LABELS).map(([type, label]) => (
                <Badge
                  key={type}
                  color={NODE_TYPE_COLORS[type]}
                  text={<Text style={{ fontSize: 12 }}>{label}</Text>}
                />
              ))}
            </Space>

            <Divider style={{ margin: '12px 0 8px' }} />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              block
              loading={saving}
              disabled={!isDone}
              onClick={handleSave}
              style={{ marginBottom: 8 }}
            >
              保存为草稿并编辑
            </Button>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center' }}>
              保存后可在流程编辑器中进一步调整
            </Text>
          </>
        )}
      </Sider>

      {/* ─── Right Panel: React Flow Preview ─── */}
      <Content style={{ position: 'relative', background: '#fafafa' }}>
        {!hasResult && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bfbfbf',
              gap: 12,
            }}
          >
            <NodeIndexOutlined style={{ fontSize: 64 }} />
            <Text type="secondary" style={{ fontSize: 15 }}>
              填写左侧信息后点击「开始生成」，流程节点将在此实时显示
            </Text>
          </div>
        )}

        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={isDone}
          nodesConnectable={false}
          elementsSelectable={isDone}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          {hasResult && <MiniMap />}
        </ReactFlow>
      </Content>
    </Layout>
  )
}

export default SopGeneratorPage
