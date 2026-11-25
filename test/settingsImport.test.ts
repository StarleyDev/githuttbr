import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  defaultAIConfig,
  defaultProfile,
  defaultSettings,
  type AIConfig,
  type AppSettings,
  type GroupTab,
  type RepoTab,
  type TabState
} from '../src/shared/types'

// The selective settings import: which part each key belongs to, translating
// an export's repository paths onto this machine, and the store merge that
// leaves unchosen parts alone.

let onDisk: AppSettings = defaultSettings()
let generation = 0
vi.mock('electron', () => ({ app: {}, ipcMain: {} }))
vi.mock('../src/renderer/src/infrastructure/api', () => ({
  settingsApi: {
    set: vi.fn(async (settings: AppSettings) => {
      onDisk = settings
    }),
    get: vi.fn(async () => ({ settings: onDisk, generation: ++generation })),
    unlock: vi.fn(async () => ({ settings: onDisk, generation: ++generation }))
  },
  reposApi: {},
  SettingsSaveRefused: class SettingsSaveRefused extends Error {}
}))

import {
  IMPORT_KEYS,
  IMPORT_PARTS,
  bundleExtrasFor,
  bundleRepoPaths,
  dropMissingRepos,
  keepMachineAIPaths,
  mergeRepoPart,
  partOfKey,
  pickParts,
  remapInfoExport,
  remapPath,
  remapRepoPaths,
  remapVaultExport,
  suggestRemap,
  summarizeImport,
  takeMachineAIPaths
} from '../src/renderer/src/lib/settingsImport'
import { useSettingsStore } from '../src/renderer/src/stores/settings'
import { isProbeablePath } from '../src/main/pathExistence'

const W = '/home/dev/Workspace'

function aiWith(accounts: { id: string; cliPath?: string }[], extra: Partial<AIConfig> = {}): AIConfig {
  const base = defaultAIConfig()
  return {
    ...base,
    accounts: accounts.map((a) => ({ ...base.accounts[0], id: a.id, provider: 'cli', cliPath: a.cliPath })),
    defaultAccountId: accounts[0].id,
    ...extra
  }
}

/** What a Linux machine exports: a repo tab, a group with folders and a page,
 *  a repo-scoped page tab, workspaces, and every path-keyed map. */
function linuxExport(): Partial<AppSettings> {
  const repoTab: RepoTab = {
    id: 't1',
    name: 'api',
    kind: 'repo',
    repos: [{ path: `${W}/api`, name: 'api' }],
    activeRepoPath: `${W}/api`,
    pages: [{ type: 'insights', repoPath: `${W}/api` }],
    activePage: 0
  }
  const group: GroupTab = {
    id: 't2',
    name: 'apps',
    kind: 'group',
    repos: [
      { path: `${W}/web`, name: 'web' },
      { path: `${W}/gone`, name: 'gone' },
      { path: `${W}/web-wt`, name: 'web-wt', worktreeRoot: `${W}/web` }
    ],
    activeRepoPath: `${W}/gone`,
    folders: [{ id: 'f', name: 'F', paths: [`${W}/gone`, `${W}/web`], folders: [] }],
    pages: [
      { type: 'wiki', repoPath: `${W}/web` },
      { type: 'ci-runs', repoPath: `${W}/gone` }
    ],
    activePage: 1
  }
  const lonelyGroup: GroupTab = {
    id: 't3',
    name: 'old',
    kind: 'group',
    repos: [{ path: `${W}/gone`, name: 'gone' }],
    activeRepoPath: `${W}/gone`
  }
  const pageTab: TabState = { id: 't4', name: 'wiki', kind: 'page', page: { type: 'wiki', repoPath: `${W}/gone` } }
  const changelog: TabState = { id: 't5', name: 'log', kind: 'page', page: { type: 'changelog' } }
  const tabs: TabState[] = [repoTab, group, lonelyGroup, pageTab, changelog]
  return {
    profiles: [{ ...defaultProfile(), id: 'p1', name: 'Work', ai: aiWith([{ id: 'acc', cliPath: '/usr/bin/claude' }]) }],
    activeProfileId: 'p1',
    ai: aiWith([{ id: 'acc', cliPath: '/usr/bin/claude' }], { cliCwd: `${W}/api` }),
    tabs,
    activeTabId: 't3',
    workspaces: [
      { id: 'default', name: 'Main', tabs, activeTabId: 't3' },
      { id: 'w2', name: 'Side', tabs: [lonelyGroup], activeTabId: 't3', sourcePath: W }
    ],
    activeWorkspaceId: 'default',
    recentRepos: [
      { path: `${W}/api`, name: 'api' },
      { path: `${W}/gone`, name: 'gone' }
    ],
    repoScanRoots: [{ path: W, depth: 3 }, { path: '/mnt/data', depth: 2 }],
    favouriteRepos: [`${W}/api`, `${W}/gone`],
    repoProfiles: { [`${W}/api`]: 'p1', [`${W}/gone`]: 'p1' },
    repoAliases: { [`${W}/web`]: 'Website', [`${W}/gone`]: 'Gone' },
    repoImages: { [`${W}/api`]: 'assets/icon.png' },
    repoLayouts: { [`${W}/api`]: { pinnedBranches: ['main'] } },
    repoTodos: { [`${W}/api`]: [] },
    repoBookmarks: { [`${W}/gone`]: [] },
    repoSectionColors: { favourites: '#f00' },
    lastClonePath: `${W}/clones`,
    terminalShell: '/usr/bin/zsh',
    terminalPoshTheme: 'paradox',
    defaultOpenApp: { name: 'Code', path: '/usr/bin/code' },
    editor: { id: 'vscode', command: '/usr/bin/code', name: 'VS Code', source: 'cli' },
    language: 'pt-BR',
    appThemeId: 'midnight',
    confirmForcePush: false
  }
}

