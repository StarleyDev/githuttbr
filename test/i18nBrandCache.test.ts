import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/renderer/src/infrastructure/api', () => ({
  settingsApi: { set: vi.fn(async () => undefined) },
  reposApi: {}
}))

import { brandedCacheSize, interp, loadLocale, t, translate } from '../src/renderer/src/i18n'
import { useSettingsStore } from '../src/renderer/src/stores/settings'
import { de } from '../src/renderer/src/i18n/de'
import { brandText } from '../src/shared/brand'

// translate() memoizes brandText per (language, key). The cache must never
// answer with what was true before a dictionary loaded or a language changed.

describe('the branded-string cache', () => {
  it('returns exactly what brandText would, and remembers it', () => {
    const first = translate('en', 'migration.message')
    expect(first).toBe(brandText(first))
    expect(first).toContain('{old}')
    expect(brandedCacheSize()).toBeGreaterThan(0)
    expect(translate('en', 'migration.message')).toBe(first)
  })

  it('drops an English stand-in once the real dictionary arrives', async () => {
    // German not loaded yet: the answer is English, and it gets cached.
    const before = translate('de', 'attrs.driverRemove')
    expect(before).toBe('Remove')
    await loadLocale('de')
    expect(translate('de', 'attrs.driverRemove')).toBe(brandText(de['attrs.driverRemove']))
    expect(translate('de', 'attrs.driverRemove')).not.toBe('Remove')
  })

  it('empties on a language switch', () => {
    const settings = useSettingsStore.getState().settings
    useSettingsStore.setState({ settings: { ...settings, language: 'en' } })
    t('attrs.driverRemove')
    expect(brandedCacheSize()).toBeGreaterThan(0)
    useSettingsStore.setState({ settings: { ...settings, language: 'de' } })
    // The first read in the new language starts from an empty cache.
    expect(t('attrs.driverRemove')).toBe(brandText(de['attrs.driverRemove']))
    expect(brandedCacheSize()).toBe(1)
  })

  it('names a stale pre-rename command as it is on disk', () => {
    // The placeholder is filled after branding, so `gitcito` is not rewritten.
    const text = interp(translate('en', 'cmd.cliRemoveStale'), { name: 'gitcito' })
    expect(text).toBe("Remove the stale 'gitcito' command from PATH")
  })
})
