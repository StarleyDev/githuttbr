import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'
import {
  httpsFormOf,
  remoteServerUnmatched,
  remoteUnmatchedReason,
  resolveRemoteProvider,
  type ServerRegistry
} from '../src/shared/remoteProvider'
import { ambiguousRemotePath } from '../src/shared/remotePath'
import {
  bitbucketBaseOfRemote,
  bitbucketServerRepoOf,
  bitbucketServerUrlProblem,
  isBitbucketCloudHost
} from '../src/shared/bitbucketServer'
import { gitlabInstanceOf, gitlabServerUrlProblem, instanceOf, isGitlabComHost } from '../src/shared/gitlabInstance'
import {
  githubBaseOfRemote,
  githubEnterpriseUrlProblem,
  githubInstanceOf,
  isGithubComHost
} from '../src/shared/githubEnterprise'

// One hostname, three servers: a self-managed GitLab at its root, a Bitbucket
// Data Center on its own port, and another under a context path. Matching on the
// hostname alone read both Data Centers as the GitLab — the wrong provider for
// push and clone, and for the one under the context path, the GitLab server's
// token offered for the Data Center's URL.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-provider-detection-'))

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

const GITLAB = 'https://git.corp'
const DC_PORT = 'https://git.corp:7990'
const DC_PATH = 'https://git.corp/bitbucket'
const GITLAB_TOKEN = 'gitlab-server-token'
const DC_PORT_TOKEN = 'dc-port-token'
const DC_PATH_TOKEN = 'dc-path-token'

const GITLAB_REPO = 'https://git.corp/group/app.git'
const DC_PORT_REPO = 'https://git.corp:7990/scm/proj/app.git'
const DC_PATH_REPO = 'https://git.corp/bitbucket/scm/proj/app.git'
// An ssh:// remote on a port that is neither 22 nor 7999: nothing decides between them.
const SSH_AMBIGUOUS = 'ssh://git@git.corp:2222/proj/app.git'
// The scp form cannot reach the Data Center's 7999: it is the GitLab's.
const SCP_GITLAB = 'git@git.corp:group/app.git'
// Neither can ssh:// with no port, or with 22 — the same daemon scp reaches.
const SSH_GITLAB = ['ssh://git@git.corp/group/app.git', 'ssh://git@git.corp:22/group/app.git']
const GITHUB_TOKEN = 'github-com-token'
const BITBUCKET_TOKEN = 'bitbucket-cloud-token'
const GITLAB_COM_TOKEN = 'gitlab-com-token'
// Paths a proxy in front of git.corp could route to the GitLab at the root
// while a decoding matcher read them as the Data Center under /bitbucket — or
// the other way round. Each belongs to no server.
const AMBIGUOUS_PATHS = [
  'https://git.corp/bitbucket%2F..%2Fgroup/app.git',
  'https://git.corp/bitbucket%2Fscm/proj/app.git',
  'https://git.corp/bitbucket%2fscm/proj/app.git',
  'https://git.corp/bitbucket/scm/proj/%2E%2E/%2e%2e/group/app.git',
  'https://git.corp/bitbucket/%2e./group/app.git',
  'https://git.corp/bitbucket/scm/../../group/app.git',
  'https://git.corp/bitbucket/./scm/proj/app.git',
  'https://git.corp/bitbucket\\scm\\proj\\app.git',
  'https://git.corp/bitbucket%5Cscm/proj/app.git',
  'https://git.corp/bitbuck%65t/scm/proj/app.git',
  'https://git.corp/group/app%zz.git'
]
const AZURE_TOKEN = 'azure-pat'

