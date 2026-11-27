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
  | 'integrations'
  | 'ai'
  | 'themes'
  | 'graph'
  | 'layout'
  | 'general'
  | 'git'
  | 'security'
  | 'analyzers'
  | 'workspaces'
  | 'shortcuts'
  | 'environment'
  | 'data'
  | 'about'

/** Each page's name in the sidebar. Searched too: "terminal" finds the Layout
 *  page's terminal settings, but "layout" should find the page itself. */
export const SETTINGS_PAGE_KEYS: Record<SettingsPageId, TranslationKey> = {
  profile: 'settings.pageProfile',
  integrations: 'settings.pageAccounts',
  ai: 'settings.ai',
  themes: 'settings.themes',
  graph: 'settings.pageGraph',
  layout: 'settings.pageLayout',
  general: 'settings.general',
  git: 'settings.pageGit',
  security: 'settings.pageSecurity',
  analyzers: 'settings.pageAnalyzers',
  workspaces: 'settings.workspaces',
  shortcuts: 'settings.shortcuts',
  environment: 'settings.environment',
  data: 'settings.pageData',
  about: 'settings.about'
}

/** The names pages had before the menu was regrouped. Searched as well, so
 *  someone who learnt "Integrations" or "Data" still finds those pages. */
export const SETTINGS_PAGE_OLD_KEYS: Partial<Record<SettingsPageId, readonly TranslationKey[]>> = {
  profile: ['settings.profile'],
  integrations: ['settings.integrations'],
  graph: ['settings.themes', 'settings.graph'],
  layout: ['settings.layout'],
  security: ['settings.security'],
  data: ['settings.data']
}

export interface SettingsEntry {
  page: SettingsPageId
  /** The label the setting shows — also how the panel finds it on the page. */
  key: TranslationKey
  hint?: TranslationKey
  /** Names the setting went by before, searched as labels: someone who learnt
   *  "Custom instructions" still finds "Extra rules for commits". */
  aka?: readonly TranslationKey[]
  /** The page the setting lived on before it moved: its name still finds it. */
  was?: SettingsPageId
}

const e = (page: SettingsPageId, key: TranslationKey, hint?: TranslationKey, was?: SettingsPageId): SettingsEntry =>
  hint || was ? { page, key, ...(hint ? { hint } : {}), ...(was ? { was } : {}) } : { page, key }

/** An entry that was renamed: its old labels stay searchable. */
const renamed = (page: SettingsPageId, key: TranslationKey, hint: TranslationKey | undefined, aka: TranslationKey[]): SettingsEntry => ({
  ...e(page, key, hint),
  aka
})

