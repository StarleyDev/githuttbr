import { describe, it, expect, vi, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultAIConfig, defaultSettings, type AIConfig, type AppSettings, type Profile } from '../src/shared/types'
import { GENERAL_AI_SECRETS_ID, type SecretStore } from '../src/shared/secrets'
import { bootLoaded, settingsIpc } from './settingsIpc'

// The general AI against the real settings handlers and a fake keyring: a file
// written before it existed, with the AI keys encrypted under each profile, must
// keep every call on the key it had — and a key cleared afterwards stays cleared.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-ai-general-'))
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
    decryptStringAsync: async (b: Buffer) => {
      const s = b.toString()
      if (!s.startsWith('enc:')) throw new Error('not ours')
      return { result: s.slice(4), shouldReEncrypt: false }
    }
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const settingsFile = (): string => join(dir, 'githuttbr-settings.json')
const storeFile = (): string => join(dir, 'githuttbr-secrets.enc')
const storeJson = (): SecretStore =>
  JSON.parse(Buffer.from(readFileSync(storeFile(), 'utf8'), 'base64').toString().slice(4)) as SecretStore
const writeStore = (s: SecretStore): void =>
  writeFileSync(storeFile(), Buffer.from(`enc:${JSON.stringify(s)}`).toString('base64'))

const ipc = settingsIpc(handlers)
const call = (channel: string, ...args: unknown[]): Promise<unknown> => ipc({ sender: { id: 1 } }, channel, ...args)

function anthropic(): AIConfig {
  return {
    ...defaultAIConfig(),
    accounts: [{ id: 'anthropic', label: 'Anthropic', provider: 'anthropic', endpoint: '', apiKey: '', model: 'claude-x' }],
    defaultAccountId: 'anthropic'
  }
}

const profile = (id: string): Profile => ({ ...defaultSettings().profiles[0], id, name: id, ai: anthropic() })

/** A main process reading files written by a build without the general AI. */
async function startOn(file: object, store: SecretStore): Promise<typeof import('../src/main/settings')> {
  for (const f of ['githuttbr-settings.json', 'githuttbr-secrets.enc', 'githuttbr-secrets.enc.bak']) {
    rmSync(join(dir, f), { force: true })
  }
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
  writeFileSync(settingsFile(), JSON.stringify(file))
  writeStore(store)
  return restart()
}

async function restart(): Promise<typeof import('../src/main/settings')> {
  vi.resetModules()
  handlers.clear()
  const mod = await import('../src/main/settings')
  mod.registerSettingsHandlers()
  await bootLoaded(handlers)
  return mod
}

