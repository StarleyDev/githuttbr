import { tokenMatchesInstance, GITLAB_COM, migrateGitlabProfile, migrateGitlabSettings, normalizeInstanceUrl } from './gitlabInstance'
import { normalizeGithubEnterpriseUrl } from './githubEnterprise'
import { normalizeBitbucketServerUrl } from './bitbucketServer'
import { serverUrlWithoutSecrets } from './serverAddress'
import { aiEnginesEqual, withoutAIEngine } from './aiScope'
import type { AIConfig, AppSettings } from './types'

/**
 * The credentials a profile can hold. They are kept out of the settings JSON on
 * disk (see main/settings.ts, which stores them with the OS keychain instead)
 * and out of exported settings files unless the user opts in.
 */
export interface ProfileSecrets {
  githubToken?: string
  azureToken?: string
  gitlabTokenIssuer?: string
  forgejoTokenIssuer?: string
  gitlabToken?: string
  bitbucketToken?: string
  forgejoToken?: string
  /** One token per GitHub Enterprise Server, keyed by its canonical base URL —
   *  so a token can only ever be restored onto the server it was saved for. */
  githubEnterpriseTokens?: Record<string, string>
  /** One token per self-managed GitLab server, keyed by its canonical base URL.
   *  `gitlabToken` is gitlab.com's; before servers were a list it could also be
   *  one self-managed instance's, named by `gitlabTokenIssuer` — see
   *  `migrateGitlabSecrets`. */
  gitlabServerTokens?: Record<string, string>
  /** One HTTP access token per Bitbucket Data Center, keyed by its canonical
   *  base URL (context path included), for the same reason. */
  bitbucketServerTokens?: Record<string, string>
  /** Legacy single AI key, written before accounts existed. Still read. */
  aiApiKey?: string
  /** One API key per AI account id. */
  aiKeys?: Record<string, string>
}

/** Secrets for every profile that has any, keyed by profile id — and the
 *  general AI's keys under `GENERAL_AI_SECRETS_ID`. */
export type SecretStore = Record<string, ProfileSecrets>

/**
 * Where the general AI (`AppSettings.ai`) files its keys in a `SecretStore`. Not
 * a profile id: those are `default` or short base-36 strings, never with an `@`.
 * Only `aiKeys`/`aiApiKey` are ever filed under it.
 */
export const GENERAL_AI_SECRETS_ID = '@general-ai'

/** Whether an AI config holds any key. */
function hasAIKeys(ai: AIConfig | undefined): boolean {
  return !!ai?.apiKey || (ai?.accounts ?? []).some((a) => !!a.apiKey)
}

/** The same config without any key. */
function withoutAIKeys(ai: AIConfig): AIConfig {
  return { ...ai, apiKey: '', accounts: (ai.accounts ?? []).map((a) => ({ ...a, apiKey: '' })) }
}

/** An AI config's keys as the store files them: one per account, or the legacy single key. */
function aiSecretsOf(ai: AIConfig | undefined): Pick<ProfileSecrets, 'aiKeys' | 'aiApiKey'> {
  const aiKeys: Record<string, string> = {}
  for (const account of ai?.accounts ?? []) {
    if (account.apiKey) aiKeys[account.id] = account.apiKey
  }
  if (Object.keys(aiKeys).length > 0) return { aiKeys }
  // Only written when the config predates accounts; migration folds it into
  // `aiKeys` the first time the settings are saved afterwards.
  if (ai?.apiKey) return { aiApiKey: ai.apiKey }
  return {}
}

