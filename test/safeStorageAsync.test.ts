import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Electron 45 deprecated safeStorage's synchronous calls and 46 removes them.
// The main process uses only the asynchronous ones; this fake has nothing else,
// so a synchronous call left anywhere would fail here instead of in a user's app.

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

describe('no synchronous safeStorage call is left in the main process', () => {
  const sources = (root: string): string[] =>
    readdirSync(root).flatMap((name) => {
      const path = join(root, name)
      return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : []
    })

  it('uses only the asynchronous encrypt, decrypt and availability calls', () => {
    const sync = /safeStorage\.(isEncryptionAvailable|encryptString|decryptString)\s*\(/
    const offenders = sources(join(__dirname, '..', 'src')).filter((path) => sync.test(readFileSync(path, 'utf8')))
    expect(offenders).toEqual([])
  })
})
