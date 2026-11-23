import { describe, it, expect, vi, afterAll } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import { saveOver, type SecretStore } from '../src/shared/secrets'
import { bootLoaded, settingsIpc } from './settingsIpc'

// The ways a user's saved tokens and AI keys used to be wiped without anyone
// asking: a keychain prompt dismissed once, a tokenless import, a debounced
// save landing after an unlock, a half-written file, a newer build's fields,
// a clear made while the keychain was off. Real handlers, a fake keyring.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-settings-integrity-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { failNext: 0, available: true }

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => keyring.available,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => {
      // The user dismisses (or the OS denies) the keychain prompt.
      if (keyring.failNext > 0) {
        keyring.failNext--
        throw new Error('denied')
      }
      const s = b.toString()
      if (!s.startsWith('enc:')) throw new Error('not ours')
      return s.slice(4)
    }
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const settingsFile = (): string => join(dir, 'githuttbr-settings.json')
const storeFile = (): string => join(dir, 'githuttbr-secrets.enc')
const store = (): string => (existsSync(storeFile()) ? Buffer.from(readFileSync(storeFile(), 'utf8'), 'base64').toString() : '')
const storeJson = (): SecretStore => JSON.parse(store().replace(/^enc:/, '')) as SecretStore
const writeStore = (s: SecretStore): void => writeFileSync(storeFile(), Buffer.from(`enc:${JSON.stringify(s)}`).toString('base64'))
const backups = (): string[] => readdirSync(dir).filter((f) => f.startsWith('githuttbr-secrets.enc.bak'))

const ipc = settingsIpc(handlers)
const callFrom = (sender: number, channel: string, ...args: unknown[]): Promise<unknown> =>
  ipc({ sender: { id: sender } }, channel, ...args)
const call = (channel: string, ...args: unknown[]): Promise<unknown> => callFrom(1, channel, ...args)
/** The raw reply, generation included — what the renderer store keeps. */
const reply = (channel: string): Promise<{ settings: AppSettings; generation: number }> =>
  Promise.resolve(handlers.get(channel)!({ sender: { id: 1 } })) as Promise<{ settings: AppSettings; generation: number }>
const save = (settings: AppSettings, generation: number, options?: unknown): Promise<unknown> =>
  Promise.resolve(handlers.get('settings:set')!({ sender: { id: 1 } }, settings, generation, options))

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultSettings().profiles[0], id: 'p', ...over })
const settingsWith = (profile: Profile): AppSettings => ({ ...defaultSettings(), onboardingCompleted: true, profiles: [profile] })

/** A fresh main process: nothing decrypted, no renderer holding anything. */
async function restart(consent: 'granted' | 'declined' = 'granted', wipe = true): Promise<typeof import('../src/main/settings')> {
  if (wipe) for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true, recursive: true })
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent, explained: true }))
  keyring.failNext = 0
  keyring.available = true
  vi.resetModules()
  handlers.clear()
  const mod = await import('../src/main/settings')
  mod.registerSettingsHandlers()
  await bootLoaded(handlers)
  return mod
}

/** A store holding a GitHub and an Azure token, and an AI key — then a restart, so it is locked. */
async function storedTokens(): Promise<typeof import('../src/main/settings')> {
  await restart()
  writeStore({ p: { githubToken: 'ghp_old', azureToken: 'az_old', aiKeys: { acc: 'sk-old' } } })
  writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith({}))))
  return restart('granted', false)
}

