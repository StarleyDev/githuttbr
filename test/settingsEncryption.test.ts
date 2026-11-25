import { afterAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { openSettingsExport, sealSettingsExport } from '../src/main/settingsEncryption'
import { ENCRYPTED_SETTINGS_FORMAT, isEncryptedSettingsExport } from '../src/shared/settingsEncryption'
import { parseSettingsImport } from '../src/renderer/src/lib/settingsImport'
import { defaultSettings } from '../src/shared/types'

// Settings → Data → Export with "Protect with a password": the same bundle,
// sealed with the Secure share cipher. Nothing readable without the password.

const bundle = {
  __githuttbr: 'settings-export',
  version: 1,
  settings: { ...defaultSettings(), language: 'pt-BR' },
  vault: { repos: {}, global: [{ key: 'API_KEY', value: 'vault-secret-value' }] }
}

describe('password-protected settings export', () => {
  it('opens with the right password to exactly what was sealed', () => {
    const text = sealSettingsExport(bundle, 'correct horse')
    const raw = JSON.parse(text)
    expect(raw.format).toBe(ENCRYPTED_SETTINGS_FORMAT)
    expect(isEncryptedSettingsExport(raw)).toBe(true)
    expect(openSettingsExport(raw, 'correct horse')).toEqual({ ok: true, data: bundle })
  })

  it('keeps every secret out of the file text', () => {
    const text = sealSettingsExport(bundle, 'pw')
    expect(text).not.toContain('vault-secret-value')
    expect(text).not.toContain('API_KEY')
    expect(text).not.toContain('pt-BR')
  })

  it('takes a password as typed — spaces included — and any length', () => {
    const raw = JSON.parse(sealSettingsExport(bundle, ' a '))
    expect(openSettingsExport(raw, 'a').ok).toBe(false)
    expect(openSettingsExport(raw, ' a ').ok).toBe(true)
  })

  it('refuses a wrong password', () => {
    const raw = JSON.parse(sealSettingsExport(bundle, 'right'))
    expect(openSettingsExport(raw, 'wrong')).toEqual({ ok: false, reason: 'bad-password' })
  })

  it('refuses a tampered file the same way, never handing back altered data', () => {
    const raw = JSON.parse(sealSettingsExport(bundle, 'pw'))
    const bytes = Buffer.from(raw.payload, 'base64')
    bytes[0] ^= 1
    raw.payload = bytes.toString('base64')
    expect(openSettingsExport(raw, 'pw')).toEqual({ ok: false, reason: 'bad-password' })
  })

  it('names a newer format instead of misreading it', () => {
    const raw = JSON.parse(sealSettingsExport(bundle, 'pw'))
    raw.version = 99
    expect(openSettingsExport(raw, 'pw')).toEqual({ ok: false, reason: 'unsupported-version' })
  })

  it('calls a damaged envelope invalid', () => {
    const raw = JSON.parse(sealSettingsExport(bundle, 'pw'))
    delete raw.cipher
    expect(openSettingsExport(raw, 'pw')).toEqual({ ok: false, reason: 'invalid' })
    expect(openSettingsExport({ __githuttbr: 'settings-export' }, 'pw')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('is never parsed as bare settings while still sealed', () => {
    // Read as bare settings it would import nothing and report success.
    expect(parseSettingsImport(JSON.parse(sealSettingsExport(bundle, 'pw')))).toBeNull()
  })

  it('leaves a plain export exactly as it was', () => {
    expect(isEncryptedSettingsExport(bundle)).toBe(false)
    expect(parseSettingsImport(bundle)?.bundle?.vault).toEqual(bundle.vault)
  })
})

// Through the real IPC handlers: what lands on disk, and the way back.
const dir = mkdtempSync(join(tmpdir(), 'githuttbr-export-pw-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
let savePath = ''

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: { showSaveDialog: async () => ({ canceled: false, filePath: savePath }) },
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (s: string) => Buffer.from(`enc:${s}`),
    decryptStringAsync: async (b: Buffer) => ({ result: b.toString().slice(4), shouldReEncrypt: false })
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('settings export handlers', () => {
  it('write the sealed file with a password, and the readable one without', async () => {
    const mod = await import('../src/main/settings')
    mod.registerSettingsHandlers()
    const exportFile = handlers.get('settings:exportFile')!
    const decryptImport = handlers.get('settings:decryptImport')!

    savePath = join(dir, 'sealed.json')
    expect(await exportFile({}, bundle, 'pw')).toBe(true)
    const sealed = JSON.parse(readFileSync(savePath, 'utf-8'))
    expect(isEncryptedSettingsExport(sealed)).toBe(true)
    expect(readFileSync(savePath, 'utf-8')).not.toContain('vault-secret-value')
    expect(await decryptImport({}, sealed, 'pw')).toEqual({ ok: true, data: bundle })
    expect(await decryptImport({}, sealed, 'nope')).toEqual({ ok: false, reason: 'bad-password' })
    // A password that is not a string is not a password.
    expect(await decryptImport({}, sealed, 42)).toEqual({ ok: false, reason: 'invalid' })

    // No password (or an empty one): the plain JSON, as before.
    for (const pw of [undefined, '']) {
      savePath = join(dir, `plain-${String(pw)}.json`)
      expect(await exportFile({}, bundle, pw)).toBe(true)
      expect(JSON.parse(readFileSync(savePath, 'utf-8'))).toEqual(bundle)
    }
  })
})
