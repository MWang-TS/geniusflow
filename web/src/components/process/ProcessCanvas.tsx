import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react'
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
import { App } from 'antd'
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

function graphNodeToRFNode(n: GraphNode, index = 0): Node {
  const defaultLabel = n.type === 'start' ? '开始' : n.type === 'end' ? '结束' : '新任务'
  return {
    id: n.id,
    type: n.type,
    position: n.position ?? { x: 250, y: index * 120 + 50 },
    data: n.data ?? { label: (n as unknown as { nodeName?: string }).nodeName || defaultLabel },
  }
}

function rfEdgeToGraphEdge(e: Edge): GraphEdge {
  return { id: e.id, source: e.source, target: e.target }
}

interface ProcessCanvasProps {
  readOnly?: boolean
}

interface ContextMenu {
  nodeId: string
  nodeType: string
  x: number
  y: number
}

const ProcessCanvas: React.FC<ProcessCanvasProps> = ({ readOnly = false }) => {
  const currentProcess = useProcessDesignStore((s) => s.currentProcess)
  const selectNode = useProcessDesignStore((s) => s.selectNode)
  const updateGraph = useProcessDesignStore((s) => s.updateGraph)
  const addNode = useProcessDesignStore((s) => s.addNode)
  const { modal, message } = App.useApp()

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  const initialNodes = useMemo(
    () => (currentProcess?.graphJson?.nodes || []).map((n, i) => graphNodeToRFNode(n, i)),
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

  // Re-sync when the loaded process changes (initialNodes/initialEdges are memo'd on id)
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges])

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
    setContextMenu(null)
  }, [selectNode])

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      selectNode(node.id)
      setContextMenu({
        nodeId: node.id,
        nodeType: node.type || 'task',
        x: event.clientX,
        y: event.clientY,
      })
    },
    [selectNode],
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setContextMenu(null)
      modal.confirm({
        title: '确认删除',
        content: '确定要删除该节点吗？相关连线也会一并删除。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          setNodes((nds) => {
            const updated = nds.filter((n) => n.id !== nodeId)
            setEdges((eds) => {
              const updatedEdges = eds.filter(
                (e) => e.source !== nodeId && e.target !== nodeId,
              )
              syncToStore(updated, updatedEdges)
              return updatedEdges
            })
            return updated
          })
          selectNode(null)
          message.success('节点已删除')
        },
      })
    },
    [modal, message, setNodes, setEdges, syncToStore, selectNode],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (readOnly) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [readOnly])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (readOnly) return
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow-type')
      if (!type || !rfInstanceRef.current) return

      const position = rfInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const label = type === 'start' ? '开始' : type === 'end' ? '结束' : '新任务'
      const newNodeId = `node-${Date.now()}`
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: { label },
      }

      setNodes((nds) => {
        const updated = [...nds, newNode]
        const newGraphJson = {
          nodes: updated.map((n) => ({
            id: n.id,
            type: (n.type || 'task') as GraphNode['type'],
            position: n.position,
            data: n.data as Record<string, unknown>,
          })),
          edges: edges.map(rfEdgeToGraphEdge),
        }
        addNode(newNodeId, type as 'start' | 'task' | 'end', label, newGraphJson)
        return updated
      })
    },
    [edges, addNode, setNodes],
  )

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : handleNodesChange}
        onEdgesChange={readOnly ? undefined : handleEdgesChange}
        onConnect={readOnly ? undefined : handleConnect}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        onInit={(instance) => { rfInstanceRef.current = instance as any }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
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

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* Overlay to dismiss */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
          />
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
              minWidth: 160,
              padding: '4px 0',
              border: '1px solid #f0f0f0',
            }}
          >
            <div
              style={{ padding: '8px 16px', fontSize: 12, color: '#999', borderBottom: '1px solid #f5f5f5' }}
            >
              {contextMenu.nodeType === 'start' ? '开始节点' : contextMenu.nodeType === 'end' ? '结束节点' : '任务节点'}
            </div>
            <div
              style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                setContextMenu(null)
                // The node is already selected; property panel is shown on the right
              }}
            >
              <span style={{ fontSize: 14 }}>⚙️</span> 查看属性
            </div>
            {!readOnly && contextMenu.nodeType !== 'start' && contextMenu.nodeType !== 'end' && (
              <div
                style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: '#ff4d4f', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fff1f0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => handleDeleteNode(contextMenu.nodeId)}
              >
                <span style={{ fontSize: 14 }}>🗑️</span> 删除节点
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ProcessCanvas
