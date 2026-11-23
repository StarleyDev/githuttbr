import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'

// A server's token (GitLab, Forgejo, GitHub Enterprise, Data Center) is resolved
// in main from the active profile — the one the provider tab lists with — since
// the renderer's own token is gitlab.com's / bitbucket.org's, and it may hold
// none until Settings is opened. github.com, bitbucket.org and Azure clone with
// the renderer's token, or anonymously without one. Clone → URL on a configured
// Data Center signs in as the profile picked in the dialog.

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

  it('a GitLab tab clone signs in with the active profile’s token — the one the tab listed with', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    for (const sent of ['', '   ', undefined, 'renderer-token']) {
      const env = JSON.stringify(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', sent))
      expect(env).toContain(WORK_GITLAB)
      expect(env).not.toContain(PERSONAL_GITLAB)
      expect(env).not.toContain('renderer-token')
    }
  })

  it('a Data Center tab clone likewise uses the active profile’s server token', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = JSON.stringify(await cloneCredentialEnv(BBS_REPO, 'bitbucket', undefined))
    expect(env).toContain(WORK_BBS)
    expect(env).not.toContain(PERSONAL_BBS)
  })

  it('github.com and bitbucket.org clone anonymously when the renderer sent no token', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    expect(await cloneCredentialEnv('https://github.com/team/app.git', 'github', '')).toBeNull()
    expect(await cloneCredentialEnv('https://bitbucket.org/team/app.git', 'bitbucket', undefined)).toBeNull()
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
    const gl = JSON.stringify(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', '', 'personal'))
    expect(gl).toContain(WORK_GITLAB)
    expect(gl).not.toContain(PERSONAL_GITLAB)
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
