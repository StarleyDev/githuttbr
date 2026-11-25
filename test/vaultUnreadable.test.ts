import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { VaultListResult } from '../src/shared/types'

// The vault never saves over a file it could not read: that save would leave a
// vault holding only the entry just typed. Writes are refused until it reads
// again, or until the user starts a new one, which keeps the old file under a
// name of its own. Real handlers, a fake keyring.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-vault-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { backend: 'gnome_libsecret', prefix: 'v11', failProbe: false }

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => true,
    getSelectedStorageBackend: () => keyring.backend,
    encryptStringAsync: async (s: string) => {
      // The throwaway probe (an empty string) fails; real seals go through.
      if (keyring.failProbe && s === '') throw new Error('probe refused')
      return Buffer.from(`${keyring.prefix}enc:${s}`)
    },
    // `old` stands for a key safeStorage is retiring: readable, but asks to be re-sealed.
    decryptStringAsync: async (b: Buffer) => {
      const m = /^(v10|v11|old)enc:/.exec(b.toString())
      if (!m) throw new Error('not ours')
      return { result: b.toString().slice(m[0].length), shouldReEncrypt: m[1] === 'old' }
    }
  }
}))

const realPlatform = process.platform
const onPlatform = (platform: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

afterAll(() => {
  onPlatform(realPlatform)
  rmSync(dir, { recursive: true, force: true })
})

const vaultFile = (): string => join(dir, 'githuttbr-vault.enc')
const vaultText = (): string => Buffer.from(readFileSync(vaultFile(), 'utf8'), 'base64').toString()
const backups = (): string[] => readdirSync(dir).filter((f) => f.startsWith('githuttbr-vault.enc.bak')).sort()
const writeVault = (data: object, prefix = 'v11'): void =>
  writeFileSync(vaultFile(), Buffer.from(`${prefix}enc:${JSON.stringify(data)}`).toString('base64'))
/** A vault another app identity wrote: present, and not readable with this key. */
const writeForeignVault = (tag: string): void => writeFileSync(vaultFile(), Buffer.from(`foreign:${tag}`).toString('base64'))

const entry = { id: 'e1', key: 'API_KEY', value: 'S3CRET', updatedAt: 1 }

async function start(): Promise<typeof import('../src/main/vault')> {
  vi.resetModules()
  handlers.clear()
  const vault = await import('../src/main/vault')
  vault.registerVaultHandlers()
  return vault
}

const call = (channel: string, ...args: unknown[]): Promise<unknown> =>
  Promise.resolve(handlers.get(channel)!({}, ...args))

beforeEach(() => {
  onPlatform('linux')
  keyring.backend = 'gnome_libsecret'
  keyring.prefix = 'v11'
  keyring.failProbe = false
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true })
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
})

