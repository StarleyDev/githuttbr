import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GITLAB_COM, migrateGitlabProfile, migrateGitlabSettings } from '../src/shared/gitlabInstance'
import { applySecrets, extractSecrets, migrateGitlabSecrets, type SecretStore } from '../src/shared/secrets'
import { defaultProfile, defaultSettings, type AppSettings, type Profile } from '../src/shared/types'

// From one self-managed GitLab per profile (`gitlabUrl` + one token) to a list
// of servers. The shapes below are what builds before the list wrote: the
// settings JSON (tokens stripped, the issuer kept), the encrypted secrets store
// (the token beside its issuer), a pre-keychain plaintext file and exports with
// and without secrets. The encrypted path runs the real settings handlers on a
// reversible fake keyring.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-glmig-'))
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

const SELF = 'https://git.example.org'
const SUB = 'https://example.com/gitlab'
const TOKEN = 'glpat-legacy-self-managed'
const COM = 'glpat-legacy-gitlab-com'
const LINK = { source: 'git' as const, login: 'work-user' }

const legacy = (over: Partial<Profile> & Record<string, unknown>): Profile => ({ ...defaultProfile(), ...over }) as Profile

describe('a one-instance profile becomes a server list', () => {
  it('settings JSON as written to disk: the address becomes a server, the link goes with it', () => {
    const p = migrateGitlabProfile(legacy({ gitlabUrl: SELF, gitlabToken: '', gitlabTokenIssuer: SELF, links: { gitlab: LINK } }))
    expect(p).not.toHaveProperty('gitlabUrl')
    expect(p.gitlabServers).toEqual([{ url: SELF, token: '', link: LINK }])
    expect(p.gitlabToken).toBe('')
    expect(p.gitlabTokenIssuer).toBeUndefined()
    expect(p.links?.gitlab).toBeUndefined()
  })

  it('a plaintext file or an export with secrets: the token moves to its issuer', () => {
    const p = migrateGitlabProfile(legacy({ gitlabUrl: 'Git.Example.org/', gitlabToken: TOKEN, gitlabTokenIssuer: SELF }))
    expect(p.gitlabServers).toEqual([{ url: SELF, token: TOKEN }])
    expect(p.gitlabToken).toBe('')
  })

  it('an export without secrets: the server, no token', () => {
    const p = migrateGitlabProfile(legacy({ gitlabUrl: SELF, gitlabToken: '' }))
    expect(p.gitlabServers).toEqual([{ url: SELF, token: '' }])
  })

  it('keeps a relative URL root', () => {
    const p = migrateGitlabProfile(legacy({ gitlabUrl: `${SUB}/`, gitlabToken: TOKEN, gitlabTokenIssuer: SUB }))
    expect(p.gitlabServers).toEqual([{ url: SUB, token: TOKEN }])
  })

  it('gitlab.com, empty or unreadable addresses only lose the field — a gitlab.com token stays', () => {
    for (const gitlabUrl of ['', 'gitlab.com', 'http://insecure.example']) {
      const p = migrateGitlabProfile(legacy({ gitlabUrl, gitlabToken: COM, gitlabTokenIssuer: GITLAB_COM, links: { gitlab: LINK } }))
      expect(p).not.toHaveProperty('gitlabUrl')
      expect(p.gitlabServers).toBeUndefined()
      expect(p.gitlabToken).toBe(COM)
      expect(p.links?.gitlab).toEqual(LINK)
    }
  })

  it('never turns a token into another instance’s', () => {
    // Issued by a previous address: it was dead before, and stays out of every slot.
    const moved = migrateGitlabProfile(legacy({ gitlabUrl: SELF, gitlabToken: TOKEN, gitlabTokenIssuer: 'https://old.example' }))
    expect(moved.gitlabServers).toEqual([{ url: SELF, token: '' }])
    expect(moved.gitlabToken).toBe('')
    // No issuer next to a self-managed address: could be either, so it is not guessed to be gitlab.com's.
    const unknown = migrateGitlabProfile(legacy({ gitlabUrl: SELF, gitlabToken: TOKEN }))
    expect(unknown.gitlabToken).toBe('')
    expect(unknown.gitlabServers).toEqual([{ url: SELF, token: '' }])
    // A token gitlab.com issued stays gitlab.com's even beside a self-managed address.
    const com = migrateGitlabProfile(legacy({ gitlabUrl: SELF, gitlabToken: COM, gitlabTokenIssuer: GITLAB_COM }))
    expect(com.gitlabToken).toBe(COM)
    expect(com.gitlabServers).toEqual([{ url: SELF, token: '' }])
  })

  it('merges into a list that already names the server instead of adding it twice', () => {
    const p = migrateGitlabProfile(
      legacy({ gitlabUrl: SELF, gitlabToken: TOKEN, gitlabTokenIssuer: SELF, gitlabServers: [{ url: SELF, token: 'newer' }] })
    )
    expect(p.gitlabServers).toEqual([{ url: SELF, token: 'newer' }])
  })

  it('leaves a profile without the legacy field untouched', () => {
    const settings = defaultSettings()
    expect(migrateGitlabSettings(settings)).toBe(settings)
  })
})