describe('provider detection — a Data Center sharing a hostname with a GitLab', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    const base = defaultSettings()
    writeFileSync(
      join(dir, 'gitcito-settings.json'),
      JSON.stringify({
        ...base,
        onboardingCompleted: true,
        activeProfileId: 'work',
        repoProfiles: { '/bound': 'work' },
        profiles: [
          {
            ...base.profiles[0],
            id: 'work',
            name: 'Work',
            azureToken: AZURE_TOKEN,
            githubToken: GITHUB_TOKEN,
            bitbucketToken: BITBUCKET_TOKEN,
            gitlabToken: GITLAB_COM_TOKEN,
            gitlabServers: [{ url: GITLAB, token: GITLAB_TOKEN }],
            bitbucketServers: [
              { url: DC_PORT, token: DC_PORT_TOKEN, username: 'dc-user' },
              { url: DC_PATH, token: DC_PATH_TOKEN, username: 'dc-user' }
            ]
          }
        ]
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings()
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('each https URL resolves to its own provider', async () => {
    const { hostFromUrl } = await import('../src/main/git')
    expect(hostFromUrl(GITLAB_REPO)).toBe('gitlab')
    expect(hostFromUrl(DC_PORT_REPO)).toBe('bitbucket')
    expect(hostFromUrl(DC_PATH_REPO)).toBe('bitbucket')
  })

  it('parseRemoteUrl reads each URL as its own server', async () => {
    const { parseRemoteUrl } = await import('../src/main/hosting')
    expect(parseRemoteUrl(GITLAB_REPO)).toMatchObject({ provider: 'gitlab', owner: 'group', repo: 'app', base: GITLAB })
    expect(parseRemoteUrl(DC_PORT_REPO)).toMatchObject({ provider: 'bitbucket', owner: 'PROJ', repo: 'app', base: DC_PORT })
    expect(parseRemoteUrl(DC_PATH_REPO)).toMatchObject({ provider: 'bitbucket', owner: 'PROJ', repo: 'app', base: DC_PATH })
  })

  it('a push or fetch signs in with each server’s own token', async () => {
    const { profileCredentialForUrl } = await import('../src/main/remoteAuthCheck')
    const repo = join(dir, 'not-bound')
    expect((await profileCredentialForUrl(repo, GITLAB_REPO)).credential?.token).toBe(GITLAB_TOKEN)
    expect((await profileCredentialForUrl(repo, DC_PORT_REPO)).credential?.token).toBe(DC_PORT_TOKEN)
    expect((await profileCredentialForUrl(repo, DC_PATH_REPO)).credential?.token).toBe(DC_PATH_TOKEN)
  })

  it('a clone of a Data Center URL gets its token, never the GitLab’s', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const port = JSON.stringify(await cloneCredentialEnv(DC_PORT_REPO, 'bitbucket', undefined))
    expect(port).toContain(DC_PORT_TOKEN)
    expect(port).not.toContain(GITLAB_TOKEN)
    const path = JSON.stringify(await cloneCredentialEnv(DC_PATH_REPO, 'bitbucket', undefined))
    expect(path).toContain(DC_PATH_TOKEN)
    expect(path).not.toContain(GITLAB_TOKEN)
    // Named as GitLab, a Data Center URL is refused outright.
    expect(await cloneCredentialEnv(DC_PATH_REPO, 'gitlab', undefined)).toBeNull()
    expect(await cloneCredentialEnv(DC_PORT_REPO, 'gitlab', undefined)).toBeNull()
    expect(JSON.stringify(await cloneCredentialEnv(GITLAB_REPO, 'gitlab', undefined))).toContain(GITLAB_TOKEN)
  })

  it('the GitLab server’s token is never offered for a URL under the Data Center’s context path', async () => {
    const { activeProfileAuth } = await import('../src/main/settings')
    expect((await activeProfileAuth('gitlab', DC_PATH_REPO)).token).toBeUndefined()
    expect((await activeProfileAuth('gitlab', 'https://git.corp/bitbucket/projects/PROJ')).token).toBeUndefined()
    expect((await activeProfileAuth('gitlab', DC_PORT_REPO)).token).toBeUndefined()
    expect((await activeProfileAuth('gitlab', GITLAB_REPO)).token).toBe(GITLAB_TOKEN)
  })

  it('an ssh remote on the shared hostname is ambiguous: no provider, no token', async () => {
    const { hostFromUrl } = await import('../src/main/git')
    const { parseRemoteUrl } = await import('../src/main/hosting')
    const { activeProfileAuth } = await import('../src/main/settings')
    expect(hostFromUrl(SSH_AMBIGUOUS)).toBeUndefined()
    expect(parseRemoteUrl(SSH_AMBIGUOUS)).toBeNull()
    expect(await activeProfileAuth('gitlab', SSH_AMBIGUOUS)).toEqual({})
    expect(await activeProfileAuth('bitbucket', SSH_AMBIGUOUS)).toEqual({})
  })

  it('an scp remote on the shared hostname is the GitLab’s: scp cannot reach port 7999', async () => {
    const { hostFromUrl } = await import('../src/main/git')
    const { parseRemoteUrl } = await import('../src/main/hosting')
    const { activeProfileAuth } = await import('../src/main/settings')
    expect(hostFromUrl(SCP_GITLAB)).toBe('gitlab')
    expect(parseRemoteUrl(SCP_GITLAB)).toMatchObject({ provider: 'gitlab', owner: 'group', repo: 'app', base: GITLAB })
    expect((await activeProfileAuth('gitlab', SCP_GITLAB)).token).toBe(GITLAB_TOKEN)
    expect(await activeProfileAuth('bitbucket', SCP_GITLAB)).toEqual({})
  })

  it('ssh:// with no port or port 22 is the GitLab’s too: it reaches the daemon scp does', async () => {
    const { hostFromUrl } = await import('../src/main/git')
    const { activeProfileAuth } = await import('../src/main/settings')
    for (const url of SSH_GITLAB) {
      expect(hostFromUrl(url), url).toBe('gitlab')
      expect((await activeProfileAuth('gitlab', url)).token, url).toBe(GITLAB_TOKEN)
      expect(await activeProfileAuth('bitbucket', url), url).toEqual({})
    }
  })

  it('a path a proxy could read as another server’s gets no provider and no token', async () => {
    const { hostFromUrl } = await import('../src/main/git')
    const { activeProfileAuth } = await import('../src/main/settings')
    const { profileCredentialForUrl } = await import('../src/main/remoteAuthCheck')
    const repo = join(dir, 'not-bound')
    for (const url of AMBIGUOUS_PATHS) {
      expect(hostFromUrl(url), url).toBeUndefined()
      expect(await activeProfileAuth('gitlab', url), url).toEqual({})
      expect(await activeProfileAuth('bitbucket', url), url).toEqual({})
      expect((await profileCredentialForUrl(repo, url)).credential, url).toBeUndefined()
    }
    // An ordinary escape is still the GitLab's.
    expect((await activeProfileAuth('gitlab', 'https://git.corp/group/my%20app.git')).token).toBe(GITLAB_TOKEN)
  })

  it('a cloud token goes to its listed hosts only, never any subdomain', async () => {
    const { activeProfileAuth } = await import('../src/main/settings')
    const { hostFromUrl } = await import('../src/main/git')
    for (const url of ['https://x.github.com/o/r.git', 'git@evil.github.com:o/r.git', 'https://www.github.com/o/r.git']) {
      expect(hostFromUrl(url), url).toBeUndefined()
      expect((await activeProfileAuth('github', url)).token, url).toBeUndefined()
    }
    for (const url of ['https://x.bitbucket.org/w/r.git', 'git@evil.bitbucket.org:w/r.git']) {
      expect(hostFromUrl(url), url).toBeUndefined()
      expect((await activeProfileAuth('bitbucket', url)).token, url).toBeUndefined()
    }
    for (const url of ['https://pages.gitlab.com/g/r.git', 'git@evil.gitlab.com:g/r.git', 'https://www.gitlab.com/g/r.git']) {
      expect(hostFromUrl(url), url).toBeUndefined()
      expect((await activeProfileAuth('gitlab', url)).token, url).toBeUndefined()
    }
    expect((await activeProfileAuth('github', 'https://github.com/o/r.git')).token).toBe(GITHUB_TOKEN)
    expect((await activeProfileAuth('github', 'https://gist.github.com/abc123.git')).token).toBe(GITHUB_TOKEN)
    expect((await activeProfileAuth('bitbucket', 'https://bitbucket.org/w/r.git')).token).toBe(BITBUCKET_TOKEN)
    expect((await activeProfileAuth('gitlab', 'https://gitlab.com/g/r.git')).token).toBe(GITLAB_COM_TOKEN)
  })

  it('a clone from a cloud subdomain gets no token', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    expect(await cloneCredentialEnv('https://x.github.com/o/r.git', 'github', GITHUB_TOKEN)).toBeNull()
    expect(await cloneCredentialEnv('https://x.bitbucket.org/w/r.git', 'bitbucket', BITBUCKET_TOKEN)).toBeNull()
    expect(await cloneCredentialEnv('https://x.gitlab.com/g/r.git', 'gitlab', undefined)).toBeNull()
    expect(JSON.stringify(await cloneCredentialEnv('https://github.com/o/r.git', 'github', GITHUB_TOKEN))).toContain(GITHUB_TOKEN)
  })

  it('the Azure PAT goes only to an Azure DevOps remote', async () => {
    const { boundProfileAuth, activeProfileAuth } = await import('../src/main/settings')
    for (const url of [
      'https://dev.azure.com/org/proj/_git/app',
      'https://org.visualstudio.com/proj/_git/app',
      'git@ssh.dev.azure.com:v3/org/proj/app'
    ]) {
      expect((await boundProfileAuth('azure', '/bound', url))?.token, url).toBe(AZURE_TOKEN)
    }
    for (const url of ['https://evil.example/x.git', 'git@evil.example:x.git', GITLAB_REPO, 'C:/repos/app.git']) {
      expect(await boundProfileAuth('azure', '/bound', url), url).toEqual({})
      expect(await activeProfileAuth('azure', url), url).toEqual({})
    }
    // A provider-level call (no remote) still gets it.
    expect((await activeProfileAuth('azure')).token).toBe(AZURE_TOKEN)
  })

  it('ssh on the Data Center port 7999 is the Data Center', async () => {
    const { parseRemoteUrl } = await import('../src/main/hosting')
    expect(parseRemoteUrl('ssh://git@git.corp:7999/proj/app.git')).toMatchObject({ provider: 'bitbucket', owner: 'PROJ', repo: 'app' })
  })
})

