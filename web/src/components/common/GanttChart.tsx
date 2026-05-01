import React, { useMemo } from 'react'
import { Tooltip } from 'antd'

export interface GanttTask {
  id: string
  name: string
  assignee: string | null
  status: string
  percentComplete: number
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  duration: number
  isOverdue: boolean
}

interface GanttChartProps {
  tasks: GanttTask[]
  projectStart?: string | null
}

const statusColors: Record<string, string> = {
  waiting: '#d9d9d9',
  in_progress: '#1677ff',
  ai_inspecting: '#722ed1',
  pending_approval: '#fa8c16',
  completed: '#52c41a',
  rejected: '#ff4d4f',
}

const BAR_HEIGHT = 32
const HEADER_HEIGHT = 36
const ROW_GAP = 4
const LABEL_WIDTH = 180

const GanttChart: React.FC<GanttChartProps> = ({ tasks, projectStart }) => {
  const { totalDays, dates, startDate } = useMemo(() => {
    if (tasks.length === 0) return { totalDays: 30, dates: [], startDate: new Date() }

    let minDate = projectStart
      ? new Date(projectStart)
      : new Date(Math.min(...tasks.map((t) => t.plannedStartDate ? new Date(t.plannedStartDate).getTime() : Date.now())))

    let maxDate = new Date(Math.max(...tasks.map((t) => t.plannedEndDate ? new Date(t.plannedEndDate).getTime() : Date.now())))

    minDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
    maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate() + 1)

    const diffDays = Math.max(30, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 2)
    const days: Date[] = []
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(minDate)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return { totalDays: diffDays, dates: days, startDate: minDate }
  }, [tasks, projectStart])

  const dayWidth = Math.max(28, 1200 / totalDays)
  const svgWidth = LABEL_WIDTH + dates.length * dayWidth
  const svgHeight = HEADER_HEIGHT + tasks.length * (BAR_HEIGHT + ROW_GAP) + 8

  const isToday = (d: Date) => {
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }

  const getX = (dateStr: string | null) => {
    if (!dateStr) return 0
    const d = new Date(dateStr)
    return Math.round((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth
  }

  const todayX = (() => {
    const now = new Date()
    return Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth
  })()

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
      <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
        <defs>
          <pattern id="stripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <rect width="4" height="8" fill="rgba(0,0,0,0.06)" />
          </pattern>
        </defs>

        {/* Header background */}
        <rect x={LABEL_WIDTH} y={0} width={svgWidth - LABEL_WIDTH} height={HEADER_HEIGHT} fill="#fafafa" />

        {/* Day columns */}
        {dates.map((d, i) => (
          <React.Fragment key={i}>
            <line x1={LABEL_WIDTH + i * dayWidth} y1={0} x2={LABEL_WIDTH + i * dayWidth} y2={svgHeight} stroke="#f0f0f0" strokeWidth={0.5} />
            <text x={LABEL_WIDTH + i * dayWidth + dayWidth / 2} y={HEADER_HEIGHT / 2 + 4} textAnchor="middle" fontSize={10} fill={isToday(d) ? '#1677ff' : '#999'}>
              {d.getDate()}
            </text>
            {/* Month labels on first day of month */}
            {d.getDate() === 1 && (
              <text x={LABEL_WIDTH + i * dayWidth + 4} y={HEADER_HEIGHT / 2 - 6} fontSize={9} fill="#666">
                {d.getMonth() + 1}月
              </text>
            )}
            {/* Highlight today column */}
            {isToday(d) && (
              <rect x={LABEL_WIDTH + i * dayWidth} y={HEADER_HEIGHT} width={dayWidth} height={svgHeight - HEADER_HEIGHT} fill="rgba(22,119,255,0.04)" />
            )}
          </React.Fragment>
        ))}

        {/* Today line */}
        {todayX >= 0 && todayX < (svgWidth - LABEL_WIDTH) && (
          <line x1={LABEL_WIDTH + todayX} y1={HEADER_HEIGHT} x2={LABEL_WIDTH + todayX} y2={svgHeight} stroke="#1677ff" strokeWidth={1.5} strokeDasharray="4,3" />
        )}

        {/* Task rows */}
        {tasks.map((task, index) => {
          const y = HEADER_HEIGHT + index * (BAR_HEIGHT + ROW_GAP) + 4
          const barY = y
          const plannedX = getX(task.plannedStartDate)
          const plannedW = Math.max(dayWidth, task.duration * dayWidth)
          const progressW = plannedW * (task.percentComplete / 100)
          const actualX = getX(task.actualStartDate)
          const color = statusColors[task.status] || '#d9d9d9'

          return (
            <g key={task.id}>
              {/* Row background */}
              <rect x={0} y={y - 2} width={svgWidth} height={BAR_HEIGHT + 4} fill={index % 2 === 0 ? '#fafafa' : '#fff'} />

              {/* Task label */}
              <foreignObject x={4} y={y} width={LABEL_WIDTH - 8} height={BAR_HEIGHT}>
                <div style={{ fontSize: 11, lineHeight: '14px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Tooltip title={task.name}>
                    <span>{task.name}</span>
                  </Tooltip>
                </div>
                {task.assignee && (
                  <div style={{ fontSize: 10, color: '#999' }}>{task.assignee}</div>
                )}
              </foreignObject>

              {/* Planned bar */}
              <Tooltip title={`计划: ${task.plannedStartDate ? new Date(task.plannedStartDate).toLocaleDateString('zh-CN') : '-'} ~ ${task.plannedEndDate ? new Date(task.plannedEndDate).toLocaleDateString('zh-CN') : '-'} | 进度: ${task.percentComplete}%`}>
                <g>
                  <rect
                    x={LABEL_WIDTH + plannedX}
                    y={barY + 2}
                    width={plannedW}
                    height={BAR_HEIGHT / 2 - 2}
                    rx={3}
                    fill={color}
                    opacity={0.3}
                  />
                  {/* Progress fill */}
                  {progressW > 0 && (
                    <rect
                      x={LABEL_WIDTH + plannedX}
                      y={barY + 2}
                      width={progressW}
                      height={BAR_HEIGHT / 2 - 2}
                      rx={3}
                      fill={color}
                      opacity={0.8}
                    />
                  )}
                  {/* Actual bar */}
                  {task.actualStartDate && (
                    <>
                      <rect
                        x={LABEL_WIDTH + actualX}
                        y={barY + BAR_HEIGHT / 2 + 1}
                        width={task.actualEndDate ? Math.max(2, getX(task.actualEndDate) - actualX) : Math.max(2, dayWidth * (task.percentComplete / 100))}
                        height={BAR_HEIGHT / 2 - 2}
                        rx={3}
                        fill={color}
                        opacity={0.6}
                      />
                    </>
                  )}
                </g>
              </Tooltip>

              {/* Overdue indicator */}
              {task.isOverdue && (
                <text x={LABEL_WIDTH + plannedX + plannedW + 4} y={barY + BAR_HEIGHT / 2 + 4} fontSize={11} fill="#ff4d4f">
                  ⚠延期
                </text>
              )}

              {/* Status tag */}
              <text x={LABEL_WIDTH + plannedX + plannedW + (task.isOverdue ? 40 : 0) + 4} y={barY + BAR_HEIGHT / 2 + 4} fontSize={10} fill="#999">
                {task.percentComplete}%
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default GanttChart
