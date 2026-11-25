import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile, type VaultListResult } from '../src/shared/types'
import type { SecretStore } from '../src/shared/secrets'
import { settingsIpc } from './settingsIpc'

// On Linux/KDE, Electron 45's asynchronous safeStorage takes its key from the
// XDG secret portal, not the KWallet key the synchronous calls used through
// v4.51 — and both tag their ciphertext `v11`. v4.52.0 read only through the
// asynchronous calls, so every store an earlier version wrote looked gone. This
// fake models the two keys: each call seals with its own, and each decrypt
// accepts only its own. `sync: false` is Electron 46, where the synchronous
// calls no longer exist.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-legacy-key-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { backend: 'kwallet6', sync: true }

const open = (prefix: string, b: Buffer): string => {
  const s = b.toString()
  if (!s.startsWith(prefix)) throw new Error('Error while decrypting the ciphertext provided to safeStorage.')
  return s.slice(prefix.length)
}

vi.mock('electron', () => {
  const safeStorage = {
    isAsyncEncryptionAvailable: async () => true,
    getSelectedStorageBackend: () => keyring.backend,
    encryptStringAsync: async (s: string) => Buffer.from(`portal:${s}`),
    decryptStringAsync: async (b: Buffer) => ({ result: open('portal:', b), shouldReEncrypt: false })
  }
  const sync = {
    encryptString: (s: string) => Buffer.from(`legacy:${s}`),
    decryptString: (b: Buffer) => open('legacy:', b)
  }
  // Present or absent per test, as the property itself: Electron 46 has no such method at all.
  for (const [name, fn] of Object.entries(sync)) {
    Object.defineProperty(safeStorage, name, { get: () => (keyring.sync ? fn : undefined), enumerable: true })
  }
  return {
    app: { getPath: () => dir, isPackaged: false },
    ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
    dialog: {},
    shell: {},
    BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
    safeStorage
  }
})

const realPlatform = process.platform
const onPlatform = (platform: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

afterAll(() => {
  onPlatform(realPlatform)
  rmSync(dir, { recursive: true, force: true })
})

const settingsFile = (): string => join(dir, 'githuttbr-settings.json')
const storeFile = (): string => join(dir, 'githuttbr-secrets.enc')
const vaultFile = (): string => join(dir, 'githuttbr-vault.enc')
const sealed = (path: string): string => Buffer.from(readFileSync(path, 'utf8'), 'base64').toString()
const writeSealed = (path: string, key: 'legacy' | 'portal' | 'foreign', data: object): void =>
  writeFileSync(path, Buffer.from(`${key}:${JSON.stringify(data)}`).toString('base64'))
/** Which key the file on disk is sealed with, and what it holds. */
const onDisk = (path: string): { key: string; data: unknown } => {
  const text = sealed(path)
  const at = text.indexOf(':')
  return { key: text.slice(0, at), data: JSON.parse(text.slice(at + 1)) }
}

const ipc = settingsIpc(handlers)
const call = (channel: string, ...args: unknown[]): Promise<unknown> => ipc({ sender: { id: 1 } }, channel, ...args)

const profile = (id: string, over: Partial<Profile> = {}): Profile => ({ ...defaultSettings().profiles[0], id, name: id, ...over })
const settingsWith = (...profiles: Profile[]): AppSettings => ({
  ...defaultSettings(),
  onboardingCompleted: true,
  profiles,
  activeProfileId: profiles[0].id
})

const twoProfiles = settingsWith(profile('work'), profile('home'))
const v451Store: SecretStore = {
  work: { githubToken: 'WORK-GH', azureToken: 'WORK-AZ' },
  home: { gitlabToken: 'HOME-GL' }
}

beforeEach(() => {
  onPlatform('linux')
  keyring.backend = 'kwallet6'
  keyring.sync = true
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true })
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
  writeFileSync(settingsFile(), JSON.stringify(twoProfiles))
})

/** A fresh main process over these files. */
async function startSettings(): Promise<void> {
  vi.resetModules()
  handlers.clear()
  const mod = await import('../src/main/settings')
  const kc = await import('../src/main/keychain')
  mod.registerSettingsHandlers()
  kc.registerKeychainHandlers()
}

const unlock = async (): Promise<Profile[]> => ((await call('settings:unlock')) as AppSettings).profiles
const tokens = (profiles: Profile[]): Record<string, Partial<Profile>> =>
  Object.fromEntries(
    profiles.map((p) => [p.id, { githubToken: p.githubToken, azureToken: p.azureToken, gitlabToken: p.gitlabToken }])
  )

describe('a token store written by v4.51 (the synchronous key)', () => {
  it('loads with every profile\'s tokens, and the next save stays on that key', async () => {
    writeSealed(storeFile(), 'legacy', v451Store)
    await startSettings()
    const profiles = await unlock()
    expect(tokens(profiles)).toMatchObject({
      work: { githubToken: 'WORK-GH', azureToken: 'WORK-AZ' },
      home: { gitlabToken: 'HOME-GL' }
    })
    // Read with the key it was written with: nothing to re-seal.
    expect(onDisk(storeFile())).toEqual({ key: 'legacy', data: v451Store })

    const [work, home] = profiles
    await call('settings:set', settingsWith({ ...work, bitbucketToken: 'WORK-BB' }, home))
    const after = onDisk(storeFile())
    expect(after.key).toBe('legacy')
    expect((after.data as SecretStore).work?.bitbucketToken).toBe('WORK-BB')
    expect((after.data as SecretStore).home?.gitlabToken).toBe('HOME-GL')
  })
})

