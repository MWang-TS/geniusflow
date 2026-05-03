import { create } from 'zustand'
import type { ProcessDefinition, GraphJson, NodeDefinition } from '../types/process'
import { processDefinitionApi } from '../api/process-definition'
import { nodeDefinitionApi } from '../api/node-definition'

interface ValidationResult {
  valid: boolean
  errors: string[]
}

interface ProcessDesignState {
  currentProcess: ProcessDefinition | null
  isLoading: boolean
  isSaving: boolean
  selectedNodeId: string | null

  loadProcess: (id: string) => Promise<void>
  resetProcess: () => void
  saveDraft: () => Promise<boolean>
  publish: () => Promise<boolean>
  updateName: (name: string) => void

  selectNode: (id: string | null) => void
  updateGraph: (graphJson: GraphJson) => void
  addNode: (nodeId: string, nodeType: 'start' | 'task' | 'end', label: string, graphJson: GraphJson) => void
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => Promise<void>

  validate: () => ValidationResult
}

export const useProcessDesignStore = create<ProcessDesignState>((set, get) => ({
  currentProcess: null,
  isLoading: false,
  isSaving: false,
  selectedNodeId: null,

  loadProcess: async (id: string) => {
    set({ isLoading: true, selectedNodeId: null })
    try {
      const res = await processDefinitionApi.getById(id)
      set({ currentProcess: res.data, isLoading: false })
    } catch {
      set({ isLoading: false })
      throw new Error('加载流程失败')
    }
  },

  resetProcess: () => {
    set({
      currentProcess: null,
      selectedNodeId: null,
      isLoading: false,
      isSaving: false,
    })
  },

  saveDraft: async () => {
    const { currentProcess } = get()
    if (!currentProcess) return false

    const validation = get().validate()
    if (!validation.valid) {
      throw new Error(validation.errors.join('；'))
    }

    set({ isSaving: true })
    try {
      const res = await processDefinitionApi.update(currentProcess.id, {
        name: currentProcess.name,
        graphJson: currentProcess.graphJson,
      })
      set({ currentProcess: res.data, isSaving: false })
      return true
    } catch {
      set({ isSaving: false })
      throw new Error('保存失败')
    }
  },

  publish: async () => {
    const { currentProcess } = get()
    if (!currentProcess) return false

    const validation = get().validate()
    if (!validation.valid) {
      throw new Error(validation.errors.join('；'))
    }

    set({ isSaving: true })
    try {
      await processDefinitionApi.publish(currentProcess.id)
      const res = await processDefinitionApi.getById(currentProcess.id)
      set({ currentProcess: { ...res.data, status: 'published' as const }, isSaving: false })
      return true
    } catch {
      set({ isSaving: false })
      throw new Error('发布失败')
    }
  },

  updateName: (name: string) => {
    const { currentProcess } = get()
    if (currentProcess) {
      set({ currentProcess: { ...currentProcess, name } })
    }
  },

  selectNode: (id: string | null) => set({ selectedNodeId: id }),

  addNode: (nodeId: string, nodeType: 'start' | 'task' | 'end', label: string, graphJson: GraphJson) => {
    const { currentProcess } = get()
    if (!currentProcess) return
    const now = new Date().toISOString()
    const defaultAiConfig = { inspector: { enabled: false }, assistant: { enabled: false }, inputAgent: { enabled: false }, outputAgent: { enabled: false } }
    const placeholder: NodeDefinition = {
      id: nodeId,
      processId: currentProcess.id,
      nodeName: label,
      nodeType,
      inputSpec: {},
      actionSpec: {},
      outputSpec: {},
      aiConfig: defaultAiConfig,
      progressConfig: { plannedDuration: nodeType === 'task' ? 2 : 0, needApproval: nodeType === 'task', isMilestone: false, requireAiReportBeforeApproval: false },
      sortOrder: currentProcess.nodes.length,
      createdAt: now,
      updatedAt: now,
    }
    set({
      currentProcess: {
        ...currentProcess,
        graphJson,
        nodes: [...currentProcess.nodes, placeholder],
      },
    })
  },

  updateGraph: (graphJson: GraphJson) => {
    const { currentProcess } = get()
    if (currentProcess) {
      set({
        currentProcess: {
          ...currentProcess,
          graphJson,
        },
      })
    }
  },

  updateNodeData: async (nodeId: string, data: Record<string, unknown>) => {
    const { currentProcess } = get()
    if (!currentProcess) return

    try {
      const res = await nodeDefinitionApi.update(nodeId, data)
      const updatedNodes = currentProcess.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...res.data } : n,
      )
      set({
        currentProcess: { ...currentProcess, nodes: updatedNodes },
      })
    } catch {
      throw new Error('更新节点配置失败')
    }
  },

  validate: (): ValidationResult => {
    const { currentProcess } = get()
    const errors: string[] = []

    if (!currentProcess?.graphJson) {
      errors.push('缺少流程结构数据')
      return { valid: false, errors }
    }

    const { nodes, edges } = currentProcess.graphJson

    const hasStart = nodes.some((n) => n.type === 'start')
    const hasEnd = nodes.some((n) => n.type === 'end')
    if (!hasStart) errors.push('缺少开始节点')
    if (!hasEnd) errors.push('缺少结束节点')

    const connectedNodeIds = new Set(edges.flatMap((e) => [e.source, e.target]))
    nodes.forEach((n) => {
      if (n.type !== 'start' && n.type !== 'end' && !connectedNodeIds.has(n.id)) {
        const label = n.data?.label || n.id
        errors.push(`节点 "${label}" 未连接`)
      }
    })

    return { valid: errors.length === 0, errors }
  },
}))
