import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'
import { blanksOnly } from './credentialConfig'

// github.com, bitbucket.org and Azure: the clone dialog's provider tab lists as
// the picked profile, resolved in main (its PAT, else its linked login). The
// renderer's token is empty until Settings is opened, and always empty for a
// link-only profile — so the clone must resolve that same profile in main too,
// or git's own helper picks whichever account it likes.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-clone-linked-'))

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

// A linked login is answered by git's helper or the GitHub CLI; neither runs
// here. The helper's answer is the account the link names, so the test sees
// which profile's link reached it.
vi.mock('../src/main/credentials', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/main/credentials')>()
  return {
    ...real,
    apiToken: async (...args: Parameters<typeof real.apiToken>) => {
      const [url, auth] = args
      if (!auth.token?.trim() && auth.link) {
        const login = auth.link.login
        return { token: `helper-${login}`, cred: { protocol: 'https', host: new URL(url).host, username: login, password: `helper-${login}` }, source: 'git', login }
      }
      return real.apiToken(...args)
    }
  }
})

const PERSONAL = { github: 'personal-github', bitbucket: 'personal-bitbucket', azure: 'personal-azure' }
const WORK = { github: 'work-github', bitbucket: 'work-bitbucket', azure: 'work-azure', gitlab: 'work-gitlab' }
const GITLAB = 'https://gitlab.example.corp'

const CLOUD = [
  { url: 'https://github.com/team/app.git', host: 'github' as const },
  { url: 'https://bitbucket.org/team/app.git', host: 'bitbucket' as const },
  { url: 'https://dev.azure.com/acme/proj/_git/app', host: 'azure' as const }
]

describe('cloneCredentialEnv — a picked profile on github.com, bitbucket.org and Azure', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    const base = defaultSettings().profiles[0]
    writeFileSync(
      join(dir, 'gitcito-settings.json'),
      JSON.stringify({
        ...defaultSettings(),
        onboardingCompleted: true,
        activeProfileId: 'work',
        profiles: [
          {
            ...base,
            id: 'work',
            name: 'Work',
            githubToken: WORK.github,
            bitbucketToken: WORK.bitbucket,
            azureToken: WORK.azure,
            gitlabServers: [{ url: GITLAB, token: WORK.gitlab }],
            links: { github: { source: 'git', login: 'work-login' } }
          },
          {
            ...base,
            id: 'personal',
            name: 'Personal',
            githubToken: PERSONAL.github,
            bitbucketToken: PERSONAL.bitbucket,
            azureToken: PERSONAL.azure
          },
          { ...base, id: 'empty', name: 'Empty' },
          {
            ...base,
            id: 'linked',
            name: 'Linked',
            links: {
              github: { source: 'git', login: 'linked-me' },
              bitbucket: { source: 'git', login: 'linked-me' },
              azure: { source: 'git', login: 'linked-me' }
            }
          }
        ]
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings()
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('no token sent: the picked profile’s PAT, resolved in main — not the active one’s, not git’s choice', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    for (const c of CLOUD) {
      for (const sent of [undefined, '', '  ']) {
        const env = JSON.stringify(await cloneCredentialEnv(c.url, c.host, sent, 'personal'))
        expect(env, c.url).toContain(PERSONAL[c.host])
        expect(env, c.url).not.toContain('work-')
      }
    }
  })

  it('a link-only profile clones as the login it linked', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    for (const c of CLOUD) {
      const env = (await cloneCredentialEnv(c.url, c.host, '', 'linked')) ?? {}
      expect(Object.values(env), c.url).toContain('helper-linked-me')
      expect(JSON.stringify(env)).not.toContain('work-')
    }
  })

  it('a token the renderer sent — the picked profile’s — is still what goes', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = JSON.stringify(await cloneCredentialEnv(CLOUD[0].url, 'github', 'typed-now', 'personal'))
    expect(env).toContain('typed-now')
  })

  // Nothing to offer is not "let git decide": git's helper would answer with
  // whatever login the machine holds, and the repository would be bound to the
  // picked profile while cloned as that other account.
  it('an empty, unknown or credential-less id clones as nobody: no token, the host’s helpers blanked', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    for (const c of CLOUD) {
      const origin = new URL(c.url).origin
      for (const id of ['', '  ', 'gone', 'empty']) {
        const env = (await cloneCredentialEnv(c.url, c.host, '', id)) ?? {}
        expect(blanksOnly(env, origin), `${c.url} ${id}`).toBe(true)
        expect(env.GIT_ASKPASS).toBe('')
        expect(env.GIT_TERMINAL_PROMPT).toBe('0')
        expect(Object.keys(env).some((k) => k.startsWith('GITCITO_GIT_'))).toBe(false)
        expect(JSON.stringify(env)).not.toMatch(/work-|personal-|helper-/)
      }
      // The provider check failing for a named profile is just as anonymous.
      const other = (await cloneCredentialEnv(c.url, c.host === 'github' ? 'azure' : 'github', '', 'personal')) ?? {}
      expect(blanksOnly(other, origin)).toBe(true)
      expect(JSON.stringify(other)).not.toContain('personal-')
    }
  })

  it('no id at all keeps today’s behaviour: a cloud host gets nothing, git’s helpers as usual', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    for (const c of CLOUD) expect(await cloneCredentialEnv(c.url, c.host, '')).toBeNull()
  })

  // One rule at the IPC boundary: a string names a profile, anything else names
  // none — the active one, exactly as the repository and account lists read it.
  it('a non-string profile id means the active profile, not an unknown one', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    for (const id of [null, 42, {}]) {
      const env = JSON.stringify(await cloneCredentialEnv(`${GITLAB}/team/app.git`, 'gitlab', '', id))
      expect(env).toContain(WORK.gitlab)
    }
  })
})