describe('resolveRemoteProvider — the rule', () => {
  const reg = (over: Partial<ServerRegistry>): ServerRegistry => ({
    gitlab: [],
    forgejo: [],
    githubEnterprise: [],
    bitbucketServer: [],
    ...over
  })

  it('cloud hosts by hostname, whatever is configured', () => {
    const r = reg({ gitlab: [GITLAB] })
    expect(resolveRemoteProvider('git@github.com:o/r.git', r)).toEqual({ provider: 'github', base: 'https://github.com' })
    expect(resolveRemoteProvider('https://gitlab.com/g/r.git', r)).toEqual({ provider: 'gitlab', base: 'https://gitlab.com' })
    expect(resolveRemoteProvider('https://bitbucket.org/w/r.git', r)).toEqual({ provider: 'bitbucket', base: 'https://bitbucket.org' })
    expect(resolveRemoteProvider('https://dev.azure.com/o/p/_git/r', r)).toEqual({ provider: 'azure' })
    expect(resolveRemoteProvider('https://github.com.evil.net/o/r.git', r)).toBeNull()
  })

  it('https: the full base wins, longest context path first, across providers', () => {
    const r = reg({ gitlab: [GITLAB], forgejo: ['https://git.corp/forge'], bitbucketServer: [DC_PORT] })
    expect(resolveRemoteProvider('https://git.corp/forge/o/r.git', r)).toEqual({ provider: 'forgejo', base: 'https://git.corp/forge' })
    expect(resolveRemoteProvider('https://git.corp/forgery/r.git', r)).toEqual({ provider: 'gitlab', base: GITLAB })
    expect(resolveRemoteProvider(DC_PORT_REPO, r)).toEqual({ provider: 'bitbucket', base: DC_PORT })
  })

  it('https on a port or path no base covers: by hostname, without a base — or unknown when shared', () => {
    expect(resolveRemoteProvider('https://git.corp:8443/g/r.git', reg({ gitlab: [GITLAB] }))).toEqual({ provider: 'gitlab' })
    expect(resolveRemoteProvider('https://git.corp:8443/g/r.git', reg({ gitlab: [GITLAB], bitbucketServer: [DC_PORT] }))).toBeNull()
  })

  it('ssh: port 7999 → Data Center; one provider on the hostname → it; several → unknown', () => {
    const shared = reg({ gitlab: [GITLAB], bitbucketServer: [DC_PORT] })
    expect(resolveRemoteProvider('ssh://git@git.corp:7999/proj/r.git', shared)).toEqual({ provider: 'bitbucket', base: DC_PORT })
    expect(resolveRemoteProvider('ssh://git@git.corp:2222/g/r.git', shared)).toBeNull()
    expect(resolveRemoteProvider('git@git.corp:g/r.git', reg({ gitlab: [GITLAB] }))).toEqual({ provider: 'gitlab', base: GITLAB })
    expect(resolveRemoteProvider('ssh://git@git.corp:7999/g/r.git', reg({ gitlab: [GITLAB] }))).toEqual({ provider: 'gitlab', base: GITLAB })
  })

  it('ssh:// with no port or :22 reaches port 22, as scp does: a Data Center beside another provider drops out', () => {
    const shared = reg({ gitlab: [GITLAB], bitbucketServer: [DC_PORT] })
    expect(resolveRemoteProvider('ssh://git@git.corp/g/r.git', shared)).toEqual({ provider: 'gitlab', base: GITLAB })
    expect(resolveRemoteProvider('ssh://git@git.corp:22/g/r.git', shared)).toEqual({ provider: 'gitlab', base: GITLAB })
    expect(resolveRemoteProvider('git+ssh://git@git.corp/g/r.git', shared)).toEqual({ provider: 'gitlab', base: GITLAB })
    // 7999 is still the Data Center, and any other explicit port stays ambiguous.
    expect(resolveRemoteProvider('ssh://git@git.corp:7999/p/r.git', shared)).toEqual({ provider: 'bitbucket', base: DC_PORT })
    expect(resolveRemoteProvider('ssh://git@git.corp:2222/g/r.git', shared)).toBeNull()
    // Alone on its hostname, the Data Center keeps it.
    expect(resolveRemoteProvider('ssh://git@git.corp/p/r.git', reg({ bitbucketServer: [DC_PORT] }))).toEqual({
      provider: 'bitbucket',
      base: DC_PORT
    })
    // Two non-Data-Center providers still disagree.
    const two = reg({ gitlab: [GITLAB], forgejo: ['https://git.corp/forge'], bitbucketServer: [DC_PORT] })
    expect(resolveRemoteProvider('ssh://git@git.corp:22/g/r.git', two)).toBeNull()
  })

  it('cloud hosts by exact name: the listed hosts, never any subdomain', () => {
    const r = reg({})
    const GH = { provider: 'github', base: 'https://github.com' } as const
    const GL = { provider: 'gitlab', base: 'https://gitlab.com' } as const
    const BB = { provider: 'bitbucket', base: 'https://bitbucket.org' } as const
    expect(resolveRemoteProvider('https://gist.github.com/abc123.git', r)).toEqual(GH)
    expect(resolveRemoteProvider('ssh://git@ssh.github.com:443/o/r.git', r)).toEqual(GH)
    expect(resolveRemoteProvider('ssh://git@altssh.gitlab.com:443/g/r.git', r)).toEqual(GL)
    expect(resolveRemoteProvider('ssh://git@altssh.bitbucket.org:443/w/r.git', r)).toEqual(BB)
    for (const url of [
      'https://x.github.com/o/r.git',
      'https://www.github.com/o/r.git',
      'https://pages.github.com/o/r.git',
      'git@a.b.github.com:o/r.git',
      'https://x.gitlab.com/g/r.git',
      'https://www.gitlab.com/g/r.git',
      'https://x.bitbucket.org/w/r.git',
      'git@evil.bitbucket.org:w/r.git'
    ]) {
      expect(resolveRemoteProvider(url, r), url).toBeNull()
    }
    // ssh over 443 is asked about on the cloud's web host, not its ssh one.
    expect(httpsFormOf('ssh://git@ssh.github.com:443/o/r.git', GH)).toBe('https://github.com/o/r.git')
    expect(httpsFormOf('ssh://git@altssh.bitbucket.org:443/w/r.git', BB)).toBe('https://bitbucket.org/w/r.git')
  })

  it('host predicates: an allowlist for tokens, the whole domain for what Settings refuses', () => {
    for (const h of ['github.com', 'API.github.com', 'gist.github.com', 'ssh.github.com']) expect(isGithubComHost(h), h).toBe(true)
    for (const h of ['x.github.com', 'www.github.com', 'github.com.evil.net', 'notgithub.com']) expect(isGithubComHost(h), h).toBe(false)
    for (const h of ['gitlab.com', 'altssh.gitlab.com']) expect(isGitlabComHost(h), h).toBe(true)
    for (const h of ['x.gitlab.com', 'www.gitlab.com', 'mygitlab.com']) expect(isGitlabComHost(h), h).toBe(false)
    for (const h of ['bitbucket.org', 'api.bitbucket.org', 'altssh.bitbucket.org']) expect(isBitbucketCloudHost(h), h).toBe(true)
    for (const h of ['x.bitbucket.org', 'www.bitbucket.org', 'evilbitbucket.org']) expect(isBitbucketCloudHost(h), h).toBe(false)
    // Settings still refuses any cloud subdomain as a self-hosted server.
    expect(githubEnterpriseUrlProblem('https://x.github.com')).toBe('githubCom')
    expect(bitbucketServerUrlProblem('https://x.bitbucket.org')).toBe('cloud')
    expect(gitlabServerUrlProblem('https://www.gitlab.com')).toBe('gitlabCom')
    // And the per-provider matchers agree with the resolver.
    expect(githubBaseOfRemote('https://x.github.com/o/r.git', [])).toBeNull()
    expect(githubInstanceOf('git@x.github.com:o/r.git', [])).toBeNull()
    expect(githubInstanceOf('git@github.com:o/r.git', [])).toEqual({ base: 'https://github.com', owner: 'o', repo: 'r' })
    expect(bitbucketBaseOfRemote('https://x.bitbucket.org/w/r.git', [])).toBeNull()
    expect(bitbucketBaseOfRemote('https://bitbucket.org/w/r.git', [])).toBe('https://bitbucket.org')
  })

  it('a path a proxy could decode into another server’s belongs to none', () => {
    const r = reg({ gitlab: [GITLAB], bitbucketServer: [DC_PATH] })
    for (const url of AMBIGUOUS_PATHS) {
      expect(ambiguousRemotePath(url), url).toBe(true)
      expect(resolveRemoteProvider(url, r), url).toBeNull()
      expect(bitbucketServerRepoOf(url, [DC_PATH]), url).toBeNull()
      expect(bitbucketBaseOfRemote(url, [DC_PATH]), url).toBeNull()
      expect(instanceOf(url, [GITLAB]), url).toBeNull()
      expect(httpsFormOf(url), url).toBeNull()
    }
    // The same tricks on a cloud host or over ssh.
    for (const url of [
      'https://github.com/o%2F..%2Fx/r.git',
      'https://gitlab.com/g/%2e%2e/r.git',
      'git@git.corp:group/../app.git',
      'ssh://git@git.corp/group%2Fapp.git'
    ]) {
      expect(ambiguousRemotePath(url), url).toBe(true)
      expect(resolveRemoteProvider(url, r), url).toBeNull()
    }
    expect(githubInstanceOf('https://github.com/o%2F..%2Fx/r.git', [])).toBeNull()
    expect(gitlabInstanceOf('https://gitlab.com/g/%2e%2e/r.git', [])).toBeNull()
    // Ordinary escapes and plain paths still match, encoded or not.
    for (const url of ['https://git.corp/group/my%20app.git', 'https://git.corp/group/app.git', 'git@git.corp:~me/app.git']) {
      expect(ambiguousRemotePath(url), url).toBe(false)
    }
    expect(resolveRemoteProvider('https://git.corp/group/my%20app.git', r)).toEqual({ provider: 'gitlab', base: GITLAB })
    expect(resolveRemoteProvider(DC_PATH_REPO, r)).toEqual({ provider: 'bitbucket', base: DC_PATH })
    expect(bitbucketServerRepoOf(DC_PATH_REPO, [DC_PATH])).toMatchObject({ projectKey: 'PROJ', repoSlug: 'app' })
    expect(instanceOf('https://git.corp/group/my%20app.git', [GITLAB])).toEqual({ base: GITLAB, path: 'group/my app' })
    // A dotted name is not a dot segment.
    expect(ambiguousRemotePath('https://git.corp/group/.github.git')).toBe(false)
    expect(ambiguousRemotePath('https://git.corp/group/...git')).toBe(false)
  })

  it('two providers on the very same base are a misconfiguration: unknown', () => {
    expect(resolveRemoteProvider('https://git.corp/o/r.git', reg({ gitlab: [GITLAB], forgejo: [GITLAB] }))).toBeNull()
  })

  it('an unknown host is unknown', () => {
    expect(resolveRemoteProvider('https://elsewhere.example/o/r.git', reg({ gitlab: [GITLAB] }))).toBeNull()
  })

  it('scp has no port: beside one other provider, a Data Center does not count for it', () => {
    const shared = reg({ gitlab: [GITLAB], bitbucketServer: [DC_PORT] })
    expect(resolveRemoteProvider('git@git.corp:g/r.git', shared)).toEqual({ provider: 'gitlab', base: GITLAB })
    expect(resolveRemoteProvider('git.corp:g/r.git', shared)).toEqual({ provider: 'gitlab', base: GITLAB })
    // Alone on its hostname, the Data Center keeps it.
    expect(resolveRemoteProvider('git@git.corp:p/r.git', reg({ bitbucketServer: [DC_PORT] }))).toEqual({
      provider: 'bitbucket',
      base: DC_PORT
    })
    // Two non-Data-Center providers still disagree.
    const two = reg({ gitlab: [GITLAB], forgejo: ['https://git.corp/forge'], bitbucketServer: [DC_PORT] })
    expect(resolveRemoteProvider('git@git.corp:g/r.git', two)).toBeNull()
  })

  it('a Windows drive path is a local path, not an ssh host called c', () => {
    const r = reg({ gitlab: ['https://c'] })
    expect(resolveRemoteProvider('C:/repos/app.git', r)).toBeNull()
    expect(resolveRemoteProvider('c:\\repos\\app.git', r)).toBeNull()
    expect(httpsFormOf('C:/repos/app.git')).toBeNull()
    expect(httpsFormOf('D:\\work\\app')).toBeNull()
    // A one-letter ssh config alias is still a host.
    expect(httpsFormOf('c:team/app.git')).toBe('https://c/team/app.git')
  })

  it('remoteServerUnmatched: a configured hostname the rule cannot place', () => {
    const shared = reg({ gitlab: [GITLAB], bitbucketServer: [DC_PORT] })
    expect(remoteServerUnmatched('ssh://git@git.corp:2222/g/r.git', shared)).toBe(true)
    expect(remoteServerUnmatched('ssh://git@git.corp/g/r.git', shared)).toBe(false)
    expect(remoteServerUnmatched('git@git.corp:g/r.git', shared)).toBe(false)
    expect(remoteServerUnmatched('https://git.corp/g/r.git', shared)).toBe(false)
    expect(remoteServerUnmatched('git@elsewhere.example:g/r.git', shared)).toBe(false)
    expect(remoteServerUnmatched('git@github.com:o/r.git', shared)).toBe(false)
    expect(remoteServerUnmatched('C:/repos/app.git', shared)).toBe(false)
  })
})