describe('the encrypted store of a one-instance profile', () => {
  const store: SecretStore = { work: { gitlabToken: TOKEN, gitlabTokenIssuer: SELF, githubToken: 'ghp-kept' } }

  it('files the token under its instance, never as gitlab.com’s', () => {
    expect(migrateGitlabSecrets(store)).toEqual({ work: { githubToken: 'ghp-kept', gitlabServerTokens: { [SELF]: TOKEN } } })
  })

  it('restores onto the migrated server, and a later save writes the new shape', () => {
    const plain: AppSettings = {
      ...defaultSettings(),
      profiles: [legacy({ id: 'work', gitlabUrl: SELF, gitlabToken: '', gitlabTokenIssuer: SELF })]
    }
    const restored = applySecrets(plain, store)
    expect(restored.profiles[0].gitlabServers).toEqual([{ url: SELF, token: TOKEN }])
    expect(restored.profiles[0].gitlabToken).toBe('')
    expect(extractSecrets(restored).work).toEqual({ githubToken: 'ghp-kept', gitlabServerTokens: { [SELF]: TOKEN } })
  })

  it('a pre-instance token (no issuer) is gitlab.com’s, and never reaches a server', () => {
    const plain: AppSettings = { ...defaultSettings(), profiles: [legacy({ id: 'p', gitlabServers: [{ url: SELF, token: '' }] })] }
    const restored = applySecrets(plain, { p: { gitlabToken: 'pre-instance' } }).profiles[0]
    expect(restored.gitlabToken).toBe('pre-instance')
    expect(restored.gitlabServers?.[0].token).toBe('')
  })
})

describe('upgrading an install, through the real settings handlers', () => {
  const settingsFile = join(dir, 'gitcito-settings.json')
  const secretsFile = join(dir, 'gitcito-secrets.enc')
  const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))
  const readStore = (): SecretStore =>
    JSON.parse(Buffer.from(readFileSync(secretsFile, 'utf8'), 'base64').toString().replace(/^enc:/, '')) as SecretStore

  beforeAll(async () => {
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
    const base = defaultSettings()
    // Exactly what v4.36 left on disk for a profile on a company GitLab.
    writeFileSync(
      settingsFile,
      JSON.stringify({
        ...base,
        onboardingCompleted: true,
        activeProfileId: 'work',
        profiles: [
          {
            ...base.profiles[0],
            id: 'work',
            name: 'Work',
            gitlabToken: '',
            gitlabTokenIssuer: SELF,
            gitlabUrl: SELF,
            links: { gitlab: LINK }
          }
        ]
      })
    )
    const legacyStore: SecretStore = { work: { gitlabToken: TOKEN, gitlabTokenIssuer: SELF } }
    writeFileSync(secretsFile, Buffer.from(`enc:${JSON.stringify(legacyStore)}`).toString('base64'))
    const { registerSettingsHandlers } = await import('../src/main/settings')
    registerSettingsHandlers()
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('reads the old file as a server list, and keeps sending the token to that server only', async () => {
    const s = (await call('settings:get')) as AppSettings
    expect(s.profiles[0]).not.toHaveProperty('gitlabUrl')
    expect(s.profiles[0].gitlabServers).toEqual([{ url: SELF, token: '', link: LINK }])

    const { activeProfileAuth } = await import('../src/main/settings')
    expect(await activeProfileAuth('gitlab', `${SELF}/team/app.git`)).toEqual({ token: TOKEN, link: LINK })
    expect(await activeProfileAuth('gitlab', 'https://gitlab.com/team/app.git')).toEqual({})
  })

  it('a save from a renderer that never had the token does not lose it', async () => {
    const s = (await call('settings:get')) as AppSettings
    await call('settings:set', s)
    const onDisk = JSON.parse(readFileSync(settingsFile, 'utf8')) as AppSettings
    expect(onDisk.profiles[0]).not.toHaveProperty('gitlabUrl')
    expect(onDisk.profiles[0].gitlabServers).toEqual([{ url: SELF, token: '', link: LINK }])
    const unlocked = (await call('settings:unlock')) as AppSettings
    expect(unlocked.profiles[0].gitlabServers?.[0].token).toBe(TOKEN)
  })

  it('the next save from Settings rewrites the store in the new shape, nothing in the clear', async () => {
    const unlocked = (await call('settings:unlock')) as AppSettings
    await call('settings:set', unlocked)
    expect(readFileSync(settingsFile, 'utf8')).not.toContain(TOKEN)
    expect(readStore().work).toEqual({ gitlabServerTokens: { [SELF]: TOKEN } })
    const again = (await call('settings:unlock')) as AppSettings
    expect(again.profiles[0].gitlabServers).toEqual([{ url: SELF, token: TOKEN, link: LINK }])
    expect(again.profiles[0].gitlabToken).toBe('')
  })

  it('an old export imported later still lands on its server', async () => {
    // An import reaches main through settings:set, in whatever shape the file had.
    const current = (await call('settings:unlock')) as AppSettings
    const exported = {
      ...current,
      profiles: [
        ...current.profiles,
        { ...defaultProfile(), id: 'imported', name: 'Imported', gitlabUrl: SUB, gitlabToken: 'glpat-imported', gitlabTokenIssuer: SUB }
      ]
    }
    await call('settings:set', exported)
    const s = (await call('settings:unlock')) as AppSettings
    const imported = s.profiles.find((p) => p.id === 'imported')!
    expect(imported).not.toHaveProperty('gitlabUrl')
    expect(imported.gitlabServers).toEqual([{ url: SUB, token: 'glpat-imported' }])
    expect(readStore().imported).toEqual({ gitlabServerTokens: { [SUB]: 'glpat-imported' } })
    expect(readFileSync(settingsFile, 'utf8')).not.toContain('glpat-imported')
  })
})