describe('classification', () => {
  it('puts every AppSettings key in exactly one part', () => {
    // The Record behind partOfKey is the compile-time check; this guards the
    // runtime side against a key typed twice or misspelt.
    const all = Object.keys(defaultSettings())
    for (const key of all) expect(IMPORT_KEYS).toContain(key)
    expect(new Set(IMPORT_KEYS).size).toBe(IMPORT_KEYS.length)
    for (const key of IMPORT_KEYS) expect(IMPORT_PARTS).toContain(partOfKey(key))
  })

  it('files the keys the import dialog talks about where it says', () => {
    expect(partOfKey('profiles')).toBe('profiles')
    expect(partOfKey('ai')).toBe('profiles')
    expect(partOfKey('aiSecretsFrom')).toBe('profiles')
    for (const key of ['tabs', 'workspaces', 'repoProfiles', 'repoTodos', 'repoBookmarks', 'lastClonePath'] as const)
      expect(partOfKey(key)).toBe('repos')
    for (const key of ['terminalShell', 'terminalPoshTheme', 'defaultOpenApp', 'editor'] as const)
      expect(partOfKey(key)).toBe('machine')
    expect(partOfKey('language')).toBe('prefs')
    expect(partOfKey('terminalFontFamily')).toBe('prefs')
  })
})

describe('summarizeImport', () => {
  it('describes a Linux export part by part', () => {
    const summary = summarizeImport(linuxExport())
    expect(summary.profileCount).toBe(1)
    expect(summary.prefCount).toBe(3) // language, appThemeId, confirmForcePush
    expect(summary.repoPaths).toEqual([
      `${W}/api`,
      `${W}/web`,
      `${W}/gone`,
      `${W}/web-wt`,
      W,
      '/mnt/data',
      `${W}/clones`
    ])
    // A bare posh theme name is not a path; the shell, editor, app and CLI are.
    expect(summary.machinePaths).toEqual(['/usr/bin/zsh', '/usr/bin/code', `${W}/api`, '/usr/bin/claude'])
  })

  it('is empty for an empty file', () => {
    expect(summarizeImport({})).toEqual({ profileCount: 0, prefCount: 0, repoPaths: [], machinePaths: [] })
  })
})