describe('remoteUnmatchedReason — which hint the Pull requests section shows', () => {
  const reg = (over: Partial<ServerRegistry>): ServerRegistry => ({
    gitlab: [],
    forgejo: [],
    githubEnterprise: [],
    bitbucketServer: [],
    ...over
  })
  const shared = reg({ gitlab: [GITLAB], bitbucketServer: [DC_PORT] })

  it('ssh to a shared hostname: use the https remote', () => {
    expect(remoteUnmatchedReason('ssh://git@git.corp:2222/g/r.git', shared)).toBe('ssh')
    const two = reg({ gitlab: [GITLAB], forgejo: ['https://git.corp/forge'] })
    expect(remoteUnmatchedReason('git@git.corp:g/r.git', two)).toBe('ssh')
  })

  it('https on a base two providers configure: a Settings problem, not an https one', () => {
    const same = reg({ gitlab: [GITLAB], forgejo: [GITLAB] })
    expect(remoteUnmatchedReason('https://git.corp/o/r.git', same)).toBe('sharedBase')
  })

  it('anything else on a shared hostname: the generic hint', () => {
    expect(remoteUnmatchedReason('https://git.corp:8443/g/r.git', shared)).toBe('other')
    expect(remoteUnmatchedReason('http://git.corp/g/r.git', shared)).toBe('other')
    expect(remoteUnmatchedReason('git://git.corp/g/r.git', shared)).toBe('other')
    expect(remoteUnmatchedReason('https://git.corp/bitbucket%2Fscm/p/r.git', reg({ gitlab: [GITLAB] }))).toBe('other')
  })

  it('placed, or on no configured hostname: no hint at all', () => {
    expect(remoteUnmatchedReason('https://git.corp/g/r.git', shared)).toBeNull()
    expect(remoteUnmatchedReason('git@git.corp:g/r.git', shared)).toBeNull()
    expect(remoteUnmatchedReason('https://elsewhere.example/g/r.git', shared)).toBeNull()
    expect(remoteUnmatchedReason('git@github.com:o/r.git', shared)).toBeNull()
    expect(remoteUnmatchedReason('C:/repos/app.git', shared)).toBeNull()
  })
})

