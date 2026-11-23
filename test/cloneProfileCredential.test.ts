import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'

// A clone authenticates as the profile picked in the clone dialog — the one the
// new repository is then bound to — never as whichever profile is active. And a
// provider tab whose profile has no token clones anonymously, as it always did.

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

describe('cloneCredentialEnv — which profile a clone signs in as', () => {
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

  it('a GitLab tab clone whose profile sent no token gets no credential, not the active profile’s', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    expect(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', '', 'empty')).toBeNull()
    expect(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', undefined)).toBeNull()
  })

  it('a GitLab tab clone uses the dialog’s profile’s token', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = JSON.stringify(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', PERSONAL_GITLAB, 'personal'))
    expect(env).toContain(PERSONAL_GITLAB)
    expect(env).not.toContain(WORK_GITLAB)
  })

  it('Clone → URL on a Data Center uses the dialog’s profile, else the active one', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const chosen = (await cloneCredentialEnv(BBS_REPO, undefined, undefined, 'personal')) ?? {}
    expect(JSON.stringify(chosen)).toContain(PERSONAL_BBS)
    expect(JSON.stringify(chosen)).not.toContain(WORK_BBS)
    expect(Object.values(chosen)).toContain('me')
    const active = (await cloneCredentialEnv(BBS_REPO, undefined, undefined)) ?? {}
    expect(JSON.stringify(active)).toContain(WORK_BBS)
    // A profile with no entry for that server gets nothing, not someone else's.
    expect(await cloneCredentialEnv(BBS_REPO, undefined, undefined, 'empty')).toBeNull()
  })
})