/** Puts stored keys back on an AI config's accounts. */
function restoreAIKeys(ai: AIConfig, secrets: ProfileSecrets): AIConfig {
  let restored = ai
  const accounts = ai.accounts ?? []
  if (accounts.length > 0) {
    const keys = secrets.aiKeys ?? {}
    // A pre-accounts key belongs to the account the migration built from it.
    const legacyOwner = ai.defaultAccountId || accounts[0].id
    restored = {
      ...ai,
      accounts: accounts.map((a) => {
        const key = keys[a.id] ?? (a.id === legacyOwner ? secrets.aiApiKey : undefined)
        return key ? { ...a, apiKey: key } : a
      })
    }
  }
  // Keep the resolved field in step so a config used before migration still
  // authenticates.
  const resolvedKey =
    secrets.aiKeys?.[restored.accountId ?? restored.defaultAccountId ?? ''] ??
    secrets.aiKeys?.[accounts[0]?.id ?? ''] ??
    secrets.aiApiKey
  return resolvedKey ? { ...restored, apiKey: resolvedKey } : restored
}

/** Profile fields holding a host access token. */
export const TOKEN_FIELDS = ['githubToken', 'azureToken', 'gitlabToken', 'bitbucketToken', 'forgejoToken'] as const

export function hasSettingsSecrets(settings: AppSettings | null | undefined): boolean {
  if (hasAIKeys(settings?.ai)) return true
  return (settings?.profiles ?? []).some(
    (p) =>
      TOKEN_FIELDS.some((f) => !!p[f]) ||
      (p.githubEnterprise ?? []).some((h) => !!h.token) ||
      (p.gitlabServers ?? []).some((h) => !!h.token) ||
      (p.bitbucketServers ?? []).some((h) => !!h.token) ||
      hasAIKeys(p.ai)
  )
}

/** The same settings with every credential blanked out. */
export function stripSettingsSecrets(settings: AppSettings): AppSettings {
  return {
    ...settings,
    // A raw import may predate the general AI: never add the field to it.
    ...(settings.ai ? { ai: withoutAIKeys(settings.ai) } : {}),
    // A partial export (no profiles part) must stay without the key, not gain
    // an empty list that would replace ours on import.
    ...(settings.profiles
      ? {
          profiles: settings.profiles.map(migrateGitlabProfile).map((p) => ({
            ...p,
            githubToken: '',
            azureToken: '',
            gitlabToken: '',
            bitbucketToken: '',
            // Optional field: blank it where it exists, never add it to an older profile.
            ...(p.forgejoToken !== undefined ? { forgejoToken: '' } : {}),
            // The servers stay (they are not secret); their tokens go.
            ...(p.githubEnterprise ? { githubEnterprise: p.githubEnterprise.map((h) => ({ ...h, token: '' })) } : {}),
            ...(p.gitlabServers ? { gitlabServers: p.gitlabServers.map((h) => ({ ...h, token: '' })) } : {}),
            ...(p.bitbucketServers ? { bitbucketServers: p.bitbucketServers.map((h) => ({ ...h, token: '' })) } : {}),
            ai: p.ai ? withoutAIKeys(p.ai) : p.ai
          }))
        }
      : {})
  }
}

/** Pulls every non-empty credential out, keyed by profile id. */
export function extractSecrets(settings: AppSettings): SecretStore {
  const store: SecretStore = {}
  for (const p of (settings.profiles ?? []).map(migrateGitlabProfile)) {
    const secrets: ProfileSecrets = {}
    for (const field of TOKEN_FIELDS) {
      const value = p[field]
      if (!value) continue
      if (field === 'gitlabToken') {
        // Always gitlab.com's now; servers file theirs below.
        if (!tokenMatchesInstance('gitlab', undefined, p.gitlabTokenIssuer)) continue
        secrets.gitlabTokenIssuer = GITLAB_COM
      } else if (field === 'forgejoToken') {
        if (!tokenMatchesInstance('forgejo', p.forgejoUrl, p.forgejoTokenIssuer)) continue
        secrets.forgejoTokenIssuer = p.forgejoTokenIssuer
      }
      secrets[field] = value
    }
    const ghes: Record<string, string> = {}
    for (const h of p.githubEnterprise ?? []) {
      const base = normalizeGithubEnterpriseUrl(h.url)
      if (base && h.token) ghes[base] = h.token
    }
    if (Object.keys(ghes).length > 0) secrets.githubEnterpriseTokens = ghes
    const gitlab: Record<string, string> = {}
    for (const h of p.gitlabServers ?? []) {
      const base = normalizeInstanceUrl(h.url)
      if (base && base !== GITLAB_COM && h.token) gitlab[base] = h.token
    }
    if (Object.keys(gitlab).length > 0) secrets.gitlabServerTokens = gitlab
    const bbs: Record<string, string> = {}
    for (const h of p.bitbucketServers ?? []) {
      const base = normalizeBitbucketServerUrl(h.url)
      if (base && h.token) bbs[base] = h.token
    }
    if (Object.keys(bbs).length > 0) secrets.bitbucketServerTokens = bbs
    Object.assign(secrets, aiSecretsOf(p.ai))
    if (Object.keys(secrets).length > 0) store[p.id] = secrets
  }
  const general = aiSecretsOf(settings.ai)
  if (Object.keys(general).length > 0) store[GENERAL_AI_SECRETS_ID] = general
  return store
}

