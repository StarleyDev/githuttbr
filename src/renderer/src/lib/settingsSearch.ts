/**
 * Search across every Settings page without opening them one by one.
 *
 * Only the open page is ever rendered, so the text to search cannot be read off
 * the screen: this module holds an index of the settings — the label each one
 * shows, its hint, the page and tab it lives on — and ranks them against what
 * the user typed. Pure: the caller hands in a translator, so the same index
 * answers in every language (and in English too, see `searchSettings`).
 *
 * `test/settingsSearch.test.ts` reads the settings screens' source and fails if
 * a labelled setting is missing here — a setting nobody can find is the bug
 * this exists to fix.
 */
import type { TranslationKey } from '../i18n'

export type SettingsPageId =
  | 'profile'
  | 'layout'
  | 'workspaces'
  | 'integrations'
  | 'ai'
  | 'themes'
  | 'general'
  | 'security'
  | 'shortcuts'
  | 'data'
  | 'environment'

/** Each page's name in the sidebar. Searched too: "terminal" finds the Layout
 *  page's terminal settings, but "layout" should find the page itself. */
export const SETTINGS_PAGE_KEYS: Record<SettingsPageId, TranslationKey> = {
  general: 'settings.general',
  layout: 'settings.layout',
  profile: 'settings.profile',
  workspaces: 'settings.workspaces',
  integrations: 'settings.integrations',
  ai: 'settings.ai',
  themes: 'settings.themes',
  security: 'settings.security',
  shortcuts: 'settings.shortcuts',
  data: 'settings.data',
  environment: 'settings.environment'
}

export interface SettingsEntry {
  page: SettingsPageId
  /** The label the setting shows — also how the panel finds it on the page. */
  key: TranslationKey
  hint?: TranslationKey
  /** The Themes page's tab the setting sits on. */
  tab?: 'theme' | 'graph'
}

const e = (page: SettingsPageId, key: TranslationKey, hint?: TranslationKey, tab?: 'theme' | 'graph'): SettingsEntry =>
  hint || tab ? { page, key, ...(hint ? { hint } : {}), ...(tab ? { tab } : {}) } : { page, key }

