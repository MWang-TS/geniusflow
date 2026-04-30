import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { PlayCircleOutlined } from '@ant-design/icons'

interface StartNodeData {
  label?: string
}

const StartNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as StartNodeData
  return (
    <div
      style={{
        background: '#e6f7ff',
        border: '2px solid #1890ff',
        borderRadius: '50%',
        width: 80,
        height: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 600,
        color: '#1890ff',
        cursor: 'pointer',
      }}
    >
      <PlayCircleOutlined style={{ fontSize: 20, marginBottom: 2 }} />
      <span>{nodeData.label || '开始'}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#1890ff', width: 10, height: 10, border: '2px solid #fff' }}
      />
    </div>
  )
})

StartNode.displayName = 'StartNode'

export default StartNode