describe('suggestRemap', () => {
  it('Linux → Mac', () => {
    expect(suggestRemap([`${W}/api`, `${W}/web`], '/Users/dev')).toEqual({
      from: W,
      to: '/Users/dev/Workspace'
    })
  })

  it('Mac → Linux', () => {
    expect(suggestRemap(['/Users/ana/Code/a', '/Users/ana/Code/b/c'], '/home/ana')).toEqual({
      from: '/Users/ana/Code',
      to: '/home/ana/Code'
    })
  })

  it('Windows → Linux, and Linux → Windows', () => {
    expect(suggestRemap(['C:\\Users\\dev\\Code\\a', 'c:\\users\\dev\\Code\\b'], '/home/dev')).toEqual({
      from: 'C:\\Users\\dev\\Code',
      to: '/home/dev/Code'
    })
    expect(suggestRemap([`${W}/a`, `${W}/b`], 'C:\\Users\\dev')).toEqual({
      from: W,
      to: 'C:\\Users\\dev\\Workspace'
    })
  })

  it('ignores paths outside a home instead of giving up', () => {
    expect(suggestRemap([`${W}/a`, '/tmp/wt', `${W}/b`, '/opt/x'], '/Users/dev')).toEqual({
      from: W,
      to: '/Users/dev/Workspace'
    })
    expect(suggestRemap(['C:\\Users\\dev\\Code\\a', 'D:\\x', 'C:\\Users\\dev\\Code\\b'], '/home/dev')).toEqual({
      from: 'C:\\Users\\dev\\Code',
      to: '/home/dev/Code'
    })
  })

  it('follows the home most paths sit under', () => {
    expect(suggestRemap(['/home/old/a', `${W}/a`, `${W}/b`], '/Users/dev')).toEqual({
      from: W,
      to: '/Users/dev/Workspace'
    })
  })

  it('null when no path is under a home', () => {
    expect(suggestRemap(['/srv/a', '/srv/b'], '/Users/dev')).toBeNull()
    expect(suggestRemap(['/srv/a', '/srv/b'], '/Users/dev')).toBeNull()
    expect(suggestRemap([], '/Users/dev')).toBeNull()
  })
})

describe('remapPath', () => {
  it('swaps a prefix only on a segment boundary', () => {
    expect(remapPath('/home/dev/Work/a', '/home/dev/Work', '/Users/dev/Work')).toBe('/Users/dev/Work/a')
    expect(remapPath('/home/dev/Workspace2/a', '/home/dev/Work', '/Users/dev/Work')).toBe('/home/dev/Workspace2/a')
    expect(remapPath('/home/dev/Work', '/home/dev/Work/', '/Users/dev/Work')).toBe('/Users/dev/Work')
    expect(remapPath('/srv/x', '/home/dev', '/Users/dev')).toBe('/srv/x')
  })

  it('writes the result in the target’s separators', () => {
    expect(remapPath('/home/dev/Code/a/b', '/home/dev', 'C:\\Users\\dev')).toBe('C:\\Users\\dev\\Code\\a\\b')
    expect(remapPath('C:\\Users\\dev\\Code\\a', 'c:\\users\\dev', '/home/dev')).toBe('/home/dev/Code/a')
  })
})

describe('remapRepoPaths', () => {
  const out = remapRepoPaths(linuxExport(), W, '/Users/dev/Workspace')
  const M = '/Users/dev/Workspace'

  it('rewrites record keys', () => {
    expect(Object.keys(out.repoProfiles!)).toEqual([`${M}/api`, `${M}/gone`])
    expect(Object.keys(out.repoAliases!)).toEqual([`${M}/web`, `${M}/gone`])
    expect(out.repoImages).toEqual({ [`${M}/api`]: 'assets/icon.png' })
    expect(Object.keys(out.repoLayouts!)).toEqual([`${M}/api`])
    expect(Object.keys(out.repoTodos!)).toEqual([`${M}/api`])
    expect(Object.keys(out.repoBookmarks!)).toEqual([`${M}/gone`])
  })

  it('rewrites values', () => {
    expect(out.favouriteRepos).toEqual([`${M}/api`, `${M}/gone`])
    expect(out.recentRepos!.map((r) => r.path)).toEqual([`${M}/api`, `${M}/gone`])
    expect(out.repoScanRoots).toEqual([{ path: M, depth: 3 }, { path: '/mnt/data', depth: 2 }])
    expect(out.lastClonePath).toBe(`${M}/clones`)
    const [repoTab, group, , pageTab] = out.tabs! as [RepoTab, GroupTab, GroupTab, TabState]
    expect(repoTab.repos[0].path).toBe(`${M}/api`)
    expect(repoTab.activeRepoPath).toBe(`${M}/api`)
    expect(repoTab.pages).toEqual([{ type: 'insights', repoPath: `${M}/api` }])
    expect(group.repos[2]).toEqual({ path: `${M}/web-wt`, name: 'web-wt', worktreeRoot: `${M}/web` })
    expect(group.folders![0].paths).toEqual([`${M}/gone`, `${M}/web`])
    expect(pageTab.kind === 'page' && pageTab.page).toEqual({ type: 'wiki', repoPath: `${M}/gone` })
    const ws = out.workspaces!
    expect((ws[0].tabs[0] as RepoTab).activeRepoPath).toBe(`${M}/api`)
    expect((ws[1].tabs[0] as GroupTab).repos[0].path).toBe(`${M}/gone`)
    expect(ws[1].sourcePath).toBe(M)
  })

  it('keeps canonical-keyed maps canonical on Windows', () => {
    const win = remapRepoPaths(linuxExport(), W, 'C:\\Users\\dev\\Workspace')
    expect(Object.keys(win.repoTodos!)).toEqual(['c:/Users/dev/Workspace/api'])
    // repoProfiles is keyed by the path as the tab holds it.
    expect(Object.keys(win.repoProfiles!)[0]).toBe('C:\\Users\\dev\\Workspace\\api')
  })

  it('leaves the other parts alone', () => {
    expect(out.terminalShell).toBe('/usr/bin/zsh')
    expect(out.ai?.cliCwd).toBe(`${W}/api`)
  })
})

