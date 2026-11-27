import type { AIConfig, ModelCatalog } from '../../../shared/types'
import { accountFor, accountLabel, findAccount, modelFor, resolveAI } from '../../../shared/aiAccounts'

/**
 * The commit box's "Generate with AI": which account and model answer, how
 * long it has been running, and the banner that offers Undo afterwards. Pure,
 * so the rules are tested without a component.
 */

/** Who answers one generation. Never written back to settings. */
export interface GenerationTarget {
  accountId: string
  model: string
}

/** The text a generation replaces, and what it wrote in its place. */
export interface MessageDraft {
  summary: string
  description: string
}

/** Models offered per account in the menu: the list is a shortcut, not a catalogue. */
export const MENU_MODELS_PER_ACCOUNT = 5

/** The commit task's own account and model, as Settings → AI resolves them. */
export function defaultGenerationTarget(ai: AIConfig): GenerationTarget | null {
  const account = accountFor(ai, 'commit')
  return account ? { accountId: account.id, model: modelFor(ai, 'commit') } : null
}

/**
 * The call's config for a target: the commit task pointed at that account and
 * model for this call only. Unknown accounts fall back to the task's own.
 */
export function configForTarget(ai: AIConfig, target: GenerationTarget | null): AIConfig {
  if (!target || !findAccount(ai, target.accountId)) return resolveAI(ai, 'commit')
  return resolveAI({ ...ai, assignments: { ...(ai.assignments ?? {}), commit: { ...target } } }, 'commit')
}

/** "Work Gemini · gemini-2.5-flash" — or the account alone when it has no model name (a CLI). */
export function targetLabel(ai: AIConfig, target: GenerationTarget | null): string {
  const account = target ? findAccount(ai, target.accountId) : undefined
  if (!account) return ''
  const name = accountLabel(account)
  return target?.model ? `${name} · ${target.model}` : name
}

/** The label of the config a call actually went to (it may have moved account). */
export function configLabel(cfg: AIConfig): string {
  return targetLabel(cfg, cfg.accountId ? { accountId: cfg.accountId, model: cfg.model ?? '' } : null)
}

export interface GenerationChoice {
  accountId: string
  label: string
  /** The account's default model first, then the catalogue's, without repeats. */
  models: string[]
}

/**
 * What the ▾ menu offers: every saved account, each with a few of its models.
 * Until a catalogue arrives an account still offers its own default model.
 */
export function generationChoices(ai: AIConfig, catalogs: Record<string, ModelCatalog | undefined>): GenerationChoice[] {
  return (ai.accounts ?? []).map((account) => {
    const own = resolveAI({ ...ai, defaultAccountId: account.id, assignments: {} }).model
    const listed = catalogs[account.id]?.models ?? []
    const models = [...new Set([own, ...listed].map((m) => (m ?? '').trim()).filter(Boolean))]
    return { accountId: account.id, label: accountLabel(account), models: models.slice(0, MENU_MODELS_PER_ACCOUNT) }
  })
}

/** An account's default model — the target "Generate again" takes after a switch. */
export function accountDefaultTarget(ai: AIConfig, accountId: string): GenerationTarget {
  return { accountId, model: resolveAI({ ...ai, defaultAccountId: accountId, assignments: {} }).model }
}

/** Whole seconds since `startedAt`, never negative (a clock step back). */
export function elapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

export type GenerationState =
  | { phase: 'idle' }
  | { phase: 'generating'; tag: string; startedAt: number; label: string; accountId: string; previous: MessageDraft }
  | { phase: 'generated'; label: string; seconds: number; previous: MessageDraft; generated: MessageDraft }

export type GenerationEvent =
  | { type: 'start'; tag: string; startedAt: number; label: string; accountId: string; current: MessageDraft }
  /** The call moved to another account (the slow prompt's switch). */
  | { type: 'attempt'; tag: string; label: string; accountId: string }
  | { type: 'finish'; tag: string; finishedAt: number; generated: MessageDraft }
  | { type: 'fail'; tag: string }
  | { type: 'cancel' }
  /** The text changed: if it is no longer what was generated, the banner goes. */
  | { type: 'edit'; current: MessageDraft }
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'dismiss' }

export const IDLE: GenerationState = { phase: 'idle' }

const sameDraft = (a: MessageDraft, b: MessageDraft): boolean =>
  a.summary === b.summary && a.description === b.description

/**
 * The generation's life: idle → generating → generated (the Undo banner) → idle.
 * Events for a generation that is no longer the current one — the late answer
 * of a cancelled request — change nothing; that is the renderer half of Cancel.
 */
export function nextGeneration(state: GenerationState, event: GenerationEvent): GenerationState {
  switch (event.type) {
    case 'start': {
      // "Generate again" or a re-run on another account keeps the text from
      // before the first generation: Undo returns to what the user wrote.
      const previous = state.phase === 'idle' ? event.current : state.previous
      return {
        phase: 'generating',
        tag: event.tag,
        startedAt: event.startedAt,
        label: event.label,
        accountId: event.accountId,
        previous
      }
    }
    case 'attempt':
      if (state.phase !== 'generating' || state.tag !== event.tag) return state
      return { ...state, label: event.label, accountId: event.accountId }
    case 'finish':
      if (state.phase !== 'generating' || state.tag !== event.tag) return state
      return {
        phase: 'generated',
        label: state.label,
        seconds: elapsedSeconds(state.startedAt, event.finishedAt),
        previous: state.previous,
        generated: event.generated
      }
    case 'fail':
      if (state.phase !== 'generating' || state.tag !== event.tag) return state
      return IDLE
    case 'cancel':
      return state.phase === 'generating' ? IDLE : state
    case 'edit':
      if (state.phase !== 'generated' || sameDraft(state.generated, event.current)) return state
      return IDLE
    case 'commit':
    case 'undo':
    case 'dismiss':
      return state.phase === 'generated' ? IDLE : state
  }
}

/** The tag of the generation running now, or null. */
export function runningTag(state: GenerationState): string | null {
  return state.phase === 'generating' ? state.tag : null
}
