import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { StopOutlined } from '@ant-design/icons'

interface EndNodeData {
  label?: string
}

const EndNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as EndNodeData
  return (
    <div
      style={{
        background: '#fff1f0',
        border: '2px solid #ff4d4f',
        borderRadius: '50%',
        width: 80,
        height: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 600,
        color: '#ff4d4f',
        cursor: 'pointer',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#ff4d4f', width: 10, height: 10, border: '2px solid #fff' }}
      />
      <StopOutlined style={{ fontSize: 20, marginBottom: 2 }} />
      <span>{nodeData.label || '结束'}</span>
    </div>
  )
})

EndNode.displayName = 'EndNode'

export default EndNode