describe('dropMissingRepos', () => {
  const existing = new Set([`${W}/api`, `${W}/web`, `${W}/web-wt`, W])
  const out = dropMissingRepos(linuxExport(), existing)

  it('removes missing repositories from tabs and drops tabs left empty', () => {
    expect(out.tabs!.map((t) => t.id)).toEqual(['t1', 't2', 't5'])
    const group = out.tabs![1] as GroupTab
    expect(group.repos.map((r) => r.path)).toEqual([`${W}/web`, `${W}/web-wt`])
    expect(group.activeRepoPath).toBe(`${W}/web`)
    expect(group.folders![0].paths).toEqual([`${W}/web`])
    expect(group.pages).toEqual([{ type: 'wiki', repoPath: `${W}/web` }])
    // The page that was showing went with its repository.
    expect(group.activePage).toBeNull()
    expect((out.tabs![0] as RepoTab).activePage).toBe(0)
    expect(out.activeTabId).toBe('t1')
  })

  it('empties workspaces whose repositories are all gone', () => {
    expect(out.workspaces![1].tabs).toEqual([])
    expect(out.workspaces![1].activeTabId).toBeNull()
    expect(out.workspaces![0].activeTabId).toBe('t1')
  })

  it('filters lists and record keys', () => {
    expect(out.recentRepos!.map((r) => r.path)).toEqual([`${W}/api`])
    expect(out.favouriteRepos).toEqual([`${W}/api`])
    expect(out.repoScanRoots).toEqual([{ path: W, depth: 3 }])
    expect(Object.keys(out.repoProfiles!)).toEqual([`${W}/api`])
    expect(Object.keys(out.repoAliases!)).toEqual([`${W}/web`])
    expect(out.repoBookmarks).toEqual({})
    expect(out.lastClonePath).toBeUndefined()
  })

  it('matches across separator style and drive case', () => {
    const win = dropMissingRepos({ repoTodos: { 'c:/Users/dev/a': [] } }, new Set(['C:\\Users\\dev\\a\\']))
    expect(Object.keys(win.repoTodos!)).toEqual(['c:/Users/dev/a'])
  })
})

describe('pickParts', () => {
  it('keeps only the chosen parts', () => {
    const picked = pickParts(linuxExport(), ['prefs', 'machine'])
    expect(Object.keys(picked).sort()).toEqual(
      ['appThemeId', 'confirmForcePush', 'defaultOpenApp', 'editor', 'language', 'terminalPoshTheme', 'terminalShell'].sort()
    )
  })

  it('passes the whole file — unknown keys included — when every part is chosen', () => {
    const file = { ...linuxExport(), legacyThing: 1 } as Partial<AppSettings>
    expect(pickParts(file, IMPORT_PARTS)).toEqual(file)
    expect('legacyThing' in pickParts(file, ['prefs'])).toBe(false)
  })
})

