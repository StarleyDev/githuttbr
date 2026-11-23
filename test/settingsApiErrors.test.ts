import { describe, it, expect, vi } from 'vitest'

// The renderer side of a failed settings load or a refused save: what main
// answers becomes a typed error, so the boot screen calls a file "damaged"
// only when it really does not parse.

const answers: { get: unknown; set: unknown } = { get: undefined, set: undefined }
vi.stubGlobal('window', {
  api: {
    settings: {
      get: async () => answers.get,
      unlock: async () => answers.get,
      set: async () => answers.set
    }
  }
})

const { settingsApi, SettingsLoadError, SettingsSaveRefused } = await import('../src/renderer/src/infrastructure/api')
const { bootErrorKind } = await import('../src/renderer/src/components/BootError')

describe('settings errors across IPC', () => {
  it('a load error carries its kind; anything else is "other"', async () => {
    for (const kind of ['parse', 'io', 'other'] as const) {
      answers.get = { error: kind }
      const err = await settingsApi.get().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(SettingsLoadError)
      expect(bootErrorKind(err)).toBe(kind)
    }
    expect(bootErrorKind(new Error('Failed to fetch dynamically imported module'))).toBe('other')
  })

  it('a refused save rejects with the reason; an accepted one resolves', async () => {
    answers.set = { refused: 'keychain-required' }
    const err = await settingsApi.set({} as never, 1).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SettingsSaveRefused)
    expect((err as InstanceType<typeof SettingsSaveRefused>).reason).toBe('keychain-required')
    answers.set = undefined
    await expect(settingsApi.set({} as never, 1)).resolves.toBeUndefined()
  })
})