describe('a vault this session cannot read', () => {
  it('is listed as unreadable, not as empty', async () => {
    writeForeignVault('theirs')
    await start()
    expect(await call('vault:list', '/repo')).toEqual({ available: true, unreadable: true, repo: [], global: [] })
  })

  it('refuses an upsert or a removal, and leaves the file and the folder as they were', async () => {
    writeForeignVault('theirs')
    const before = readFileSync(vaultFile(), 'utf8')
    await start()
    const added = (await call('vault:upsert', 'global', '', { key: 'NEW', value: 'v' })) as VaultListResult
    expect(added.unreadable).toBe(true)
    const removed = (await call('vault:remove', 'global', '', 'e1')) as VaultListResult
    expect(removed.unreadable).toBe(true)
    expect(readFileSync(vaultFile(), 'utf8')).toBe(before)
    expect(backups()).toEqual([])
  })

  it('rejects an import, from a settings file or a secure-share bundle', async () => {
    writeForeignVault('theirs')
    const before = readFileSync(vaultFile(), 'utf8')
    const vault = await start()
    expect(await call('vault:importAll', { repos: {}, global: [entry] })).toEqual({ unreadable: true })
    await expect(vault.importGlobalEntries([{ key: 'K', value: 'v' }])).rejects.toBeInstanceOf(vault.VaultUnreadableError)
    expect(await vault.checkVaultWritable()).toBe('unreadable')
    expect(readFileSync(vaultFile(), 'utf8')).toBe(before)
  })

  it('refuses an export rather than handing over an empty vault', async () => {
    writeForeignVault('theirs')
    const vault = await start()
    expect(await call('vault:exportAll')).toEqual({ repos: {}, global: [], unreadable: true })
    await expect(vault.exportGlobalEntries()).rejects.toBeInstanceOf(vault.VaultUnreadableError)
  })

  it('a readable vault exports and imports as before', async () => {
    writeVault({ repos: {}, global: [entry] })
    const vault = await start()
    expect(await call('vault:exportAll')).toEqual({ repos: {}, global: [entry] })
    expect(await vault.exportGlobalEntries()).toEqual([{ key: 'API_KEY', value: 'S3CRET' }])
    expect(await call('vault:importAll', { repos: { '/r': [{ ...entry, id: 'e2' }] }, global: [] })).toEqual({})
    expect(await vault.checkVaultWritable()).toBe('ok')
  })

  it('the pre-check adopts the consent an existing vault implies, like the import would', async () => {
    writeForeignVault('theirs')
    // Consent never recorded, but explained: an install from before the gate that saw the dialog.
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'unset', explained: true }))
    const vault = await start()
    // No window to ask in (tests): adopted, unexplained, so the answer is "no" —
    // said as unavailable, before anything is written, and the import refuses the same way.
    expect(await vault.checkVaultWritable()).toBe('unavailable')
    await expect(vault.importGlobalEntries([{ key: 'K', value: 'v' }])).rejects.toBeInstanceOf(vault.VaultUnavailableError)
    expect(JSON.parse(readFileSync(join(dir, 'githuttbr-keychain.json'), 'utf8'))).toMatchObject({ consent: 'granted' })
  })

  it('takes writes again once it reads', async () => {
    writeForeignVault('theirs')
    await start()
    expect(((await call('vault:list', '')) as VaultListResult).unreadable).toBe(true)
    writeVault({ repos: {}, global: [entry] })
    const added = (await call('vault:upsert', 'global', '', { key: 'NEW', value: 'v' })) as VaultListResult
    expect(added.unreadable).toBeUndefined()
    expect(added.global.map((e) => e.key)).toEqual(['API_KEY', 'NEW'])
  })

  it('starting a new vault keeps every old file under a name of its own', async () => {
    writeForeignVault('first')
    const first = readFileSync(vaultFile(), 'utf8')
    await start()
    expect(await call('vault:replaceUnreadable')).toBe(true)
    expect(await call('vault:list', '')).toEqual({ available: true, repo: [], global: [] })

    writeForeignVault('second')
    const second = readFileSync(vaultFile(), 'utf8')
    expect(await call('vault:replaceUnreadable')).toBe(true)

    const names = backups()
    expect(names).toHaveLength(2)
    expect(names.every((n) => n.startsWith('githuttbr-vault.enc.bak-'))).toBe(true)
    expect(names.map((n) => readFileSync(join(dir, n), 'utf8')).sort()).toEqual([first, second].sort())
  })

  it('does not replace a vault that reads after all', async () => {
    writeVault({ repos: {}, global: [entry] })
    await start()
    expect(await call('vault:replaceUnreadable')).toBe(false)
    expect(backups()).toEqual([])
    expect(((await call('vault:list', '')) as VaultListResult).global).toHaveLength(1)
  })
})