describe('AI CLI paths and bundle extras', () => {
  const current = {
    ...defaultSettings(),
    ai: aiWith([{ id: 'acc', cliPath: '/opt/homebrew/bin/claude' }, { id: 'mine' }]),
    profiles: [{ ...defaultProfile(), id: 'p1', ai: aiWith([{ id: 'acc', cliPath: '/opt/homebrew/bin/claude' }]) }]
  }

  it('profiles without machine keep this machine’s paths, and drop the file’s for unknown accounts', () => {
    const file = { ai: aiWith([{ id: 'acc', cliPath: '/usr/bin/claude' }, { id: 'theirs', cliPath: '/usr/bin/x' }]) }
    const kept = keepMachineAIPaths(file, current)
    expect(kept.ai!.accounts.map((a) => a.cliPath)).toEqual(['/opt/homebrew/bin/claude', undefined])
    expect(kept.profiles).toBeUndefined()
  })

  it('machine without profiles takes the file’s paths onto our accounts of the same id', () => {
    const taken = takeMachineAIPaths(current, linuxExport())
    expect(taken.ai!.accounts.map((a) => a.cliPath)).toEqual(['/usr/bin/claude', undefined])
    expect(taken.profiles![0].ai.accounts[0].cliPath).toBe('/usr/bin/claude')
  })

  it('bundleExtrasFor', () => {
    expect(bundleExtrasFor(['repos'])).toEqual({ info: true, vault: false, avatars: false })
    expect(bundleExtrasFor(['profiles'])).toEqual({ info: false, vault: true, avatars: true })
  })

  it('remaps info and vault keys, dropping missing ones when asked', () => {
    const info = { repos: { [`${W}/api`]: [], [`${W}/gone`]: [] } }
    expect(remapInfoExport(info, W, '/Users/dev/W', ['/Users/dev/W/api'])).toEqual({ repos: { '/Users/dev/W/api': [] } })
    expect(Object.keys(remapInfoExport(info, W, '/Users/dev/W').repos)).toHaveLength(2)
    const vault = { repos: { [`${W}/api`]: [] }, global: [] }
    // Never filtered: a secret for a repository not here yet is kept.
    expect(remapVaultExport(vault, W, '/Users/dev/W')).toEqual({ repos: { '/Users/dev/W/api': [] }, global: [] })
  })

  it('bundleRepoPaths lists the info and vault keys once', () => {
    const bundle = {
      info: { repos: { [`${W}/api`]: [], [`${W}/docs`]: [] } },
      vault: { repos: { [`${W}/api/`]: [], '': [], [`${W}/secret`]: [] }, global: [] }
    }
    expect(bundleRepoPaths(bundle)).toEqual([`${W}/api`, `${W}/docs`, `${W}/secret`])
    expect(bundleRepoPaths(null)).toEqual([])
  })
})

