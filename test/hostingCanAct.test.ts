import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractSecrets } from '../src/shared/secrets'
import { defaultSettings, type AppSettings } from '../src/shared/types'

// `hosting:canAct` decides whether the branch comparison offers Create PR. The
// renderer cannot: its profile has no tokens until Settings is unlocked and
// never has links. Main answers from the same resolution every hosting call
// uses — and, since it is asked just by opening a dialog, never decrypts or
// prompts. Real IPC handlers, real settings files, a keyring that counts.
const plainDir = mkdtempSync(join(tmpdir(), 'githuttbr-canact-plain-'))
const lockedDir = mkdtempSync(join(tmpdir(), 'githuttbr-canact-locked-'))
let dir = plainDir
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { decrypts: 0, asked: 0 }

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => [{ isDestroyed: () => false, once: () => undefined, webContents: { send: () => keyring.asked++ } }]
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => {
      keyring.decrypts++
      return b.toString().replace(/^enc:/, '')
    }
  }
}))

const GITHUB = 'https://github.com/acme/app.git'
const LINKED = '/repos/linked'
const BARE = '/repos/bare'
const TOKENED = '/repos/tokened'
const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))

/** An active profile with nothing, one linked to a gh login, one with a GitHub token. */
function settingsWith(token: string): AppSettings {
  const base = defaultSettings()
  const active = { ...base.profiles[0], id: 'active', name: 'Active' }
  const linked = { ...base.profiles[0], id: 'linked', name: 'Linked', links: { github: { source: 'gh' as const, login: 'octo' } } }
  const tokened = { ...base.profiles[0], id: 'tokened', name: 'Tokened', githubToken: token }
  return {
    ...base,
    onboardingCompleted: true,
    activeProfileId: 'active',
    profiles: [active, linked, tokened, { ...base.profiles[0], id: 'bare', name: 'Bare' }],
    repoProfiles: { [LINKED]: 'linked', [BARE]: 'bare', [TOKENED]: 'tokened' }
  }
}

async function boot(): Promise<void> {
  vi.resetModules()
  handlers.clear()
  const { readSettings, registerSettingsHandlers } = await import('../src/main/settings')
  await readSettings()
  const { registerHostingHandlers } = await import('../src/main/hosting')
  registerSettingsHandlers()
  registerHostingHandlers()
}

afterAll(() => {
  rmSync(plainDir, { recursive: true, force: true })
  rmSync(lockedDir, { recursive: true, force: true })
})

describe('hosting:canAct with no encrypted store', () => {
  beforeAll(async () => {
    dir = plainDir
    writeFileSync(join(plainDir, 'githuttbr-settings.json'), JSON.stringify(settingsWith('')))
    await boot()
  })

  it('is yes for a profile linked to a machine login, with no token anywhere', async () => {
    expect(await call('hosting:canAct', LINKED, GITHUB)).toBe('yes')
  })

  it('is no for a bound profile with nothing — never the active profile, nor a machine login it did not link', async () => {
    expect(await call('hosting:canAct', BARE, GITHUB)).toBe('no')
    expect(await call('hosting:canAct', '/repos/unbound', GITHUB)).toBe('no')
  })

  it('is no for a remote no hosting service owns, and for a malformed call', async () => {
    expect(await call('hosting:canAct', LINKED, 'https://git.example.test/acme/app.git')).toBe('no')
    expect(await call('hosting:canAct', LINKED, 42)).toBe('no')
  })
})

describe('hosting:canAct with tokens in a locked store', () => {
  const TOKEN = 'ghp_locked_token'
  beforeAll(async () => {
    dir = lockedDir
    keyring.decrypts = 0
    keyring.asked = 0
    const withTokens = settingsWith(TOKEN)
    writeFileSync(join(lockedDir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
    writeFileSync(
      join(lockedDir, 'githuttbr-secrets.enc'),
      Buffer.from(`enc:${JSON.stringify(extractSecrets(withTokens))}`).toString('base64')
    )
    // The token lives only in the encrypted store, as it does after a restart.
    writeFileSync(join(lockedDir, 'githuttbr-settings.json'), JSON.stringify(settingsWith('')))
    await boot()
  })

  it('answers unknown while locked — so the action is offered — without decrypting or asking', async () => {
    expect(await call('hosting:canAct', TOKENED, GITHUB)).toBe('unknown')
    expect(await call('hosting:canAct', '/repos/unbound', GITHUB)).toBe('unknown')
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
  })

  it('still answers no for a remote no hosting service owns, locked or not', async () => {
    expect(await call('hosting:canAct', TOKENED, 'https://git.example.test/acme/app.git')).toBe('no')
  })

  it('answers from the decrypted tokens once something the user did unlocked the store', async () => {
    await call('settings:unlock')
    expect(keyring.decrypts).toBe(1)
    expect(await call('hosting:canAct', TOKENED, GITHUB)).toBe('yes')
    expect(await call('hosting:canAct', BARE, GITHUB)).toBe('no')
    expect(await call('hosting:canAct', '/repos/unbound', GITHUB)).toBe('no')
    expect(keyring.decrypts).toBe(1)
  })
})
