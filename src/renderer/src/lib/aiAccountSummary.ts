import type { TranslationKey } from '../i18n'
import { aiProviderPreset, type AIAccount, type ModelCatalog } from '../../../shared/types'
import { accountEndpoint } from '../../../shared/aiAccounts'

/**
 * One piece of a provider row's second line. Literal text is a token — a
 * command, an address, a model id — never prose; the one translated piece
 * comes back as a key so the caller renders it in the current language.
 */
export type AccountSummaryPart = { text: string } | { key: TranslationKey; vars: Record<string, string> }

/** Providers reached at an address the user runs, so the address is what tells
 *  two of them apart. A hosted API's address is the same for everyone. */
const SERVER_PROVIDERS = new Set<AIAccount['provider']>(['ollama', 'custom'])

/**
 * What a provider row says under its name: what the account actually uses.
 *
 * - a CLI or subscription: `CLI claude · sonnet`
 * - a server the user runs: `http://localhost:11434 · qwen3:8b` (the `/v1` the
 *   OpenAI-compatible path ends in is noise in a list)
 * - a hosted API: `gpt-4o-mini · 41 models`, the count only once the provider
 *   has listed them — the bundled list is a guess, not a count
 *
 * Empty pieces are left out, so a CLI on its default model reads `CLI claude`.
 */
export function accountSummaryParts(account: AIAccount, catalog?: ModelCatalog): AccountSummaryPart[] {
  const parts: AccountSummaryPart[] = []
  const model = (account.model ?? '').trim()
  if (account.provider === 'cli') {
    parts.push({ text: `CLI ${account.cli ?? 'claude'}` })
    if (model) parts.push({ text: model })
    return parts
  }
  const shownModel = model || aiProviderPreset(account.provider).defaultModel
  if (SERVER_PROVIDERS.has(account.provider)) {
    const address = endpointForList(accountEndpoint(account))
    if (address) parts.push({ text: address })
    if (shownModel) parts.push({ text: shownModel })
    return parts
  }
  if (shownModel) parts.push({ text: shownModel })
  if (catalog && catalog.source !== 'fallback' && catalog.models.length > 0) {
    parts.push({ key: 'settings.accountModelCount', vars: { count: String(catalog.models.length) } })
  }
  return parts
}

/** An endpoint without its trailing slash and the `/v1` API version. */
export function endpointForList(endpoint: string): string {
  return endpoint
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '')
}

/** The letter in a provider row's avatar: the CLI's command for a CLI account,
 *  since "Local CLI" says nothing; otherwise the provider's own name. */
export function accountInitial(account: AIAccount): string {
  const source = account.provider === 'cli' ? (account.cli ?? 'claude') : aiProviderPreset(account.provider).label
  return source.charAt(0).toUpperCase()
}