/**
 * A store written before GitLab servers were a list kept a self-managed
 * instance's token in `gitlabToken`, its issuer beside it. File it under that
 * instance instead — never as gitlab.com's. A token already filed there wins.
 */
export function migrateGitlabSecrets(store: SecretStore): SecretStore {
  let out: SecretStore | null = null
  for (const [id, secrets] of Object.entries(store)) {
    const issuer = secrets.gitlabTokenIssuer
    if (!issuer || issuer === GITLAB_COM) continue
    const { gitlabToken, ...rest } = secrets
    delete rest.gitlabTokenIssuer
    const base = normalizeInstanceUrl(issuer)
    const servers = { ...(base && gitlabToken ? { [base]: gitlabToken } : {}), ...(rest.gitlabServerTokens ?? {}) }
    out ??= { ...store }
    out[id] = { ...rest, ...(Object.keys(servers).length > 0 ? { gitlabServerTokens: servers } : {}) }
  }
  return out ?? store
}

/** Puts stored credentials back on their profiles, leaving the rest untouched. */
export function applySecrets(settings: AppSettings, raw: SecretStore, opts?: { seed?: boolean }): AppSettings {
  const store = migrateGitlabSecrets(raw)
  const restored: AppSettings = {
    ...settings,
    profiles: migrateGitlabSettings({ profiles: settings.profiles ?? [] }).profiles.map((p) => {
      const secrets = store[p.id]
      const restored = { ...p }
      for (const provider of ['gitlab', 'forgejo'] as const) {
        const field = `${provider}Token` as const
        const issuer = `${provider}TokenIssuer` as const
        // GitLab's own field is gitlab.com's: its servers are restored below.
        const address = provider === 'forgejo' ? p.forgejoUrl : undefined
        if (p[field] && !tokenMatchesInstance(provider, address, p[issuer])) restored[field] = ''
        if (secrets?.[field] && tokenMatchesInstance(provider, address, secrets[issuer])) {
          restored[field] = secrets[field]
          if (secrets[issuer]) restored[issuer] = secrets[issuer]
        }
      }
      if (!secrets) return restored
      const gitlab = secrets.gitlabServerTokens
      if (gitlab && restored.gitlabServers) {
        restored.gitlabServers = restored.gitlabServers.map((h) => {
          const base = normalizeInstanceUrl(h.url)
          const token = base ? gitlab[base] : undefined
          return token ? { ...h, token } : h
        })
      }
      const ghes = secrets.githubEnterpriseTokens
      if (ghes && restored.githubEnterprise) {
        restored.githubEnterprise = restored.githubEnterprise.map((h) => {
          const base = normalizeGithubEnterpriseUrl(h.url)
          const token = base ? ghes[base] : undefined
          return token ? { ...h, token } : h
        })
      }
      const bbs = secrets.bitbucketServerTokens
      if (bbs && restored.bitbucketServers) {
        restored.bitbucketServers = restored.bitbucketServers.map((h) => {
          const base = normalizeBitbucketServerUrl(h.url)
          const token = base ? bbs[base] : undefined
          return token ? { ...h, token } : h
        })
      }
      for (const field of TOKEN_FIELDS) {
        if (field === 'gitlabToken' || field === 'forgejoToken') continue
        if (secrets[field]) restored[field] = secrets[field] as string
      }
      if (!restored.ai) return restored
      restored.ai = restoreAIKeys(restored.ai, secrets)
      return restored
    })
  }
  return withGeneralAISecrets(restored, store, opts?.seed !== false)
}

