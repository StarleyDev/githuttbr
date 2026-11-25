import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import { extractSecrets, mergeSecretStores, pruneSecrets } from '../src/shared/secrets'
import { bootLoaded, settingsIpc } from './settingsIpc'

// A server removed from a profile must take its token with it. The merge path —
// a save from a renderer that was never sent the secrets — keeps whatever the
// save does not mention, so the removed server's token stayed in the encrypted
// store and came back, maybe revoked, the moment the same URL was added again.

const MAPS = [
  {
    field: 'githubEnterpriseTokens',
    list: 'githubEnterprise',
    a: 'https://ghe.a.example',
    b: 'https://ghe.b.example',
    // Written differently, filed under the same base.
    bAlias: 'GHE.B.EXAMPLE/'
  },
  {
    field: 'gitlabServerTokens',
    list: 'gitlabServers',
    a: 'https://gitlab.a.example',
    b: 'https://gitlab.b.example',
    bAlias: 'https://GITLAB.b.example/'
  },
  {
    field: 'bitbucketServerTokens',
    list: 'bitbucketServers',
    a: 'https://bbs.a.example/bitbucket',
    b: 'https://bbs.b.example',
    bAlias: 'https://BBS.b.example/'
  }
] as const

const profileWith = (servers: Partial<Record<(typeof MAPS)[number]['list'], { url: string; token: string }[]>>): Profile => ({
  ...defaultSettings().profiles[0],
  id: 'p',
  ...servers
})

const settingsWith = (profile: Profile): AppSettings => ({ ...defaultSettings(), onboardingCompleted: true, profiles: [profile] })

describe('pruneSecrets — server tokens follow the profile’s server list', () => {
  for (const m of MAPS) {
    describe(m.field, () => {
      const stored = extractSecrets(
        settingsWith(profileWith({ [m.list]: [{ url: m.a, token: 'tok-a' }, { url: m.b, token: 'tok-b' }] }))
      )

      it('stores both servers to begin with', () => {
        expect(Object.values(stored.p[m.field] ?? {})).toEqual(['tok-a', 'tok-b'])
      })

      it('a merge-path save that removed a server drops its token, keeps the other', () => {
        // The renderer was never sent secrets: B is still listed, its token blank.
        const next = settingsWith(profileWith({ [m.list]: [{ url: m.b, token: '' }] }))
        const merged = pruneSecrets(mergeSecretStores(stored, extractSecrets(next)), ['p'], next.profiles)
        const tokens = merged.p?.[m.field] ?? {}
        expect(Object.values(tokens)).toEqual(['tok-b'])
        expect(JSON.stringify(merged)).not.toContain('tok-a')
      })

      it('a server still listed keeps its token, however its URL is written', () => {
        const next = settingsWith(
          profileWith({ [m.list]: [{ url: m.a, token: '' }, { url: m.bAlias, token: '' }] })
        )
        const merged = pruneSecrets(mergeSecretStores(stored, extractSecrets(next)), ['p'], next.profiles)
        expect(Object.values(merged.p[m.field] ?? {})).toEqual(['tok-a', 'tok-b'])
      })

      it('removing every server drops the map, not the rest of the profile', () => {
        const withOther = { p: { ...stored.p, githubToken: 'ghp' } }
        const next = settingsWith(profileWith({}))
        const merged = pruneSecrets(mergeSecretStores(withOther, {}), ['p'], next.profiles)
        expect(merged.p[m.field]).toBeUndefined()
        expect(merged.p.githubToken).toBe('ghp')
      })

      it('without the profiles, only whole profiles are pruned, as before', () => {
        expect(pruneSecrets(stored, ['p'])).toEqual(stored)
      })
    })
  }
})

// The same, through the real settings handlers and a fake keyring.
const dir = mkdtempSync(join(tmpdir(), 'githuttbr-server-prune-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (s: string) => Buffer.from(`enc:${s}`),
    decryptStringAsync: async (b: Buffer) => ({ result: b.toString().replace(/^enc:/, ''), shouldReEncrypt: false })
  }
}))

const ipc = settingsIpc(handlers)
const call = (channel: string, ...args: unknown[]): Promise<unknown> => ipc({}, channel, ...args)
const storeFile = (): string =>
  Buffer.from(readFileSync(join(dir, 'githuttbr-secrets.enc'), 'utf8'), 'base64').toString().replace(/^enc:/, '')

/** A fresh main process: nothing decrypted yet, no renderer served secrets. */
const restart = async (): Promise<void> => {
  vi.resetModules()
  handlers.clear()
  const { registerSettingsHandlers } = await import('../src/main/settings')
  registerSettingsHandlers()
  await bootLoaded(handlers)
}

const allServers = (a: string, b: string): Profile =>
  profileWith(
    Object.fromEntries(
      MAPS.map((m) => [m.list, [{ url: m.a, token: `${a}-${m.field}` }, { url: m.b, token: `${b}-${m.field}` }]])
    )
  )

describe('a save from a renderer never sent the secrets', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
    await restart()
    await call('settings:set', settingsWith(allServers('old-a', 'kept-b')))
    for (const m of MAPS) {
      expect(storeFile()).toContain(`old-a-${m.field}`)
      expect(storeFile()).toContain(`kept-b-${m.field}`)
    }
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('removing server A drops its token from the store; B’s survives the merge', async () => {
    await restart()
    // Never served: server tokens blank, one unrelated token typed — the merge path.
    const removed = profileWith(Object.fromEntries(MAPS.map((m) => [m.list, [{ url: m.b, token: '' }]])))
    await call('settings:set', settingsWith({ ...removed, githubToken: 'ghp-typed' }))
    const store = storeFile()
    for (const m of MAPS) {
      expect(store, m.field).not.toContain(`old-a-${m.field}`)
      expect(store, m.field).toContain(`kept-b-${m.field}`)
    }
    expect(store).toContain('ghp-typed')
  })

  it('adding A’s URL back does not bring the old token with it', async () => {
    await restart()
    const readded = profileWith(
      Object.fromEntries(MAPS.map((m) => [m.list, [{ url: m.a, token: '' }, { url: m.b, token: '' }]]))
    )
    await call('settings:set', settingsWith({ ...readded, githubToken: 'ghp-typed' }))
    // `settings:unlock`: a plain `settings:get` never carries the decrypted store.
    const settings = (await call('settings:unlock')) as AppSettings
    const p = settings.profiles[0]
    for (const m of MAPS) {
      const servers = (p[m.list] ?? []) as { url: string; token: string }[]
      expect(servers.map((h) => h.token), m.field).toEqual(['', `kept-b-${m.field}`])
    }
  })
})
