import { create } from 'zustand'

interface AiAssistantState {
  /** When set, the AI assistant should open and send this message, then clear it */
  pendingMessage: string | null
  sendMessage: (msg: string) => void
  clearPending: () => void
}

export const useAiAssistantStore = create<AiAssistantState>()((set) => ({
  pendingMessage: null,
  sendMessage: (msg) => set({ pendingMessage: msg }),
  clearPending: () => set({ pendingMessage: null }),
}))