describe('a settings file from before the general AI', () => {
  const { ai: _ai, ...preGeneral } = { ...defaultSettings(), onboardingCompleted: true }
  void _ai
  const file = { ...preGeneral, profiles: [profile('p'), profile('q')], activeProfileId: 'p' }
  const store = { p: { aiKeys: { anthropic: 'sk-p' } }, q: { aiKeys: { anthropic: 'sk-q' } } }

  it('keeps every profile on its own key, and settles on the first unlock', async () => {
    const mod = await startOn(file, store)
    // Before any renderer has saved: main builds the general AI and finds its key.
    expect(await mod.activeProfileAiKey('anthropic')).toBe('sk-p')

    // Locked, both profiles look alike: their keys are still encrypted.
    const locked = (await call('settings:get')) as AppSettings
    expect(locked.ai.defaultAccountId).toBe('anthropic')
    expect(locked.aiSecretsFrom).toBe('p')

    // The unlock settles it in main: own entry, q's exception, p's old engine gone.
    const unlocked = (await call('settings:unlock')) as AppSettings
    expect(unlocked.aiSecretsFrom).toBeUndefined()
    expect(unlocked.ai.accounts[0].apiKey).toBe('sk-p')
    const q = unlocked.profiles.find((p) => p.id === 'q')!
    expect(q.ownAI).toBe(true)
    expect(q.ai.accounts[0].apiKey).toBe('sk-q')
    expect(unlocked.profiles.find((p) => p.id === 'p')!.ai.accounts).toEqual(defaultAIConfig().accounts)
    expect(storeJson()[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-p' } })
    expect(storeJson().p).toBeUndefined()
    const onDisk = readFileSync(settingsFile(), 'utf8')
    expect(onDisk).not.toContain('aiSecretsFrom')
    expect(onDisk).not.toContain('sk-p')

    // Cleared afterwards, no slot anywhere still holds the old key.
    await call('settings:set', {
      ...unlocked,
      ai: { ...unlocked.ai, apiKey: '', accounts: unlocked.ai.accounts.map((a) => ({ ...a, apiKey: '' })) }
    })
    expect(JSON.stringify(storeJson())).not.toContain('sk-p')
    await restart()
    const after = (await call('settings:unlock')) as AppSettings
    expect(after.ai.accounts[0].apiKey).toBe('')
    expect(JSON.stringify(after)).not.toContain('sk-p')
  })

  it('deleting the source profile before any unlock keeps the general key', async () => {
    const mod = await startOn(file, store)
    // A background lookup decrypts the store; the renderer stays locked.
    expect(await mod.activeProfileAiKey('anthropic')).toBe('sk-p')
    const locked = (await call('settings:get')) as AppSettings
    await call('settings:set', { ...locked, profiles: locked.profiles.filter((p) => p.id !== 'p'), activeProfileId: 'q' })
    expect(storeJson().p).toEqual({ aiKeys: { anthropic: 'sk-p' } })
    const unlocked = (await call('settings:unlock')) as AppSettings
    expect(unlocked.ai.accounts[0].apiKey).toBe('sk-p')
    expect(storeJson()[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-p' } })
    expect(storeJson().p).toBeUndefined()
    // q differed by its key: it keeps it.
    expect(unlocked.profiles.find((p) => p.id === 'q')?.ownAI).toBe(true)
  })

  it('a window still holding the pre-unlock settings cannot undo the settle', async () => {
    await startOn(file, store)
    const stale = (await ipc({ sender: { id: 2 } }, 'settings:get')) as AppSettings
    await call('settings:unlock')
    await ipc({ sender: { id: 2 } }, 'settings:set', stale)
    const onDisk = JSON.parse(readFileSync(settingsFile(), 'utf8')) as AppSettings
    expect(onDisk.aiSecretsFrom).toBeUndefined()
    expect(onDisk.profiles.find((p) => p.id === 'q')?.ownAI).toBe(true)
    expect(storeJson()[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-p' } })
  })
})

describe('a settings file from before the behaviour followed the general AI (4.5x)', () => {
  // A settled general AI (own keychain entry) with only its engine counting, and
  // each profile's styles on the profile — 'own' with an AI of its own.
  const withStyle = (id: string, extra: Partial<AIConfig>, own = false): Profile => ({
    ...profile(id),
    ai: { ...anthropic(), ...extra },
    ...(own ? { ownAI: true } : {})
  })
  const file = {
    ...defaultSettings(),
    onboardingCompleted: true,
    ai: anthropic(),
    profiles: [
      withStyle('home', { commitStyle: 'gitmoji' }),
      withStyle('work', { commitStyle: 'haiku', customInstructions: 'cite tickets' }),
      withStyle('own', { commitStyle: 'caveman' }, true)
    ],
    activeProfileId: 'work'
  }
  const store = { [GENERAL_AI_SECRETS_ID]: { aiKeys: { anthropic: 'sk-general' } }, own: { aiKeys: { anthropic: 'sk-own' } } }

  it('moves the active profile’s behaviour onto the general AI once, keys untouched', async () => {
    const mod = await startOn(file, store)
    const locked = (await call('settings:get')) as AppSettings
    expect(locked.aiBehaviourShared).toBe(true)
    expect(locked.ai.commitStyle).toBe('haiku')
    expect(locked.ai.customInstructions).toBe('cite tickets')
    expect(await mod.activeProfileAiKey('anthropic')).toBe('sk-general')

    const unlocked = (await call('settings:unlock')) as AppSettings
    expect(unlocked.ai.accounts[0].apiKey).toBe('sk-general')
    const own = unlocked.profiles.find((p) => p.id === 'own')!
    expect(own.ownAI).toBe(true)
    expect(own.ai.commitStyle).toBe('caveman')
    expect(own.ai.accounts[0].apiKey).toBe('sk-own')

    // Saved, the marker is on disk; switched to another profile and restarted,
    // nothing is copied again.
    await call('settings:set', { ...unlocked, activeProfileId: 'home' })
    const onDisk = JSON.parse(readFileSync(settingsFile(), 'utf8')) as AppSettings
    expect(onDisk.aiBehaviourShared).toBe(true)
    expect(onDisk.ai.commitStyle).toBe('haiku')
    expect(JSON.stringify(onDisk)).not.toContain('sk-general')
    await restart()
    const again = (await call('settings:unlock')) as AppSettings
    expect(again.activeProfileId).toBe('home')
    expect(again.ai.commitStyle).toBe('haiku')
    expect(again.ai.accounts[0].apiKey).toBe('sk-general')
    expect(storeJson()[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-general' } })
    expect(storeJson().own).toEqual({ aiKeys: { anthropic: 'sk-own' } })
  })
})
