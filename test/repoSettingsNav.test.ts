import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../src/renderer/src/i18n/en'
import {
  REPO_SETTINGS_NAV,
  REPO_SETTINGS_PAGES,
  findRepoSettingsNavItem,
  getHostKind,
  getMainRemote,
  getRemoteHostname,
  getRepoInitials,
  getRepoSettingsPills,
  resolveRepoSettingsPage,
  type RepoSettingsPage
} from '../src/renderer/src/lib/repoSettingsNav'

const ROOT = join(__dirname, '..')

describe('repository settings nav', () => {
  it('groups the pages as Repository, Security, Activity', () => {
    expect(REPO_SETTINGS_NAV.map((g) => [g.id, g.items.map((i) => i.id)])).toEqual([
      ['repository', ['general', 'config', 'info']],
      ['security', ['vault']],
      ['activity', ['analytics', 'insights', 'history', 'logs']]
    ])
  })

  it('lists every page once', () => {
    expect(new Set(REPO_SETTINGS_PAGES).size).toBe(REPO_SETTINGS_PAGES.length)
    expect(REPO_SETTINGS_PAGES).toHaveLength(8)
  })

  it('has a translated label and description for every group and page', () => {
    for (const g of REPO_SETTINGS_NAV) {
      expect(en[g.labelKey]).toBeTruthy()
      for (const i of g.items) {
        expect(en[i.labelKey]).toBeTruthy()
        expect(en[i.descriptionKey]).toBeTruthy()
      }
    }
  })

  it('finds the nav item of a page', () => {
    expect(findRepoSettingsNavItem('vault').labelKey).toBe('repoSettings.vault')
    expect(findRepoSettingsNavItem('config').labelKey).toBe('repoSettings.projectConfig')
  })
})

describe('resolveRepoSettingsPage', () => {
  it('keeps every page id callers already pass', () => {
    for (const id of REPO_SETTINGS_PAGES) expect(resolveRepoSettingsPage(id)).toBe(id)
  })

  it('maps the names pages are labelled with to their ids', () => {
    expect(resolveRepoSettingsPage('metrics')).toBe('analytics')
    expect(resolveRepoSettingsPage('project-config')).toBe('config')
    expect(resolveRepoSettingsPage('information')).toBe('info')
    expect(resolveRepoSettingsPage('operation-history')).toBe('history')
    expect(resolveRepoSettingsPage('Insights')).toBe('insights')
  })

  it('opens General for a missing or unknown id', () => {
    expect(resolveRepoSettingsPage(undefined)).toBe('general')
    expect(resolveRepoSettingsPage('')).toBe('general')
    expect(resolveRepoSettingsPage('nonsense')).toBe('general')
  })

  // A deep link with an id the modal does not know silently opens General —
  // exactly the regression this guards: every caller's tab must be a real page.
  it('knows every tab a caller in the renderer opens', () => {
    const files = [
      'src/renderer/src/App.tsx',
      'src/renderer/src/components/AIStatusChip.tsx',
      'src/renderer/src/components/CommandPalette.tsx',
      'src/renderer/src/components/CommitComposer.tsx',
      'src/renderer/src/components/Toolbar.tsx',
      'src/renderer/src/stores/repo.ts'
    ]
    const tabs = new Set<string>()
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8')
      for (const m of src.matchAll(/kind: 'repo-settings'[^}]*?tab: '([a-z-]+)'/g)) tabs.add(m[1])
    }
    expect(tabs.size).toBeGreaterThan(0)
    for (const tab of tabs) expect(REPO_SETTINGS_PAGES).toContain(tab as RepoSettingsPage)
  })

  it('accepts exactly the page ids the modal spec declares', () => {
    const ui = readFileSync(join(ROOT, 'src/renderer/src/stores/ui.ts'), 'utf8')
    const line = ui.split('\n').find((l) => l.includes("kind: 'repo-settings'")) ?? ''
    const declared = [...line.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).filter((id) => id !== 'repo')
    expect(declared.filter((id) => id !== 'repo-settings').sort()).toEqual([...REPO_SETTINGS_PAGES].sort())
  })
})

describe('repository settings header', () => {
  it('takes initials from the first two words, or the first two letters', () => {
    expect(getRepoInitials('sample-api')).toBe('SA')
    expect(getRepoInitials('playground')).toBe('PL')
    expect(getRepoInitials('my app_docs')).toBe('MA')
    expect(getRepoInitials('  ')).toBe('?')
    expect(getRepoInitials('.dotfiles')).toBe('DO')
    expect(getRepoInitials('ÉCOLE')).toBe('ÉC')
  })

  it('reads the hostname of https, ssh and scp-like remotes', () => {
    expect(getRemoteHostname('https://github.com/acme/app.git')).toBe('github.com')
    expect(getRemoteHostname('https://user@Dev.Azure.com/org/p/_git/r')).toBe('dev.azure.com')
    expect(getRemoteHostname('ssh://git@git.example.test:2222/team/app.git')).toBe('git.example.test')
    expect(getRemoteHostname('git@gitlab.com:team/app.git')).toBe('gitlab.com')
    expect(getRemoteHostname('ssh://git@[::1]:22/app.git')).toBe('[::1]')
  })

  it('has no hostname for local paths', () => {
    expect(getRemoteHostname('/srv/git/app.git')).toBeNull()
    expect(getRemoteHostname('../upstream')).toBeNull()
    expect(getRemoteHostname('C:\\repos\\app')).toBeNull()
    expect(getRemoteHostname('file:///srv/git/app.git')).toBeNull()
    expect(getRemoteHostname('')).toBeNull()
  })

  it('names the hosting product when the hostname says so', () => {
    expect(getHostKind('github.com')).toBe('github')
    expect(getHostKind('gitlab.com')).toBe('gitlab')
    expect(getHostKind('bitbucket.org')).toBe('bitbucket')
    expect(getHostKind('dev.azure.com')).toBe('azure')
    expect(getHostKind('org.visualstudio.com')).toBe('azure')
    expect(getHostKind('git.example.test')).toBeNull()
    expect(getHostKind(null)).toBeNull()
  })

  it('prefers origin, falls back to the first remote, and trusts a resolved provider', () => {
    const remotes = [
      { name: 'upstream', url: 'git@github.com:acme/app.git' },
      { name: 'origin', url: 'https://git.example.test/me/app.git' }
    ]
    expect(getMainRemote(remotes)).toEqual({ name: 'origin', hostname: 'git.example.test', kind: null })
    expect(getMainRemote(remotes, 'forgejo')?.kind).toBe('forgejo')
    expect(getMainRemote([remotes[0]])).toEqual({ name: 'upstream', hostname: 'github.com', kind: 'github' })
    expect(getMainRemote([])).toBeNull()
  })

  it('shows only the counts that are known', () => {
    expect(getRepoSettingsPills({ branchCount: 4, vaultCount: null }).map((p) => [p.id, p.count])).toEqual([['branches', 4]])
    expect(getRepoSettingsPills({ branchCount: 4, vaultCount: 0 }).map((p) => p.id)).toEqual(['branches', 'vault'])
    expect(getRepoSettingsPills({ branchCount: null, vaultCount: null })).toEqual([])
    for (const p of getRepoSettingsPills({ branchCount: 1, vaultCount: 1 })) expect(en[p.titleKey]).toContain('{n}')
  })
})