describe('the store merge', () => {
  beforeEach(async () => {
    onDisk = {
      ...defaultSettings(),
      onboardingCompleted: true,
      language: 'en',
      terminalShell: '/bin/bash',
      repoAliases: { '/Users/dev/mine': 'Mine' },
      ai: aiWith([{ id: 'acc', cliPath: '/opt/homebrew/bin/claude' }]),
      profiles: [{ ...defaultProfile(), id: 'local', name: 'Local' }],
      activeProfileId: 'local'
    }
    await useSettingsStore.getState().load()
  })

  it('leaves the keys of unchosen parts at their current values', async () => {
    await useSettingsStore.getState().importSettings(linuxExport(), { parts: ['prefs'] })
    const s = useSettingsStore.getState().settings
    expect(s.appThemeId).toBe('midnight')
    expect(s.confirmForcePush).toBe(false)
    expect(s.terminalShell).toBe('/bin/bash')
    expect(s.repoAliases).toEqual({ '/Users/dev/mine': 'Mine' })
    expect(s.profiles.map((p) => p.id)).toEqual(['local'])
  })

  it('translates and filters the repositories part', async () => {
    const M = '/Users/dev/Workspace'
    await useSettingsStore.getState().importSettings(linuxExport(), {
      parts: ['repos'],
      remap: { from: W, to: M, existing: [`${M}/api`] }
    })
    const s = useSettingsStore.getState().settings
    expect(s.tabs.map((t) => t.id)).toEqual(['t1', 't5'])
    expect(s.favouriteRepos).toEqual([`${M}/api`])
    expect(s.language).toBe('en')
  })

  it('repos with none found keeps this machine’s tabs and todos', async () => {
    const tab: RepoTab = { id: 'm1', name: 'm', kind: 'repo', repos: [{ path: '/Users/dev/mine', name: 'mine' }], activeRepoPath: '/Users/dev/mine' }
    useSettingsStore.getState().update((s) => ({ ...s, tabs: [tab], activeTabId: 'm1', repoTodos: { '/Users/dev/mine': [] } }))
    await useSettingsStore.getState().importSettings(linuxExport(), {
      parts: ['repos'],
      remap: { from: W, to: '/Users/dev/Workspace', existing: [] }
    })
    const s = useSettingsStore.getState().settings
    expect(s.tabs.map((t) => t.id)).toEqual(['m1', 't5'])
    expect(s.activeTabId).toBe('m1')
    expect(s.repoTodos).toEqual({ '/Users/dev/mine': [] })
    expect(s.repoAliases).toEqual({ '/Users/dev/mine': 'Mine' })
  })

  it('profiles without machine keep this machine’s CLI path', async () => {
    await useSettingsStore.getState().importSettings(linuxExport(), { parts: ['profiles'] })
    const s = useSettingsStore.getState().settings
    expect(s.profiles.map((p) => p.id)).toEqual(['p1'])
    expect(s.ai.accounts.find((a) => a.id === 'acc')?.cliPath).toBe('/opt/homebrew/bin/claude')
    expect(s.terminalShell).toBe('/bin/bash')
  })

  it('repos without profiles never rebinds a repository to a profile of the other machine', async () => {
    const M = '/Users/dev/Workspace'
    useSettingsStore.getState().update((s) => ({ ...s, repoProfiles: { [`${M}/api`]: 'local' } }))
    const file = linuxExport()
    file.repoProfiles = { [`${W}/api`]: 'p1', [`${W}/web`]: 'local', [`${W}/ghost`]: 'p1' }
    await useSettingsStore.getState().importSettings(file, {
      parts: ['repos'],
      remap: { from: W, to: M, existing: [`${M}/api`, `${M}/web`, `${M}/ghost`] }
    })
    // api keeps our binding; web binds to a profile that exists here; ghost's
    // profile only exists on the other machine, so it is not bound at all.
    expect(useSettingsStore.getState().settings.repoProfiles).toEqual({ [`${M}/api`]: 'local', [`${M}/web`]: 'local' })
  })

  it('repos filters missing folders even without a translation', async () => {
    const file = linuxExport()
    await useSettingsStore.getState().importSettings(file, {
      parts: ['repos'],
      remap: { from: '', to: '', existing: [`${W}/api`] }
    })
    const paths = useSettingsStore.getState().settings.favouriteRepos
    expect(paths.every((p) => p === `${W}/api` || !p.startsWith(W))).toBe(true)
  })

  it('every part by default, as before', async () => {
    await useSettingsStore.getState().importSettings(linuxExport())
    const s = useSettingsStore.getState().settings
    expect(s.terminalShell).toBe('/usr/bin/zsh')
    expect(s.ai.accounts.find((a) => a.id === 'acc')?.cliPath).toBe('/usr/bin/claude')
    expect(s.language).toBe('pt-BR')
  })
})

describe('dropMissingRepos keeps the active tab and page coherent', () => {
  it('moves activeTabId off a dropped tab, and keeps a surviving active page by identity', () => {
    const file = linuxExport()
    const repoTab = file.tabs![0] as RepoTab
    // The showing page is the second one; the first goes, so its index shifts.
    file.tabs![0] = {
      ...repoTab,
      pages: [{ type: 'ci-runs', repoPath: `${W}/gone` }, { type: 'insights', repoPath: `${W}/api` }],
      activePage: 1
    }
    const out = dropMissingRepos(file, new Set([`${W}/api`, `${W}/web`]))
    expect((out.tabs![0] as RepoTab).pages).toEqual([{ type: 'insights', repoPath: `${W}/api` }])
    expect((out.tabs![0] as RepoTab).activePage).toBe(0)
    // t3 (the active tab) held only a missing repository.
    expect(out.activeTabId).toBe('t1')
    expect(dropMissingRepos({ ...file, activeTabId: 't2' }, new Set([`${W}/web`])).activeTabId).toBe('t2')
  })
})

