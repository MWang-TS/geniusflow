import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FileTextOutlined } from '@ant-design/icons'

interface TaskNodeData {
  label?: string
}

const TaskNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as TaskNodeData
  return (
    <div
      style={{
        background: '#fff',
        border: '2px solid #d9d9d9',
        borderRadius: 8,
        padding: '10px 24px',
        minWidth: 140,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 500,
        color: '#333',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#d9d9d9', width: 10, height: 10, border: '2px solid #fff' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <FileTextOutlined style={{ color: '#1890ff' }} />
        <span>{nodeData.label || '新任务'}</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#d9d9d9', width: 10, height: 10, border: '2px solid #fff' }}
      />
    </div>
  )
})

TaskNode.displayName = 'TaskNode'

export default TaskNode
