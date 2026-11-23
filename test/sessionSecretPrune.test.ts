import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { EventEmitter } from 'events'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import { migrateAIConfig } from '../src/shared/aiAccounts'
import { bootLoaded, settingsIpc } from './settingsIpc'

// With the keychain declined, a typed token lives only in memory for the
// session. A save that removed its server pruned the encrypted store but not
// that memory copy, so adding the same URL back brought the token back with it.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-session-prune-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString().replace(/^enc:/, '')
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const ipc = settingsIpc(handlers)
const callFrom = (sender: number, channel: string, ...args: unknown[]): Promise<unknown> =>
  ipc({ sender: { id: sender } }, channel, ...args)
/** The app's window. */
const call = (channel: string, ...args: unknown[]): Promise<unknown> => callFrom(1, channel, ...args)

const GHES = 'https://ghe.corp.example'
const GITLAB = 'https://gitlab.corp.example'

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultSettings().profiles[0], id: 'p', ...over })
const settingsWith = (profile: Profile): AppSettings => ({ ...defaultSettings(), onboardingCompleted: true, profiles: [profile] })

describe('session-only tokens follow the server list (keychain declined)', () => {
  beforeEach(async () => {
    for (const f of ['gitcito-settings.json', 'gitcito-secrets.enc']) rmSync(join(dir, f), { force: true })
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    vi.resetModules()
    handlers.clear()
    const { registerSettingsHandlers } = await import('../src/main/settings')
    registerSettingsHandlers()
    await bootLoaded(handlers)
  })

  // Every token kind a profile carries, all through the same session path.
  const FORGEJO = 'https://forgejo.corp.example'
  const DC = 'https://bbs.corp.example'
  const everyToken = (v: (name: string) => string): Profile => {
    const base = profileWith({})
    const ai = migrateAIConfig(base.ai)
    return profileWith({
      githubToken: v('gh'),
      gitlabToken: v('gl'),
      bitbucketToken: v('bb'),
      azureToken: v('az'),
      forgejoUrl: FORGEJO,
      forgejoTokenIssuer: FORGEJO,
      forgejoToken: v('fj'),
      githubEnterprise: [{ url: GHES, token: v('ghes') }],
      gitlabServers: [{ url: GITLAB, token: v('glsrv') }],
      bitbucketServers: [{ url: DC, token: v('dc') }],
      ai: { ...ai, accounts: ai.accounts.map((a) => ({ ...a, apiKey: v('ai') })) }
    })
  }
  const tokensOf = (p: Profile): string[] => [
    p.githubToken,
    p.gitlabToken,
    p.bitbucketToken,
    p.azureToken,
    p.forgejoToken,
    p.githubEnterprise?.[0]?.token ?? 'missing',
    p.gitlabServers?.[0]?.token ?? 'missing',
    p.bitbucketServers?.[0]?.token ?? 'missing',
    migrateAIConfig(p.ai).accounts[0]?.apiKey ?? 'missing'
  ]
  const KINDS = ['gh', 'gl', 'bb', 'az', 'fj', 'ghes', 'glsrv', 'dc', 'ai']
  const typed = (n: string): string => `${n}-session`

  it('a token the renderer held and sent back empty is cleared — every kind, at once', async () => {
    await call('settings:get')
    await call('settings:set', settingsWith(everyToken(typed)))
    expect(tokensOf(((await call('settings:get')) as AppSettings).profiles[0])).toEqual(KINDS.map(typed))
    await call('settings:set', settingsWith(everyToken(() => '')))
    expect(tokensOf(((await call('settings:get')) as AppSettings).profiles[0])).toEqual(KINDS.map(() => ''))
    const { activeProfileAuth } = await import('../src/main/settings')
    expect((await activeProfileAuth('github')).token).toBeUndefined()
    expect((await activeProfileAuth('azure')).token).toBeUndefined()
  })

  it('clearing one token keeps the others — each kind on its own', async () => {
    for (const cleared of KINDS) {
      await call('settings:set', settingsWith(everyToken(typed)))
      await call('settings:set', settingsWith(everyToken((n) => (n === cleared ? '' : typed(n)))))
      const after = tokensOf(((await call('settings:get')) as AppSettings).profiles[0])
      expect(after, cleared).toEqual(KINDS.map((n) => (n === cleared ? '' : typed(n))))
    }
  })

  it('a renderer that typed the tokens holds them, even without a settings read', async () => {
    await call('settings:set', settingsWith(everyToken(typed)))
    await call('settings:set', settingsWith(everyToken((n) => (n === 'gh' ? '' : typed(n)))))
    const { activeProfileAuth } = await import('../src/main/settings')
    expect((await activeProfileAuth('github')).token).toBeUndefined()
    expect((await activeProfileAuth('azure')).token).toBe(typed('az'))
  })

  it('a renderer that never held the session tokens cannot clear them by sending blanks', async () => {
    await call('settings:set', settingsWith(everyToken(typed)))
    // Another renderer (webContents 2): never served these settings, never typed
    // these tokens — its blanks are what it never had, not a clear.
    await callFrom(2, 'settings:set', settingsWith(everyToken(() => '')))
    const { activeProfileAuth } = await import('../src/main/settings')
    expect((await activeProfileAuth('azure')).token).toBe(typed('az'))
    // A token it does type is still added, and nothing it lacked is lost.
    await callFrom(2, 'settings:set', settingsWith(everyToken((n) => (n === 'gh' ? 'gh-new' : ''))))
    expect((await activeProfileAuth('github')).token).toBe('gh-new')
    expect((await activeProfileAuth('azure')).token).toBe(typed('az'))
    // The first renderer keeps its say over what it holds: its blanks clear the
    // tokens it typed — but not GitHub's, which the overlay replaced since.
    await call('settings:set', settingsWith(everyToken(() => '')))
    const merged = KINDS.map((n) => (n === 'gh' ? 'gh-new' : ''))
    expect(tokensOf(((await callFrom(2, 'settings:get')) as AppSettings).profiles[0])).toEqual(merged)
    // Once served them, its blanks count.
    await callFrom(2, 'settings:set', settingsWith(everyToken(() => '')))
    expect(tokensOf(((await call('settings:get')) as AppSettings).profiles[0])).toEqual(KINDS.map(() => ''))
  })

  for (const served of [false, true]) {
    it(`a removed server’s token does not come back with its URL${served ? ' (renderer served the secrets)' : ''}`, async () => {
      await call(
        'settings:set',
        settingsWith(
          profileWith({
            githubEnterprise: [{ url: GHES, token: 'ghes-session' }],
            gitlabServers: [{ url: GITLAB, token: 'gl-session' }]
          })
        )
      )
      // The saves below come from a second renderer: one never served the
      // session tokens (it sends GitLab's back blank, which must not clear it),
      // or one served them (it sends GitLab's back as it was given it).
      const kept = served ? 'gl-session' : ''
      if (served) {
        const first = (await callFrom(2, 'settings:get')) as AppSettings
        expect(first.profiles[0].githubEnterprise?.[0]?.token).toBe('ghes-session')
      }
      // Remove the GHES server; the GitLab server stays.
      await callFrom(2, 'settings:set', settingsWith(profileWith({ gitlabServers: [{ url: GITLAB, token: kept }] })))
      // Add the same URL again, with no token.
      await callFrom(
        2,
        'settings:set',
        settingsWith(
          profileWith({ githubEnterprise: [{ url: GHES, token: '' }], gitlabServers: [{ url: GITLAB, token: kept }] })
        )
      )
      const after = ((await call('settings:get')) as AppSettings).profiles[0]
      expect(after.githubEnterprise?.map((s) => s.token)).toEqual([''])
      expect(after.gitlabServers?.map((s) => s.token)).toEqual(['gl-session'])
    })
  }
})

