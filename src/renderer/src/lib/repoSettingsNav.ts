import type { TranslationKey } from '../i18n'
import type { HostingProvider } from '../../../shared/types'

/**
 * The repository settings modal: which pages it has, how the side nav groups
 * them, and the summary shown above them. Pure so the grouping, the id mapping
 * and the header can be tested without rendering the modal.
 */

/** Page ids. They are also the `tab` callers pass to `openModal({ kind: 'repo-settings' })`,
 *  so renaming one breaks every caller that deep-links to it. */
export type RepoSettingsPage = 'general' | 'config' | 'info' | 'vault' | 'analytics' | 'insights' | 'history' | 'logs'

export type RepoSettingsGroupId = 'repository' | 'security' | 'activity'

export interface RepoSettingsNavItem {
  id: RepoSettingsPage
  labelKey: TranslationKey
  descriptionKey: TranslationKey
}

export interface RepoSettingsNavGroup {
  id: RepoSettingsGroupId
  labelKey: TranslationKey
  items: RepoSettingsNavItem[]
}

// Keys, not strings: a module-level constant holding translated text would be
// frozen at the language active on first import.
export const REPO_SETTINGS_NAV: readonly RepoSettingsNavGroup[] = [
  {
    id: 'repository',
    labelKey: 'repoSettings.groupRepository',
    items: [
      { id: 'general', labelKey: 'repoSettings.general', descriptionKey: 'repoSettings.generalDesc' },
      { id: 'config', labelKey: 'repoSettings.projectConfig', descriptionKey: 'repoSettings.projectConfigDesc' },
      { id: 'info', labelKey: 'repoSettings.information', descriptionKey: 'repoSettings.informationDesc' }
    ]
  },
  {
    id: 'security',
    labelKey: 'repoSettings.groupSecurity',
    items: [{ id: 'vault', labelKey: 'repoSettings.vault', descriptionKey: 'repoSettings.vaultDesc' }]
  },
  {
    id: 'activity',
    labelKey: 'repoSettings.groupActivity',
    items: [
      { id: 'analytics', labelKey: 'repoSettings.metrics', descriptionKey: 'repoSettings.metricsDesc' },
      { id: 'insights', labelKey: 'repoSettings.insights', descriptionKey: 'repoSettings.insightsDesc' },
      { id: 'history', labelKey: 'repoSettings.operationHistory', descriptionKey: 'repoSettings.operationHistoryDesc' },
      { id: 'logs', labelKey: 'repoSettings.logs', descriptionKey: 'repoSettings.logsDesc' }
    ]
  }
]

export const REPO_SETTINGS_PAGES: readonly RepoSettingsPage[] = REPO_SETTINGS_NAV.flatMap((g) => g.items.map((i) => i.id))

/** Names a page went by elsewhere — the labels in the nav, the handbook's old
 *  tab names — so a deep link written against any of them still lands. */
const PAGE_ALIASES: Readonly<Record<string, RepoSettingsPage>> = {
  metrics: 'analytics',
  project: 'config',
  'project-config': 'config',
  projectconfig: 'config',
  configuration: 'config',
  information: 'info',
  secrets: 'vault',
  security: 'vault',
  operations: 'history',
  'operation-history': 'history',
  log: 'logs'
}

/** The page an incoming tab id opens. Unknown or missing ids open General. */
export function resolveRepoSettingsPage(id: string | null | undefined): RepoSettingsPage {
  if (!id) return 'general'
  const key = id.trim().toLowerCase()
  if ((REPO_SETTINGS_PAGES as readonly string[]).includes(key)) return key as RepoSettingsPage
  return PAGE_ALIASES[key] ?? 'general'
}

export function findRepoSettingsNavItem(page: RepoSettingsPage): RepoSettingsNavItem {
  for (const group of REPO_SETTINGS_NAV) {
    const hit = group.items.find((i) => i.id === page)
    if (hit) return hit
  }
  return REPO_SETTINGS_NAV[0].items[0]
}

/** Up to two letters for the avatar: the first letters of the first two words
 *  (`my-api` → `MA`), or the first two letters of a single word. */
export function getRepoInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s._\-/]+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
  if (words.length === 0) return '?'
  const first = [...words[0]]
  const letters = words.length > 1 ? first[0] + [...words[1]][0] : first.slice(0, 2).join('')
  return letters.toUpperCase()
}

/** Hostname of a remote URL — `https://`, `ssh://` and scp-like `git@host:path`.
 *  Null for a local path, which has no host to name. */
export function getRemoteHostname(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null
  const scheme = /^[a-z][a-z0-9+.-]*:\/\/([^/]*)/i.exec(raw)
  if (scheme) {
    if (/^file:/i.test(raw)) return null
    const authority = scheme[1].replace(/^.*@/, '')
    const host = authority.startsWith('[') ? authority.slice(0, authority.indexOf(']') + 1) : authority.split(':')[0]
    return host ? host.toLowerCase() : null
  }
  // scp-like: [user@]host:path — but not a Windows drive (`C:\repo`).
  const scp = /^(?:[^@/\\]+@)?([^:/\\]+):(?!\\)/.exec(raw)
  if (scp && scp[1].length > 1) return scp[1].toLowerCase()
  return null
}

/** The hosting product a hostname belongs to, when the hostname alone says so. */
export function getHostKind(hostname: string | null): Exclude<HostingProvider, null> | null {
  if (!hostname) return null
  if (hostname === 'github.com' || hostname.endsWith('.github.com')) return 'github'
  if (hostname === 'gitlab.com' || hostname.startsWith('gitlab.')) return 'gitlab'
  if (hostname === 'bitbucket.org' || hostname.startsWith('bitbucket.')) return 'bitbucket'
  if (hostname === 'dev.azure.com' || hostname.endsWith('.visualstudio.com') || hostname === 'ssh.dev.azure.com') return 'azure'
  if (hostname === 'codeberg.org') return 'forgejo'
  return null
}

export interface RepoSettingsRemote {
  name: string
  hostname: string | null
  kind: Exclude<HostingProvider, null> | null
}

/** `origin` when there is one — it is what push and the PR pages talk to — else
 *  the first remote. */
export function getMainRemote(
  remotes: ReadonlyArray<{ name: string; url: string }>,
  provider: HostingProvider = null
): RepoSettingsRemote | null {
  const main = remotes.find((r) => r.name === 'origin') ?? remotes[0]
  if (!main) return null
  const hostname = getRemoteHostname(main.url)
  // The provider the store resolved knows enterprise and self-hosted instances
  // the hostname cannot; the hostname is the fallback before it has loaded.
  return { name: main.name, hostname, kind: provider ?? getHostKind(hostname) }
}

export type RepoSettingsPillId = 'branches' | 'vault'

export interface RepoSettingsPill {
  id: RepoSettingsPillId
  count: number
  titleKey: TranslationKey
}

/**
 * The counts in the header. Only what is already in hand: the branch list is
 * in the store; the vault count is known only once the vault page has listed
 * it — listing it up front would ask for keychain access just to open the
 * modal. The commit total is left out because nothing cheap knows it.
 */
export function getRepoSettingsPills(input: {
  branchCount: number | null
  vaultCount: number | null
}): RepoSettingsPill[] {
  const pills: RepoSettingsPill[] = []
  if (input.branchCount != null) pills.push({ id: 'branches', count: input.branchCount, titleKey: 'repoSettings.pillBranches' })
  if (input.vaultCount != null) pills.push({ id: 'vault', count: input.vaultCount, titleKey: 'repoSettings.pillVault' })
  return pills
}
