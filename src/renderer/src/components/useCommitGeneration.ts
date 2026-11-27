import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { AIConfig } from '../../../shared/types'
import { aiApi } from '../infrastructure/api'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { AIRequestCancelled } from '../lib/aiGuard'
import {
  IDLE,
  accountDefaultTarget,
  configForTarget,
  configLabel,
  defaultGenerationTarget,
  elapsedSeconds,
  nextGeneration,
  type GenerationState,
  type GenerationTarget,
  type MessageDraft
} from '../lib/commitGeneration'

let seq = 0

/** Thrown inside a retry the user already cancelled, so it never reaches main. */
class GenerationCancelled extends Error {}

export interface CommitGeneration {
  state: GenerationState
  /** Seconds the current generation has run; 0 when idle. */
  elapsed: number
  /** Starts a generation; `target` overrides the commit task's account for this one call. */
  generateMessage: (target?: GenerationTarget | null) => Promise<void>
  /** "Generate again": the same account and model as the last generation. */
  regenerateMessage: () => Promise<void>
  /** Ends the running generation, here and in main. */
  cancelGeneration: () => void
  /** Restores the text from before the generation and drops the banner. */
  undoGeneration: () => void
  /** Drops the banner (the user committed). Also ends a generation still running. */
  dismissGenerationBanner: () => void
}

interface Options {
  repoPath: string
  branch: string
  /** The diff to describe, or '' when there is nothing to describe (the caller toasts why). */
  diff: () => Promise<string>
  current: MessageDraft
  /** Writes a message into the fields; returns it as `current` will then read, when the surface reshapes it. */
  apply: (draft: MessageDraft) => MessageDraft | void
}

/**
 * One commit-message generation at a time, cancellable. Cancel works twice
 * over: the renderer stops listening to the request (a late answer changes
 * nothing), and main is told to abort it by the tag it was started with —
 * the call in flight and any re-ask it would make.
 */
export function useCommitGeneration({ repoPath, branch, diff, current, apply }: Options): CommitGeneration {
  const [state, dispatch] = useReducer(nextGeneration, IDLE)
  const [now, setNow] = useState(() => Date.now())
  const running = useRef<string | null>(null)
  const lastTarget = useRef<GenerationTarget | null>(null)
  const latest = useRef({ current, apply, diff, state })
  latest.current = { current, apply, diff, state }

  useEffect(() => {
    if (state.phase !== 'generating') return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [state.phase])

  // The banner goes the moment the text is no longer what was generated.
  useEffect(() => dispatch({ type: 'edit', current }), [current.summary, current.description]) // eslint-disable-line react-hooks/exhaustive-deps

  const cancelGeneration = useCallback((): void => {
    const tag = running.current
    if (!tag) return
    running.current = null
    dispatch({ type: 'cancel' })
    void aiApi.cancelRequest(tag).catch(() => undefined)
  }, [])

  // A composer that goes away takes its request with it.
  useEffect(() => cancelGeneration, [cancelGeneration])

  const generateMessage = useCallback(
    async (target?: GenerationTarget | null): Promise<void> => {
      if (running.current) cancelGeneration()
      lastTarget.current = target ?? null
      const ai = useSettingsStore.getState().activeAI()
      const cfg: AIConfig = { ...configForTarget(ai, target ?? defaultGenerationTarget(ai)), cliCwd: repoPath }
      const tag = `commit-${++seq}`
      running.current = tag
      dispatch({
        type: 'start',
        tag,
        startedAt: Date.now(),
        label: configLabel(cfg),
        accountId: cfg.accountId ?? '',
        current: latest.current.current
      })
      try {
        const text = await latest.current.diff()
        if (running.current !== tag) return
        if (!text.trim()) {
          running.current = null
          dispatch({ type: 'fail', tag })
          return
        }
        const msg = await aiApi.commitMessage(text, cfg, { branch, requestTag: tag }, (tried) => {
          if (running.current !== tag) throw new GenerationCancelled()
          dispatch({ type: 'attempt', tag, label: configLabel(tried), accountId: tried.accountId ?? '' })
          // Moved to another account from the slow prompt: "Generate again" goes there too, not
          // back to the account that was too slow.
          if (tried.accountId && tried.accountId !== cfg.accountId) {
            lastTarget.current = accountDefaultTarget(useSettingsStore.getState().activeAI(), tried.accountId)
          }
        })
        if (running.current !== tag) return
        running.current = null
        const written = { summary: msg.summary, description: msg.description }
        const generated = latest.current.apply(written) ?? written
        dispatch({ type: 'finish', tag, finishedAt: Date.now(), generated })
      } catch (err) {
        if (running.current !== tag) return
        running.current = null
        // Cancel on the slow prompt: the user's own choice, so no error toast.
        if (err instanceof AIRequestCancelled) {
          dispatch({ type: 'cancel' })
          return
        }
        dispatch({ type: 'fail', tag })
        useUIStore.getState().toast('error', err instanceof Error ? err.message : String(err))
      }
    },
    [repoPath, branch, cancelGeneration]
  )

  const regenerateMessage = useCallback((): Promise<void> => generateMessage(lastTarget.current), [generateMessage])

  const undoGeneration = useCallback((): void => {
    const s = latest.current.state
    if (s.phase !== 'generated') return
    latest.current.apply(s.previous)
    dispatch({ type: 'undo' })
  }, [])

  const dismissGenerationBanner = useCallback((): void => {
    cancelGeneration()
    dispatch({ type: 'dismiss' })
  }, [cancelGeneration])

  const elapsed = state.phase === 'generating' ? elapsedSeconds(state.startedAt, now) : 0
  return {
    state,
    elapsed,
    generateMessage,
    regenerateMessage,
    cancelGeneration,
    undoGeneration,
    dismissGenerationBanner
  }
}
