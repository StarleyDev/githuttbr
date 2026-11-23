import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import { saveOver, scrubServerUrls, secretView } from '../src/shared/secrets'
import { serverUrlWithoutSecrets } from '../src/shared/serverAddress'
import { parseSettingsImport } from '../src/renderer/src/lib/settingsImport'

// The settings handlers against a fake keyring: what reaches the files, and
// which renderer's blank counts as a clear.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-settings-privacy-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { decrypts: 0 }

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    // Only what this "build" wrote decrypts — anything else is another identity's.
    decryptString: (b: Buffer) => {
      keyring.decrypts++
      const s = b.toString()
      if (!s.startsWith('enc:')) throw new Error('not ours')
      return s.slice(4)
    }
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const FILES = ['gitcito-settings.json', 'gitcito-secrets.enc', 'gitcito-secrets.enc.bak', 'gitcito-log.json']
const settingsFile = (): string => join(dir, 'gitcito-settings.json')
const storeFile = (): string => join(dir, 'gitcito-secrets.enc')
const store = (): string => Buffer.from(readFileSync(storeFile(), 'utf8'), 'base64').toString()

const callFrom = (sender: number, channel: string, ...args: unknown[]): Promise<unknown> =>
  Promise.resolve(handlers.get(channel)!({ sender: { id: sender } }, ...args))
const call = (channel: string, ...args: unknown[]): Promise<unknown> => callFrom(1, channel, ...args)

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultSettings().profiles[0], id: 'p', ...over })
const settingsWith = (profile: Profile): AppSettings => ({ ...defaultSettings(), onboardingCompleted: true, profiles: [profile] })
const tokens = (gh: string, az: string): AppSettings => settingsWith(profileWith({ githubToken: gh, azureToken: az }))

/** A fresh main process: nothing decrypted, no renderer holding anything. */
async function restart(consent: 'granted' | 'declined' = 'granted', wipe = true): Promise<typeof import('../src/main/settings')> {
  if (wipe) for (const f of FILES) rmSync(join(dir, f), { force: true })
  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent, explained: true }))
  vi.resetModules()
  handlers.clear()
  const mod = await import('../src/main/settings')
  mod.registerSettingsHandlers()
  return mod
}

describe('a token typed, saved and cleared in one session (keychain granted)', () => {
  beforeEach(() => restart())

  it('is gone after the clear — from the store, and from what git and the API are given', async () => {
    const { activeProfileAuth } = await import('../src/main/settings')
    await call('settings:get')
    await call('settings:set', tokens('ghp_typed_then_cleared', ''))
    expect(store()).toContain('ghp_typed_then_cleared')
    await call('settings:set', tokens('', ''))
    expect(store()).not.toContain('ghp_typed_then_cleared')
    expect((await activeProfileAuth('github')).token).toBeUndefined()
  })
})

describe('two windows saving the same store', () => {
  for (const consent of ['granted', 'declined'] as const) {
    describe(`keychain ${consent}`, () => {
      beforeEach(() => restart(consent))
      const tokensNow = async (): Promise<[string, string]> => {
        const p = ((await callFrom(9, 'settings:unlock')) as AppSettings).profiles[0]
        return [p.githubToken, p.azureToken]
      }

      it('a window keeps its say over what it holds after another one saved', async () => {
        await call('settings:set', tokens('gh-1', 'az-1'))
        // Window 2 never read the settings: its save can only add.
        await callFrom(2, 'settings:set', settingsWith(profileWith({ bitbucketToken: 'bb-2' })))
        // Window 1 clears GitHub's token: it held it, with the value stored now.
        await call('settings:set', tokens('', 'az-1'))
        expect(await tokensNow()).toEqual(['', 'az-1'])
      })

      it('but its blank never erases a token it was not given, or one replaced since', async () => {
        await call('settings:set', tokens('gh-1', 'az-1'))
        await callFrom(2, 'settings:set', settingsWith(profileWith({ githubToken: 'gh-2', bitbucketToken: 'bb-2' })))
        await call('settings:set', tokens('', ''))
        const p = ((await callFrom(9, 'settings:unlock')) as AppSettings).profiles[0]
        expect([p.githubToken, p.azureToken, p.bitbucketToken]).toEqual(['gh-2', '', 'bb-2'])
      })
    })
  }

  it('saveOver: a blank clears only a slot held with the current value', () => {
    const current = { p: { githubToken: 'a', azureToken: 'b', githubEnterpriseTokens: { 'https://h': 'c' } } }
    expect(saveOver(current, {}, secretView(current))).toEqual({})
    expect(saveOver(current, {}, new Map())).toEqual(current)
    expect(saveOver(current, {}, secretView({ p: { githubToken: 'old', azureToken: 'b' } }))).toEqual({
      p: { githubToken: 'a', githubEnterpriseTokens: { 'https://h': 'c' } }
    })
  })
})

