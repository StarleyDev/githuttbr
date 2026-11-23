import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { defaultSettings, type AppSettings } from '../src/shared/types'

// What the renderer's settings store sends to main, and when: the generation
// a save carries is what lets main tell a stale save from a clear.

const log: Array<{ op: string; settings?: AppSettings; generation?: number; options?: unknown }> = []
let generation = 0
let onDisk: AppSettings = defaultSettings()
vi.mock('../src/renderer/src/infrastructure/api', () => ({
  settingsApi: {
    set: vi.fn(async (settings: AppSettings, gen: number, options?: unknown) => {
      log.push({ op: 'set', settings, generation: gen, options })
      onDisk = settings
    }),
    get: vi.fn(async () => {
      log.push({ op: 'get' })
      return { settings: onDisk, generation: ++generation }
    }),
    unlock: vi.fn(async () => {
      log.push({ op: 'unlock' })
      return { settings: onDisk, generation: ++generation }
    })
  },
  reposApi: {},
  SettingsSaveRefused: class SettingsSaveRefused extends Error {
    constructor(readonly reason: string) {
      super(`settings save refused (${reason})`)
    }
  }
}))

import { useSettingsStore } from '../src/renderer/src/stores/settings'
import { useUIStore } from '../src/renderer/src/stores/ui'
import { SettingsSaveRefused } from '../src/renderer/src/infrastructure/api'

const saves = (): typeof log => log.filter((e) => e.op === 'set')

describe('the settings store', () => {
  beforeEach(async () => {
    log.length = 0
    onDisk = { ...defaultSettings(), onboardingCompleted: true }
    await useSettingsStore.getState().load()
    log.length = 0
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a debounced save sends the state when it fires, with the generation it was built from', async () => {
    const gen = useSettingsStore.getState().secretsGeneration
    useSettingsStore.getState().update((s) => ({ ...s, language: 'de' }))
    useSettingsStore.getState().update((s) => ({ ...s, confirmForcePush: false }))
    await vi.advanceTimersByTimeAsync(300)
    expect(saves()).toHaveLength(1)
    expect(saves()[0].settings).toMatchObject({ language: 'de', confirmForcePush: false })
    expect(saves()[0].generation).toBe(gen)
  })

  it('a pending save goes out before an unlock, never after it with the older state', async () => {
    const gen = useSettingsStore.getState().secretsGeneration
    useSettingsStore.getState().update((s) => ({ ...s, confirmForcePush: false }))
    await useSettingsStore.getState().load({ unlock: true })
    expect(log.map((e) => e.op)).toEqual(['set', 'unlock'])
    expect(saves()[0].generation).toBe(gen)
    // Nothing left to fire afterwards.
    await vi.advanceTimersByTimeAsync(300)
    expect(saves()).toHaveLength(1)
    // The state now carries the unlock's generation.
    expect(useSettingsStore.getState().secretsGeneration).toBe(generation)
    expect(useSettingsStore.getState().unlocked).toBe(true)
  })

  it('before a successful load, a change is neither applied nor saved', async () => {
    useSettingsStore.setState({ loaded: false })
    try {
      useSettingsStore.getState().update((s) => ({ ...s, language: 'de' }))
      await vi.advanceTimersByTimeAsync(300)
      expect(saves()).toHaveLength(0)
      expect(useSettingsStore.getState().settings.language).not.toBe('de')
    } finally {
      useSettingsStore.setState({ loaded: true })
    }
  })

  it('an unlock waits for a save already in flight', async () => {
    const api = (await import('../src/renderer/src/infrastructure/api')).settingsApi
    let release: () => void = () => undefined
    vi.mocked(api.set).mockImplementationOnce(async (settings: AppSettings, gen: number) => {
      log.push({ op: 'set', settings, generation: gen })
      await new Promise<void>((r) => (release = r))
      log.push({ op: 'set-done' })
    })
    useSettingsStore.getState().update((s) => ({ ...s, confirmForcePush: false }))
    await vi.advanceTimersByTimeAsync(300)
    const unlocking = useSettingsStore.getState().load({ unlock: true })
    await vi.advanceTimersByTimeAsync(50)
    expect(log.map((e) => e.op)).toEqual(['set'])
    release()
    await unlocking
    expect(log.map((e) => e.op)).toEqual(['set', 'set-done', 'unlock'])
  })

  it('an import merges credentials unless asked to replace, then reads back what main kept', async () => {
    await useSettingsStore.getState().importSettings({ language: 'fr' })
    expect(saves()[0].options).toEqual({ import: 'merge' })
    expect(log.map((e) => e.op)).toEqual(['set', 'get'])
    log.length = 0
    await useSettingsStore.getState().load({ unlock: true })
    log.length = 0
    await useSettingsStore.getState().importSettings({ language: 'it' }, { replaceSecrets: true })
    expect(saves()[0].options).toEqual({ import: 'replace' })
    // Settings was unlocked: the read-back is an unlock too.
    expect(log.map((e) => e.op)).toEqual(['set', 'unlock'])
  })

  it('a refused import keeps its reason, even when the read-back fails too', async () => {
    const api = (await import('../src/renderer/src/infrastructure/api')).settingsApi
    vi.mocked(api.set).mockRejectedValueOnce(new SettingsSaveRefused('keychain-required'))
    vi.mocked(api.get).mockRejectedValueOnce(new Error('reload failed'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await expect(useSettingsStore.getState().importSettings({ language: 'fr' }, { replaceSecrets: true }))
        .rejects.toMatchObject({ reason: 'keychain-required' })
    } finally {
      warn.mockRestore()
    }
  })

  it('tells the user, once, when main refuses saves because the file went bad', async () => {
    const api = (await import('../src/renderer/src/infrastructure/api')).settingsApi
    vi.mocked(api.set).mockRejectedValue(new SettingsSaveRefused('not-loaded'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    useUIStore.setState({ toasts: [] })
    try {
      useSettingsStore.getState().update((s) => ({ ...s, language: 'de' }))
      await vi.advanceTimersByTimeAsync(300)
      useSettingsStore.getState().update((s) => ({ ...s, language: 'fr' }))
      await vi.advanceTimersByTimeAsync(300)
      const errors = useUIStore.getState().toasts.filter((x) => x.kind === 'error')
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toMatch(/damaged/)
    } finally {
      vi.mocked(api.set).mockReset()
      vi.mocked(api.set).mockImplementation(async (settings: AppSettings, gen: number, options?: unknown) => {
        log.push({ op: 'set', settings, generation: gen, options })
        onDisk = settings
      })
      warn.mockRestore()
    }
  })
})
