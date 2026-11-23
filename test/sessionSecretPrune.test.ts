import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'

// With the keychain declined, a typed token lives only in memory for the
// session. A save that removed its server pruned the encrypted store but not
// that memory copy, so adding the same URL back brought the token back with it.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-session-prune-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString().replace(/^enc:/, '')
  }
}))

const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))

const GHES = 'https://ghe.corp.example'
const GITLAB = 'https://gitlab.corp.example'

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultSettings().profiles[0], id: 'p', ...over })
const settingsWith = (profile: Profile): AppSettings => ({ ...defaultSettings(), onboardingCompleted: true, profiles: [profile] })

describe('session-only tokens follow the server list (keychain declined)', () => {
  beforeEach(async () => {
    for (const f of ['gitcito-settings.json', 'gitcito-secrets.enc']) rmSync(join(dir, f), { force: true })
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    vi.resetModules()
    handlers.clear()
    const { registerSettingsHandlers } = await import('../src/main/settings')
    registerSettingsHandlers()
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  for (const served of [false, true]) {
    it(`a removed server’s token does not come back with its URL${served ? ' (renderer served the secrets)' : ''}`, async () => {
      await call(
        'settings:set',
        settingsWith(
          profileWith({
            githubEnterprise: [{ url: GHES, token: 'ghes-session' }],
            gitlabServers: [{ url: GITLAB, token: 'gl-session' }]
          })
        )
      )
      if (served) {
        // A renderer that was served the session tokens: the removal must count all the same.
        const first = (await call('settings:get')) as AppSettings
        expect(first.profiles[0].githubEnterprise?.[0]?.token).toBe('ghes-session')
      }
      // Remove the GHES server; the GitLab server stays, its token not sent back.
      await call('settings:set', settingsWith(profileWith({ gitlabServers: [{ url: GITLAB, token: '' }] })))
      // Add the same URL again, with no token.
      await call(
        'settings:set',
        settingsWith(
          profileWith({ githubEnterprise: [{ url: GHES, token: '' }], gitlabServers: [{ url: GITLAB, token: '' }] })
        )
      )
      const after = ((await call('settings:get')) as AppSettings).profiles[0]
      expect(after.githubEnterprise?.map((s) => s.token)).toEqual([''])
      expect(after.gitlabServers?.map((s) => s.token)).toEqual(['gl-session'])
    })
  }
})
