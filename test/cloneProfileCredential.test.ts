import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'
import { credentialEnvValues, revealCredentialEnv } from './helpers'
import { blanksOnly } from './credentialConfig'

// A server's token (GitLab, Forgejo, GitHub Enterprise, Data Center) is resolved
// in main from the profile picked in the clone dialog — the one the provider tab
// lists with and the new repository is bound to — or the active profile when no
// caller names one. The renderer's own token is gitlab.com's / bitbucket.org's,
// and it may hold none until Settings is opened. github.com, bitbucket.org and
// Azure clone with the renderer's token, or anonymously without one.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-clone-profile-'))

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
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    const base = defaultSettings()
    writeFileSync(
      join(dir, 'githuttbr-settings.json'),
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
      const env = revealCredentialEnv(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', sent))
      expect(env).toContain(WORK_GITLAB)
      expect(env).not.toContain(PERSONAL_GITLAB)
      expect(env).not.toContain('renderer-token')
    }
  })

  it('a Data Center tab clone likewise uses the active profile’s server token', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = revealCredentialEnv(await cloneCredentialEnv(BBS_REPO, 'bitbucket', undefined))
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
    expect(revealCredentialEnv(env)).toContain(PERSONAL_BBS)
    expect(revealCredentialEnv(env)).not.toContain(WORK_BBS)
    expect(credentialEnvValues(env)).toContain('me')
  })

  it('Clone → URL with an unknown or empty profile id clones as nobody — not the active profile, not the first', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    // The last one: a profile with no entry for that server.
    for (const id of ['gone', '', '  ', 'empty']) {
      expectAnonymous(await cloneCredentialEnv(BBS_REPO, undefined, undefined, id), BBS_REPO, WORK_BBS, PERSONAL_BBS)
    }
  })

  // The provider tab lists with the picked profile, and the dialog binds the
  // new repository to it: the clone must sign in as that profile too.
  it('a provider-tab clone signs in as the profile picked in the dialog, not the active one', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const gl = revealCredentialEnv(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', '', 'personal'))
    expect(gl).toContain(PERSONAL_GITLAB)
    expect(gl).not.toContain(WORK_GITLAB)
    const env = revealCredentialEnv(await cloneCredentialEnv(BBS_REPO, 'bitbucket', 'sent', 'personal'))
    expect(env).toContain(PERSONAL_BBS)
    expect(env).not.toContain(WORK_BBS)
  })

  it('a provider-tab clone with an unknown or empty profile id clones as nobody — not even with the token the renderer sent', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    for (const id of ['gone', '', '  ']) {
      const gh = 'https://github.com/team/app.git'
      expectAnonymous(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', 'renderer-token', id), GITLAB_REPO, 'renderer-token')
      expectAnonymous(await cloneCredentialEnv(gh, 'github', 'renderer-token', id), gh, 'renderer-token')
    }
  })

  // With no profile named (an older caller), the active one — the rule every
  // other Data Center call uses.
  it('Clone → URL on a configured Data Center with no profile named signs in as the active profile', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv(BBS_REPO, undefined, undefined)) ?? {}
    expect(revealCredentialEnv(env)).toContain(WORK_BBS)
    expect(revealCredentialEnv(env)).not.toContain(PERSONAL_BBS)
    expect(credentialEnvValues(env)).toContain('worker')
    // An address under no configured server gets nothing.
    expect(await cloneCredentialEnv('https://elsewhere.example/scm/proj/app.git', undefined, undefined)).toBeNull()
  })
})

/** Anonymous, not "nothing": the host's credential helpers are blanked, so the
 *  machine's credential manager cannot answer as another account. No token. */
function expectAnonymous(env: NodeJS.ProcessEnv | null, url: string, ...absent: string[]): void {
  expect(env, url).not.toBeNull()
  // As real git reads it, in whichever form the installed git takes.
  expect(blanksOnly(env, new URL(url).origin), url).toBe(true)
  expect(env!.GIT_ASKPASS, url).toBe('')
  for (const s of absent) expect(revealCredentialEnv(env), url).not.toContain(s)
}
