import React from 'react'
import { Card, Space, Typography } from 'antd'
import {
  PlayCircleOutlined,
  FileTextOutlined,
  StopOutlined,
} from '@ant-design/icons'

const { Text } = Typography

interface NodeTemplate {
  type: string
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
}

const nodeTemplates: NodeTemplate[] = [
  { type: 'start', label: '开始', icon: <PlayCircleOutlined style={{ fontSize: 20 }} />, color: '#1890ff', bgColor: '#e6f7ff' },
  { type: 'task', label: '任务', icon: <FileTextOutlined style={{ fontSize: 20 }} />, color: '#1890ff', bgColor: '#f0f5ff' },
  { type: 'end', label: '结束', icon: <StopOutlined style={{ fontSize: 20 }} />, color: '#ff4d4f', bgColor: '#fff1f0' },
]

const NodeLibrary: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <Card title="节点库" size="small" style={{ height: '100%' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {nodeTemplates.map((template) => (
          <div
            key={template.type}
            draggable
            onDragStart={(e) => onDragStart(e, template.type)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: template.bgColor,
              border: `2px solid ${template.color}`,
              borderRadius: 8,
              cursor: 'grab',
              userSelect: 'none',
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'none'
            }}
          >
            <span style={{ color: template.color }}>{template.icon}</span>
            <Text strong style={{ color: template.color }}>{template.label}</Text>
          </div>
        ))}
      </Space>
    </Card>
  )
}

export default NodeLibrary
export { nodeTemplates }
