import React, { useCallback, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  useNodesState,
  useEdgesState,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import StartNode from './StartNode'
import TaskNode from './TaskNode'
import EndNode from './EndNode'
import { useProcessDesignStore } from '../../stores/process-design.store'
import type { GraphNode, GraphEdge } from '../../types/process'

const nodeTypes = {
  start: StartNode,
  task: TaskNode,
  end: EndNode,
}

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#b1b1b7', strokeWidth: 2 },
}

function graphNodeToRFNode(n: GraphNode): Node {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data || { label: n.type === 'start' ? '开始' : n.type === 'end' ? '结束' : '新任务' },
  }
}

function rfEdgeToGraphEdge(e: Edge): GraphEdge {
  return { id: e.id, source: e.source, target: e.target }
}

const ProcessCanvas: React.FC = () => {
  const currentProcess = useProcessDesignStore((s) => s.currentProcess)
  const selectNode = useProcessDesignStore((s) => s.selectNode)
  const updateGraph = useProcessDesignStore((s) => s.updateGraph)

  const initialNodes = useMemo(
    () => (currentProcess?.graphJson?.nodes || []).map(graphNodeToRFNode),
    [currentProcess?.id],
  )

  const initialEdges = useMemo(
    () => (currentProcess?.graphJson?.edges || []).map(
      (e) => ({ id: e.id, source: e.source, target: e.target, animated: true }),
    ),
    [currentProcess?.id],
  )

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialEdges)

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null)

  const syncToStore = useCallback(
    (updatedNodes: Node[], updatedEdges: Edge[]) => {
      const graphJson = {
        nodes: updatedNodes.map((n) => ({
          id: n.id,
          type: (n.type || 'task') as GraphNode['type'],
          position: n.position,
          data: n.data as Record<string, unknown>,
        })),
        edges: updatedEdges.map(rfEdgeToGraphEdge),
      }
      updateGraph(graphJson)
    },
    [updateGraph],
  )

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChangeBase(changes)
    },
    [onNodesChangeBase],
  )

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChangeBase(changes as any)
    },
    [onEdgesChangeBase],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const newEdge: Edge = {
          id: `e-${Date.now()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
          animated: true,
        }
        const newEdges = [...eds, newEdge] as any
        syncToStore(nodes, newEdges)
        return newEdges
      })
    },
    [nodes, syncToStore, setEdges],
  )

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id)
    },
    [selectNode],
  )

  const handlePaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow-type')
      if (!type || !rfInstanceRef.current) return

      const position = rfInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNodeId = `node-${Date.now()}`
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {
          label: type === 'start' ? '开始' : type === 'end' ? '结束' : '新任务',
        },
      }

      setNodes((nds) => {
        const updated = [...nds, newNode]
        syncToStore(updated, edges)
        return updated
      })
    },
    [edges, syncToStore, setNodes],
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={(instance) => { rfInstanceRef.current = instance as any }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'start') return '#1890ff'
            if (node.type === 'end') return '#ff4d4f'
            return '#d9d9d9'
          }}
          maskColor="rgba(0,0,0,0.08)"
        />
      </ReactFlow>
    </div>
  )
}

export default ProcessCanvas
