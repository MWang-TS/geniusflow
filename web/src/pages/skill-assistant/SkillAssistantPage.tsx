import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Layout, Select, Checkbox, Button, Input, Typography, Spin, Space, Tag, Divider, Empty, Tooltip,
} from 'antd'
import {
  SendOutlined, RobotOutlined, UserOutlined, ClearOutlined, LoadingOutlined,
} from '@ant-design/icons'
import { streamSkillChat, skillChatApi, type SkillChatMessage, type SkillChatChunk } from '@/api/skill-chat'

const { Sider, Content } = Layout
const { Text, Paragraph } = Typography
const { TextArea } = Input

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  toolCalling?: string  // tool name currently being called
}

export default function SkillAssistantPage() {
  const [agentRoles, setAgentRoles] = useState<Array<{ id: string; name: string; description?: string }>>([])
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>()
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    skillChatApi.listAgentRoles().then((res: any) => {
      const roles = res?.data ?? res ?? []
      setAgentRoles(Array.isArray(roles) ? roles : [])
    }).catch(() => {})
    skillChatApi.listKnowledgeBases().then((res: any) => {
      const kbs = res?.data ?? res ?? []
      setKnowledgeBases(Array.isArray(kbs) ? kbs : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', pending: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    const history: SkillChatMessage[] = messages
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }))

    abortRef.current = new AbortController()

    try {
      await streamSkillChat(
        text,
        history,
        selectedKbIds,
        selectedRoleId,
        (chunk: SkillChatChunk) => {
          if (chunk.type === 'tool_call' && chunk.name) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, toolCalling: chunk.name, pending: true }
                  : m,
              ),
            )
          } else if (chunk.type === 'text' && chunk.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content + chunk.content, pending: true, toolCalling: undefined }
                  : m,
              ),
            )
          } else if (chunk.type === 'done') {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m)),
            )
            setLoading(false)
          } else if (chunk.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: `⚠️ ${chunk.content ?? '请求失败'}`, pending: false }
                  : m,
              ),
            )
            setLoading(false)
          }
        },
        abortRef.current.signal,
      )
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: '⚠️ 连接中断，请重试', pending: false }
              : m,
          ),
        )
      }
      setLoading(false)
    }
  }, [input, loading, messages, selectedKbIds, selectedRoleId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    if (loading) {
      abortRef.current?.abort()
      setLoading(false)
    }
    setMessages([])
  }

  return (
    <Layout style={{ height: 'calc(100vh - 112px)', background: 'transparent' }}>
      {/* Left panel: configuration */}
      <Sider
        width={260}
        style={{ background: '#fafafa', borderRight: '1px solid #f0f0f0', padding: 16, overflow: 'auto' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong style={{ fontSize: 12, color: '#666' }}>AI 角色</Text>
            <Select
              style={{ width: '100%', marginTop: 6 }}
              placeholder="使用默认助理"
              allowClear
              value={selectedRoleId}
              onChange={setSelectedRoleId}
              options={agentRoles.map((r) => ({ value: r.id, label: r.name }))}
              optionRender={(opt) => {
                const role = agentRoles.find((r) => r.id === opt.value)
                return (
                  <div>
                    <div style={{ fontWeight: 500 }}>{opt.label}</div>
                    {role?.description && <div style={{ fontSize: 11, color: '#999' }}>{role.description}</div>}
                  </div>
                )
              }}
            />
          </div>

          <Divider style={{ margin: '4px 0' }} />

          <div>
            <Text strong style={{ fontSize: 12, color: '#666' }}>知识库范围</Text>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
              不选则不使用知识库
            </Text>
            {knowledgeBases.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>暂无可用知识库</Text>
            ) : (
              <Checkbox.Group
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                value={selectedKbIds}
                onChange={(vals) => setSelectedKbIds(vals as string[])}
              >
                {knowledgeBases.map((kb) => (
                  <Checkbox key={kb.id} value={kb.id}>
                    <span style={{ fontSize: 13 }}>{kb.name}</span>
                    <Tag style={{ marginLeft: 4, fontSize: 10 }} color="default">{kb.type}</Tag>
                  </Checkbox>
                ))}
              </Checkbox.Group>
            )}
          </div>

          <Divider style={{ margin: '4px 0' }} />

          <Tooltip title="清空对话历史">
            <Button icon={<ClearOutlined />} size="small" onClick={handleClear} style={{ width: '100%' }}>
              清空对话
            </Button>
          </Tooltip>
        </Space>
      </Sider>

      {/* Right panel: chat */}
      <Content style={{ display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {messages.length === 0 ? (
            <Empty
              image={<RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
              description={
                <Space direction="vertical" size={4}>
                  <Text>企业技能库 AI 助理</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    选择知识库和AI角色，开始提问
                  </Text>
                </Space>
              }
              style={{ marginTop: 80 }}
            />
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 16,
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: '#1677ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                    color: msg.role === 'user' ? '#fff' : 'inherit',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.pending && !msg.content && !msg.toolCalling ? (
                    <Spin indicator={<LoadingOutlined />} size="small" />
                  ) : msg.toolCalling ? (
                    <Space size={6}>
                      <Spin indicator={<LoadingOutlined />} size="small" />
                      <Text style={{ fontSize: 13, color: '#666' }}>正在调用工具：<Tag color="blue">{msg.toolCalling}</Tag></Text>
                    </Space>
                  ) : (
                    <Paragraph style={{ margin: 0, color: 'inherit', whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                      {msg.pending && <span style={{ opacity: 0.5 }}>▊</span>}
                    </Paragraph>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: '#f0f0f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <UserOutlined style={{ fontSize: 16 }} />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，按 Enter 发送（Shift+Enter 换行）"
              autoSize={{ minRows: 1, maxRows: 5 }}
              disabled={loading}
              style={{ flex: 1, borderRadius: 8 }}
            />
            <Button
              type="primary"
              icon={loading ? <LoadingOutlined /> : <SendOutlined />}
              onClick={handleSend}
              disabled={!input.trim() || loading}
              style={{ height: 40 }}
            >
              发送
            </Button>
          </div>
          {selectedKbIds.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {selectedKbIds.map((id) => {
                const kb = knowledgeBases.find((k) => k.id === id)
                return kb ? <Tag key={id} color="blue" style={{ fontSize: 11 }}>{kb.name}</Tag> : null
              })}
            </div>
          )}
        </div>
      </Content>
    </Layout>
  )
}