describe('a store this session could not read (one dismissed keychain prompt)', () => {
  it('a token saved afterwards does not replace it, and no backup is deleted', async () => {
    await storedTokens()
    keyring.failNext = 1
    await call('settings:set', settingsWith(profileWith({ bitbucketToken: 'bb_new' })))
    expect(storeJson()).toEqual({ p: { githubToken: 'ghp_old', azureToken: 'az_old', aiKeys: { acc: 'sk-old' } } })
    expect(backups()).toEqual([])
    expect(await call('settings:secretsState')).toEqual({ unreadable: true })
  })

  it('a background read that failed first does not make the next save authoritative', async () => {
    const mod = await storedTokens()
    keyring.failNext = 1
    // A fetch resolving its token: the decrypt is refused.
    expect((await mod.activeProfileAuth('github')).token).toBeUndefined()
    await call('settings:set', settingsWith(profileWith({ bitbucketToken: 'bb_new' })))
    expect(storeJson().p.githubToken).toBe('ghp_old')
    expect(storeJson().p.azureToken).toBe('az_old')
    // The typed token works for the session meanwhile.
    expect((await mod.activeProfileAuth('bitbucket')).token).toBe('bb_new')
  })

  it('opening Settings reads it again, and then the typed token joins the stored ones', async () => {
    const mod = await storedTokens()
    keyring.failNext = 1
    await call('settings:set', settingsWith(profileWith({ bitbucketToken: 'bb_new' })))
    const s = (await call('settings:unlock')) as AppSettings
    expect(s.profiles[0].githubToken).toBe('ghp_old')
    expect(s.profiles[0].bitbucketToken).toBe('bb_new')
    expect(storeJson().p).toMatchObject({ githubToken: 'ghp_old', azureToken: 'az_old', bitbucketToken: 'bb_new' })
    expect(mod.hasSessionOnlySecrets()).toBe(false)
    expect(await call('settings:secretsState')).toEqual({ unreadable: false })
  })

  it('"Replace all" is refused over it, and nothing is written — its tokens would come back once readable', async () => {
    await storedTokens()
    keyring.failNext = 1
    // The failed read marks the store unreadable.
    await call('settings:set', settingsWith(profileWith({ bitbucketToken: 'bb_new' })))
    const settingsBefore = readFileSync(settingsFile(), 'utf8')
    const storeBefore = readFileSync(storeFile(), 'utf8')
    const imported = settingsWith(profileWith({ name: 'Imported', githubToken: 'ghp_file' }))
    expect(await call('settings:set', imported, 0, { import: 'replace' })).toEqual({ refused: 'store-unreadable' })
    expect(readFileSync(settingsFile(), 'utf8')).toBe(settingsBefore)
    expect(readFileSync(storeFile(), 'utf8')).toBe(storeBefore)
  })

  it('a damaged store (not even base64 of a store) is unreadable, never empty', async () => {
    await restart()
    writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith({}))))
    writeFileSync(storeFile(), 'enc:{"p":{"githubT')
    const before = readFileSync(storeFile(), 'utf8')
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_new' })))
    expect(readFileSync(storeFile(), 'utf8')).toBe(before)
  })
})

describe('importing settings', () => {
  it('a file without tokens (the default export) clears nothing, even with Settings unlocked', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_stored', azureToken: 'az_stored' })))
    const s = (await call('settings:unlock')) as AppSettings
    const imported = { ...s, profiles: s.profiles.map((p) => ({ ...p, githubToken: '', azureToken: '' })) }
    await call('settings:set', imported, undefined, { import: 'merge' })
    expect(storeJson().p).toMatchObject({ githubToken: 'ghp_stored', azureToken: 'az_stored' })
  })

  it('"replace" without any credential in the file is still a merge', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_stored' })))
    const { settings, generation } = await reply('settings:unlock')
    await save({ ...settings, profiles: [{ ...settings.profiles[0], githubToken: '' }] }, generation, { import: 'replace' })
    expect(storeJson().p.githubToken).toBe('ghp_stored')
  })

  it('a file with credentials merges them by default — added, nothing cleared', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_stored', azureToken: 'az_stored' })))
    const { generation } = await reply('settings:unlock')
    await save(settingsWith(profileWith({ githubToken: 'ghp_file' })), generation, { import: 'merge' })
    expect(storeJson().p).toMatchObject({ githubToken: 'ghp_file', azureToken: 'az_stored' })
  })

  it('a file with credentials replaces them all when the user chose that', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_stored', azureToken: 'az_stored' })))
    // Even a renderer that never unlocked: the confirm is what authorizes it.
    const { generation } = await reply('settings:get')
    await save(settingsWith(profileWith({ githubToken: 'ghp_file' })), generation, { import: 'replace' })
    expect(storeJson()).toEqual({ p: { githubToken: 'ghp_file' } })
  })
})

