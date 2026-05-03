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

const NodeLibrary: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    if (readOnly) return
    event.dataTransfer.setData('application/reactflow-type', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <Card title="节点库" size="small" style={{ height: '100%' }}>
      {readOnly && (
        <div style={{ marginBottom: 8, fontSize: 12, color: '#faad14', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4, padding: '4px 8px' }}>
          已发布，不可添加节点
        </div>
      )}
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {nodeTemplates.map((template) => (
          <div
            key={template.type}
            draggable={!readOnly}
            onDragStart={(e) => onDragStart(e, template.type)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: readOnly ? '#fafafa' : template.bgColor,
              border: `2px solid ${readOnly ? '#d9d9d9' : template.color}`,
              borderRadius: 8,
              cursor: readOnly ? 'not-allowed' : 'grab',
              userSelect: 'none',
              opacity: readOnly ? 0.5 : 1,
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!readOnly) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
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
