import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PlatformMode = 'workflow' | 'assistant' | 'api-platform'

export const PLATFORM_MODES: Array<{
  key: PlatformMode
  label: string
  shortLabel: string
  description: string
  icon: string
}> = [
  {
    key: 'workflow',
    label: '流程任务模式',
    shortLabel: '流程任务',
    description: '设计并执行业务流程，AI辅助质检与审批',
    icon: 'NodeIndexOutlined',
  },
  {
    key: 'assistant',
    label: 'AI助理模式',
    shortLabel: 'AI助理',
    description: '企业知识库对话助理，即时解答业务问题',
    icon: 'RobotOutlined',
  },
  {
    key: 'api-platform',
    label: 'AI中台模式',
    shortLabel: 'AI中台',
    description: '提供标准API接口，供企业内部平台集成使用',
    icon: 'ApiOutlined',
  },
]

interface PlatformModeState {
  mode: PlatformMode
  setMode: (mode: PlatformMode) => void
}

export const usePlatformModeStore = create<PlatformModeState>()(
  persist(
    (set) => ({
      mode: 'workflow',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'platform-mode-storage' },
  ),
)
