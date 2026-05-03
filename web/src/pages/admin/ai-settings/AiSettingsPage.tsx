import { useState } from 'react'
import { Card, Tabs } from 'antd'
import {
  ApiOutlined, MessageOutlined, DatabaseOutlined, ThunderboltOutlined, RobotOutlined, BranchesOutlined
} from '@ant-design/icons'
import ProvidersTab from './ProvidersTab'
import ModelsTab from './ModelsTab'
import SkillsTab from './SkillsTab'
import AgentRolesTab from './AgentRolesTab'
import FallbackTab from './FallbackTab'

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

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>AI 配置</h2>
        <p style={{ margin: '4px 0 0', color: '#888' }}>
          管理 AI 服务提供商、模型、Agent 技能与角色定义
        </p>
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