// A renderer that reloads (or crashes) starts over holding nothing, and may save
// before it has read the settings again. Its blanks must not count as clears.
const RESETS = ['did-navigate', 'render-process-gone', 'destroyed'] as const

/** A stand-in webContents: an id and the events the main process watches. */
const fakeRenderer = (id: number): EventEmitter & { id: number } => Object.assign(new EventEmitter(), { id })
const callAs = (wc: EventEmitter & { id: number }, channel: string, ...args: unknown[]): Promise<unknown> =>
  ipc({ sender: wc }, channel, ...args)

describe('a reloaded renderer holds nothing until it is served again', () => {
  const restart = async (consent: 'declined' | 'granted'): Promise<void> => {
    for (const f of ['gitcito-settings.json', 'gitcito-secrets.enc']) rmSync(join(dir, f), { force: true })
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent, explained: true }))
    vi.resetModules()
    handlers.clear()
    const { registerSettingsHandlers } = await import('../src/main/settings')
    registerSettingsHandlers()
    await bootLoaded(handlers)
  }
  const tokens = (gh: string, glsrv: string): AppSettings =>
    settingsWith(profileWith({ githubToken: gh, gitlabServers: [{ url: GITLAB, token: glsrv }] }))
  // `settings:unlock`, as Settings does: a plain read never carries the decrypted store.
  const tokensNow = async (wc: EventEmitter & { id: number }): Promise<string[]> => {
    const p = ((await callAs(wc, 'settings:unlock')) as AppSettings).profiles[0]
    return [p.githubToken, p.gitlabServers?.[0]?.token ?? 'missing']
  }

  for (const reset of RESETS) {
    it(`session-only tokens (keychain declined) survive blanks after ${reset}`, async () => {
      await restart('declined')
      const wc = fakeRenderer(7)
      await callAs(wc, 'settings:set', tokens('gh-typed', 'gl-typed'))
      expect(await tokensNow(wc)).toEqual(['gh-typed', 'gl-typed'])
      wc.emit(reset)
      await callAs(wc, 'settings:set', tokens('', ''))
      const { activeProfileAuth } = await import('../src/main/settings')
      expect((await activeProfileAuth('github')).token).toBe('gh-typed')
      // Served again, its blanks are clears once more.
      expect(await tokensNow(wc)).toEqual(['gh-typed', 'gl-typed'])
      await callAs(wc, 'settings:set', tokens('', ''))
      expect(await tokensNow(wc)).toEqual(['', ''])
    })

    it(`stored tokens (keychain granted) survive blanks after ${reset}`, async () => {
      await restart('granted')
      const wc = fakeRenderer(8)
      await callAs(wc, 'settings:set', tokens('gh-stored', 'gl-stored'))
      expect(await tokensNow(wc)).toEqual(['gh-stored', 'gl-stored'])
      wc.emit(reset)
      await callAs(wc, 'settings:set', tokens('', ''))
      expect(await tokensNow(wc)).toEqual(['gh-stored', 'gl-stored'])
      await callAs(wc, 'settings:set', tokens('', ''))
      expect(await tokensNow(wc)).toEqual(['', ''])
    })
  }
})
