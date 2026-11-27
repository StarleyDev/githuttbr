import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS_PAGE,
  SETTINGS_NAV_GROUPS,
  SETTINGS_PAGE_ORDER,
  countAccountProblems,
  resolveSettingsPage,
  settingsGroupOf
} from '../src/renderer/src/lib/settingsNav'
import { SETTINGS_PAGE_KEYS, type SettingsPageId } from '../src/renderer/src/lib/settingsSearch'

describe('settings menu groups', () => {
  it('has the four approved groups, in order', () => {
    expect(SETTINGS_NAV_GROUPS.map((g) => g.id)).toEqual(['you', 'appearance', 'behaviour', 'system'])
    expect(SETTINGS_NAV_GROUPS.map((g) => g.pages)).toEqual([
      ['profile', 'integrations', 'ai'],
      ['themes', 'graph', 'layout'],
      ['general', 'git', 'security', 'analyzers'],
      ['workspaces', 'shortcuts', 'environment', 'data', 'about']
    ])
  })

  it('lists every page exactly once', () => {
    const all = Object.keys(SETTINGS_PAGE_KEYS) as SettingsPageId[]
    expect([...SETTINGS_PAGE_ORDER].sort()).toEqual([...all].sort())
    expect(new Set(SETTINGS_PAGE_ORDER).size).toBe(SETTINGS_PAGE_ORDER.length)
  })

  it('knows the group of each page', () => {
    expect(settingsGroupOf('integrations')).toBe('you')
    expect(settingsGroupOf('graph')).toBe('appearance')
    expect(settingsGroupOf('analyzers')).toBe('behaviour')
    expect(settingsGroupOf('data')).toBe('system')
  })
})

describe('settings page ids', () => {
  // Everything that opened a page before the regrouping still has to land somewhere sensible.
  it.each([
    'profile',
    'layout',
    'workspaces',
    'integrations',
    'ai',
    'themes',
    'general',
    'security',
    'shortcuts',
    'data',
    'environment',
    'about'
  ])('keeps the old id %s on its own page', (id) => {
    expect(resolveSettingsPage(id)).toBe(id)
  })

  it('sends Themes with the Graph tab to the Graph page', () => {
    expect(resolveSettingsPage('themes', 'graph')).toBe('graph')
    expect(resolveSettingsPage('themes', 'theme')).toBe('themes')
  })

  it('opens the new pages by id and by alias', () => {
    expect(resolveSettingsPage('graph')).toBe('graph')
    expect(resolveSettingsPage('git')).toBe('git')
    expect(resolveSettingsPage('analyzers')).toBe('analyzers')
    expect(resolveSettingsPage('connected-accounts')).toBe('integrations')
    expect(resolveSettingsPage('accounts')).toBe('integrations')
    expect(resolveSettingsPage('git-sync')).toBe('git')
    expect(resolveSettingsPage('code-analyzers')).toBe('analyzers')
    expect(resolveSettingsPage('backup')).toBe('data')
  })

  it('leaves an unknown or empty id to the caller', () => {
    expect(resolveSettingsPage('nonsense')).toBeUndefined()
    expect(resolveSettingsPage(undefined)).toBeUndefined()
    expect(resolveSettingsPage(null)).toBeUndefined()
    expect(resolveSettingsPage('')).toBeUndefined()
    expect(SETTINGS_PAGE_ORDER).toContain(DEFAULT_SETTINGS_PAGE)
  })
})

describe('connected accounts warning count', () => {
  it('counts refused tokens and errors, not an unreachable host', () => {
    expect(countAccountProblems(undefined)).toBe(0)
    expect(countAccountProblems({})).toBe(0)
    expect(countAccountProblems({ github: 'refused', gitlab: 'unreachable', azure: 'error' })).toBe(2)
    expect(countAccountProblems({ forgejo: 'unreachable' })).toBe(0)
  })
})
