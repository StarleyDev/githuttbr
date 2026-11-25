import { describe, it, expect, vi, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'

// 4.40 docks the terminal under the graph and opens it when a repository opens.
// Both are defaults only: a settings file that stored a placement keeps it, and
// one written before either key existed reads as the new defaults. The file is
// read through the real main-process loader. The once-per-session rule is in
// pureLogic.test.ts (claimTerminalAutoOpen).

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-termdefaults-'))

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: () => undefined, on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => false,
    encryptStringAsync: async (s: string) => Buffer.from(s),
    decryptStringAsync: async (b: Buffer) => ({ result: b.toString(), shouldReEncrypt: false })
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const writeSettings = (settings: Record<string, unknown>): void =>
  writeFileSync(join(dir, 'githuttbr-settings.json'), JSON.stringify(settings))

describe('terminal defaults', () => {
  it('a new install docks the terminal in the center and opens it with a repository', () => {
    const sd = defaultSettings()
    expect(sd.terminalPlacement).toBe('center')
    expect(sd.openTerminalOnRepoOpen).toBe(true)
  })

  it('a settings file from before the keys existed reads as the new defaults', async () => {
    writeSettings({ themeMode: 'dark', onboardingCompleted: true })
    const { readSettings } = await import('../src/main/settings')
    const s = await readSettings()
    expect(s.terminalPlacement).toBe('center')
    expect(s.openTerminalOnRepoOpen).toBe(true)
  })

  it('a stored placement and a stored opt-out are kept', async () => {
    writeSettings({ terminalPlacement: 'bottom', openTerminalOnRepoOpen: false, onboardingCompleted: true })
    const { readSettings } = await import('../src/main/settings')
    const s = await readSettings()
    expect(s.terminalPlacement).toBe('bottom')
    expect(s.openTerminalOnRepoOpen).toBe(false)
  })
})