/**
 * A profile the migration put on the general AI although only an encrypted key
 * told it apart from the profile the general AI was built from (`source`): it
 * has keys of its own in the store, its engine matches the source's in
 * everything but those keys, and with them it differs.
 *
 * Measured against the source profile, never the general AI: the source's
 * engine is frozen since the migration, while the general AI may have been
 * edited since — and a profile that only drifted from an edited general AI is
 * not one that had a key of its own. A profile added since has no keys in the
 * store and never matches.
 */
function keyOnlyDifference(p: Profiles[number], source: AIConfig, store: SecretStore): boolean {
  if (p.ownAI === true || !p.ai) return false
  const own = store[p.id]
  if (!own?.aiKeys && !own?.aiApiKey) return false
  const mine = restoreAIKeys(p.ai, own)
  return aiEnginesEqual(mine, source, { ignoreKeys: true }) && !aiEnginesEqual(mine, source)
}

/**
 * The source profile's engine with its keys — what `keyOnlyDifference` measures
 * against. A source deleted since leaves the general AI, built as its copy, with
 * the keys its entry still holds (kept by `secretOwnerIds`).
 */
function seedSource(settings: AppSettings, store: SecretStore): AIConfig | undefined {
  const from = settings.aiSecretsFrom
  if (!from) return undefined
  const source = (settings.profiles ?? []).find((p) => p.id === from)
  if (source?.ai) return restoreAIKeys(source.ai, store[from] ?? {})
  return settings.ai ? restoreAIKeys(settings.ai, store[from] ?? {}) : undefined
}

/** `profiles` with every key-only exception given its own AI back (`keyOnlyDifference`). */
function withKeyOnlyExceptions(settings: AppSettings, store: SecretStore): Profiles {
  const source = seedSource(settings, store)
  if (!source) return settings.profiles
  return settings.profiles.map((p) =>
    p.id !== settings.aiSecretsFrom && keyOnlyDifference(p, source, store) ? { ...p, ownAI: true } : p
  )
}

/**
 * Puts the general AI's keys back — from its own entry, or, while the general
 * AI still has none and was built from a profile (`aiSecretsFrom`), from that
 * profile's. `seed: false` reads only its own entry and leaves every profile's
 * `ownAI` alone: the settings file's plaintext keep-list must not invent
 * either (see main's `savedFileJson`).
 *
 * While `aiSecretsFrom` is set the migration is also re-checked with the keys
 * (`withKeyOnlyExceptions`), so a read before main settles it (`settleGeneralAI`)
 * already sends each profile's calls to its own key.
 */
function withGeneralAISecrets(settings: AppSettings, store: SecretStore, seed: boolean): AppSettings {
  if (!settings.ai) return settings
  const own = store[GENERAL_AI_SECRETS_ID]
  const seedId = seed && !own ? settings.aiSecretsFrom : undefined
  const secrets = own ?? (seedId ? store[seedId] : undefined)
  const ai = secrets ? restoreAIKeys(settings.ai, secrets) : settings.ai
  if (!seed || !settings.aiSecretsFrom) return { ...settings, ai }
  return { ...settings, ai, profiles: withKeyOnlyExceptions(settings, store) }
}

/** The same secrets without any AI key. */
function withoutAISecrets(secrets: ProfileSecrets): ProfileSecrets {
  const { aiKeys: _keys, aiApiKey: _legacy, ...rest } = secrets
  void _keys
  void _legacy
  return rest
}

