import { tokenMatchesInstance, GITLAB_COM, migrateGitlabProfile, migrateGitlabSettings, normalizeInstanceUrl } from './gitlabInstance'
import { normalizeGithubEnterpriseUrl } from './githubEnterprise'
import type { AppSettings } from './types'

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
  /** Legacy single AI key, written before accounts existed. Still read. */
  aiApiKey?: string
  /** One API key per AI account id. */
  aiKeys?: Record<string, string>
}

/** Secrets for every profile that has any, keyed by profile id. */
export type SecretStore = Record<string, ProfileSecrets>

/** Profile fields holding a host access token. */
export const TOKEN_FIELDS = ['githubToken', 'azureToken', 'gitlabToken', 'bitbucketToken', 'forgejoToken'] as const

export function hasSettingsSecrets(settings: AppSettings | null | undefined): boolean {
  return (settings?.profiles ?? []).some(
    (p) =>
      TOKEN_FIELDS.some((f) => !!p[f]) ||
      (p.githubEnterprise ?? []).some((h) => !!h.token) ||
      (p.gitlabServers ?? []).some((h) => !!h.token) ||
      !!p.ai?.apiKey ||
      (p.ai?.accounts ?? []).some((a) => !!a.apiKey)
  )
}

/** The same settings with every credential blanked out. */
export function stripSettingsSecrets(settings: AppSettings): AppSettings {
  return {
    ...settings,
    profiles: (settings.profiles ?? []).map(migrateGitlabProfile).map((p) => ({
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
      ai: p.ai
        ? {
            ...p.ai,
            apiKey: '',
            accounts: (p.ai.accounts ?? []).map((a) => ({ ...a, apiKey: '' }))
          }
        : p.ai
    }))
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
    const aiKeys: Record<string, string> = {}
    for (const account of p.ai?.accounts ?? []) {
      if (account.apiKey) aiKeys[account.id] = account.apiKey
    }
    if (Object.keys(aiKeys).length > 0) secrets.aiKeys = aiKeys
    // Only written when the config predates accounts; migration folds it into
    // `aiKeys` the first time the settings are saved afterwards.
    else if (p.ai?.apiKey) secrets.aiApiKey = p.ai.apiKey
    if (Object.keys(secrets).length > 0) store[p.id] = secrets
  }
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
export function applySecrets(settings: AppSettings, raw: SecretStore): AppSettings {
  const store = migrateGitlabSecrets(raw)
  return {
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
      for (const field of TOKEN_FIELDS) {
        if (field === 'gitlabToken' || field === 'forgejoToken') continue
        if (secrets[field]) restored[field] = secrets[field] as string
      }
      if (!restored.ai) return restored

      const accounts = restored.ai.accounts ?? []
      if (accounts.length > 0) {
        const keys = secrets.aiKeys ?? {}
        // A pre-accounts key belongs to the account the migration built from it.
        const legacyOwner = restored.ai.defaultAccountId || accounts[0].id
        restored.ai = {
          ...restored.ai,
          accounts: accounts.map((a) => {
            const key = keys[a.id] ?? (a.id === legacyOwner ? secrets.aiApiKey : undefined)
            return key ? { ...a, apiKey: key } : a
          })
        }
      }

      // Keep the resolved field in step so a config used before migration still
      // authenticates.
      const resolvedKey =
        secrets.aiKeys?.[restored.ai.accountId ?? restored.ai.defaultAccountId ?? ''] ??
        secrets.aiKeys?.[accounts[0]?.id ?? ''] ??
        secrets.aiApiKey
      if (resolvedKey) restored.ai = { ...restored.ai, apiKey: resolvedKey }
      return restored
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
    out[id] = {
      ...base,
      ...secrets,
      ...(Object.keys(aiKeys).length > 0 ? { aiKeys } : {}),
      ...(Object.keys(ghes).length > 0 ? { githubEnterpriseTokens: ghes } : {}),
      ...(Object.keys(gitlab).length > 0 ? { gitlabServerTokens: gitlab } : {})
    }
  }
  return out
}

/** Drops entries for profiles that no longer exist. */
export function pruneSecrets(store: SecretStore, profileIds: string[]): SecretStore {
  const keep = new Set(profileIds)
  const out: SecretStore = {}
  for (const [id, secrets] of Object.entries(store)) {
    if (keep.has(id)) out[id] = secrets
  }
  return out
}
