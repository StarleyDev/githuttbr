import type { AIAccount, AIConfig, DetectedCli, ModelCatalog, Profile } from '../../../shared/types'
import { accountFor, accountLabel, accountNeedsKey, modelFor } from '../../../shared/aiAccounts'
import { usesGeneralAI } from '../../../shared/aiScope'
import {
  accountRowRole,
  accountStatus,
  readableReason,
  setAccountInUse,
  type AccountRowRole,
  type AccountStatusView
} from './aiAccountDraft'

/**
 * What the status bar's AI button and its popover show: which AI the active
 * profile answers with — the general one or its own — and every saved account
 * of that AI with its status.
 *
 * The popover exists to end one confusion: a profile with its own AI ignores
 * the general default, and nothing outside Settings said so. `scope` is that
 * sentence; the rows are the same accounts, in the same order, that the
 * providers screen lists for that scope.
 */
export interface AIStatusRow {
  id: string
  label: string
  model: string
  role: AccountRowRole
  status: AccountStatusView
}

export interface AIStatusView {
  scope: 'general' | 'own'
  /** The row answering every task without a provider of its own. */
  inUse: AIStatusRow
  rows: AIStatusRow[]
}

export interface AIStatusInputs {
  catalogs: Record<string, ModelCatalog>
  /** The CLIs found on PATH, or null while that is not known yet. */
  clis: DetectedCli[] | null
  /**
   * Whether the settings carry the decrypted keys. Until Settings is opened
   * they do not, and a blank key there means "not loaded", not "missing" — the
   * main process fills it in for every call, the model listing included.
   */
  keysKnown: boolean
}

/** Whether a plain CLI account's command was found — undefined when that
 *  cannot be told: a subscription, a custom path, or detection still running. */
export function cliDetectedFor(account: AIAccount, clis: DetectedCli[] | null): boolean | undefined {
  if (account.provider !== 'cli' || account.subscription) return undefined
  if ((account.cliPath ?? '').trim() || !clis) return undefined
  return clis.some((c) => c.binary === (account.cli ?? 'claude'))
}

/**
 * An account's status from what is already known — the model list the
 * catalogs fetched anyway, the CLI detection — and never a request of its own.
 * There are no explicit checks here: those live on the providers screen.
 */
export function statusBarAccountStatus(
  account: AIAccount,
  catalog: ModelCatalog | undefined,
  clis: DetectedCli[] | null,
  keysKnown: boolean
): AccountStatusView {
  if (!keysKnown && accountNeedsKey(account)) {
    // The key may well be stored: only the listing main ran with it can tell.
    if (!catalog) return { status: 'unchecked' }
    if (catalog.error) return { status: 'failing', detail: readableReason(catalog.error) }
    return catalog.source === 'fallback' ? { status: 'unchecked' } : { status: 'ready' }
  }
  return accountStatus(account, catalog, undefined, cliDetectedFor(account, clis))
}

/** The model an account answers with when it is the one in use. */
function accountModel(ai: AIConfig, account: AIAccount): string {
  return modelFor({ ...ai, defaultAccountId: account.id })
}

/** The view, or null when there is nothing to show: AI off, or no account. */
export function aiStatusView(
  ai: AIConfig,
  profile: Pick<Profile, 'ownAI'>,
  inputs: AIStatusInputs
): AIStatusView | null {
  if (ai.enabled === false) return null
  const accounts = ai.accounts ?? []
  const current = accountFor(ai)
  if (!current || accounts.length === 0) return null
  const rows = accounts.map((account) => ({
    id: account.id,
    label: accountLabel(account),
    model: accountModel(ai, account),
    role: accountRowRole(ai, account.id),
    status: statusBarAccountStatus(account, inputs.catalogs[account.id], inputs.clis, inputs.keysKnown)
  }))
  const inUse = rows.find((row) => row.id === current.id) ?? rows[0]
  return { scope: usesGeneralAI(profile) ? 'general' : 'own', inUse, rows }
}

/**
 * The patch that puts an account in use, for `saveAIFor(profileId, …)` —
 * which writes it where the profile reads its AI: the general AI, or its own.
 * Null when nothing would change, so a click on the account already in use
 * saves nothing.
 */
export function inUsePatch(ai: AIConfig, accountId: string): Pick<AIConfig, 'defaultAccountId'> | null {
  const next = setAccountInUse(ai, accountId)
  return next === ai ? null : { defaultAccountId: next.defaultAccountId }
}

/** Whether any account needs the CLI detection to say how it is. */
export function needsCliDetection(ai: AIConfig): boolean {
  return (ai.accounts ?? []).some((account) => cliDetectedFor(account, []) !== undefined)
}
