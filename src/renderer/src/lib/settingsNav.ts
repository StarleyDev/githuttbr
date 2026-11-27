/**
 * The Settings side menu: which pages exist, how they group, and how an id
 * from anywhere else — a deep link, `openModal({ kind: 'settings', page })`,
 * the command palette, a page remembered from an older version — lands on one.
 *
 * Pure, so the grouping and the id mapping are pinned by tests rather than by
 * whoever last edited the panel.
 */
import type { TranslationKey } from '../i18n'
import type { SettingsPageId } from './settingsSearch'

export type SettingsNavGroupId = 'you' | 'appearance' | 'behaviour' | 'system'

export interface SettingsNavGroup {
  id: SettingsNavGroupId
  labelKey: TranslationKey
  pages: readonly SettingsPageId[]
}

/** The menu, top to bottom. Every page sits in exactly one group. */
export const SETTINGS_NAV_GROUPS: readonly SettingsNavGroup[] = [
  { id: 'you', labelKey: 'settings.navGroupYou', pages: ['profile', 'integrations', 'ai'] },
  { id: 'appearance', labelKey: 'settings.navGroupAppearance', pages: ['themes', 'graph', 'layout'] },
  { id: 'behaviour', labelKey: 'settings.navGroupBehaviour', pages: ['general', 'git', 'security', 'analyzers'] },
  { id: 'system', labelKey: 'settings.navGroupSystem', pages: ['workspaces', 'shortcuts', 'environment', 'data', 'about'] }
]

/** Every page, in menu order. */
export const SETTINGS_PAGE_ORDER: readonly SettingsPageId[] = SETTINGS_NAV_GROUPS.flatMap((g) => g.pages)

/** Where Settings opens when nothing says otherwise. */
export const DEFAULT_SETTINGS_PAGE: SettingsPageId = 'general'

/**
 * Names a page went by, or could reasonably be linked by, that are not its id.
 * The ids themselves never changed — `integrations` is still Connected accounts
 * — so this only widens what a link may say.
 */
const PAGE_ALIASES: Record<string, SettingsPageId> = {
  accounts: 'integrations',
  'connected-accounts': 'integrations',
  identity: 'profile',
  appearance: 'themes',
  'git-sync': 'git',
  sync: 'git',
  confirmations: 'security',
  'code-analyzers': 'analyzers',
  backup: 'data'
}

/**
 * The page an id opens. `themeTab` is the old way into the graph settings —
 * Themes with its Graph tab — which is now a page of its own. Unknown ids give
 * `undefined`, so the caller decides the fallback.
 */
export function resolveSettingsPage(page: string | undefined | null, themeTab?: string): SettingsPageId | undefined {
  if (!page) return undefined
  if (page === 'themes' && themeTab === 'graph') return 'graph'
  if ((SETTINGS_PAGE_ORDER as readonly string[]).includes(page)) return page as SettingsPageId
  return PAGE_ALIASES[page]
}

/** The group a page sits in. */
export function settingsGroupOf(page: SettingsPageId): SettingsNavGroupId {
  return (SETTINGS_NAV_GROUPS.find((g) => g.pages.includes(page)) ?? SETTINGS_NAV_GROUPS[0]).id
}

/**
 * How many of a profile's accounts the menu flags. A refused token (expired,
 * revoked, missing a scope) or another error needs the user; an unreachable
 * host does not — the token may be fine, the network is not.
 */
export function countAccountProblems(failures: Partial<Record<string, string>> | undefined): number {
  return Object.values(failures ?? {}).filter((kind) => kind === 'refused' || kind === 'error').length
}
