import { migrateAIConfig } from './aiAccounts'
import type { AIConfig, AppSettings, Profile } from './types'

/**
 * The general AI and the per-profile override — pure, so both processes and
 * the test suite can use them.
 *
 * Like git's `--global` config with a local override: the app holds one AI
 * (`AppSettings.ai`) that every profile uses, and a profile may keep its own
 * (`Profile.ownAI`). Only the *engine* — who answers, with which key and model —
 * is shared. The *personal* fields — how the output reads — always stay on the
 * profile, because a work and a personal profile legitimately want different
 * commit styles while paying for the same account.
 */

/**
 * Fields that pick who answers: the accounts and their keys, the default and
 * per-feature assignments, the resolved connection mirrored from them, and the
 * master switch. Shared from the general AI unless the profile has its own.
 *
 * `repoChatModel` is here because it chooses a model — it is legacy, folded into
 * the chat assignment by `migrateAIConfig` — and `cliCwd` because it is stamped
 * per call by the renderer and never belongs to a profile's taste.
 */
export const AI_ENGINE_FIELDS = [
  'enabled',
  'accounts',
  'defaultAccountId',
  'assignments',
  'provider',
  'endpoint',
  'apiKey',
  'model',
  'accountId',
  'transport',
  'cli',
  'cliPath',
  'subscription',
  'cliCwd',
  'repoChatModel'
] as const satisfies readonly (keyof AIConfig)[]

/**
 * Fields that shape the output, or what the assistant may do: styles, custom
 * instructions, trailers, hover, and the repository chat's privacy and action
 * policy. Always read from the profile, whichever engine answers.
 */
export const AI_PERSONAL_FIELDS = [
  'commitStyle',
  'explainStyle',
  'conflictStyle',
  'branchNamingStyle',
  'customInstructions',
  'generateDescription',
  'coAuthor',
  'hoverExplain',
  'hoverExplainKey',
  'repoChat',
  'repoChatCommittedOnly',
  'repoChatActions',
  'repoChatReadOnly',
  'repoChatRemoteActions',
  'repoChatApproval'
] as const satisfies readonly (keyof AIConfig)[]

export type AIEngineField = (typeof AI_ENGINE_FIELDS)[number]
export type AIPersonalField = (typeof AI_PERSONAL_FIELDS)[number]
export type AIEngine = Pick<AIConfig, AIEngineField>
export type AIPersonal = Pick<AIConfig, AIPersonalField>

// A field added to AIConfig without being classified fails to compile here, so
// it cannot silently stay per-profile (or silently become shared).
type Unclassified = Exclude<keyof AIConfig, AIEngineField | AIPersonalField>
type DoublyClassified = Extract<AIEngineField, AIPersonalField>
const classified: [Unclassified, DoublyClassified] extends [never, never] ? true : never = true
void classified

const ENGINE_SET: ReadonlySet<string> = new Set(AI_ENGINE_FIELDS)

export function isAIEngineField(field: string): field is AIEngineField {
  return ENGINE_SET.has(field)
}

/** Copies the listed fields that `ai` actually has — an absent optional stays absent. */
function pick<K extends keyof AIConfig>(ai: Partial<AIConfig>, fields: readonly K[]): Pick<AIConfig, K> {
  const out: Partial<AIConfig> = {}
  for (const field of fields) {
    if (field in ai) (out as Record<string, unknown>)[field] = ai[field]
  }
  return out as Pick<AIConfig, K>
}

/** The engine half of a config. */
export function engineOf(ai: Partial<AIConfig>): AIEngine {
  return pick(ai, AI_ENGINE_FIELDS)
}

/** The personal half of a config. */
export function personalOf(ai: Partial<AIConfig>): AIPersonal {
  return pick(ai, AI_PERSONAL_FIELDS)
}

/** True when the profile answers with the general AI's engine. */
export function usesGeneralAI(profile: Pick<Profile, 'ownAI'>): boolean {
  return profile.ownAI !== true
}

/**
 * The config a profile actually runs with: its own when `ownAI`, otherwise its
 * personal fields over the general AI's engine. Engine fields left on a profile
 * that uses the general AI are dropped, not merged — a stale `cli` or key there
 * must never leak into the general engine's calls.
 */
export function effectiveAI(settings: Pick<AppSettings, 'ai'>, profile: Pick<Profile, 'ai' | 'ownAI'>): AIConfig {
  if (!usesGeneralAI(profile) || !settings.ai) return profile.ai
  return { ...personalOf(profile.ai), ...engineOf(settings.ai) }
}

/** Key-order-independent JSON, so two equal configs always serialise alike. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/**
 * Whether two configs answer with the same engine — same accounts (keys
 * included), default, assignments and switch. Both sides are brought to the
 * account model first, so a pre-accounts config equals its migrated self.
 * `cliCwd` is per call and never compared; `ignoreKeys` leaves the keys out too.
 */
export function aiEnginesEqual(
  a: Partial<AIConfig>,
  b: Partial<AIConfig>,
  opts?: { ignoreKeys?: boolean }
): boolean {
  const norm = (ai: Partial<AIConfig>): string => {
    const engine: Partial<AIEngine> = engineOf(migrateAIConfig(ai))
    delete engine.cliCwd
    if (opts?.ignoreKeys) {
      delete engine.apiKey
      engine.accounts = (engine.accounts ?? []).map((account) => ({ ...account, apiKey: '' }))
    }
    return canonical(engine)
  }
  return norm(a) === norm(b)
}

