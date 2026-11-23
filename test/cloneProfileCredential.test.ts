import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'

// A provider tab whose profile sent no token clones anonymously, as it always
// did; only Clone → URL on a configured Data Center resolves a token in main.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-clone-profile-'))

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: () => undefined, on: () => undefined },
  dialog: {},
  shell: { openExternal: () => undefined },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error('stubbed')
    },
    decryptString: () => {
      throw new Error('stubbed')
    }
  }
}))

const WORK_GITLAB = 'work-gitlab-token'
const PERSONAL_GITLAB = 'personal-gitlab-token'
const WORK_BBS = 'work-bbs-token'
const PERSONAL_BBS = 'personal-bbs-token'
const BBS = 'https://bitbucket.example.corp'
const GITLAB_REPO = 'https://gitlab.com/team/app.git'
const BBS_REPO = 'https://bitbucket.example.corp/scm/proj/app.git'

describe('cloneCredentialEnv — when a clone signs in, and as whom', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    const base = defaultSettings()
    writeFileSync(
      join(dir, 'gitcito-settings.json'),
      JSON.stringify({
        ...base,
        onboardingCompleted: true,
        activeProfileId: 'work',
        profiles: [
          {
            ...base.profiles[0],
            id: 'work',
            name: 'Work',
            gitlabToken: WORK_GITLAB,
            bitbucketServers: [{ url: BBS, token: WORK_BBS, username: 'worker' }]
          },
          {
            ...base.profiles[0],
            id: 'personal',
            name: 'Personal',
            gitlabToken: PERSONAL_GITLAB,
            bitbucketServers: [{ url: BBS, token: PERSONAL_BBS, username: 'me' }]
          },
          { ...base.profiles[0], id: 'empty', name: 'Empty', gitlabToken: '' }
        ]
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings()
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('a GitLab tab clone that sent no token gets no credential, not the active profile’s', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    expect(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', '')).toBeNull()
    expect(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', '   ')).toBeNull()
    expect(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', undefined)).toBeNull()
  })

  it('a Data Center tab clone that sent no token gets no credential either', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    expect(await cloneCredentialEnv(BBS_REPO, 'bitbucket', undefined)).toBeNull()
  })

  // The dialog then pins the new repository to that profile, so it is cloned
  // and later fetched as the same account.
  it('Clone → URL on a configured Data Center signs in as the profile picked in the dialog', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv(BBS_REPO, undefined, undefined, 'personal')) ?? {}
    expect(JSON.stringify(env)).toContain(PERSONAL_BBS)
    expect(JSON.stringify(env)).not.toContain(WORK_BBS)
    expect(Object.values(env)).toContain('me')
  })

  it('Clone → URL with an unknown or empty profile id gets nothing — not the active profile, not the first', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    expect(await cloneCredentialEnv(BBS_REPO, undefined, undefined, 'gone')).toBeNull()
    expect(await cloneCredentialEnv(BBS_REPO, undefined, undefined, '')).toBeNull()
    expect(await cloneCredentialEnv(BBS_REPO, undefined, undefined, '  ')).toBeNull()
    // A profile with no entry for that server.
    expect(await cloneCredentialEnv(BBS_REPO, undefined, undefined, 'empty')).toBeNull()
  })

  it('a provider-tab clone ignores the URL tab’s profile id', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    expect(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', '', 'personal')).toBeNull()
    const env = JSON.stringify(await cloneCredentialEnv(BBS_REPO, 'bitbucket', 'sent', 'personal'))
    expect(env).toContain(WORK_BBS)
    expect(env).not.toContain(PERSONAL_BBS)
  })

  // With no profile named (an older caller), the active one — the rule every
  // other Data Center call uses.
  it('Clone → URL on a configured Data Center with no profile named signs in as the active profile', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv(BBS_REPO, undefined, undefined)) ?? {}
    expect(JSON.stringify(env)).toContain(WORK_BBS)
    expect(JSON.stringify(env)).not.toContain(PERSONAL_BBS)
    expect(Object.values(env)).toContain('worker')
    // An address under no configured server gets nothing.
    expect(await cloneCredentialEnv('https://elsewhere.example/scm/proj/app.git', undefined, undefined)).toBeNull()
  })
})
