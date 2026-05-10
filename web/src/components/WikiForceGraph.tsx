/**
 * Self-contained force-directed graph renderer for Wiki knowledge graphs.
 * Uses HTML5 Canvas + a simple spring/repulsion simulation.
 * No external graph library required.
 */
import { useEffect, useRef, useCallback } from 'react'
import type { GraphNode, GraphEdge } from '../api/wiki'

interface SimNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  fx?: number  // pinned x
  fy?: number  // pinned y
}

interface SimEdge {
  source: SimNode
  target: SimNode
  label: string
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width?: number
  height?: number
  onNodeClick?: (node: GraphNode) => void
}

/** Fit the graph to fill the canvas and return the new transform. */
function computeFitTransform(
  nodes: { x: number; y: number }[],
  width: number,
  height: number,
  padding = 60,
): { x: number; y: number; scale: number } {
  if (!nodes.length) return { x: 0, y: 0, scale: 1 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  const gw = maxX - minX || 1
  const gh = maxY - minY || 1
  const scale = Math.min((width - padding * 2) / gw, (height - padding * 2) / gh, 2)
  const x = (width - gw * scale) / 2 - minX * scale
  const y = (height - gh * scale) / 2 - minY * scale
  return { x, y, scale }
}

const NODE_RADIUS = 28
const EDGE_LABEL_FONT = '11px sans-serif'
const NODE_FONT = '12px sans-serif'
const COLORS = ['#5b8dee', '#f08a4b', '#52c41a', '#722ed1', '#eb2f96', '#13c2c2']

function getColor(label: string) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export default function WikiForceGraph({ nodes, edges, width = 900, height = 600, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<{ nodes: SimNode[]; edges: SimEdge[]; running: boolean; frameId: number }>({
    nodes: [], edges: [], running: false, frameId: 0,
  })
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ node: SimNode | null; panStart: { x: number; y: number } | null }>({ node: null, panStart: null })
  const hoveredNodeRef = useRef<string | null>(null)
  const alphaRef = useRef(1)

  const toWorld = useCallback((cx: number, cy: number) => {
    const t = transformRef.current
    return { x: (cx - t.x) / t.scale, y: (cy - t.y) / t.scale }
  }, [])

  const findNode = useCallback((wx: number, wy: number): SimNode | null => {
    for (const n of simRef.current.nodes) {
      const dx = n.x - wx; const dy = n.y - wy
      if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) return n
    }
    return null
  }, [])

  // Initialize simulation
  useEffect(() => {
    const cx = width / 2; const cy = height / 2
    const r = Math.min(width, height) * 0.35
    const simNodes: SimNode[] = nodes.map((n, i) => ({
      ...n,
      x: cx + r * Math.cos((2 * Math.PI * i) / nodes.length),
      y: cy + r * Math.sin((2 * Math.PI * i) / nodes.length),
      vx: 0, vy: 0,
    }))
    const nodeById = new Map(simNodes.map(n => [n.id, n]))
    const simEdges: SimEdge[] = edges
      .map(e => ({ ...e, source: nodeById.get(e.source)!, target: nodeById.get(e.target)! }))
      .filter(e => e.source && e.target)

    simRef.current = { nodes: simNodes, edges: simEdges, running: true, frameId: 0 }
    transformRef.current = { x: 0, y: 0, scale: 1 }
  }, [nodes, edges, width, height])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const step = () => {
      const sim = simRef.current
      if (!sim.running) return

      // Force simulation tick
      if (alphaRef.current > 0.001) {
        alphaRef.current *= 0.985
        const REPEL = 4000
        const SPRING = 0.04
        const DAMPING = 0.85
        const CENTER_FORCE = 0.003

        const { nodes: sn, edges: se } = sim
        const cx = width / 2; const cy = height / 2

        // Repulsion (O(n²))
        for (let i = 0; i < sn.length; i++) {
          for (let j = i + 1; j < sn.length; j++) {
            const dx = sn[j].x - sn[i].x; const dy = sn[j].y - sn[i].y
            const dist2 = dx * dx + dy * dy + 1
            const force = REPEL / dist2
            const fx = force * dx; const fy = force * dy
            sn[i].vx -= fx; sn[i].vy -= fy
            sn[j].vx += fx; sn[j].vy += fy
          }
        }

        // Spring attraction along edges
        for (const e of se) {
          const dx = e.target.x - e.source.x; const dy = e.target.y - e.source.y
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
          const ideal = 120
          const stretch = (dist - ideal) * SPRING
          const fx = (dx / dist) * stretch; const fy = (dy / dist) * stretch
          e.source.vx += fx; e.source.vy += fy
          e.target.vx -= fx; e.target.vy -= fy
        }

        // Center gravity
        for (const n of sn) {
          if (n.fx !== undefined) { n.x = n.fx; n.vy = 0; continue }
          if (n.fy !== undefined) { n.y = n.fy; n.vy = 0; continue }
          n.vx += (cx - n.x) * CENTER_FORCE
          n.vy += (cy - n.y) * CENTER_FORCE
          n.vx *= DAMPING; n.vy *= DAMPING
          n.x += n.vx; n.y += n.vy
        }
      }

      // Draw
      const t = transformRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.scale(t.scale, t.scale)

      // Draw edges
      for (const e of sim.edges) {
        const { source: s, target: tg, label } = e
        const dx = tg.x - s.x; const dy = tg.y - s.y
        const len = Math.sqrt(dx * dx + dy * dy) + 0.01
        const mx = (s.x + tg.x) / 2; const my = (s.y + tg.y) / 2

        ctx.beginPath()
        ctx.moveTo(s.x + (dx / len) * NODE_RADIUS, s.y + (dy / len) * NODE_RADIUS)
        ctx.lineTo(tg.x - (dx / len) * NODE_RADIUS, tg.y - (dy / len) * NODE_RADIUS)
        ctx.strokeStyle = '#c8d0e0'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Arrowhead
        const angle = Math.atan2(dy, dx)
        const ax = tg.x - (dx / len) * NODE_RADIUS
        const ay = tg.y - (dy / len) * NODE_RADIUS
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax - 10 * Math.cos(angle - 0.4), ay - 10 * Math.sin(angle - 0.4))
        ctx.lineTo(ax - 10 * Math.cos(angle + 0.4), ay - 10 * Math.sin(angle + 0.4))
        ctx.closePath()
        ctx.fillStyle = '#b0b8cc'
        ctx.fill()

        // Edge label
        ctx.font = EDGE_LABEL_FONT
        ctx.fillStyle = '#888'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, mx, my - 8)
      }

      // Draw nodes
      for (const n of sim.nodes) {
        const r = NODE_RADIUS * (0.7 + 0.06 * Math.min(n.size, 10))
        const color = getColor(n.label)
        const isHovered = n.id === hoveredNodeRef.current

        // Shadow
        ctx.shadowColor = isHovered ? color : 'rgba(0,0,0,0.15)'
        ctx.shadowBlur = isHovered ? 20 : 6

        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.9
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = isHovered ? '#fff' : 'rgba(255,255,255,0.6)'
        ctx.lineWidth = isHovered ? 2.5 : 1.5
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'

        // Label
        ctx.font = NODE_FONT
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const maxW = r * 2 - 4
        let label = n.label
        if (ctx.measureText(label).width > maxW) {
          while (label.length > 1 && ctx.measureText(label + '…').width > maxW) label = label.slice(0, -1)
          label += '…'
        }
        ctx.fillText(label, n.x, n.y)
      }

      ctx.restore()
      simRef.current.frameId = requestAnimationFrame(step)
    }

    simRef.current.running = true
    alphaRef.current = 1
    simRef.current.frameId = requestAnimationFrame(step)
    return () => {
      simRef.current.running = false
      cancelAnimationFrame(simRef.current.frameId)
    }
  }, [nodes, edges, width, height])

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { x, y } = toWorld(e.clientX - rect.left, e.clientY - rect.top)
    const node = findNode(x, y)
    if (node) {
      node.fx = x; node.fy = y
      dragRef.current.node = node
    } else {
      dragRef.current.panStart = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y }
    }
  }, [toWorld, findNode])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left; const cy = e.clientY - rect.top
    const { x, y } = toWorld(cx, cy)
    const { node, panStart } = dragRef.current
    if (node) {
      node.fx = x; node.fy = y; node.x = x; node.y = y
    } else if (panStart) {
      transformRef.current.x = e.clientX - panStart.x
      transformRef.current.y = e.clientY - panStart.y
    } else {
      const hovered = findNode(x, y)
      hoveredNodeRef.current = hovered?.id ?? null
      canvasRef.current!.style.cursor = hovered ? 'pointer' : 'grab'
    }
  }, [toWorld, findNode])

  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    const { node } = dragRef.current
    if (node) {
      delete node.fx; delete node.fy
    }
    dragRef.current = { node: null, panStart: null }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { x, y } = toWorld(e.clientX - rect.left, e.clientY - rect.top)
    const node = findNode(x, y)
    if (node && onNodeClick) onNodeClick(node)
  }, [toWorld, findNode, onNodeClick])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left; const cy = e.clientY - rect.top
    // Clamp deltaY to slow down trackpad bursts; step ~3% per notch
    const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100)
    const factor = 1 - delta * 0.0003
    const t = transformRef.current
    const newScale = Math.min(5, Math.max(0.05, t.scale * factor))
    t.x = cx - (cx - t.x) * (newScale / t.scale)
    t.y = cy - (cy - t.y) * (newScale / t.scale)
    t.scale = newScale
  }, [])

  const fitView = useCallback(() => {
    const fit = computeFitTransform(simRef.current.nodes, width, height)
    transformRef.current = fit
  }, [width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Auto-fit once the simulation has settled (after ~3 s)
  useEffect(() => {
    const timer = setTimeout(fitView, 3000)
    return () => clearTimeout(timer)
  }, [fitView])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ borderRadius: 8, background: '#f8f9fc', cursor: 'grab', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          title="适应视图（全局）"
          onClick={fitView}
          style={{
            width: 32, height: 32, border: '1px solid #d9d9d9', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: '30px',
            textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
          }}
        >⊡</button>
        <button
          title="放大"
          onClick={() => {
            const t = transformRef.current
            const cx = width / 2; const cy = height / 2
            const newScale = Math.min(5, t.scale * 1.3)
            t.x = cx - (cx - t.x) * (newScale / t.scale)
            t.y = cy - (cy - t.y) * (newScale / t.scale)
            t.scale = newScale
          }}
          style={{
            width: 32, height: 32, border: '1px solid #d9d9d9', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: '30px',
            textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
          }}
        >+</button>
        <button
          title="缩小"
          onClick={() => {
            const t = transformRef.current
            const cx = width / 2; const cy = height / 2
            const newScale = Math.max(0.05, t.scale * 0.7)
            t.x = cx - (cx - t.x) * (newScale / t.scale)
            t.y = cy - (cy - t.y) * (newScale / t.scale)
            t.scale = newScale
          }}
          style={{
            width: 32, height: 32, border: '1px solid #d9d9d9', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: '30px',
            textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
          }}
        >−</button>
      </div>
    </div>
  )
}