/**
 * Finishes the move to the general AI once the whole store is in hand — main
 * calls it on the first decrypted, queued read (`settings:unlock`) and persists
 * both halves:
 *
 * - the general AI gets its own entry, copied from the profile it was built
 *   from, so deleting that profile can no longer take the key with it;
 * - every profile that differed only by an encrypted key gets `ownAI` for good;
 * - every profile left on the general AI loses its old engine and its AI keys
 *   in the store — nothing shows them any more, and an export or a rotated
 *   general key must not leave a copy behind;
 * - `aiSecretsFrom` goes.
 *
 * Without the marker it returns both unchanged.
 */
export function settleGeneralAI(
  settings: AppSettings,
  raw: SecretStore,
  fallback: AIConfig
): { settings: AppSettings; store: SecretStore } {
  const from = settings.aiSecretsFrom
  if (!from || !settings.ai) return { settings, store: raw }
  const store: SecretStore = { ...raw }
  if (!store[GENERAL_AI_SECRETS_ID] && raw[from]) {
    const general = aiSecretsOf(restoreAIKeys(settings.ai, raw[from]))
    if (Object.keys(general).length > 0) store[GENERAL_AI_SECRETS_ID] = general
  }
  const profiles = withKeyOnlyExceptions(settings, raw).map((p) => {
    if (p.ownAI === true) return p
    if (store[p.id]) store[p.id] = withoutAISecrets(store[p.id])
    return { ...p, ai: withoutAIEngine(p.ai, fallback) }
  })
  // The source profile may be gone: its entry only lived on for the seed.
  if (store[from] && !profiles.some((p) => p.id === from)) store[from] = withoutAISecrets(store[from])
  for (const id of Object.keys(store)) if (Object.keys(store[id]).length === 0) delete store[id]
  const { aiSecretsFrom: _from, ...rest } = settings
  void _from
  return { settings: { ...rest, profiles }, store }
}

/**
 * A save built on settings read before main settled the general AI (it still
 * carries `aiSecretsFrom`, the file no longer does): it must not put the marker
 * back nor undo what settling decided. Profiles that got their own AI keep it;
 * the others drop the old engine again.
 */
export function reconcileSettledSave(incoming: AppSettings, onDisk: AppSettings, fallback: AIConfig): AppSettings {
  const own = new Set(onDisk.profiles.filter((p) => p.ownAI === true).map((p) => p.id))
  const { aiSecretsFrom: _from, ...rest } = incoming
  void _from
  return {
    ...rest,
    profiles: incoming.profiles.map((p) => {
      if (p.ownAI === true) return p
      if (own.has(p.id)) return { ...p, ownAI: true }
      return { ...p, ai: withoutAIEngine(p.ai, fallback) }
    })
  }
}

/**
 * Overlays `next` onto `stored` without dropping credentials `next` never had.
 * Used for saves coming from a renderer that was hydrated before the store was
 * unlocked: such a save can add or replace a credential, but an absence in it
 * means "I was never given this", not "the user cleared it".
 */
export function mergeSecretStores(storedRaw: SecretStore, nextRaw: SecretStore): SecretStore {
  // Both sides in the list shape first: a legacy self-managed `gitlabToken` in
  // the stored copy must not survive as — or be overwritten by — gitlab.com's.
  const stored = migrateGitlabSecrets(storedRaw)
  const next = migrateGitlabSecrets(nextRaw)
  const out: SecretStore = { ...stored }
  for (const [id, secrets] of Object.entries(next)) {
    const base = out[id] ?? {}
    const aiKeys = { ...(base.aiKeys ?? {}), ...(secrets.aiKeys ?? {}) }
    const ghes = { ...(base.githubEnterpriseTokens ?? {}), ...(secrets.githubEnterpriseTokens ?? {}) }
    const gitlab = { ...(base.gitlabServerTokens ?? {}), ...(secrets.gitlabServerTokens ?? {}) }
    const bbs = { ...(base.bitbucketServerTokens ?? {}), ...(secrets.bitbucketServerTokens ?? {}) }
    out[id] = {
      ...base,
      ...secrets,
      ...(Object.keys(aiKeys).length > 0 ? { aiKeys } : {}),
      ...(Object.keys(ghes).length > 0 ? { githubEnterpriseTokens: ghes } : {}),
      ...(Object.keys(gitlab).length > 0 ? { gitlabServerTokens: gitlab } : {}),
      ...(Object.keys(bbs).length > 0 ? { bitbucketServerTokens: bbs } : {})
    }
  }
  return out
}

