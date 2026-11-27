import { create } from 'zustand'
import type { AIAccount } from '../../../shared/types'

/**
 * The app-wide AI prompts: "taking longer than expected" for a call that is
 * still running, and "not responding" for one whose local server went away.
 * Either can be raised from any surface — the commit box, the chat, a review —
 * so they live here and render once, in AIRequestPrompt.
 */
export type AIPrompt =
  | { key: string; kind: 'slow'; requestId: number; label: string; accountId: string }
  | {
      key: string
      kind: 'unreachable'
      label: string
      others: AIAccount[]
      resolve: (accountId: string | null) => void
    }

interface AIPromptState {
  prompts: AIPrompt[]
  showSlow: (requestId: number, label: string, accountId: string) => void
  /** The call ended on its own: its "taking longer" prompt is moot. */
  dropSlow: (requestId: number) => void
  askUnreachable: (label: string, others: AIAccount[]) => Promise<string | null>
  dismissPrompt: (key: string) => void
}

let seq = 0

export const useAIPromptStore = create<AIPromptState>((set, get) => ({
  prompts: [],
  showSlow: (requestId, label, accountId) =>
    set((s) =>
      s.prompts.some((p) => p.kind === 'slow' && p.requestId === requestId)
        ? s
        : { prompts: [...s.prompts, { key: `slow-${requestId}`, kind: 'slow', requestId, label, accountId }] }
    ),
  dropSlow: (requestId) =>
    set((s) => ({ prompts: s.prompts.filter((p) => !(p.kind === 'slow' && p.requestId === requestId)) })),
  askUnreachable: (label, others) =>
    new Promise((resolve) => {
      const key = `unreachable-${++seq}`
      const settle = (accountId: string | null): void => {
        get().dismissPrompt(key)
        resolve(accountId)
      }
      set((s) => ({ prompts: [...s.prompts, { key, kind: 'unreachable', label, others, resolve: settle }] }))
    }),
  dismissPrompt: (key) => set((s) => ({ prompts: s.prompts.filter((p) => p.key !== key) }))
}))