/** In sidebar order, then top to bottom within a page — the order ties keep. */
export const SETTINGS_INDEX: readonly SettingsEntry[] = [
  // Profile — the profile bar on top, then the page
  e('profile', 'settings.newProfile'),
  e('profile', 'settings.gitIdentity'),
  e('profile', 'profileAvatar.title'),
  e('profile', 'settings.preferences'),
  e('profile', 'signing.title'),
  e('profile', 'signing.signAll', 'signing.signAllHint'),

  // Integrations
  e('integrations', 'settings.ghesTitle'),
  e('integrations', 'settings.gitlabServersTitle'),
  e('integrations', 'settings.bbsTitle'),
  e('integrations', 'localCi.title'),
  e('integrations', 'localCi.enable', 'localCi.intro'),

  // General
  e('general', 'settings.language'),
  e('general', 'settings.general'),
  e('general', 'settings.initialCommitCount'),
  e('general', 'settings.loadMoreCount'),
  e('general', 'settings.autoLoadOnScroll', 'settings.autoLoadOnScrollHint'),
  e('general', 'settings.autoFetch'),
  e('general', 'settings.warnOnClose'),
  e('general', 'settings.tabRepoLabel'),
  e('general', 'settings.graph'),
  e('general', 'settings.relativeDates', 'settings.relativeDatesHint'),
  e('general', 'settings.commitAvatars', 'settings.commitAvatarsHint'),
  e('general', 'settings.githubAvatars', 'settings.githubAvatarsHint'),
  e('general', 'settings.avatarMotion', 'settings.avatarMotionHint'),
  e('general', 'settings.groupBranches', 'settings.groupBranchesHint'),
  e('general', 'settings.behaviour'),
  e('general', 'settings.todosHideDone', 'settings.todosHideDoneHint'),
  e('general', 'settings.confirmForcePush', 'settings.confirmForcePushHint'),
  e('general', 'settings.desktopNotifications', 'settings.desktopNotificationsHint'),
  e('general', 'settings.mergeCommit', 'settings.mergeCommitHint'),
  e('general', 'settings.autoOpenChangelog', 'settings.autoOpenChangelogHint'),
  e('general', 'settings.launchEnabled', 'settings.launchEnabledHint'),
  e('general', 'settings.analyzerMode'),
  e('general', 'rerere.title'),
  e('general', 'rerere.enable', 'rerere.enableHint'),
  e('general', 'rerere.autoUpdate', 'rerere.autoUpdateHint'),
  e('general', 'difftool.title'),
  e('general', 'difftool.keepBackup', 'difftool.keepBackupHint'),
  e('general', 'settings.fileViewer'),
  e('general', 'settings.showChangeGutter', 'settings.showChangeGutterHint'),
  e('general', 'settings.showMinimap', 'settings.showMinimapHint'),
  e('general', 'settings.editor'),
  e('general', 'settings.editorChoice'),
  e('general', 'settings.defaultOpenApp'),

  // Layout
  e('layout', 'settings.layout'),
  e('layout', 'settings.livePreview'),
  e('layout', 'settings.sidebarSide', 'settings.sidebarSideHint'),
  e('layout', 'settings.sidebarSections', 'settings.sidebarSectionsHint'),
  e('layout', 'settings.rightPanelFullHeight', 'settings.rightPanelFullHeightHint'),
  e('layout', 'settings.terminalPlacement', 'settings.terminalPlacementHint'),
  e('layout', 'settings.terminalShell', 'settings.terminalShellHint'),
  e('layout', 'settings.openTerminalOnRepoOpen', 'settings.openTerminalOnRepoOpenHint'),
  e('layout', 'settings.tabSizing', 'settings.tabSizingHint'),
  e('layout', 'settings.worktreeShortLabels', 'settings.worktreeShortLabelsHint'),
  e('layout', 'settings.resetPanelSizes', 'settings.resetPanelSizesHint'),

  // Workspaces
  e('workspaces', 'ws.title'),

  // AI — the general AI is an app page; the AI preferences belong to each profile
  e('ai', 'settings.aiEnabled', 'settings.aiEnabledHint'),
  e('ai', 'settings.aiByProfile', 'settings.aiByProfileHint'),
  e('profile', 'settings.profileAiTitle', 'settings.profileAiGeneral'),
  e('profile', 'settings.useOwnAi', 'settings.profileAiGeneral'),
  e('profile', 'settings.profileAiPrefs', 'settings.profileAiPrefsHint'),
  e('profile', 'settings.generateDescription', 'settings.generateDescriptionHint'),
  e('profile', 'settings.coAuthor', 'settings.coAuthorHint'),
  e('profile', 'settings.branchNamingStyle'),
  e('profile', 'settings.conflictStyle'),
  e('profile', 'settings.hoverExplain', 'settings.hoverExplainHint'),
  e('profile', 'settings.hoverExplainKey'),
  e('profile', 'settings.explainStyle'),
  e('profile', 'settings.repoChat'),
  e('profile', 'settings.repoChatEnable', 'settings.repoChatEnableHint'),
  e('profile', 'settings.repoChatCommitted', 'settings.repoChatCommittedHint'),
  e('profile', 'settings.repoChatActions', 'settings.repoChatActionsHint'),
  e('profile', 'settings.repoChatReadOnly', 'settings.repoChatReadOnlyHint'),
  e('profile', 'settings.repoChatRemoteActions', 'settings.repoChatRemoteActionsHint'),

  // Themes — the Theme tab
  e('themes', 'settings.appearance', undefined, 'theme'),
  e('themes', 'settings.iconColors', 'settings.iconColorsHint', 'theme'),
  e('themes', 'settings.appTheme', undefined, 'theme'),
  e('themes', 'settings.codeTheme', undefined, 'theme'),
  e('themes', 'settings.codeFontSize', undefined, 'theme'),
  e('themes', 'settings.terminalTheme', undefined, 'theme'),
  e('themes', 'settings.terminalFontSize', undefined, 'theme'),
  e('themes', 'settings.terminalFontFamily', 'settings.terminalFontFamilyHint', 'theme'),
  e('themes', 'settings.terminalPoshTheme', 'settings.terminalPoshThemeHint', 'theme'),
  // Themes — the Graph tab
  e('themes', 'settings.graphPalette', undefined, 'graph'),
  e('themes', 'settings.graphCorners', undefined, 'graph'),
  e('themes', 'settings.graphDensity', undefined, 'graph'),
  e('themes', 'settings.graphNodeStyle', undefined, 'graph'),
  e('themes', 'settings.graphLineWidth', undefined, 'graph'),
  e('themes', 'settings.graphFocus', undefined, 'graph'),
  e('themes', 'settings.graphTopology', undefined, 'graph'),

  // Security
  e('security', 'settings.security'),
  e('security', 'settings.maskSecrets', 'settings.maskSecretsHint'),
  e('security', 'keychain.settingsTitle'),
  e('security', 'settings.vault'),
  e('security', 'ssh.title'),

  // Shortcuts — one editor, no labelled rows of its own
  e('shortcuts', 'settings.shortcuts'),

  // Data
  e('data', 'settings.data'),
  e('data', 'settings.importExport'),
  e('data', 'settings.includeSecrets', 'settings.includeSecretsHint'),
  e('data', 'settings.exportWarnTitle'),
  e('data', 'settings.exportProtect', 'settings.exportProtectHint'),
  // Shown only while protection is on; the toggle above matches "password" too.
  e('data', 'settings.exportPassword'),
  e('data', 'settings.exportPasswordConfirm'),
  e('data', 'repos.scanRoots'),
  e('data', 'settings.cachedReposTitle'),

  // Environment
  e('environment', 'settings.environment')
]

