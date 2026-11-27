import type { TranslationKey } from '../i18n'
import type { AIAccount, AIConfig, ModelCatalog, SubscriptionTest } from '../../../shared/types'
import {
  accountConnectionKey,
  accountFor,
  accountNeedsKey,
  findAccount,
  newAccount,
  nextAccountId
} from '../../../shared/aiAccounts'
import { redactSecrets } from '../../../shared/redact'

/**
 * The provider editor's pending state, kept apart from the saved config.
 *
 * Every keystroke used to land in settings, and "Add provider" saved an empty
 * account the moment it was pressed — so a half-typed key was already live, and
 * a provider nobody finished could end up answering every task. A draft is the
 * copy being edited; nothing reaches the config until it is committed.
 */
export interface AccountDraft {
  /** The saved account this draft edits, or null for one not yet added. */
  original: AIAccount | null
  account: AIAccount
}

export function startNewDraft(existing: AIAccount[]): AccountDraft {
  return { original: null, account: newAccount(existing, 'openai') }
}

export function startEditDraft(account: AIAccount): AccountDraft {
  return { original: account, account: { ...account } }
}

const COMPARED: (keyof AIAccount)[] = ['label', 'provider', 'endpoint', 'apiKey', 'model', 'cli', 'cliPath', 'subscription']

/** Field-by-field, treating a missing optional field and an empty one alike. */
export function sameAccount(a: AIAccount, b: AIAccount): boolean {
  return COMPARED.every((field) => (a[field] ?? '') === (b[field] ?? ''))
}

/** A new draft is always pending; an edit only once it differs from what is saved. */
export function isDraftDirty(draft: AccountDraft | null): boolean {
  if (!draft) return false
  return !draft.original || !sameAccount(draft.original, draft.account)
}

/**
 * Writes a draft into the config. A new account gets its id from its final
 * provider — a draft started as OpenAI and switched to Ollama is `ollama`, not
 * `openai` — and becomes the default only when the default it would replace is
 * the untouched keyless starter, the same rule the subscription setup uses.
 */
export function commitDraft(ai: AIConfig, draft: AccountDraft): { ai: AIConfig; accountId: string } {
  const accounts = ai.accounts ?? []
  if (draft.original) {
    const id = draft.original.id
    const account = { ...draft.account, id }
    return { ai: { ...ai, accounts: accounts.map((a) => (a.id === id ? account : a)) }, accountId: id }
  }
  const id = nextAccountId(accounts, draft.account.provider)
  const account = { ...draft.account, id }
  const current = accounts.find((a) => a.id === ai.defaultAccountId)
  const starter = accounts.length === 1 && current?.id === 'default' && accountNeedsKey(current)
  return {
    ai: {
      ...ai,
      accounts: [...accounts, account],
      defaultAccountId: starter || !current ? id : ai.defaultAccountId
    },
    accountId: id
  }
}

/** A short, non-reversible digest so a check can tell one key from another
 *  without holding a second copy of it. FNV-1a — collisions only cost a
 *  "Ready" that should have said "Not checked yet". */
