import { useState, useRef } from 'react'
import { Card, Tabs, Button, Space, Tooltip, message } from 'antd'
import {
  ApiOutlined, MessageOutlined, DatabaseOutlined, ThunderboltOutlined, RobotOutlined,
  BranchesOutlined, DownloadOutlined, UploadOutlined,
} from '@ant-design/icons'
import ProvidersTab from './ProvidersTab'
import ModelsTab from './ModelsTab'
import SkillsTab from './SkillsTab'
import AgentRolesTab from './AgentRolesTab'
import FallbackTab from './FallbackTab'
import { aiSettingsApi } from '@/api/ai-settings'

const TABS = [
  {
    key: 'providers',
    label: <span><ApiOutlined /> AI 提供商</span>,
    children: <ProvidersTab />,
  },
  {
    key: 'chat-models',
    label: <span><MessageOutlined /> 对话模型管理</span>,
    children: <ModelsTab lockedType="chat" />,
  },
  {
    key: 'embedding-models',
    label: <span><DatabaseOutlined /> 知识库模型管理</span>,
    children: <ModelsTab lockedType="embedding" />,
  },
  {
    key: 'fallback',
    label: <span><BranchesOutlined /> Fallback 链</span>,
    children: <FallbackTab />,
  },
  {
    key: 'skills',
    label: <span><ThunderboltOutlined /> Agent 技能</span>,
    children: <SkillsTab />,
  },
  {
    key: 'agent-roles',
    label: <span><RobotOutlined /> Agent 角色</span>,
    children: <AgentRolesTab />,
  },
]

export default function AiSettingsPage() {
  const [activeTab, setActiveTab] = useState('providers')
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await aiSettingsApi.exportConfig()
      const data = (res as any)?.data ?? res
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `geniusflow-ai-settings-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch {
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await aiSettingsApi.importConfig(json)
      const result = (res as any)?.data ?? res
      const s = result.summary
      message.success(
        `导入成功：提供商 ${s.providers}，模型 ${s.models}，技能 ${s.skills}，角色 ${s.agentRoles}，Fallback ${s.fallbacks}`,
        5,
      )
      // Reload the page to reflect new data
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) {
      message.error(`导入失败：${err?.response?.data?.message ?? err?.message ?? '文件格式错误'}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 600 }}>AI 配置</h2>
          <p style={{ margin: '4px 0 0', color: '#888' }}>
            管理 AI 服务提供商、模型、Agent 技能与角色定义
          </p>
        </div>
        <Space>
          <Tooltip title="导出全部配置（含 API Key）为 JSON 文件">
            <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
              导出配置
            </Button>
          </Tooltip>
          <Tooltip title="从 JSON 文件导入配置（按名称合并，不会删除现有数据）">
            <Button
              icon={<UploadOutlined />}
              loading={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              导入配置
            </Button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </Space>
      </div>
      <Card bodyStyle={{ padding: '0 16px 16px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={TABS}
          style={{ minHeight: 400 }}
          destroyInactiveTabPane
        />
      </Card>
    </div>
  )
}
