import { useState, useEffect } from 'react'
import {
  Card, Form, Input, Button, Alert, Space, Typography, Divider, App, Tag,
} from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, SaveOutlined } from '@ant-design/icons'
import { aiSettingsApi } from '@/api/ai-settings'

const { Title, Paragraph, Text } = Typography

export default function MineruTab() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [maskedKey, setMaskedKey] = useState('')
  const [newKey, setNewKey] = useState('')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const res = await aiSettingsApi.getMineruConfig()
      const data = (res as any)?.data ?? res
      setHasKey(data.hasKey)
      setMaskedKey(data.apiKey || '')
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!newKey.trim()) {
      message.warning('请输入 API Key')
      return
    }
    setSaving(true)
    try {
      await aiSettingsApi.saveMineruConfig(newKey.trim())
      message.success('MinerU API Key 保存成功')
      setNewKey('')
      loadConfig()
    } catch {
      message.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    try {
      await aiSettingsApi.saveMineruConfig('')
      message.success('API Key 已清除')
      setHasKey(false)
      setMaskedKey('')
    } catch {
      message.error('清除失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <Title level={5} style={{ marginBottom: 4 }}>MinerU 文档解析服务</Title>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        配置 MinerU 云端 API Key 以启用高精度文档解析（PDF、PPTX、DOCX 等）。
        未配置时将自动使用免费的轻量版 API（限 10 MB / 20 页）或本地 markitdown 解析。
      </Paragraph>

      <Alert
        icon={<InfoCircleOutlined />}
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="解析模式优先级"
        description={
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li><Text strong>MinerU Precision（本配置）</Text> — VLM 模型，支持复杂 PDF / 扫描件 / 公式表格，免费 1000 页/天</li>
            <li><Text strong>MinerU 轻量版</Text> — 无需 Key，IP 限速，≤10 MB / 20 页，自动回退</li>
            <li><Text strong>markitdown（本地）</Text> — MIT 开源，无网络依赖，适合 Office 文档</li>
          </ol>
        }
      />

      <Card
        title="API Key 配置"
        loading={loading}
        extra={
          hasKey
            ? <Tag icon={<CheckCircleOutlined />} color="success">已配置</Tag>
            : <Tag icon={<CloseCircleOutlined />} color="default">未配置</Tag>
        }
      >
        {hasKey && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">当前 Key：</Text>
            <Text code>{maskedKey}</Text>
            <Button
              danger
              size="small"
              style={{ marginLeft: 12 }}
              onClick={handleClear}
              loading={saving}
            >
              清除 Key
            </Button>
          </div>
        )}

        <Form layout="vertical">
          <Form.Item
            label={hasKey ? '更新 API Key' : '输入 API Key'}
            help={
              <span>
                前往{' '}
                <a href="https://mineru.net" target="_blank" rel="noopener noreferrer">
                  mineru.net
                </a>{' '}
                注册并在控制台创建 API Key
              </span>
            }
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input.Password
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="输入 MinerU API Key（Bearer token）"
                onPressEnter={handleSave}
              />
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                保存
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>

        <Divider />

        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <InfoCircleOutlined style={{ marginRight: 6 }} />
          API Key 存储在系统配置中，仅在服务端使用，不会暴露给前端用户。
          免费配额：Precision 模型 1000 页/天，文件上限 200 MB。
        </Paragraph>
      </Card>
    </div>
  )
}