type Profiles = AppSettings['profiles']
type ServerTokenField = 'githubEnterpriseTokens' | 'gitlabServerTokens' | 'bitbucketServerTokens'

// Each map, with the profile's server list it is keyed by and the same
// normalization `extractSecrets` files the tokens under.
const SERVER_TOKEN_MAPS: {
  field: ServerTokenField
  bases: (p: Profiles[number]) => (string | null)[]
}[] = [
  { field: 'githubEnterpriseTokens', bases: (p) => (p.githubEnterprise ?? []).map((h) => normalizeGithubEnterpriseUrl(h.url)) },
  {
    field: 'gitlabServerTokens',
    bases: (p) => (p.gitlabServers ?? []).map((h) => normalizeInstanceUrl(h.url)).filter((b) => b !== GITLAB_COM)
  },
  { field: 'bitbucketServerTokens', bases: (p) => (p.bitbucketServers ?? []).map((h) => normalizeBitbucketServerUrl(h.url)) }
]

const normalizerOf: Record<ServerTokenField, (raw: string) => string | null> = {
  githubEnterpriseTokens: normalizeGithubEnterpriseUrl,
  gitlabServerTokens: normalizeInstanceUrl,
  bitbucketServerTokens: normalizeBitbucketServerUrl
}

/**
 * The store ids a settings object still owns: its profiles', and — while the
 * general AI's keys still live there (`aiSecretsFrom`) — that profile's even
 * after it was deleted, or pruning would take the general AI's only key.
 */
export function secretOwnerIds(settings: Pick<AppSettings, 'profiles' | 'aiSecretsFrom'>): string[] {
  const ids = (settings.profiles ?? []).map((p) => p.id)
  return settings.aiSecretsFrom ? [...ids, settings.aiSecretsFrom] : ids
}

/**
 * Drops entries for profiles that no longer exist and, given the profiles
 * themselves, every server token whose server the profile no longer lists. The
 * merge path keeps whatever a save did not mention, so without this a server
 * removed in Settings kept its token in the store, and adding the same URL back
 * later silently restored an old — maybe revoked — token.
 */
export function pruneSecrets(store: SecretStore, profileIds: string[], profiles?: Profiles): SecretStore {
  // The general AI's entry belongs to no profile, so no profile list removes it.
  const keep = new Set([...profileIds, GENERAL_AI_SECRETS_ID])
  const listed = profiles ? new Map(profiles.map(migrateGitlabProfile).map((p) => [p.id, p])) : null
  const out: SecretStore = {}
  for (const [id, secrets] of Object.entries(store)) {
    if (!keep.has(id)) continue
    const profile = listed?.get(id)
    if (!listed) {
      out[id] = secrets
      continue
    }
    const kept: ProfileSecrets = { ...secrets }
    for (const { field, bases } of SERVER_TOKEN_MAPS) {
      const tokens = secrets[field]
      if (!tokens) continue
      const allowed = new Set(profile ? bases(profile).filter((b): b is string => !!b) : [])
      const filtered = Object.fromEntries(
        Object.entries(tokens).filter(([base]) => {
          const canonical = normalizerOf[field](base)
          return !!canonical && allowed.has(canonical)
        })
      )
      if (Object.keys(filtered).length > 0) kept[field] = filtered
      else delete kept[field]
    }
    if (Object.keys(kept).length > 0) out[id] = kept
  }
  return out
}

/**
 * The same settings with every server address stripped of a userinfo, query
 * or fragment (`serverUrlWithoutSecrets`). Settings refuses such an address
 * when it is typed, but an import, a hand-edited file or an older build can
 * still carry one — and the addresses, unlike the tokens, stay in the plain
 * JSON. The same object back when nothing needed it, so a caller can tell.
 */
