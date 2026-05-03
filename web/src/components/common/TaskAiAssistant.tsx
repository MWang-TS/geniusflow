import { useState, useRef, useEffect, useCallback } from 'react'
import { Drawer, Button, Input, Space, Spin, Tag, Divider } from 'antd'
import {
  RobotOutlined,
  SendOutlined,
  ClearOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat, type ChatMessage } from '../../api/ai-assistant'

interface NodeContext {
  nodeName: string
  instructions?: string
  requirements?: string
  acceptanceCriteria?: string
  deliverables?: string[]
  inputFields?: Array<{ name: string; type: string; required?: boolean; description?: string }>
}

interface TaskAiAssistantProps {
  open: boolean
  onClose: () => void
  nodeContext: NodeContext
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function buildContextPrompt(ctx: NodeContext): string {
  const lines: string[] = [`我正在执行任务【${ctx.nodeName}】，请为我提供完成指导，包括如何高质量完成本任务、需要注意的标准和要求。\n\n以下是任务详情：`]

  if (ctx.instructions) {
    lines.push(`**行动说明：**\n${ctx.instructions}`)
  }
  if (ctx.requirements) {
    lines.push(`**质量要求：**\n${ctx.requirements}`)
  }
  if (ctx.acceptanceCriteria) {
    lines.push(`**验收标准：**\n${ctx.acceptanceCriteria}`)
  }
  if (ctx.deliverables && ctx.deliverables.length > 0) {
    lines.push(`**需要交付的成果：**\n${ctx.deliverables.map((d) => `- ${d}`).join('\n')}`)
  }
  if (ctx.inputFields && ctx.inputFields.length > 0) {
    lines.push(`**需要填写的输入字段：**\n${ctx.inputFields.map((f) => `- ${f.name}（${f.type}${f.required ? '，必填' : ''}）${f.description ? '：' + f.description : ''}`).join('\n')}`)
  }

  lines.push('\n请给出详细的完成步骤和注意事项。')
  return lines.join('\n\n')
}

export default function TaskAiAssistant({ open, onClose, nodeContext }: TaskAiAssistantProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingText, setThinkingText] = useState('')
  const [guided, setGuided] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingText])

  // Reset when node changes
  useEffect(() => {
    setMessages([])
    setGuided(false)
    setThinkingText('')
  }, [nodeContext.nodeName])

  const sendMessage = useCallback(
    async (text: string, historyOverride?: ChatMessage[]) => {
      if (!text.trim() || loading) return

      const userMsg: DisplayMessage = { id: Date.now().toString(), role: 'user', content: text }
      const assistantId = (Date.now() + 1).toString()
      const assistantMsg: DisplayMessage = { id: assistantId, role: 'assistant', content: '' }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setLoading(true)
      setThinkingText('')

      const history: ChatMessage[] = historyOverride ??
        messages.map((m) => ({ role: m.role, content: m.content }))

      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        await streamChat(
          text,
          history,
          (chunk) => {
            if (chunk.type === 'text' && chunk.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + chunk.content } : m,
                ),
              )
              setThinkingText('')
            } else if (chunk.type === 'tool_start' && chunk.tools) {
              setThinkingText(`正在查询相关信息...`)
            } else if (chunk.type === 'error' && chunk.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: `⚠️ ${chunk.content}` } : m,
                ),
              )
              setThinkingText('')
            } else if (chunk.type === 'done') {
              setThinkingText('')
            }
          },
          ctrl.signal,
        )
      } catch (e: unknown) {
        if ((e as Error).name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: '⚠️ 连接失败，请稍后重试' } : m,
            ),
          )
        }
      } finally {
        setLoading(false)
        setThinkingText('')
        abortRef.current = null
      }
    },
    [loading, messages],
  )

  const handleGetGuidance = useCallback(() => {
    setGuided(true)
    const prompt = buildContextPrompt(nodeContext)
    sendMessage(prompt, [])
  }, [nodeContext, sendMessage])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessage(text)
  }, [input, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    abortRef.current?.abort()
    setLoading(false)
    setThinkingText('')
    setMessages([])
    setGuided(false)
  }

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined style={{ color: '#1677ff' }} />
          <span>AI任务助手</span>
          <Tag color="blue">{nodeContext.nodeName}</Tag>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={480}
      styles={{ body: { display: 'flex', flexDirection: 'column', padding: 0, height: '100%' } }}
      extra={
        messages.length > 0 && (
          <Button size="small" icon={<ClearOutlined />} onClick={handleClear} type="text">
            清空
          </Button>
        )
      }
    >
      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <RobotOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#262626' }}>
              AI任务助手
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.7 }}>
              我可以帮你理解任务要求、提供完成步骤指导、解答执行过程中的疑问。
            </div>
            <Button
              type="primary"
              icon={<BulbOutlined />}
              size="large"
              onClick={handleGetGuidance}
              loading={loading}
            >
              获取任务完成指导
            </Button>
            <Divider />
            <div style={{ fontSize: 12, color: '#aaa', textAlign: 'left' }}>
              <div style={{ fontWeight: 500, marginBottom: 6, color: '#666' }}>也可以直接提问，例如：</div>
              {['这个任务的验收标准是什么？', '如何高质量完成这项工作？', '交付物应该包含哪些内容？'].map((q) => (
                <div
                  key={q}
                  onClick={() => { setInput(q) }}
                  style={{
                    cursor: 'pointer', padding: '5px 10px', marginBottom: 4,
                    background: '#f5f5f5', borderRadius: 6, color: '#1677ff',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e6f4ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                >
                  {q}
                </div>
              ))}
            </div>
          </div>
        )}

        <style>{`
          .task-ai-md { font-size: 13px; line-height: 1.75; color: #333; }
          .task-ai-md p { margin: 0 0 6px; }
          .task-ai-md p:last-child { margin-bottom: 0; }
          .task-ai-md h1, .task-ai-md h2, .task-ai-md h3 {
            font-size: 14px; font-weight: 600; margin: 10px 0 4px;
          }
          .task-ai-md ul, .task-ai-md ol { margin: 4px 0 6px; padding-left: 18px; }
          .task-ai-md li { margin-bottom: 3px; }
          .task-ai-md code {
            background: rgba(0,0,0,0.07); padding: 1px 5px;
            border-radius: 4px; font-family: monospace; font-size: 12px;
          }
          .task-ai-md pre {
            background: rgba(0,0,0,0.06); padding: 8px 10px;
            border-radius: 6px; overflow-x: auto; margin: 6px 0;
          }
          .task-ai-md table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12px; }
          .task-ai-md th, .task-ai-md td {
            border: 1px solid #ddd; padding: 5px 8px; text-align: left;
          }
          .task-ai-md th { background: #f5f5f5; font-weight: 600; }
          .task-ai-md blockquote {
            border-left: 3px solid #1677ff; margin: 6px 0; padding: 4px 10px;
            background: #f0f5ff; border-radius: 0 4px 4px 0; color: #555;
          }
        `}</style>

        {messages.map((msg) => {
          // Hide the initial context prompt from user (show as compact label)
          const isInitialGuide = guided && msg === messages[0] && msg.role === 'user'
          if (isInitialGuide) {
            return (
              <div key={msg.id} style={{ marginBottom: 12, textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', background: '#e6f4ff', color: '#1677ff',
                  borderRadius: 12, padding: '4px 12px', fontSize: 12,
                }}>
                  <BulbOutlined style={{ marginRight: 4 }} />获取任务完成指导
                </span>
              </div>
            )
          }

          if (msg.role === 'user') {
            return (
              <div key={msg.id} style={{ marginBottom: 12, textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', maxWidth: '80%', background: '#1677ff',
                  color: '#fff', borderRadius: '12px 12px 2px 12px',
                  padding: '8px 12px', fontSize: 13, textAlign: 'left',
                }}>
                  {msg.content}
                </span>
              </div>
            )
          }

          return (
            <div key={msg.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: '#1677ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                }}>
                  <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
                </div>
                <div style={{
                  flex: 1, background: '#f5f5f5', borderRadius: '2px 12px 12px 12px',
                  padding: '10px 14px',
                }}>
                  {msg.content ? (
                    <ReactMarkdown className="task-ai-md" remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <Spin indicator={<span style={{ fontSize: 12 }}>思考中...</span>} size="small" />
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {thinkingText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: '#1677ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
            </div>
            <div style={{ background: '#f5f5f5', borderRadius: '2px 12px 12px 12px', padding: '8px 14px' }}>
              <Spin size="small" style={{ marginRight: 8 }} />
              <span style={{ fontSize: 12, color: '#888' }}>{thinkingText}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid #f0f0f0', padding: '12px 16px',
        background: '#fafafa',
      }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="有任何疑问都可以问我... (Enter 发送，Shift+Enter 换行)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            style={{ resize: 'none' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{ height: 'auto', alignSelf: 'flex-end' }}
          >
            发送
          </Button>
        </Space.Compact>
      </div>
    </Drawer>
  )
}
