import type { TranslationKey } from '../i18n'
import type {
  AIAccount,
  AIConfig,
  AIProvider,
  DetectedCli,
  SubscriptionCli
} from '../../../shared/types'
import { newAccount } from '../../../shared/aiAccounts'
import { commitDraft, setAccountInUse } from './aiAccountDraft'

/**
 * The first-run wizard's logic, kept out of the component so the step list,
 * what counts as finished and how a card turns into an AI account can be
 * tested against stable keys.
 */

export type OnboardingStepId = 'identity' | 'accounts' | 'ai' | 'appearance' | 'done'

export interface OnboardingStep {
  id: OnboardingStepId
  /** The stepper's label. */
  labelKey: TranslationKey
  /** Steps the user can leave empty say so in the eyebrow. */
  optional: boolean
}

/**
 * Only steps with a feature behind them. The welcome screen (and its settings
 * import) comes before the list and is not one of them.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: 'identity', labelKey: 'onboarding.stepIdentity', optional: false },
  { id: 'accounts', labelKey: 'onboarding.stepAccounts', optional: true },
  { id: 'ai', labelKey: 'onboarding.stepAI', optional: true },
  { id: 'appearance', labelKey: 'onboarding.stepAppearance', optional: true },
  { id: 'done', labelKey: 'onboarding.stepDone', optional: false }
]

/**
 * `done` — passed with something filled in; `skipped` — passed and left empty,
 * which must not wear the same green check; `current`; `todo`.
 */
export type StepState = 'done' | 'skipped' | 'current' | 'todo'

/** What the wizard holds that decides whether a step was filled in. */
export interface OnboardingProgress {
  gitName: string
  gitEmail: string
  /** Any hosting token or self-hosted server entered on the accounts step. */
  hasHostAccount: boolean
  /** The AI account the AI step saved, if it saved one. */
  aiAccountId: string | null
}

export function isStepFilled(id: OnboardingStepId, p: OnboardingProgress): boolean {
  switch (id) {
    case 'identity':
      return !!p.gitName.trim() && !!p.gitEmail.trim()
    case 'accounts':
      return p.hasHostAccount
    case 'ai':
      return !!p.aiAccountId
    case 'appearance':
    case 'done':
      return true
  }
}

/**
 * Each step's state for the stepper. `current` is an index into
 * ONBOARDING_STEPS; -1 is the welcome screen, where nothing has started.
 */
export function stepStates(current: number, p: OnboardingProgress): StepState[] {
  return ONBOARDING_STEPS.map((step, i) => {
    if (i === current) return 'current'
    if (i > current) return 'todo'
    return isStepFilled(step.id, p) ? 'done' : 'skipped'
  })
}

/** "Step 3 of 5 · Optional" — rendered by the caller, so word order stays per locale. */
export function stepEyebrow(current: number): { key: TranslationKey; vars: { n: number; total: number } } {
  const step = ONBOARDING_STEPS[current]
  return {
    key: step?.optional ? 'onboarding.eyebrowOptional' : 'onboarding.eyebrow',
    vars: { n: current + 1, total: ONBOARDING_STEPS.length }
  }
}

// ── The AI step ──────────────────────────────────────────────────────────────

export type AIChoice = 'subscription' | 'api-key' | 'local'

export const AI_CHOICES: readonly { id: AIChoice; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { id: 'subscription', titleKey: 'onboarding.aiChoiceSubscription', descKey: 'onboarding.aiChoiceSubscriptionDesc' },
  { id: 'api-key', titleKey: 'onboarding.aiChoiceApiKey', descKey: 'onboarding.aiChoiceApiKeyDesc' },
  { id: 'local', titleKey: 'onboarding.aiChoiceLocal', descKey: 'onboarding.aiChoiceLocalDesc' }
]

/** The hosted providers the API-key card offers, most asked-for first. */
export const API_KEY_PROVIDERS: readonly AIProvider[] = ['openai', 'anthropic', 'google', 'groq', 'openrouter', 'mistral']

export type LocalServer = 'ollama' | 'lmstudio'

/**
 * LM Studio has no preset of its own: it serves the OpenAI-compatible API, so
 * it is a `custom` account pointed at its default port.
 */
export const LOCAL_SERVERS: Record<LocalServer, { provider: AIProvider; label: string; endpoint: string }> = {
  ollama: { provider: 'ollama', label: 'Ollama', endpoint: 'http://localhost:11434/v1' }, // i18n-ignore product name
  lmstudio: { provider: 'custom', label: 'LM Studio', endpoint: 'http://localhost:1234/v1' } // i18n-ignore product name
}

/** The binaries that can answer with the user's subscription. */
const SUBSCRIPTION_CLIS: readonly SubscriptionCli[] = ['claude', 'codex']

/** The subscription CLI to offer: Claude Code before Codex when both are found. */
export function subscriptionCliOf(clis: readonly DetectedCli[]): (DetectedCli & { binary: SubscriptionCli }) | null {
  for (const binary of SUBSCRIPTION_CLIS) {
    const found = clis.find((c) => c.binary === binary)
    if (found) return { ...found, binary }
  }
  return null
}

export type AIChoiceInput =
  | { kind: 'subscription'; cli: SubscriptionCli; path: string; label: string }
  | { kind: 'api-key'; provider: AIProvider; apiKey: string }
  | { kind: 'local'; server: LocalServer; endpoint: string }

/** The account a filled-in card describes, not yet added to any config. */
export function accountForChoice(existing: AIAccount[], input: AIChoiceInput): AIAccount {
  switch (input.kind) {
    case 'subscription':
      // Same shape Settings' "Use my subscription" adds (AIAccountsEditor.connect).
      return { ...newAccount(existing, 'cli'), cli: input.cli, subscription: true, cliPath: input.path, label: input.label }
    case 'api-key':
      return { ...newAccount(existing, input.provider), apiKey: input.apiKey.trim() }
    case 'local': {
      const server = LOCAL_SERVERS[input.server]
      return {
        ...newAccount(existing, server.provider),
        label: server.label,
        // A cleared field falls back to the server's default port, not to an
        // empty endpoint, which a `custom` account cannot reach anything with.
        endpoint: input.endpoint.trim() || server.endpoint
      }
    }
  }
}

/** A model the server actually listed: the preset's when it is there, the first one otherwise. */
export function withListedModel(account: AIAccount, models: readonly string[]): AIAccount {
  if (!models.length || models.includes(account.model)) return account
  return { ...account, model: models[0] }
}

/**
 * Adds the account and puts it in use, as Settings does when a new account is
 * saved and then picked — and turns AI on, which choosing a card asked for.
 */
export function addAccountInUse(
  ai: AIConfig,
  account: AIAccount,
  replacingId?: string
): { ai: AIConfig; accountId: string } {
  // Back on the step to fix the key: the account saved a moment ago is
  // updated, not joined by a second copy holding the wrong key.
  const original = replacingId ? ((ai.accounts ?? []).find((a) => a.id === replacingId) ?? null) : null
  const { ai: added, accountId } = commitDraft(ai, { original, account })
  return { ai: { ...setAccountInUse(added, accountId), enabled: true }, accountId }
}

/** Whole seconds for "answered in N s", never 0 for an answer that took any time. */
export function answeredInSeconds(ms: number): number {
  return Math.max(1, Math.round(ms / 1000))
}