describe('a debounced save racing an unlock', () => {
  it('a save of the state from before the unlock clears nothing', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_stored', azureToken: 'az_stored' })))
    await restart('granted', false)
    const before = await reply('settings:get') // app start: no tokens
    await reply('settings:unlock') // Settings opens; main records the full holdings
    // The renderer has not applied the unlock yet; its pending save fires.
    await save(before.settings, before.generation)
    expect(storeJson().p).toMatchObject({ githubToken: 'ghp_stored', azureToken: 'az_stored' })
  })

  it('a save built from the unlock still clears what the user cleared', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_stored', azureToken: 'az_stored' })))
    await restart('granted', false)
    const unlocked = await reply('settings:unlock')
    const p = unlocked.settings.profiles[0]
    await save({ ...unlocked.settings, profiles: [{ ...p, githubToken: '' }] }, unlocked.generation)
    expect(storeJson()).toEqual({ p: { azureToken: 'az_stored' } })
  })

  it('a generation off the wire that is not a number names none', async () => {
    await restart()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_stored' })))
    const unlocked = await reply('settings:unlock')
    await save({ ...unlocked.settings, profiles: [{ ...unlocked.settings.profiles[0], githubToken: '' }] }, 'x' as never)
    expect(storeJson().p.githubToken).toBe('ghp_stored')
  })
})

describe('the settings file', () => {
  const big = (name: string): AppSettings => {
    const s = settingsWith(profileWith({ name, githubEnterprise: [{ url: 'https://jane:pw@ghe.acme.com', token: '' }] }))
    return { ...s, repoAliases: Object.fromEntries(Array.from({ length: 20000 }, (_, i) => [`/home/x/repo${i}`, `alias${i}`])) }
  }

  it('concurrent reads of a file being scrubbed all get the real settings', async () => {
    await restart()
    writeFileSync(settingsFile(), JSON.stringify(big('Work')))
    const res = (await Promise.all(Array.from({ length: 40 }, () => call('settings:get')))) as AppSettings[]
    expect(res.filter((s) => s.profiles[0].name !== 'Work')).toEqual([])
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).profiles[0].name).toBe('Work')
  })

  it('a read-path rewrite never lands over a save made in between', async () => {
    await restart()
    writeFileSync(settingsFile(), JSON.stringify(big('Old')))
    await Promise.all([
      call('settings:get'),
      call('settings:set', settingsWith(profileWith({ name: 'New' }))),
      call('settings:get')
    ])
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).profiles[0].name).toBe('New')
  })

  it('one that cannot be parsed is an error, never the defaults — and is left untouched', async () => {
    const mod = await restart()
    writeFileSync(settingsFile(), '{"profiles": [')
    // Answered as a reason the boot screen can name, never thrown across IPC.
    expect(await call('settings:get')).toEqual({ error: 'parse' })
    await expect(mod.readSettings()).rejects.toThrow(mod.SettingsReadError)
    await expect(mod.readSettings()).rejects.toThrow(/left untouched/)
    expect(readFileSync(settingsFile(), 'utf8')).toBe('{"profiles": [')
  })

  it('none at all is the defaults', async () => {
    await restart()
    const s = (await call('settings:get')) as AppSettings
    expect(s.profiles).toEqual(defaultSettings().profiles)
  })
})

describe('secret fields this build does not know', () => {
  it('saveOver keeps them, whatever the sender held', () => {
    const current = { p: { githubToken: 'gh', futureServerTokens: { 'https://f2': 'fj2' } } } as unknown as SecretStore
    const out = saveOver(current, { p: { azureToken: 'az' } }, new Map())
    expect(out).toEqual({ p: { githubToken: 'gh', azureToken: 'az', futureServerTokens: { 'https://f2': 'fj2' } } })
    // A sender that held GitHub's token and cleared it clears only that.
    const cleared = saveOver(current, {}, new Map([['p\0githubToken', 'gh']]))
    expect(cleared).toEqual({ p: { futureServerTokens: { 'https://f2': 'fj2' } } })
  })

  it('survive a plain save after a background unlock', async () => {
    await restart()
    writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith({}))))
    writeStore({ p: { githubToken: 'gh', futureServerTokens: { 'https://x': 'fut' } } as never })
    const m = await restart('granted', false)
    const g = await call('settings:get')
    await m.activeProfileAuth('github')
    await call('settings:set', g)
    expect(store()).toContain('fut')
  })
})