function digest(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * What a connection check was run against. The connection key alone reduces
 * the API key to "is there one", so replacing a working key with a wrong one
 * would have kept the old "Ready".
 */
export function checkFingerprint(account: AIAccount): string {
  return `${accountConnectionKey(account)}|${digest((account.apiKey ?? '').trim())}`
}

/** The outcome of testing a connection: listing its models, or probing its CLI. */
export type AccountCheck =
  | { fingerprint: string; ok: true; models?: number; catalog?: ModelCatalog }
  | { fingerprint: string; ok: false; reasonKey?: TranslationKey; detail?: string }

const MAX_DETAIL = 300

/**
 * A provider's error, fit to show. The provider answered with whatever it
 * likes — some echo the key back — so the account's own key is masked along
 * with every known token shape before the text reaches the screen.
 */
export function readableReason(message: string, secrets: string[] = []): string {
  let out = withoutJsonBody(message)
  for (const secret of secrets) {
    const value = secret.trim()
    if (value.length >= 4) out = out.split(value).join('***')
  }
  out = redactSecrets(out)
    // AI keys the shared list does not know: OpenAI/Anthropic `sk-…`, Google `AIza…`.
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '***')
    .replace(/\bAIza[A-Za-z0-9_-]{20,}/g, '***')
    // A key passed as a query parameter on a custom endpoint.
    .replace(/([?&](?:key|api[_-]?key|token)=)[^&\s'"]+/gi, '$1***')
    .replace(/\s+/g, ' ')
    .trim()
  return out.length > MAX_DETAIL ? `${out.slice(0, MAX_DETAIL - 1)}…` : out
}

/**
 * A provider's JSON error body, reduced to its `message`. "Could not list
 * models (401): { "error": { "message": "Incorrect API key…", "type": … } }"
 * reads as "Could not list models (401): Incorrect API key…". Only a `message`
 * field is lifted; anything else stays as it came.
 */
function withoutJsonBody(text: string): string {
  const start = text.indexOf('{')
  if (start < 0) return text
  const found = /"message"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(text.slice(start))
  if (!found) return text
  const inner = found[1].replace(/\\"/g, '"').replace(/\\n/g, ' ')
  return `${text.slice(0, start).trimEnd()} ${inner}`.trim()
}

/** A model listing as a check: only a list fetched just now proves the connection. */
export function checkFromCatalog(account: AIAccount, catalog: ModelCatalog): AccountCheck {
  const fingerprint = checkFingerprint(account)
  if (catalog.source === 'live') return { fingerprint, ok: true, models: catalog.models.length, catalog }
  return {
    fingerprint,
    ok: false,
    ...(catalog.error ? { detail: readableReason(catalog.error, [account.apiKey ?? '']) } : { reasonKey: 'settings.accountCheckFailed' })
  }
}

export function checkFromError(account: AIAccount, err: unknown): AccountCheck {
  const message = err instanceof Error ? err.message : String(err)
  return { fingerprint: checkFingerprint(account), ok: false, detail: readableReason(message, [account.apiKey ?? '']) }
}

const SUBSCRIPTION_REASON: Record<Exclude<SubscriptionTest, 'connected'>, TranslationKey> = {
  missing: 'settings.cliNotFound',
  login: 'settings.accountCheckLogin',
  limit: 'settings.planLimit',
  failed: 'settings.planFailed'
}

export function checkFromSubscription(account: AIAccount, result: SubscriptionTest): AccountCheck {
  const fingerprint = checkFingerprint(account)
  if (result === 'connected') return { fingerprint, ok: true }
  return { fingerprint, ok: false, reasonKey: SUBSCRIPTION_REASON[result] }
}

/** How an account would be tested: a model listing, a subscription probe, or
 *  only finding the CLI on PATH. A key the account requires and lacks is not
 *  worth a request at all. */
export type CheckPlan = 'needs-key' | 'list' | 'subscription' | 'detect'

export function checkPlanFor(account: AIAccount): CheckPlan {
  if (account.provider === 'cli') {
    const binary = account.cli ?? 'claude'
    return account.subscription && (binary === 'claude' || binary === 'codex') ? 'subscription' : 'detect'
  }
  return accountNeedsKey(account) ? 'needs-key' : 'list'
}

export function checkFromDetection(account: AIAccount, found: boolean): AccountCheck {
  const fingerprint = checkFingerprint(account)
  return found ? { fingerprint, ok: true } : { fingerprint, ok: false, reasonKey: 'settings.cliNotFound' }
}

export function checkNeedsKey(account: AIAccount): AccountCheck {
  return { fingerprint: checkFingerprint(account), ok: false, reasonKey: 'settings.accountNeedsKey' }
}

export type AccountStatus = 'ready' | 'no-key' | 'failing' | 'unchecked'

export interface AccountStatusView {
  status: AccountStatus
  /** Why a failing account fails: a translated reason, or the provider's own words. */
  reasonKey?: TranslationKey
  detail?: string
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, TranslationKey> = {
  ready: 'settings.accountStatusReady',
  'no-key': 'settings.accountStatusNoKey',
  failing: 'settings.accountStatusFailing',
  unchecked: 'settings.accountStatusUnchecked'
}

/**
 * The badge an account shows. Derived from what is already known — the last
 * explicit check, else the model list the page fetched anyway — and never a
 * reason to make a request of its own.
 *
 * A CLI account's model list is bundled, not fetched, so it proves nothing:
 * only a check or, for a plain CLI, finding the command says it works.
 * `cliDetected` is undefined when that cannot be told (a custom path).
 */
export function accountStatus(
  account: AIAccount,
  catalog: ModelCatalog | undefined,
  check: AccountCheck | undefined,
  cliDetected?: boolean
): AccountStatusView {
  if (accountNeedsKey(account)) return { status: 'no-key' }
  if (check && check.fingerprint === checkFingerprint(account)) {
    return check.ok ? { status: 'ready' } : { status: 'failing', reasonKey: check.reasonKey, detail: check.detail }
  }
  if (account.provider === 'cli') {
    if (account.subscription || cliDetected === undefined) return { status: 'unchecked' }
    return cliDetected ? { status: 'ready' } : { status: 'failing', reasonKey: 'settings.cliNotFound' }
  }
  if (!catalog) return { status: 'unchecked' }
  if (catalog.error) return { status: 'failing', detail: readableReason(catalog.error, [account.apiKey ?? '']) }
  return catalog.source === 'fallback' ? { status: 'unchecked' } : { status: 'ready' }
}

/** The fields an edit changed, so each can say so next to its label. A new
 *  draft has nothing to compare against and marks none. */
export function changedFields(draft: AccountDraft | null): Set<keyof AIAccount> {
  const out = new Set<keyof AIAccount>()
  if (!draft?.original) return out
  for (const field of COMPARED) {
    if ((draft.original[field] ?? '') !== (draft.account[field] ?? '')) out.add(field)
  }
  return out
}

/**
 * What a provider's row offers at its right edge: the "In use" pill on the
 * account answering every task without a provider of its own, a one-click
 * "Use" on every other saved one, and nothing on a draft — an unsaved provider
 * cannot be put in use before it exists.
 *
 * "In use" follows what actually answers, so a `defaultAccountId` left pointing
 * at nothing marks the first account, the one `accountFor` falls back to.
 * A row's status never hides the button: putting a "No key" provider in use is
 * the user's call, and its pill keeps saying what is wrong.
 */
export type AccountRowRole = 'in-use' | 'use' | 'none'

export function accountRowRole(ai: AIConfig, accountId: string, isDraft = false): AccountRowRole {
  if (isDraft || !findAccount(ai, accountId)) return 'none'
  return accountFor(ai)?.id === accountId ? 'in-use' : 'use'
}

/** The config with a saved account put in use. An unknown id changes nothing. */
export function setAccountInUse(ai: AIConfig, accountId: string): AIConfig {
  if (!findAccount(ai, accountId) || ai.defaultAccountId === accountId) return ai
  return { ...ai, defaultAccountId: accountId }
}
