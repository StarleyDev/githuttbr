import type { AIAccount, AIConfig } from '../../../shared/types'
import { accountLabel, accountNeedsKey, resolveAI } from '../../../shared/aiAccounts'

/**
 * What a failed AI call means, read from the tag the main process put on its
 * message (main/aiRequests.ts) — an Error crossing IPC keeps only its message.
 */
export type AIOutcome =
  | { kind: 'cancelled' }
  | { kind: 'switch'; accountId: string }
  | { kind: 'unreachable' }

export function aiOutcome(err: unknown): AIOutcome | null {
  const message = err instanceof Error ? err.message : String(err ?? '')
  const m = /\[ai:(cancelled|unreachable|switch:([^\]\s]+))\]/.exec(message)
  if (!m) return null
  if (m[1] === 'cancelled') return { kind: 'cancelled' }
  if (m[1] === 'unreachable') return { kind: 'unreachable' }
  return { kind: 'switch', accountId: m[2] }
}

/** The name the user knows the account by. */
export function accountNameOf(cfg: AIConfig, accountId = cfg.accountId): string {
  const account = (cfg.accounts ?? []).find((a) => a.id === accountId)
  return account ? accountLabel(account) : (cfg.provider ?? 'AI')
}

/** Accounts a call could move to: every other one that can make a call right now. */
export function otherAccounts(cfg: AIConfig, excludeId = cfg.accountId): AIAccount[] {
  return (cfg.accounts ?? []).filter((a) => a.id !== excludeId && !accountNeedsKey(a))
}

/** The same call's config, pointed at another account (its default model). */
export function configForAccount(cfg: AIConfig, accountId: string): AIConfig {
  return { ...resolveAI({ ...cfg, defaultAccountId: accountId, assignments: {} }), cliCwd: cfg.cliCwd }
}

export interface GuardDeps {
  /** Ask which account to use now that `label` is not responding; null keeps the failure. */
  askUnreachable: (label: string, others: AIAccount[]) => Promise<string | null>
  cancelledMessage: () => string
  unreachableMessage: (label: string) => string
}

/**
 * Runs an AI call and handles the outcomes the user chose or the watchdog
 * decided: a switch re-runs the same call on the other account, a cancel ends
 * it with a plain message, and a dead local server offers the other accounts
 * before giving up.
 */
export async function guardAI<T>(
  cfg: AIConfig,
  call: (cfg: AIConfig) => Promise<T>,
  deps: GuardDeps
): Promise<T> {
  try {
    return await call(cfg)
  } catch (err) {
    const outcome = aiOutcome(err)
    if (!outcome) throw err
    if (outcome.kind === 'switch') return guardAI(configForAccount(cfg, outcome.accountId), call, deps)
    if (outcome.kind === 'cancelled') throw new Error(deps.cancelledMessage())
    const label = accountNameOf(cfg)
    const others = otherAccounts(cfg)
    const pick = others.length ? await deps.askUnreachable(label, others) : null
    if (pick) return guardAI(configForAccount(cfg, pick), call, deps)
    throw new Error(deps.unreachableMessage(label))
  }
}