describe('a vault the keychain cannot open (declined, dismissed, or timed out)', () => {
  const declined = (): void =>
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))

  it('a write is answered unavailable, the listing says a vault is there, and nothing is written', async () => {
    writeVault({ repos: {}, global: [entry] })
    declined()
    const before = readFileSync(vaultFile(), 'utf8')
    await start()
    expect(await call('vault:list', '')).toEqual({ available: false, onDisk: true, repo: [], global: [] })
    expect(((await call('vault:upsert', 'global', '', { key: 'K', value: 'v' })) as VaultListResult).available).toBe(false)
    expect(readFileSync(vaultFile(), 'utf8')).toBe(before)
  })

  it('the listing says no vault is there when there is none', async () => {
    declined()
    await start()
    expect(await call('vault:list', '')).toEqual({ available: false, onDisk: false, repo: [], global: [] })
  })

  it('is refused by every export and import, never dropped silently', async () => {
    writeVault({ repos: {}, global: [entry] })
    declined()
    const before = readFileSync(vaultFile(), 'utf8')
    const vault = await start()
    expect(await call('vault:exportAll')).toEqual({ repos: {}, global: [], unavailable: true })
    await expect(vault.exportGlobalEntries()).rejects.toBeInstanceOf(vault.VaultUnavailableError)
    expect(await call('vault:importAll', { repos: {}, global: [entry] })).toEqual({ unavailable: true })
    expect(await vault.checkVaultWritable()).toBe('unavailable')
    await expect(vault.importGlobalEntries([{ key: 'K', value: 'v' }])).rejects.toBeInstanceOf(vault.VaultUnavailableError)
    expect(readFileSync(vaultFile(), 'utf8')).toBe(before)
  })

  it('with no vault on disk, an export is simply empty and an empty import is a no-op', async () => {
    declined()
    const vault = await start()
    expect(await call('vault:exportAll')).toEqual({ repos: {}, global: [] })
    expect(await vault.exportGlobalEntries()).toEqual([])
    expect(await call('vault:importAll', { repos: {}, global: [] })).toEqual({})
    // Entries to merge, and nowhere to keep them: still refused.
    expect(await call('vault:importAll', { repos: {}, global: [entry] })).toEqual({ unavailable: true })
  })
})

describe('a vault read with a retiring key (shouldReEncrypt)', () => {
  it('is re-sealed with the current key', async () => {
    writeVault({ repos: {}, global: [entry] }, 'old')
    await start()
    expect(((await call('vault:list', '')) as VaultListResult).global).toHaveLength(1)
    expect(vaultText().startsWith('v11enc:')).toBe(true)
  })

  it('is not re-sealed when the seal comes back v10 although the probe said nothing', async () => {
    writeVault({ repos: {}, global: [entry] }, 'old')
    keyring.prefix = 'v10'
    keyring.failProbe = true
    const before = readFileSync(vaultFile(), 'utf8')
    await start()
    expect(((await call('vault:list', '')) as VaultListResult).global).toHaveLength(1)
    expect(readFileSync(vaultFile(), 'utf8')).toBe(before)
  })

  it('is left as it is when the store is weak', async () => {
    writeVault({ repos: {}, global: [entry] }, 'old')
    keyring.backend = 'basic_text'
    const before = readFileSync(vaultFile(), 'utf8')
    await start()
    expect(((await call('vault:list', '')) as VaultListResult).global).toHaveLength(1)
    expect(readFileSync(vaultFile(), 'utf8')).toBe(before)
  })
})

describe('the vault on a fixed-password store', () => {
  it('still saves (it has no session-only mode), and the session now counts as weak', async () => {
    keyring.prefix = 'v10'
    await start()
    const kc = await import('../src/main/keychain')
    await call('vault:upsert', 'global', '', { key: 'K', value: 'v' })
    expect(existsSync(vaultFile())).toBe(true)
    expect(vaultText().startsWith('v10enc:')).toBe(true)
    // Only the vault's own seal can have told it: a probe now would see v11.
    keyring.prefix = 'v11'
    expect(await kc.isKeychainWeak()).toBe(true)
  })
})