/** Lower-case, accents off, whitespace collapsed — so typing "configuracao"
 *  finds "configuração", and a stray double space changes nothing. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** The texts one key reads as: the reader's language first, then English. */
export type SettingsTextReader = (key: TranslationKey) => readonly string[]

/**
 * The entries matching `query`, best first. Every word typed must appear
 * somewhere in the entry — its label, hint or page name, in the reader's
 * language or in English (`read` returns both), so someone using the app in
 * Portuguese who types "token" or "font" still lands on the right row.
 *
 * Ranking: a label starting with the query, then a label containing it, then
 * a label containing every word, then anything else that matched. Ties keep
 * index order, which is the order the pages show them in.
 */
export function searchSettings(
  query: string,
  read: SettingsTextReader,
  entries: readonly SettingsEntry[] = SETTINGS_INDEX
): SettingsEntry[] {
  const q = normalizeSearchText(query)
  if (!q) return []
  const words = q.split(' ')

  const scored: { entry: SettingsEntry; score: number; at: number }[] = []
  entries.forEach((entry, at) => {
    const labels = read(entry.key).map(normalizeSearchText)
    const rest = [
      ...(entry.hint ? read(entry.hint) : []),
      ...read(SETTINGS_PAGE_KEYS[entry.page])
    ].map(normalizeSearchText)
    const haystack = [...labels, ...rest].join(' \u0000 ')
    if (!words.every((w) => haystack.includes(w))) return

    const score = labels.some((l) => l.startsWith(q))
      ? 4
      : labels.some((l) => l.includes(q))
        ? 3
        : labels.some((l) => words.every((w) => l.includes(w)))
          ? 2
          : 1
    scored.push({ entry, score, at })
  })

  return scored.sort((a, b) => b.score - a.score || a.at - b.at).map((s) => s.entry)
}

/** How many matches each page holds — the sidebar dims the pages with none. */
export function countSettingsByPage(matches: readonly SettingsEntry[]): Partial<Record<SettingsPageId, number>> {
  const out: Partial<Record<SettingsPageId, number>> = {}
  for (const m of matches) out[m.page] = (out[m.page] ?? 0) + 1
  return out
}