describe('mergeRepoPart', () => {
  const M = '/Users/dev/Workspace'
  const mine: RepoTab = {
    id: 'm1',
    name: 'local',
    kind: 'repo',
    repos: [{ path: '/Users/dev/local', name: 'local' }],
    activeRepoPath: '/Users/dev/local'
  }
  const current = (): AppSettings => ({
    ...defaultSettings(),
    tabs: [mine],
    activeTabId: 'm1',
    workspaces: [{ id: 'default', name: 'Mine', tabs: [mine], activeTabId: 'm1' }],
    activeWorkspaceId: 'default',
    repoAliases: { [`${M}/web`]: 'Ours', '/Users/dev/local': 'Local' },
    repoTodos: { '/Users/dev/local': [] },
    favouriteRepos: ['/Users/dev/local'],
    recentRepos: [{ path: '/Users/dev/local', name: 'local' }]
  })

  it('keeps everything of ours when none of the file’s repositories exist', () => {
    const chosen = dropMissingRepos(remapRepoPaths(pickParts(linuxExport(), ['repos']), W, M), new Set())
    const out = mergeRepoPart(current(), chosen)
    // Only the file's changelog tab is added — it needs no repository.
    expect(out.tabs!.map((t) => t.id)).toEqual(['m1', 't5'])
    expect(out.activeTabId).toBe('m1')
    expect(out.repoTodos).toEqual({ '/Users/dev/local': [] })
    expect(out.favouriteRepos).toEqual(['/Users/dev/local'])
  })

  it('adds the file’s repositories; the file wins per repository, ours stay', () => {
    const chosen = dropMissingRepos(
      remapRepoPaths(pickParts(linuxExport(), ['repos']), W, M),
      new Set([`${M}/api`, `${M}/web`, `${M}/web-wt`])
    )
    const out = mergeRepoPart(current(), chosen)
    expect(out.repoAliases).toEqual({ [`${M}/web`]: 'Website', '/Users/dev/local': 'Local' })
    expect(out.favouriteRepos).toEqual([`${M}/api`, '/Users/dev/local'])
    expect(out.recentRepos!.map((r) => r.path)).toEqual([`${M}/api`, '/Users/dev/local'])
    // Our tab first, then the file's that we did not have; still ours active.
    expect(out.tabs!.map((t) => t.id)).toEqual(['m1', 't1', 't2', 't5'])
    expect(out.activeTabId).toBe('m1')
    // The file's other workspace lost every tab: not added.
    expect(out.workspaces!.map((w) => w.id)).toEqual(['default'])
  })

  it('skips a tab we already have, by id or by the same repositories', () => {
    const same: RepoTab = { ...mine, id: 'other-id' }
    const out = mergeRepoPart(current(), { tabs: [same, mine], workspaces: [{ id: 'default', name: 'x', tabs: [same], activeTabId: null }] })
    expect(out.tabs!.map((t) => t.id)).toEqual(['m1'])
  })

  it('puts a pre-workspaces export’s tabs into our active workspace, translated', () => {
    const legacy = { tabs: linuxExport().tabs, activeTabId: 't1' }
    const chosen = dropMissingRepos(remapRepoPaths(legacy, W, M), new Set([`${M}/api`]))
    const out = mergeRepoPart(current(), chosen)
    expect(out.tabs!.map((t) => t.id)).toEqual(['m1', 't1', 't5'])
    expect((out.tabs![1] as RepoTab).activeRepoPath).toBe(`${M}/api`)
    expect(out.workspaces!.find((w) => w.id === 'default')!.tabs).toEqual(out.tabs)
  })

  it('opens on the file’s workspace when this machine has no tabs yet', () => {
    const out = mergeRepoPart(defaultSettings(), { ...linuxExport(), activeWorkspaceId: 'w2' })
    expect(out.activeWorkspaceId).toBe('w2')
  })
})

describe('isProbeablePath', () => {
  it('refuses UNC and device paths on Windows without touching them', () => {
    for (const p of ['\\\\host\\share', '\\\\?\\C:\\x', '\\\\.\\pipe\\x', '//host/share', 'relative\\x', 'C:x'])
      expect(isProbeablePath(p, 'win32')).toBe(false)
    expect(isProbeablePath('C:\\Users\\dev', 'win32')).toBe(true)
    expect(isProbeablePath('d:/code', 'win32')).toBe(true)
  })

  it('takes single-slash absolute paths on POSIX only', () => {
    expect(isProbeablePath('/home/dev', 'linux')).toBe(true)
    for (const p of ['//host/share', 'rel/x', '', 'C:\\x', '/a\0b', 42]) expect(isProbeablePath(p, 'darwin')).toBe(false)
  })
})
