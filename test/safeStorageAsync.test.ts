import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Electron 45 deprecated safeStorage's synchronous calls and 46 removes them.
// The secret stores still encrypt and decrypt with the synchronous key while it
// exists (see keychain.ts and keychainLegacyKey.test.ts), so those calls live
// in keychain.ts alone, each behind a check that it exists. This fake is the
// Electron 46 shape — asynchronous calls only — so a synchronous call made
// without that check would fail here instead of in a user's app.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-safestorage-async-'))
const keyring = { available: true as boolean | 'reject', probes: 0 }

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: () => undefined, on: () => undefined },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => {
      keyring.probes++
      if (keyring.available === 'reject') throw new Error('safeStorage cannot be used before app is ready')
      return keyring.available
    },
    encryptStringAsync: async (s: string) => Buffer.from(`async:${s}`),
    decryptStringAsync: async (b: Buffer) => {
      const s = b.toString()
      if (!s.startsWith('async:')) throw new Error('Error while decrypting the ciphertext')
      return { result: s.slice('async:'.length), shouldReEncrypt: s === 'async:retiring' }
    }
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const consent = (value: 'granted' | 'declined'): void =>
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: value, explained: true }))

describe('the keychain gate on the asynchronous safeStorage API', () => {
  beforeEach(() => {
    vi.resetModules()
    keyring.available = true
    keyring.probes = 0
  })

  it('reports the keychain usable when consent is given and encryption is available', async () => {
    consent('granted')
    const { canUseKeychain, ensureKeychain } = await import('../src/main/keychain')
    expect(await canUseKeychain()).toBe(true)
    expect(await ensureKeychain('tokens')).toBe(true)
  })

  it('reports it unusable when encryption is not available', async () => {
    consent('granted')
    keyring.available = false
    const { canUseKeychain, ensureKeychain } = await import('../src/main/keychain')
    expect(await canUseKeychain()).toBe(false)
    expect(await ensureKeychain('tokens')).toBe(false)
  })

  it('treats a rejected availability check as unusable, never as a crash', async () => {
    consent('granted')
    keyring.available = 'reject'
    const { canUseKeychain, ensureKeychain } = await import('../src/main/keychain')
    await expect(canUseKeychain()).resolves.toBe(false)
    await expect(ensureKeychain('tokens')).resolves.toBe(false)
  })

  it('never asks safeStorage once the keychain was declined', async () => {
    consent('declined')
    const { canUseKeychain, ensureKeychain } = await import('../src/main/keychain')
    expect(await canUseKeychain()).toBe(false)
    expect(await ensureKeychain('tokens')).toBe(false)
    expect(keyring.probes).toBe(0)
  })
})

describe('sealing and opening on an Electron with asynchronous calls only', () => {
  beforeEach(() => {
    vi.resetModules()
    consent('granted')
  })

  it('seals and opens through the asynchronous calls', async () => {
    const { sealSecret, openSecret } = await import('../src/main/keychain')
    const sealed = await sealSecret('token')
    expect(sealed.toString()).toBe('async:token')
    expect(await openSecret(sealed)).toEqual({ plain: 'token', reseal: false })
  })

  it('asks for a re-seal only when safeStorage says the key is retiring', async () => {
    const { openSecret } = await import('../src/main/keychain')
    expect(await openSecret(Buffer.from('async:retiring'))).toEqual({ plain: 'retiring', reseal: true })
  })

  it('throws when the asynchronous key cannot open it', async () => {
    const { openSecret } = await import('../src/main/keychain')
    await expect(openSecret(Buffer.from('other:token'))).rejects.toThrow()
  })
})

describe('synchronous safeStorage calls stay in keychain.ts', () => {
  const sources = (root: string): string[] =>
    readdirSync(root).flatMap((name) => {
      const path = join(root, name)
      return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : []
    })

  it('no other file in the main process encrypts, decrypts or asks availability synchronously', () => {
    const sync = /safeStorage\.(isEncryptionAvailable|encryptString|decryptString)\s*\(/
    const main = join(__dirname, '..', 'src', 'main')
    const offenders = sources(main).filter(
      (path) => path !== join(main, 'keychain.ts') && sync.test(readFileSync(path, 'utf8'))
    )
    expect(offenders).toEqual([])
  })

  it('keychain.ts never asks availability synchronously: availability does not choose the key', () => {
    const source = readFileSync(join(__dirname, '..', 'src', 'main', 'keychain.ts'), 'utf8')
    expect(source).not.toMatch(/safeStorage\.isEncryptionAvailable\s*\(/)
  })

  it('no other module encrypts or decrypts through safeStorage at all', () => {
    const crypt = /safeStorage\.(encryptString|decryptString)(Async)?\s*\(/
    const main = join(__dirname, '..', 'src', 'main')
    const offenders = sources(main).filter(
      (path) => path !== join(main, 'keychain.ts') && crypt.test(readFileSync(path, 'utf8'))
    )
    expect(offenders).toEqual([])
  })
})