export function scrubServerUrls<T extends { profiles?: unknown }>(settings: T): T {
  if (!Array.isArray(settings.profiles)) return settings
  let changed = false
  const clean = (v: unknown): unknown => {
    if (typeof v !== 'string') return v
    const out = serverUrlWithoutSecrets(v)
    if (out !== v) changed = true
    return out
  }
  const hosts = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.map((h: unknown) =>
          h && typeof h === 'object' && 'url' in h ? { ...h, url: clean((h as { url: unknown }).url) } : h
        )
      : list
  const profiles = (settings.profiles as unknown[]).map((raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const p = raw as Record<string, unknown>
    const out: Record<string, unknown> = { ...p }
    // The issuers name the server a token was typed for, so they are addresses too.
    for (const key of ['forgejoUrl', 'gitlabUrl', 'gitlabTokenIssuer', 'forgejoTokenIssuer']) {
      if (key in p) out[key] = clean(p[key])
    }
    for (const key of ['githubEnterprise', 'gitlabServers', 'bitbucketServers']) {
      if (key in p) out[key] = hosts(p[key])
    }
    return out
  })
  return changed ? { ...settings, profiles } : settings
}

/**
 * One credential slot of a store, as `profile \0 field [\0 base-or-account]`,
 * with its value. The issuer beside a GitLab or Forgejo token is not a slot of
 * its own: it travels with the token (see `saveOver`).
 */
export type SecretView = ReadonlyMap<string, string>

const SINGLE_FIELDS = [...TOKEN_FIELDS, 'aiApiKey'] as const
const MAP_FIELDS = ['githubEnterpriseTokens', 'gitlabServerTokens', 'bitbucketServerTokens', 'aiKeys'] as const
const ISSUER_OF: Partial<Record<(typeof SINGLE_FIELDS)[number], 'gitlabTokenIssuer' | 'forgejoTokenIssuer'>> = {
  gitlabToken: 'gitlabTokenIssuer',
  forgejoToken: 'forgejoTokenIssuer'
}

/** Every credential slot of `store` and its value — what a renderer holds once given it. */
export function secretView(store: SecretStore): SecretView {
  const out = new Map<string, string>()
  for (const [id, secrets] of Object.entries(migrateGitlabSecrets(store))) {
    for (const f of SINGLE_FIELDS) {
      const v = secrets[f]
      if (v) out.set(`${id}\0${f}`, v)
    }
    for (const f of MAP_FIELDS) {
      for (const [k, v] of Object.entries(secrets[f] ?? {})) if (v) out.set(`${id}\0${f}\0${k}`, v)
    }
  }
  return out
}

/** Every credential value in `store`, deduplicated — for "is this one of ours?". */
export function secretValues(store: SecretStore): string[] {
  return [...new Set(secretView(store).values())]
}

/**
 * What the store becomes after a save carrying `incoming`, from a renderer that
 * had been given exactly `seen`.
 *
 * A value the save carries is the new one. A slot it leaves blank is a clear
 * only when the sender held that slot *with the value stored now*: a token it
 * never saw — added by another window, or replaced since it last read the
 * settings — is not its to erase, so a blank there keeps it. With nothing seen
 * this is `mergeSecretStores`; with the whole store seen it is the save itself.
 */
export function saveOver(currentRaw: SecretStore, incomingRaw: SecretStore, seen: SecretView): SecretStore {
  const current = migrateGitlabSecrets(currentRaw)
  const incoming = migrateGitlabSecrets(incomingRaw)
  const out: SecretStore = {}
  for (const id of new Set([...Object.keys(current), ...Object.keys(incoming)])) {
    const cur = current[id] ?? {}
    const inc = incoming[id] ?? {}
    // Fields this build does not know (a newer build wrote them) are nobody's
    // to clear from here: they start out kept, and only the known slots below
    // follow the held-slot rule.
    const kept: ProfileSecrets = { ...cur }
    for (const f of [...SINGLE_FIELDS, ...MAP_FIELDS, 'gitlabTokenIssuer', 'forgejoTokenIssuer'] as const) delete kept[f]
    const stays = (slot: string, value: string | undefined): value is string => !!value && seen.get(slot) !== value
    for (const f of SINGLE_FIELDS) {
      const issuer = ISSUER_OF[f]
      const from = inc[f] ? inc : stays(`${id}\0${f}`, cur[f]) ? cur : null
      if (!from) continue
      kept[f] = from[f]
      if (issuer && from[issuer]) kept[issuer] = from[issuer]
    }
    for (const f of MAP_FIELDS) {
      const map: Record<string, string> = {}
      for (const [k, v] of Object.entries(cur[f] ?? {})) if (stays(`${id}\0${f}\0${k}`, v)) map[k] = v
      for (const [k, v] of Object.entries(inc[f] ?? {})) if (v) map[k] = v
      if (Object.keys(map).length > 0) kept[f] = map
    }
    if (Object.keys(kept).length > 0) out[id] = kept
  }
  return out
}