/**
 * Brings a settings object that predates the general AI forward. Idempotent and
 * lossless: a file that already has `ai` only gets it migrated to the account
 * model.
 *
 * Without one, the general AI's engine is the active profile's, and every
 * profile whose engine differs keeps its own — so one profile, or several
 * identical ones, end up with no exception at all. `aiSecretsFrom` records
 * where the general AI's keys still live: they are in the keychain store under
 * that profile's id, and `applySecrets` reads them from there until the general
 * AI has an entry of its own.
 *
 * Keys still encrypted read as blank here, so two profiles differing only in
 * an encrypted key look equal. While `aiSecretsFrom` is set, `applySecrets`
 * re-checks with the keys; main then settles it for good on the first unlock
 * (`settleGeneralAI`): the general AI gets its own keychain entry, the
 * exceptions are persisted, and profiles on the general AI drop their old
 * engine — keys included. Until then they keep it: it is what the re-check
 * measures, and nothing is lost before the keys have been seen.
 */
export function ensureGeneralAI<T extends Omit<AppSettings, 'ai'> & { ai?: Partial<AIConfig> }>(
  settings: T
): T & { ai: AIConfig } {
  if (settings.ai) return { ...settings, ai: migrateAIConfig(settings.ai) }
  const profiles = settings.profiles ?? []
  const active = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  // Personal fields on the general AI are never read; keeping the source's
  // means the stored object is still a whole, sensible config.
  const ai = migrateAIConfig(active?.ai)
  const out = {
    ...settings,
    ai,
    ...(active ? { aiSecretsFrom: active.id } : {}),
    profiles: profiles.map((p) => {
      const own = p !== active && !aiEnginesEqual(p.ai, ai)
      const { ownAI: _drop, ...rest } = p
      void _drop
      return own ? { ...rest, ownAI: true } : rest
    })
  }
  return out as T & { ai: AIConfig }
}

/**
 * Writes the general AI's engine. Its personal fields are left as they were:
 * nobody reads them, and replacing them would only churn the file.
 */
export function withGeneralAI(settings: AppSettings, ai: Partial<AIConfig>): AppSettings {
  return { ...settings, ai: { ...personalOf(settings.ai), ...engineOf(ai) } as AIConfig }
}

/**
 * Routes a change to where it takes effect: engine fields to the general AI
 * when the profile uses it, or to the profile's own; personal fields always to
 * the profile. An unknown profile id changes nothing.
 */
export function withAIPatch(settings: AppSettings, profileId: string, partial: Partial<AIConfig>): AppSettings {
  const profile = settings.profiles.find((p) => p.id === profileId)
  if (!profile) return settings
  const engine = engineOf(partial)
  const personal = personalOf(partial)
  const general = usesGeneralAI(profile)
  const hasEngine = Object.keys(engine).length > 0
  const next: AppSettings = general && hasEngine ? { ...settings, ai: { ...settings.ai, ...engine } } : settings
  const profileHalf = general ? personal : { ...personal, ...engine }
  if (Object.keys(profileHalf).length === 0) return next
  return {
    ...next,
    profiles: next.profiles.map((p) => (p.id === profileId ? { ...p, ai: { ...p.ai, ...profileHalf } } : p))
  }
}

/** A profile config with its engine reset to `fallback`'s, personal fields kept. */
export function withoutAIEngine(ai: AIConfig, fallback: AIConfig): AIConfig {
  return { ...personalOf(ai), ...engineOf(fallback) } as AIConfig
}

/**
 * The settings without the migration's keychain seed. For an export: the id it
 * names is this machine's, and on another one it would point keys at whatever
 * profile happens to share it.
 */
export function withoutAISecretsSeed<T extends { aiSecretsFrom?: string }>(settings: T): T {
  if (!('aiSecretsFrom' in settings)) return settings
  const { aiSecretsFrom: _from, ...rest } = settings
  void _from
  return rest as T
}

/**
 * Gives a profile its own AI, or hands it back to the general one.
 *
 * On: the profile starts from a copy of the general engine, so it is never an
 * empty, keyless config the user then has to rebuild.
 *
 * Off: the profile's engine is reset to `fallback` (the defaults). Keeping it
 * would be harmless to behaviour, but its keys would stay in the keychain store
 * under a profile that no longer uses them — and an own AI turned back on
 * starts from the general one anyway, so nothing worth keeping is lost.
 */
export function withProfileOwnAI(settings: AppSettings, profileId: string, own: boolean, fallback: AIConfig): AppSettings {
  return {
    ...settings,
    profiles: settings.profiles.map((p) => {
      if (p.id !== profileId || (p.ownAI === true) === own) return p
      if (own) return { ...p, ownAI: true, ai: { ...personalOf(p.ai), ...engineOf(settings.ai) } as AIConfig }
      const ai = withoutAIEngine(p.ai, fallback)
      const { ownAI: _drop, ...rest } = p
      void _drop
      return { ...rest, ai }
    })
  }
}