describe('the decrypted store and a plain settings read', () => {
  beforeEach(() => restart())

  it('settings:get never carries it, even once something else unlocked it; settings:unlock does', async () => {
    await call('settings:set', tokens('ghp_stored', ''))
    const { activeProfileAuth } = await restart('granted', false)
    // A push resolving its token decrypts the store in main…
    expect((await activeProfileAuth('github')).token).toBe('ghp_stored')
    // …which a renderer reading the settings must not be handed for free.
    expect(((await call('settings:get')) as AppSettings).profiles[0].githubToken).toBe('')
    expect(((await call('settings:unlock')) as AppSettings).profiles[0].githubToken).toBe('ghp_stored')
  })
})

describe('isHeldSecret', () => {
  it('knows the stored tokens once decrypted — and never decrypts to find out', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_held', githubEnterprise: [{ url: 'https://ghe.x', token: 'ghes_held' }] })))
    const locked = await restart('granted', false)
    keyring.decrypts = 0
    expect(await locked.isHeldSecret('ghp_held')).toBe(false)
    expect(keyring.decrypts).toBe(0)
    await locked.activeProfileAuth('github')
    expect(await locked.isHeldSecret(' ghp_held ')).toBe(true)
    expect(await locked.isHeldSecret('ghes_held')).toBe(true)
    expect(await locked.isHeldSecret('typed-new')).toBe(false)
    expect(await locked.isHeldSecret('')).toBe(false)
  })

  it('knows a session-only token while the store is locked', async () => {
    const mod = await restart('declined')
    await call('settings:set', tokens('', 'az-session'))
    expect(await mod.isHeldSecret('az-session')).toBe(true)
  })
})

describe('server addresses with a credential in them', () => {
  const DIRTY = {
    githubEnterprise: [{ url: 'https://jane:hunter2@ghe.acme.com', token: '' }],
    gitlabServers: [{ url: 'https://oauth2:glpat-secretsecret@gl.acme.com/', token: '' }],
    bitbucketServers: [{ url: 'https://jane:pa/ss@bbs.acme.com/ctx?access_token=qq', token: '' }],
    forgejoUrl: 'https://jane:tok@forgejo.acme.com#frag'
  }
  const leaks = /hunter2|glpat-secret|pa\/ss|access_token|tok@|frag/

  it('lose it: the helper', () => {
    expect(serverUrlWithoutSecrets('https://u:p@h.example')).toBe('https://h.example')
    expect(serverUrlWithoutSecrets('https://u:pa/ss@h.example/ctx')).toBe('https://h.example/ctx')
    expect(serverUrlWithoutSecrets('h.example/?token=x#y')).toBe('h.example/')
    const clean = 'https://h.example'
    expect(serverUrlWithoutSecrets(clean)).toBe(clean)
    const plain = { profiles: [profileWith({ githubEnterprise: [{ url: clean, token: 't' }] })] }
    expect(scrubServerUrls(plain)).toBe(plain)
  })

  it('lose it on read, and on disk', async () => {
    await restart()
    writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith(DIRTY))))
    const p = ((await call('settings:get')) as AppSettings).profiles[0]
    expect(JSON.stringify(p)).not.toMatch(leaks)
    expect(p.githubEnterprise?.[0]?.url).toBe('https://ghe.acme.com')
    expect(p.bitbucketServers?.[0]?.url).toBe('https://bbs.acme.com/ctx')
    expect(readFileSync(settingsFile(), 'utf8')).not.toMatch(leaks)
  })

  it('lose it on write', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith(DIRTY)))
    expect(readFileSync(settingsFile(), 'utf8')).not.toMatch(leaks)
  })

  it('lose it on import', () => {
    const parsed = parseSettingsImport({ __gitcito: 'settings-export', version: 1, settings: settingsWith(profileWith(DIRTY)) })
    expect(JSON.stringify(parsed)).not.toMatch(leaks)
  })
})

describe.skipIf(process.platform === 'win32')('files in the user-data folder', () => {
  const mode = (f: string): number => statSync(f).mode & 0o777

  it('are owner-only — new, and an older one written world-readable', async () => {
    await restart()
    writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith({}))))
    chmodSync(settingsFile(), 0o644)
    await call('settings:set', tokens('ghp_mode', ''))
    expect(mode(settingsFile())).toBe(0o600)
    expect(mode(storeFile())).toBe(0o600)
  })

  it('the backup of our own store goes after a successful write', async () => {
    await restart()
    writeFileSync(`${storeFile()}.bak`, Buffer.from('enc:{"p":{"githubToken":"revoked"}}').toString('base64'))
    await call('settings:set', tokens('ghp_new', ''))
    expect(existsSync(`${storeFile()}.bak`)).toBe(false)
  })

  it('a backup only another build can read is kept, owner-only, until it is old', async () => {
    await restart()
    // Another build's store: this one cannot decrypt it, so it is backed up first.
    writeFileSync(storeFile(), Buffer.from('other-build').toString('base64'))
    await call('settings:set', tokens('ghp_new', ''))
    const bak = `${storeFile()}.bak`
    expect(existsSync(bak)).toBe(true)
    expect(mode(bak)).toBe(0o600)
    const old = (Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000
    utimesSync(bak, old, old)
    await call('settings:set', tokens('ghp_newer', ''))
    expect(existsSync(bak)).toBe(false)
  })
})