describe('a token store written by v4.52.0 (the asynchronous key)', () => {
  it('loads, and is re-sealed under the synchronous key on that read', async () => {
    writeSealed(storeFile(), 'portal', v451Store)
    await startSettings()
    expect(tokens(await unlock())).toMatchObject({
      work: { githubToken: 'WORK-GH', azureToken: 'WORK-AZ' },
      home: { gitlabToken: 'HOME-GL' }
    })
    // Readable again by v4.51, the rollback target.
    expect(onDisk(storeFile())).toEqual({ key: 'legacy', data: v451Store })
  })

  it('is not re-sealed when the keychain is weak', async () => {
    keyring.backend = 'basic_text'
    writeSealed(storeFile(), 'portal', v451Store)
    const before = readFileSync(storeFile(), 'utf8')
    await startSettings()
    expect(tokens(await unlock()).work.githubToken).toBe('WORK-GH')
    expect(readFileSync(storeFile(), 'utf8')).toBe(before)
  })
})

describe('the vault', () => {
  const entry = { id: 'e1', key: 'API_KEY', value: 'S3CRET', updatedAt: 1 }
  const vaultData = { repos: {}, global: [entry] }

  async function startVault(): Promise<void> {
    vi.resetModules()
    handlers.clear()
    const vault = await import('../src/main/vault')
    vault.registerVaultHandlers()
  }
  const vaultCall = (channel: string, ...args: unknown[]): Promise<unknown> =>
    Promise.resolve(handlers.get(channel)!({}, ...args))

  it('reads one sealed with the synchronous key, and writes with it', async () => {
    writeSealed(vaultFile(), 'legacy', vaultData)
    await startVault()
    const listed = (await vaultCall('vault:list', '/repo')) as VaultListResult
    expect(listed.unreadable).toBeFalsy()
    expect(listed.global.map((e) => e.value)).toEqual(['S3CRET'])
    expect(onDisk(vaultFile()).key).toBe('legacy')

    await vaultCall('vault:upsert', 'global', '', { key: 'NEW', value: 'v' })
    expect(onDisk(vaultFile()).key).toBe('legacy')
    expect(JSON.stringify(onDisk(vaultFile()).data)).toContain('NEW')
  })

  it('reads one sealed with the asynchronous key, and re-seals it under the synchronous one', async () => {
    writeSealed(vaultFile(), 'portal', vaultData)
    await startVault()
    const listed = (await vaultCall('vault:list', '/repo')) as VaultListResult
    expect(listed.unreadable).toBeFalsy()
    expect(listed.global.map((e) => e.value)).toEqual(['S3CRET'])
    expect(onDisk(vaultFile())).toEqual({ key: 'legacy', data: vaultData })
  })

  it('leaves an asynchronous-key vault as it was when the keychain is weak', async () => {
    keyring.backend = 'basic_text'
    writeSealed(vaultFile(), 'portal', vaultData)
    const before = readFileSync(vaultFile(), 'utf8')
    await startVault()
    const listed = (await vaultCall('vault:list', '/repo')) as VaultListResult
    expect(listed.global.map((e) => e.value)).toEqual(['S3CRET'])
    expect(readFileSync(vaultFile(), 'utf8')).toBe(before)
  })
})

describe('an Electron without the synchronous calls (46)', () => {
  beforeEach(() => {
    keyring.sync = false
  })

  it('reads and writes the token store with the asynchronous key', async () => {
    writeSealed(storeFile(), 'portal', v451Store)
    await startSettings()
    const [work, home] = await unlock()
    expect(work.githubToken).toBe('WORK-GH')
    // Nothing to re-seal: the asynchronous key is the only one there is.
    expect(onDisk(storeFile()).key).toBe('portal')
    await call('settings:set', settingsWith({ ...work, bitbucketToken: 'WORK-BB' }, home))
    const after = onDisk(storeFile())
    expect(after.key).toBe('portal')
    expect((after.data as SecretStore).work?.bitbucketToken).toBe('WORK-BB')
  })

  it('reads and writes the vault with the asynchronous key', async () => {
    writeSealed(vaultFile(), 'portal', { repos: {}, global: [] })
    vi.resetModules()
    handlers.clear()
    const vault = await import('../src/main/vault')
    vault.registerVaultHandlers()
    await handlers.get('vault:upsert')!({}, 'global', '', { key: 'K', value: 'v' })
    expect(onDisk(vaultFile()).key).toBe('portal')
    expect(JSON.stringify(onDisk(vaultFile()).data)).toContain('"K"')
  })
})

describe('a store neither key opens', () => {
  it('stays unreadable and is never overwritten', async () => {
    writeSealed(storeFile(), 'foreign', v451Store)
    const before = readFileSync(storeFile(), 'utf8')
    await startSettings()
    const [work, home] = await unlock()
    expect(work.githubToken).toBe('')
    // A new token over it: kept off the unreadable file, whatever the save answers.
    await call('settings:set', settingsWith({ ...work, githubToken: 'TYPED' }, home)).catch(() => undefined)
    expect(readFileSync(storeFile(), 'utf8')).toBe(before)
    expect(existsSync(storeFile())).toBe(true)
  })
})