describe('a clear made while the keychain is off', () => {
  it('holds at once, and reaches the store when the keychain is back on', async () => {
    const mod = await restart()
    const kc = await import('../src/main/keychain')
    kc.registerKeychainHandlers()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_revoked', azureToken: 'az_keep' })))
    await call('settings:unlock')
    await call('keychain:set', false)
    const s = (await call('settings:unlock')) as AppSettings
    await call('settings:set', { ...s, profiles: [{ ...s.profiles[0], githubToken: '' }] })
    // Off: nothing written, but nothing sent with the cleared token either.
    expect((await mod.activeProfileAuth('github')).token).toBeUndefined()
    expect((await mod.activeProfileAuth('azure')).token).toBe('az_keep')
    expect(store()).toContain('ghp_revoked')
    await call('keychain:set', true)
    const r = (await call('settings:unlock')) as AppSettings
    expect(r.profiles[0].githubToken).toBe('')
    expect(r.profiles[0].azureToken).toBe('az_keep')
    expect(store()).not.toContain('ghp_revoked')
  })

  it('clearing every token while off holds too', async () => {
    const mod = await restart()
    const kc = await import('../src/main/keychain')
    kc.registerKeychainHandlers()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_revoked' })))
    await call('settings:unlock')
    await call('keychain:set', false)
    const s = (await call('settings:unlock')) as AppSettings
    await call('settings:set', { ...s, profiles: [{ ...s.profiles[0], githubToken: '' }] })
    expect((await mod.activeProfileAuth('github')).token).toBeUndefined()
    expect(((await call('settings:unlock')) as AppSettings).profiles[0].githubToken).toBe('')
    // Not yet in the store: said so, so it is not silently lost on quit.
    expect(mod.hasSessionOnlySecrets()).toBe(true)
  })

  it('a token typed while off does not hide the stored ones of the same profile', async () => {
    const mod = await restart()
    const kc = await import('../src/main/keychain')
    kc.registerKeychainHandlers()
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_stored' })))
    await call('settings:unlock')
    await call('keychain:set', false)
    // A renderer that never unlocked types an Azure token.
    await callFrom(2, 'settings:set', settingsWith(profileWith({ azureToken: 'az_typed' })))
    expect((await mod.activeProfileAuth('github')).token).toBe('ghp_stored')
    expect((await mod.activeProfileAuth('azure')).token).toBe('az_typed')
  })
})

describe('isHeldSecret, padded', () => {
  it('sees a held token through spaces, invisible characters and junk around it', async () => {
    const mod = await restart('declined')
    await call('settings:set', settingsWith(profileWith({ githubToken: 'ghp_heldheldheld0123' })))
    for (const v of [
      'ghp_heldheldheld0123',
      ' ghp_heldheldheld0123 ',
      'ghp_heldheldheld0123 x',
      'ghp_held​heldheld0123',
      '﻿ghp_heldheldheld0123⁠',
      'Bearer ghp_heldheldheld0123',
      'ghp_heldheld\theld0123'
    ]) {
      expect(await mod.isHeldSecret(v), JSON.stringify(v)).toBe(true)
    }
    // A long enough piece of one is that one too.
    expect(await mod.isHeldSecret('heldheldheld0123')).toBe(true)
    // Unrelated values, and a piece too short to mean anything, are not.
    expect(await mod.isHeldSecret('ghp_somethingelse999')).toBe(false)
    expect(await mod.isHeldSecret('held')).toBe(false)
    expect(await mod.isHeldSecret('​ ')).toBe(false)
  })
})
