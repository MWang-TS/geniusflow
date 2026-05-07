import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, Tooltip, Spin, Typography, Select } from 'antd'
import {
  RobotOutlined,
  CloseOutlined,
  SendOutlined,
  ClearOutlined,
  LoadingOutlined,
  BookOutlined,
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat, type ChatMessage } from '../../api/ai-assistant'
import { useAiAssistantStore } from '../../stores/ai-assistant.store'
import { knowledgeBaseApi, type KnowledgeBaseItem } from '../../api/knowledge-base'

const { Text } = Typography

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string // tool execution info
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingText, setThinkingText] = useState('')
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([])
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const [showKbSelector, setShowKbSelector] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const pendingMessage = useAiAssistantStore((s) => s.pendingMessage)
  const clearPending = useAiAssistantStore((s) => s.clearPending)
  // Ref so the effect can call the latest handleSend without stale closure
  const sendRef = useRef<((text: string) => Promise<void>) | null>(null)

  useEffect(() => {
    knowledgeBaseApi.list().then((res: any) => {
      const list = res?.data?.list ?? []
      setKnowledgeBases(Array.isArray(list) ? list : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingText])

  useEffect(() => {
    if (open && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, loading])

  const handleSend = useCallback(async (forcedText?: string) => {
    const text = (forcedText ?? input).trim()
    if (!text || loading) return

    const userMsg: DisplayMessage = { id: Date.now().toString(), role: 'user', content: text }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: DisplayMessage = { id: assistantId, role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    if (!forcedText) setInput('')
    setLoading(true)
    setThinkingText('')

    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }))

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
            const toolNames: Record<string, string> = {
              get_my_tasks: '查询我的任务',
              get_process_instances: '查询流程实例',
              get_process_definitions: '查询流程定义',
              get_notifications: '查询通知',
              get_instance_detail: '查询实例详情',
            }
            const labels = chunk.tools.map((t) => toolNames[t] || t).join('、')
            setThinkingText(`正在${labels}...`)
          } else if (chunk.type === 'error' && chunk.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `⚠️ ${chunk.content}` }
                  : m,
              ),
            )
            setThinkingText('')
          } else if (chunk.type === 'done') {
            setThinkingText('')
          }
        },
        ctrl.signal,
        selectedKbIds,
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
  }, [input, loading, messages, selectedKbIds])

  // Keep sendRef up to date so the pending effect can always call latest version
  useEffect(() => {
    sendRef.current = handleSend
  }, [handleSend])

  // Handle messages pushed from outside (e.g. NodeExecutionPage)
  useEffect(() => {
    if (!pendingMessage) return
    clearPending()
    setOpen(true)
    // Small delay to let the dialog open first
    setTimeout(() => {
      sendRef.current?.(pendingMessage)
    }, 120)
  }, [pendingMessage, clearPending])

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
      setThinkingText('')
    }
    setMessages([])
  }

  return (
    <>
      {/* Markdown styles */}
      <style>{`
        .ai-markdown { font-size: 13px; line-height: 1.7; color: #333; }
        .ai-markdown p { margin: 0 0 6px; }
        .ai-markdown p:last-child { margin-bottom: 0; }
        .ai-markdown h1, .ai-markdown h2, .ai-markdown h3 {
          font-size: 14px; font-weight: 600; margin: 8px 0 4px;
        }
        .ai-markdown ul, .ai-markdown ol {
          margin: 4px 0 6px; padding-left: 18px;
        }
        .ai-markdown li { margin-bottom: 2px; }
        .ai-markdown code {
          background: rgba(0,0,0,0.07); padding: 1px 5px;
          border-radius: 4px; font-family: monospace; font-size: 12px;
        }
        .ai-markdown pre {
          background: rgba(0,0,0,0.06); padding: 8px 10px;
          border-radius: 6px; overflow-x: auto; margin: 6px 0;
        }
        .ai-markdown pre code { background: none; padding: 0; }
        .ai-markdown blockquote {
          border-left: 3px solid #d9d9d9; margin: 4px 0;
          padding-left: 10px; color: #666;
        }
        .ai-markdown strong { font-weight: 600; }
        .ai-markdown a { color: #1677ff; }
        .ai-markdown hr { border: none; border-top: 1px solid #eee; margin: 8px 0; }
        .ai-markdown table { border-collapse: collapse; width: 100%; font-size: 12px; display: block; overflow-x: auto; }
        .ai-markdown th, .ai-markdown td { border: 1px solid #e8e8e8; padding: 4px 8px; }
        .ai-markdown th { background: #fafafa; font-weight: 600; }
      `}</style>

      {/* Floating button */}
      <Tooltip title="AI助手" placement="left">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<RobotOutlined style={{ fontSize: 22 }} />}
          onClick={() => setOpen((v) => !v)}
          style={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            width: 56,
            height: 56,
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            background: open ? '#1677ff' : undefined,
          }}
        />
      </Tooltip>

      {/* Dialog */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 100,
            right: 32,
            width: 440,
            height: 560,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RobotOutlined style={{ fontSize: 18 }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>GeniusFlow AI助手</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Tooltip title="选择知识库">
                <Button
                  type="text"
                  icon={<BookOutlined />}
                  size="small"
                  style={{ color: selectedKbIds.length > 0 ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: selectedKbIds.length > 0 ? 600 : undefined }}
                  onClick={() => setShowKbSelector((v) => !v)}
                />
              </Tooltip>
              <Tooltip title="清空对话">
                <Button
                  type="text"
                  icon={<ClearOutlined />}
                  size="small"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                  onClick={handleClear}
                />
              </Tooltip>
              <Button
                type="text"
                icon={<CloseOutlined />}
                size="small"
                style={{ color: 'rgba(255,255,255,0.85)' }}
                onClick={() => setOpen(false)}
              />
            </div>
          </div>

          {/* KB selector panel */}
          {showKbSelector && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>选择知识库（可多选）</div>
              <Select
                mode="multiple"
                allowClear
                size="small"
                placeholder="不选则不检索知识库"
                value={selectedKbIds}
                onChange={setSelectedKbIds}
                style={{ width: '100%' }}
                options={knowledgeBases.map((kb) => ({ label: kb.name, value: kb.id }))}
              />
            </div>
          )}

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 12px 4px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 48 }}>
                <RobotOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />
                <div style={{ color: '#aaa', marginTop: 12, fontSize: 13 }}>
                  你好！我是GeniusFlow AI助手
                  <br />
                  可以问我系统使用问题，或查询流程、任务信息
                </div>
                <div
                  style={{
                    marginTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  {[
                    '我有哪些待办任务？',
                    '如何创建一个新的流程？',
                    '最近有哪些运行中的流程？',
                  ].map((q) => (
                    <Button
                      key={q}
                      size="small"
                      style={{ fontSize: 12, height: 'auto', padding: '4px 10px', whiteSpace: 'normal', textAlign: 'left' }}
                      onClick={() => { setInput(q) }}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '82%',
                    padding: '8px 12px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    fontSize: 13,
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.role === 'assistant' && msg.content === '' && loading ? (
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} />} size="small" />
                  ) : msg.role === 'user' ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                  ) : (
                    <div className="ai-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {thinkingText && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 12 }} />} size="small" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {thinkingText}
                </Text>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '8px 12px 12px',
              borderTop: '1px solid #f0f0f0',
              flexShrink: 0,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <Input.TextArea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，Enter发送，Shift+Enter换行"
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
              style={{ borderRadius: 8, fontSize: 13, flex: 1 }}
            />
            <Button
              type="primary"
              icon={loading ? <LoadingOutlined /> : <SendOutlined />}
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{ borderRadius: 8, flexShrink: 0, height: 36 }}
            />
          </div>
        </div>
      )}
    </>
  )
}