/** In sidebar order, then top to bottom within a page — the order ties keep. */
export const SETTINGS_INDEX: readonly SettingsEntry[] = [
  // Profile & identity — the header card, then the page
  e('profile', 'settings.newProfile'),
  e('profile', 'settings.gitIdentity'),
  e('profile', 'profileAvatar.title'),
  e('profile', 'signing.title'),
  e('profile', 'signing.signAll', 'signing.signAllHint'),
  e('profile', 'settings.pageAccounts', 'settings.accountsSummaryHint'),

  // Connected accounts
  e('integrations', 'settings.ghesTitle'),
  e('integrations', 'settings.gitlabServersTitle'),
  e('integrations', 'settings.bbsTitle'),
  e('integrations', 'localCi.title'),
  e('integrations', 'localCi.enable', 'localCi.intro'),

  // AI — everything about an AI lives on the AI page, the general one's or a
  // profile's own; the Profile page only says which one the profile uses
  e('ai', 'settings.aiEnabled', 'settings.aiEnabledHint'),
  e('ai', 'settings.aiSectionCommits'),
  e('ai', 'settings.commitStyle', 'settings.commitStyleHint'),
  e('ai', 'settings.generateDescription', 'settings.generateDescriptionHint'),
  e('ai', 'settings.coAuthor', 'settings.coAuthorHint'),
  renamed('ai', 'settings.commitRules', 'settings.commitRulesHint', ['settings.customInstructions']),
  e('ai', 'settings.commitPreview', 'settings.commitPreviewHint'),
  e('ai', 'settings.aiSectionExplain'),
  e('ai', 'settings.explainStyle', 'settings.explainStyleHint'),
  e('ai', 'settings.hoverExplain', 'settings.hoverExplainHint'),
  e('ai', 'settings.hoverExplainKey', 'settings.hoverExplainKeyHint'),
  e('ai', 'settings.aiSectionBranches'),
  e('ai', 'settings.conflictStyle', 'settings.conflictStyleHint'),
  e('ai', 'settings.branchNamingStyle', 'settings.branchNamingStyleHint'),
  e('ai', 'settings.repoChat'),
  e('ai', 'settings.repoChatEnable', 'settings.repoChatEnableHint'),
  e('ai', 'settings.repoChatPermissions'),
  e('ai', 'settings.repoChatRead', 'settings.repoChatReadHint'),
  renamed('ai', 'settings.repoChatGitActions', 'settings.repoChatGitActionsHint', ['settings.repoChatActions']),
  // Its old name said the opposite ("read-only"); both still find it.
  renamed('ai', 'settings.repoChatFiles', 'settings.repoChatFilesHint', ['settings.repoChatReadOnly']),
  renamed('ai', 'settings.repoChatRemote', 'settings.repoChatRemoteActionsHint', ['settings.repoChatRemoteActions']),
  renamed('ai', 'settings.repoChatApprovalTitle', 'settings.repoChatApprovalHint', ['chat.approvalTitle']),
  renamed('ai', 'settings.repoChatCommitted', 'settings.repoChatCommittedHint', ['settings.repoChatPrivacy']),
  e('ai', 'settings.aiByProfile', 'settings.aiByProfileHint'),
  e('profile', 'settings.profileAiTitle', 'settings.profileAiGeneral'),
  e('profile', 'settings.useOwnAi', 'settings.profileAiGeneral'),

  // Themes
  e('themes', 'settings.appearance'),
  e('themes', 'settings.iconColors', 'settings.iconColorsHint'),
  e('themes', 'settings.iconPalette', 'settings.iconPaletteHint'),
  e('themes', 'settings.appTheme'),
  e('themes', 'settings.codeTheme'),
  e('themes', 'settings.codeFontSize'),
  e('themes', 'settings.terminalTheme'),
  e('themes', 'settings.terminalFontSize'),
  e('themes', 'settings.terminalFontFamily', 'settings.terminalFontFamilyHint'),
  e('themes', 'settings.terminalPoshTheme', 'settings.terminalPoshThemeHint'),

  // Graph — history and rows came from General, the drawing from Themes' Graph tab
  e('graph', 'settings.pageGraph', 'settings.graphPageIntro'),
  e('graph', 'settings.graphHistory', 'settings.graphIntro', 'general'),
  e('graph', 'settings.initialCommitCount', 'settings.initialCommitCountHint', 'general'),
  e('graph', 'settings.loadMoreCount', undefined, 'general'),
  e('graph', 'settings.autoLoadOnScroll', 'settings.autoLoadOnScrollHint', 'general'),
  e('graph', 'settings.graphRows', undefined, 'general'),
  e('graph', 'settings.relativeDates', 'settings.relativeDatesHint', 'general'),
  e('graph', 'settings.commitAvatars', 'settings.commitAvatarsHint', 'general'),
  e('graph', 'settings.githubAvatars', 'settings.githubAvatarsHint', 'general'),
  e('graph', 'settings.graphAppearance', undefined, 'themes'),
  e('graph', 'settings.graphPalette', undefined, 'themes'),
  e('graph', 'settings.graphCorners', undefined, 'themes'),
  e('graph', 'settings.graphDensity', undefined, 'themes'),
  e('graph', 'settings.graphNodeStyle', undefined, 'themes'),
  e('graph', 'settings.graphFocus', undefined, 'themes'),
  e('graph', 'settings.graphTopology', undefined, 'themes'),
  e('graph', 'settings.graphLineWidth', undefined, 'themes'),

  // Layout & terminal
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
  e('layout', 'settings.layoutChrome', undefined, 'general'),
  e('layout', 'settings.avatarMotion', 'settings.avatarMotionHint', 'general'),
  e('layout', 'settings.todosHideDone', 'settings.todosHideDoneHint', 'general'),
  e('layout', 'settings.groupBranches', 'settings.groupBranchesHint', 'general'),
  e('layout', 'settings.fileViewer', 'settings.fileViewerIntro', 'general'),
  e('layout', 'settings.showChangeGutter', 'settings.showChangeGutterHint', 'general'),
  e('layout', 'settings.showMinimap', 'settings.showMinimapHint', 'general'),

  // General — only what is about the app as a whole
  e('general', 'settings.general'),
  e('general', 'settings.language'),
  e('general', 'settings.tabRepoLabel'),
  e('general', 'settings.desktopNotifications', 'settings.desktopNotificationsHint'),
  e('general', 'settings.autoOpenChangelog', 'settings.autoOpenChangelogHint'),
  e('general', 'settings.warnOnClose'),

  // Git & sync — all of it came from General
  e('git', 'settings.pageGit', 'settings.gitIntro'),
  e('git', 'settings.gitSync', undefined, 'general'),
  e('git', 'settings.autoFetch', 'settings.autoFetchHint', 'general'),
  e('git', 'settings.gitMerging', undefined, 'general'),
  e('git', 'settings.mergeCommit', 'settings.mergeCommitHint', 'general'),
  e('git', 'rerere.title', 'rerere.intro', 'general'),
  e('git', 'rerere.enable', 'rerere.enableHint', 'general'),
  e('git', 'rerere.autoUpdate', 'rerere.autoUpdateHint', 'general'),
  e('git', 'difftool.title', 'difftool.intro', 'general'),
  e('git', 'difftool.keepBackup', 'difftool.keepBackupHint', 'general'),
  e('git', 'settings.editor', 'settings.editorHint', 'general'),
  e('git', 'settings.editorChoice', undefined, 'general'),
  e('git', 'settings.defaultOpenApp', 'settings.defaultOpenAppHint', 'general'),

  // Security & confirmations
  e('security', 'settings.pageSecurity', 'settings.securityIntro'),
  e('security', 'settings.secAskTitle'),
  e('security', 'settings.confirmForcePush', 'settings.confirmForcePushHint', 'general'),
  e('security', 'settings.largeFileWarn', 'settings.largeFileWarnHint'),
  e('security', 'settings.secAlwaysAsk', 'settings.secAlwaysAskHint'),
  e('security', 'settings.privacyTitle'),
  e('security', 'settings.maskSecrets', 'settings.maskSecretsHint'),
  e('security', 'settings.commentImagesFromOtherSites', 'settings.commentImagesFromOtherSitesHint'),
  e('security', 'settings.vault'),
  e('security', 'keychain.settingsTitle'),
  e('security', 'ssh.title'),

  // Code analyzers — from General
  e('analyzers', 'settings.analyzerMode', 'settings.analyzerModeHint', 'general'),
  e('analyzers', 'settings.launchTitle', undefined, 'general'),
  e('analyzers', 'settings.launchEnabled', 'settings.launchEnabledHint', 'general'),

  // Workspaces
  e('workspaces', 'ws.title'),

  // Shortcuts — one editor, no labelled rows of its own
  e('shortcuts', 'settings.shortcuts'),

  // Environment
  e('environment', 'settings.environment'),

  // Data & backup
  e('data', 'settings.pageData'),
  e('data', 'settings.importExport'),
  e('data', 'settings.includeSecrets', 'settings.includeSecretsHint'),
  e('data', 'settings.exportWarnTitle'),
  e('data', 'settings.exportProtect', 'settings.exportProtectHint'),
  // Shown only while protection is on; the toggle above matches "password" too.
  e('data', 'settings.exportPassword'),
  e('data', 'settings.exportPasswordConfirm'),
  e('data', 'repos.scanRoots'),
  e('data', 'settings.dangerZone', 'settings.dangerZoneHint'),
  e('data', 'settings.cachedReposTitle'),

  // About — the version, going back to an earlier one, the settings copies
  e('about', 'settings.about'),
  e('about', 'about.installed', 'about.checkUpdates'),
  e('about', 'rollback.title', 'rollback.intro'),
  e('about', 'backups.title', 'backups.hint')
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
 * somewhere in the entry — its label, hint or page name (or the page it lived
 * on before it moved), in the reader's language or in English (`read` returns both), so someone using the app in
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
    const labels = [entry.key, ...(entry.aka ?? [])].flatMap(read).map(normalizeSearchText)
    const rest = [
      ...(entry.hint ? read(entry.hint) : []),
      ...pageNames(entry.page).flatMap(read),
      ...(entry.was ? pageNames(entry.was).flatMap(read) : [])
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

/** A page's name now and the names it had before. */
function pageNames(page: SettingsPageId): TranslationKey[] {
  return [SETTINGS_PAGE_KEYS[page], ...(SETTINGS_PAGE_OLD_KEYS[page] ?? [])]
}

/** How many matches each page holds — the sidebar dims the pages with none. */
export function countSettingsByPage(matches: readonly SettingsEntry[]): Partial<Record<SettingsPageId, number>> {
  const out: Partial<Record<SettingsPageId, number>> = {}
  for (const m of matches) out[m.page] = (out[m.page] ?? 0) + 1
  return out
}