describe('httpsFormOf — the address a credential helper is asked about', () => {
  it('without a resolved server: the hostname and the path', () => {
    expect(httpsFormOf('git@github.com:o/r.git')).toBe('https://github.com/o/r.git')
    expect(httpsFormOf('ssh://git@host:22/o/r.git')).toBe('https://host/o/r.git')
    expect(httpsFormOf('https://host/o/r.git')).toBe('https://host/o/r.git')
    expect(httpsFormOf('git://host/o/r.git')).toBeNull()
    // Escapes are carried as written, not encoded twice.
    expect(httpsFormOf('ssh://git@host/o/my%20repo.git')).toBe('https://host/o/my%20repo.git')
    expect(httpsFormOf('git@host:o/my repo.git')).toBe('https://host/o/my%20repo.git')
  })

  it('on a resolved server: its base, with its web port and context path', () => {
    expect(httpsFormOf('git@git.corp:g/r.git', { provider: 'gitlab', base: 'https://git.corp/gitlab' })).toBe(
      'https://git.corp/gitlab/g/r.git'
    )
    expect(httpsFormOf('git@git.corp:o/r.git', { provider: 'github', base: 'https://git.corp:8443' })).toBe(
      'https://git.corp:8443/o/r.git'
    )
    expect(httpsFormOf('git@github.com:o/r.git', { provider: 'github', base: 'https://github.com' })).toBe(
      'https://github.com/o/r.git'
    )
  })

  it('a Data Center: its repositories live under /scm on the web side', () => {
    expect(httpsFormOf('ssh://git@git.corp:7999/proj/app.git', { provider: 'bitbucket', base: DC_PORT })).toBe(
      'https://git.corp:7990/scm/proj/app.git'
    )
    expect(httpsFormOf('ssh://git@git.corp:7999/proj/app.git', { provider: 'bitbucket', base: `${DC_PATH}/` })).toBe(
      'https://git.corp/bitbucket/scm/proj/app.git'
    )
    // bitbucket.org is not a Data Center.
    expect(httpsFormOf('git@bitbucket.org:w/r.git', { provider: 'bitbucket', base: 'https://bitbucket.org' })).toBe(
      'https://bitbucket.org/w/r.git'
    )
  })
})
