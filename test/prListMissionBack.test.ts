import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../src/renderer/src/infrastructure/api', () => ({
  settingsApi: { set: vi.fn(async () => undefined) },
  reposApi: {},
  hostingApi: {}
}))

import { useSettingsStore } from '../src/renderer/src/stores/settings'
import { openPrFromList } from '../src/renderer/src/stores/prList'

// The pull requests list opened from Mission Control offers the way back there;
// going into one of its PRs and back with "← Pull requests" must not lose it.
describe('a PR opened from a list that came from Mission Control', () => {
  beforeAll(() => useSettingsStore.setState({ loaded: true }))

  it('carries where the list came from, and keeps it on the PR pages it walks to', () => {
    useSettingsStore.getState().update((s) => ({ ...s, workspaces: [], tabs: [], activeTabId: null }))
    const entry = { number: 7, title: 'Add search', remoteUrl: 'https://example.com/team/app.git' }
    const nav = { entries: [entry], filters: {} as never, tab: 'open' as never }
    openPrFromList('/repos/app', entry, nav, 'mission')
    const pages = useSettingsStore.getState().settings.tabs.flatMap((t) => (t.kind === 'page' ? [t.page] : []))
    expect(pages.find((p) => p.type === 'pr')).toMatchObject({ number: 7, via: 'list', listFrom: 'mission' })

    // Opened from the plain list: no flag to hand back.
    openPrFromList('/repos/app', { ...entry, number: 8 }, nav)
    const after = useSettingsStore.getState().settings.tabs.flatMap((t) => (t.kind === 'page' ? [t.page] : []))
    const pr8 = after.find((p) => p.type === 'pr' && p.number === 8)
    expect(pr8 && 'listFrom' in pr8).toBe(false)
  })
})