/** Whether every credential slot of `part` is in `whole`, with the same value. */
export function isSubsetStore(part: SecretStore, whole: SecretStore): boolean {
  const have = secretView(whole)
  for (const [slot, value] of secretView(part)) if (have.get(slot) !== value) return false
  return true
}

/** The slots of `before` that `after` no longer holds with that value — what a save cleared. */
export function clearedSlots(before: SecretStore, after: SecretStore): SecretView {
  const now = secretView(after)
  const out = new Map<string, string>()
  for (const [slot, value] of secretView(before)) if (now.get(slot) !== value) out.set(slot, value)
  return out
}

/**
 * `store` without the slots in `tombstones` — each only while it still holds
 * the value that was cleared, so a token set again since is not removed.
 */
export function withoutSlots(storeRaw: SecretStore, tombstones: SecretView): SecretStore {
  if (tombstones.size === 0) return storeRaw
  const store = migrateGitlabSecrets(storeRaw)
  const out: SecretStore = {}
  for (const [id, secrets] of Object.entries(store)) {
    const kept: ProfileSecrets = { ...secrets }
    for (const f of SINGLE_FIELDS) {
      if (kept[f] && tombstones.get(`${id}\0${f}`) === kept[f]) {
        delete kept[f]
        const issuer = ISSUER_OF[f]
        if (issuer) delete kept[issuer]
      }
    }
    for (const f of MAP_FIELDS) {
      const map = kept[f]
      if (!map) continue
      const left = Object.fromEntries(Object.entries(map).filter(([k, v]) => tombstones.get(`${id}\0${f}\0${k}`) !== v))
      if (Object.keys(left).length > 0) kept[f] = left
      else delete kept[f]
    }
    if (Object.keys(kept).length > 0) out[id] = kept
  }
  return out
}

// Whitespace, and the invisible characters that render as nothing: padding a
// held token with either must not make it look like a different one.
const INVISIBLE = /[\s\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g

/** A credential as compared: no whitespace, no invisible characters. */
export function canonicalSecret(value: string): string {
  return value.replace(INVISIBLE, '')
}

/**
 * Below this, "contains" would match by accident — a held value this short is
 * only ever compared whole.
 */
export const MIN_CONTAINED_SECRET = 8
/** A supplied value this long that sits inside a held one is a piece of it. */
export const MIN_SECRET_FRAGMENT = 16

/**
 * Whether `supplied` carries a held credential: equal to one, containing one,
 * or — when long enough to be no accident — contained in one. Both sides are
 * compared canonical (`canonicalSecret`), so `' ghp_x '`, `'ghp_x\u200B'` or
 * `'ghp_x junk'` are all the held `ghp_x`. Every candidate is checked every
 * time; there is no early exit to time.
 */
export function carriesHeldSecret(supplied: string, held: Iterable<string>): boolean {
  const want = canonicalSecret(supplied)
  if (!want) return false
  let hit = false
  for (const raw of held) {
    const c = canonicalSecret(raw)
    if (!c) continue
    const contains = c.length >= MIN_CONTAINED_SECRET ? want.includes(c) : want === c
    const piece = want.length >= MIN_SECRET_FRAGMENT && c.includes(want)
    hit = contains || piece || hit
  }
  return hit
}
