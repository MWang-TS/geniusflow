import { useState, useEffect, useCallback } from 'react'
import {
  Button, Table, Modal, Form, Input, Select, DatePicker, message, Space, Tag,
  Typography, Card, Tabs, Descriptions, Alert, Tooltip, Popconfirm, Empty,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CopyOutlined, EyeOutlined, CodeOutlined,
} from '@ant-design/icons'
import { openApiClient, type ApiKey, type CreateApiKeyRequest } from '@/api/open-api'
import { skillChatApi } from '@/api/skill-chat'
import dayjs from 'dayjs'

const { Text, Title } = Typography

export default function ApiPlatformPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: string; name: string }>>([])
  const [agentRoles, setAgentRoles] = useState<Array<{ id: string; name: string }>>([])
  const [form] = Form.useForm()
  const [creating, setCreating] = useState(false)

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true)
    try {
      const res = await openApiClient.listKeys()
      const data = (res as any)?.data ?? res
      setKeys(Array.isArray(data) ? data : [])
    } catch {
      message.error('加载 API 密钥失败')
    } finally {
      setLoadingKeys(false)
    }
  }, [])

  useEffect(() => {
    loadKeys()
    skillChatApi.listKnowledgeBases().then((res: any) => {
      const kbs = res?.data ?? res ?? []
      setKnowledgeBases(Array.isArray(kbs) ? kbs : [])
    }).catch(() => {})
    skillChatApi.listAgentRoles().then((res: any) => {
      const roles = res?.data ?? res ?? []
      setAgentRoles(Array.isArray(roles) ? roles : [])
    }).catch(() => {})
  }, [loadKeys])

  const handleCreate = async (values: any) => {
    setCreating(true)
    try {
      const req: CreateApiKeyRequest = {
        name: values.name,
        knowledgeBaseIds: values.knowledgeBaseIds ?? [],
        agentRoleId: values.agentRoleId,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
      }
      const res = await openApiClient.createKey(req)
      const result = (res as any)?.data ?? res
      setNewKeyVisible((result as any).rawKey ?? null)
      setCreateModalOpen(false)
      form.resetFields()
      await loadKeys()
    } catch {
      message.error('创建 API 密钥失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await openApiClient.deleteKey(id)
      message.success('已删除')
      await loadKeys()
    } catch {
      message.error('删除失败')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制'))
  }

  const baseUrl = `${window.location.origin}/api/v1/open/v1`

  const codeExamplePython = `import openai

client = openai.OpenAI(
    api_key="YOUR_API_KEY",
    base_url="${baseUrl}",
)

# 流式对话
stream = client.chat.completions.create(
    model="geniusflow",
    messages=[{"role": "user", "content": "你好，请介绍一下公司的产品"}],
    stream=True,
    extra_body={
        "knowledge_base_ids": ["kb_id_1", "kb_id_2"],  # 可选
        "agent_role_id": "role_id",  # 可选
    }
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
`

  const codeExampleCurl = `curl -X POST "${baseUrl}/chat/completions" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "geniusflow",
    "stream": true,
    "messages": [
      {"role": "user", "content": "你好，请介绍公司产品"}
    ],
    "knowledge_base_ids": ["kb_id_1"],
    "agent_role_id": "role_id"
  }'`

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Key 前缀',
      dataIndex: 'keyPrefix',
      key: 'keyPrefix',
      render: (prefix: string) => (
        <Text code style={{ fontSize: 12 }}>{prefix}…</Text>
      ),
    },
    {
      title: '知识库范围',
      dataIndex: 'knowledgeBaseIds',
      key: 'knowledgeBaseIds',
      render: (ids: string[]) =>
        ids.length === 0 ? <Text type="secondary">全部</Text> : (
          <Space size={4} wrap>
            {ids.map((id) => {
              const kb = knowledgeBases.find((k) => k.id === id)
              return <Tag key={id} color="blue">{kb?.name ?? id.slice(0, 8)}</Tag>
            })}
          </Space>
        ),
    },
    {
      title: 'AI 角色',
      dataIndex: 'agentRoleId',
      key: 'agentRoleId',
      render: (id: string | null) => {
        const role = agentRoles.find((r) => r.id === id)
        return role ? <Tag color="green">{role.name}</Tag> : <Text type="secondary">默认</Text>
      },
    },
    {
      title: '调用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      align: 'right' as const,
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (v: string | null) => {
        if (!v) return <Tag color="green">永不过期</Tag>
        const expired = dayjs(v).isBefore(dayjs())
        return <Tag color={expired ? 'red' : 'orange'}>{dayjs(v).format('YYYY-MM-DD')}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '已禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: ApiKey) => (
        <Popconfirm
          title="确认删除此 API 密钥？"
          description="删除后所有使用该密钥的接入将立即失效"
          onConfirm={() => handleDelete(record.id)}
          okText="确认删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button danger icon={<DeleteOutlined />} size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>AI 中台 · API 管理</Title>
          <Text type="secondary">管理企业内部集成 API 密钥，通过 OpenAI 兼容协议接入 GeniusFlow 技能库</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          创建 API 密钥
        </Button>
      </div>

      {/* Newly created key banner */}
      {newKeyVisible && (
        <Alert
          type="success"
          showIcon
          closable
          onClose={() => setNewKeyVisible(null)}
          style={{ marginBottom: 16 }}
          message="API 密钥已创建"
          description={
            <Space direction="vertical" size={4}>
              <Text>请立即复制保存，此密钥仅显示一次：</Text>
              <Space>
                <Text code copyable style={{ fontSize: 13 }}>{newKeyVisible}</Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(newKeyVisible)}
                >
                  复制
                </Button>
              </Space>
            </Space>
          }
        />
      )}

      <Tabs
        items={[
          {
            key: 'keys',
            label: 'API 密钥',
            icon: <EyeOutlined />,
            children: (
              <Table
                columns={columns}
                dataSource={keys}
                rowKey="id"
                loading={loadingKeys}
                pagination={false}
                locale={{ emptyText: <Empty description="暂无 API 密钥，点击右上角创建" /> }}
              />
            ),
          },
          {
            key: 'docs',
            label: '接入文档',
            icon: <CodeOutlined />,
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Card>
                  <Title level={5}>接口信息</Title>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Base URL">
                      <Text code copyable>{baseUrl}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="协议">
                      OpenAI Chat Completions API（兼容格式）
                    </Descriptions.Item>
                    <Descriptions.Item label="认证方式">
                      Bearer Token（API 密钥）
                    </Descriptions.Item>
                    <Descriptions.Item label="流式支持">
                      <Tag color="green">支持 SSE 流式输出</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card>
                  <Title level={5}>Python 示例（openai SDK）</Title>
                  <div style={{
                    background: '#1e1e1e', borderRadius: 8, padding: '16px 20px', position: 'relative',
                  }}>
                    <Tooltip title="复制代码">
                      <Button
                        icon={<CopyOutlined />}
                        size="small"
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => copyToClipboard(codeExamplePython)}
                      />
                    </Tooltip>
                    <pre style={{ color: '#d4d4d4', margin: 0, fontSize: 13, overflowX: 'auto' }}>
                      {codeExamplePython}
                    </pre>
                  </div>
                </Card>

                <Card>
                  <Title level={5}>cURL 示例</Title>
                  <div style={{
                    background: '#1e1e1e', borderRadius: 8, padding: '16px 20px', position: 'relative',
                  }}>
                    <Tooltip title="复制代码">
                      <Button
                        icon={<CopyOutlined />}
                        size="small"
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => copyToClipboard(codeExampleCurl)}
                      />
                    </Tooltip>
                    <pre style={{ color: '#d4d4d4', margin: 0, fontSize: 13, overflowX: 'auto' }}>
                      {codeExampleCurl}
                    </pre>
                  </div>
                </Card>

                <Card>
                  <Title level={5}>扩展参数说明</Title>
                  <Table
                    size="small"
                    pagination={false}
                    columns={[
                      { title: '参数', dataIndex: 'param', key: 'param', render: (v: string) => <Text code>{v}</Text> },
                      { title: '类型', dataIndex: 'type', key: 'type' },
                      { title: '说明', dataIndex: 'desc', key: 'desc' },
                    ]}
                    dataSource={[
                      { key: 1, param: 'knowledge_base_ids', type: 'string[]', desc: '指定查询的知识库 ID 列表；为空则使用密钥绑定的知识库' },
                      { key: 2, param: 'agent_role_id', type: 'string', desc: '指定 AI 角色 ID；为空则使用密钥绑定的角色，或系统默认' },
                      { key: 3, param: 'stream', type: 'boolean', desc: '是否启用流式输出（推荐 true）' },
                    ]}
                  />
                </Card>
              </Space>
            ),
          },
        ]}
      />

      {/* Create key modal */}
      <Modal
        title="创建 API 密钥"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="密钥名称" name="name" rules={[{ required: true, message: '请输入密钥名称' }]}>
            <Input placeholder="如：外部客服系统" />
          </Form.Item>
          <Form.Item label="知识库范围" name="knowledgeBaseIds" extra="不选则允许访问全部知识库">
            <Select
              mode="multiple"
              placeholder="选择允许查询的知识库"
              options={knowledgeBases.map((kb) => ({ value: kb.id, label: kb.name }))}
              allowClear
            />
          </Form.Item>
          <Form.Item label="绑定 AI 角色" name="agentRoleId" extra="不选则使用调用方传入的角色或系统默认">
            <Select
              placeholder="选择 AI 角色"
              options={agentRoles.map((r) => ({ value: r.id, label: r.name }))}
              allowClear
            />
          </Form.Item>
          <Form.Item label="过期时间" name="expiresAt" extra="不选则永不过期">
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(d) => d.isBefore(dayjs(), 'day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
