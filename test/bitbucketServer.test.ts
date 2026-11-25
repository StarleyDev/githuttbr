import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { credentialEnvValues, revealCredentialEnv } from './helpers'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BITBUCKET_CLOUD,
  bitbucketAuthFor,
  bitbucketBaseOfRemote,
  bitbucketServerBases,
  bitbucketServerBranchUrl,
  bitbucketServerCommitUrl,
  bitbucketServerCompareUrl,
  bitbucketServerCreatePrUrl,
  bitbucketServerDisplayAddress,
  bitbucketServerEndpoints,
  bitbucketServerGitUsername,
  bitbucketServerPullRequestUrl,
  bitbucketServerRepoOf,
  bitbucketServerRepoUrl,
  bitbucketServerUrlProblem,
  normalizeBitbucketServerUrl
} from '../src/shared/bitbucketServer'
import { applySecrets, extractSecrets, hasSettingsSecrets, mergeSecretStores, stripSettingsSecrets } from '../src/shared/secrets'
import { defaultProfile, defaultSettings, type Profile } from '../src/shared/types'
import {
  bbsCanMerge,
  bbsCiStatus,
  bbsMergeBlockers,
  bbsMergeRefusal,
  bbsMergeRefusedSilently,
  bbsStrategyFor,
  mapBbsActivities,
  mapBbsPull,
  mapBbsReviews,
  mergeBbsChanges
} from '../src/main/bitbucketServer'
import { isReviewableRemote } from '../src/renderer/src/lib/hosting'
import { blanksOnly } from './credentialConfig'
import type { TokenCheckResult } from '../src/shared/tokenCheck'

// Bitbucket Data Center: one resolver for every Data Center URL, a token that
// only ever reaches the server it was saved for, and call sites checked through
// the real IPC handlers against a fake fetch that answers in the documented
// shapes (developer.atlassian.com/server/bitbucket/rest/, OpenAPI 10.2).

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-bbs-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const opened: string[] = []

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: { openExternal: (url: string) => opened.push(url) },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => false,
    encryptStringAsync: async () => {
      throw new Error('stubbed')
    },
    decryptStringAsync: async () => {
      throw new Error('stubbed')
    }
  }
}))

const BBS = 'https://bitbucket.example.corp/bitbucket'
const BBS_B = 'https://bbs.other.example:8443'
const CLOUD_TOKEN = 'cloud-token'
const BBS_TOKEN = 'bbs-token-a'
const BBS_B_TOKEN = 'bbs-token-b'
const API = `${BBS}/rest/api/latest`
const REPO_API = `${API}/projects/PROJ/repos/app`

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultProfile(), ...over })

describe('normalizeBitbucketServerUrl', () => {
  it('accepts a bare host, a port and a context path, and canonicalises host case and the trailing slash', () => {
    expect(normalizeBitbucketServerUrl('Bitbucket.Example.Corp/bitbucket/')).toBe(BBS)
    expect(normalizeBitbucketServerUrl('https://bbs.other.example:8443')).toBe(BBS_B)
    expect(normalizeBitbucketServerUrl('bitbucket.internal')).toBe('https://bitbucket.internal')
    expect(normalizeBitbucketServerUrl('10.0.0.5:7990/scm-tools')).toBe('https://10.0.0.5:7990/scm-tools')
  })

  it('keeps the context path as typed: servlet paths are case-sensitive', () => {
    expect(normalizeBitbucketServerUrl('h.example/Bitbucket')).toBe('https://h.example/Bitbucket')
  })

  it('refuses http, credentials, queries, deep paths and bitbucket.org — each for its own reason', () => {
    expect(bitbucketServerUrlProblem('http://bitbucket.example.corp')).toBe('http')
    expect(bitbucketServerUrlProblem('ftp://bitbucket.example.corp')).toBe('invalid')
    expect(bitbucketServerUrlProblem('https://me:secret@bitbucket.example.corp')).toBe('credentials')
    expect(bitbucketServerUrlProblem('bitbucket.example.corp/?x=1')).toBe('path')
    expect(bitbucketServerUrlProblem('bitbucket.example.corp/#top')).toBe('path')
    // A pasted repository, clone or REST address is not a context path.
    expect(bitbucketServerUrlProblem('bitbucket.example.corp/projects/PROJ/repos/app')).toBe('path')
    expect(bitbucketServerUrlProblem('bitbucket.example.corp/bitbucket/scm/proj/app.git')).toBe('path')
    expect(bitbucketServerUrlProblem('bitbucket.example.corp/rest/api/1.0')).toBe('path')
    expect(bitbucketServerUrlProblem('bitbucket.example.corp/a/../b')).toBe('path')
    expect(bitbucketServerUrlProblem('bitbucket.example.corp/a b')).toBe('path')
    expect(bitbucketServerUrlProblem('bitbucket.org')).toBe('cloud')
    expect(bitbucketServerUrlProblem('api.bitbucket.org')).toBe('cloud')
    expect(bitbucketServerUrlProblem('')).toBe('invalid')
    expect(normalizeBitbucketServerUrl('http://bitbucket.example.corp')).toBeNull()
  })
})

describe('bitbucketServerEndpoints', () => {
  it('puts REST, build status and the web root under the context path', () => {
    expect(bitbucketServerEndpoints(BBS)).toEqual({
      apiBase: `${BBS}/rest/api/latest`,
      buildStatusBase: `${BBS}/rest/build-status/latest`,
      webBase: BBS
    })
    expect(bitbucketServerEndpoints(BBS_B).apiBase).toBe('https://bbs.other.example:8443/rest/api/latest')
  })

  it('throws on a malformed base instead of guessing', () => {
    expect(() => bitbucketServerEndpoints('http://bitbucket.example.corp')).toThrow()
    expect(() => bitbucketServerEndpoints('https://bitbucket.org')).toThrow()
  })
})

describe('bitbucketServerRepoOf — remotes', () => {
  const known = [BBS, BBS_B]

  it('parses an https clone URL under the context path, upper-casing the project key', () => {
    expect(bitbucketServerRepoOf('https://bitbucket.example.corp/bitbucket/scm/proj/app.git', known)).toEqual({
      base: BBS,
      projectKey: 'PROJ',
      repoSlug: 'app'
    })
    // The user name git writes into the URL does not matter; neither does `.git`.
    expect(bitbucketServerRepoOf('https://jdoe@bitbucket.example.corp/bitbucket/scm/PROJ/app', known)?.repoSlug).toBe('app')
  })

  it('needs the context path over https, and the port to match', () => {
    expect(bitbucketServerRepoOf('https://bitbucket.example.corp/scm/proj/app.git', known)).toBeNull()
    expect(bitbucketServerRepoOf('https://bbs.other.example:8443/scm/team/svc.git', known)?.base).toBe(BBS_B)
    expect(bitbucketServerRepoOf('https://bbs.other.example/scm/team/svc.git', known)).toBeNull()
  })

  it('parses ssh with the default 7999 port, with no context path, and scp-style', () => {
    expect(bitbucketServerRepoOf('ssh://git@bitbucket.example.corp:7999/proj/app.git', known)).toEqual({
      base: BBS,
      projectKey: 'PROJ',
      repoSlug: 'app'
    })
    expect(bitbucketServerRepoOf('ssh://git@bbs.other.example:7999/team/svc.git', known)?.base).toBe(BBS_B)
    expect(bitbucketServerRepoOf('git@bitbucket.example.corp:proj/app.git', known)?.projectKey).toBe('PROJ')
  })

  it('parses a personal repository (~user) over https and ssh', () => {
    expect(bitbucketServerRepoOf('https://bitbucket.example.corp/bitbucket/scm/~jdoe/scratch.git', known)).toEqual({
      base: BBS,
      projectKey: '~jdoe',
      repoSlug: 'scratch',
      user: 'jdoe'
    })
    expect(bitbucketServerRepoOf('ssh://git@bitbucket.example.corp:7999/~jdoe/scratch.git', known)?.user).toBe('jdoe')
  })

  it('never matches plain http, an unknown host, or a path of another shape', () => {
    expect(bitbucketServerRepoOf('http://bitbucket.example.corp/bitbucket/scm/proj/app.git', known)).toBeNull()
    expect(bitbucketServerRepoOf('https://git.example.org/scm/proj/app.git', known)).toBeNull()
    expect(bitbucketServerRepoOf('https://bitbucket.example.corp/bitbucket/scm/proj/sub/app.git', known)).toBeNull()
    expect(bitbucketServerRepoOf('https://bitbucket.example.corp/bitbucket/projects/PROJ/repos/app', known)).toBeNull()
  })

  it('picks the longest context path when two servers share a host', () => {
    const both = ['https://h.example', 'https://h.example/bitbucket']
    expect(bitbucketServerRepoOf('https://h.example/bitbucket/scm/p/r.git', both)?.base).toBe('https://h.example/bitbucket')
    expect(bitbucketServerRepoOf('https://h.example/scm/p/r.git', both)?.base).toBe('https://h.example')
  })

  it('tells Data Center, bitbucket.org and everything else apart', () => {
    expect(bitbucketBaseOfRemote('https://bitbucket.example.corp/bitbucket/scm/proj/app.git', known)).toBe(BBS)
    expect(bitbucketBaseOfRemote('git@bitbucket.org:team/app.git', known)).toBe(BITBUCKET_CLOUD)
    expect(bitbucketBaseOfRemote('https://bitbucket.org/team/app.git', known)).toBe(BITBUCKET_CLOUD)
    expect(bitbucketBaseOfRemote('https://evil.example/scm/proj/app.git', known)).toBeNull()
    expect(bitbucketBaseOfRemote('https://bitbucket.org.evil.example/team/app.git', known)).toBeNull()
  })
})

describe('web links', () => {
  const repo = { base: BBS, projectKey: 'PROJ', repoSlug: 'app' }
  const personal = { base: BBS, projectKey: '~jdoe', repoSlug: 'scratch', user: 'jdoe' }
  it('land under the server and its context path', () => {
    expect(bitbucketServerRepoUrl(repo)).toBe(`${BBS}/projects/PROJ/repos/app`)
    expect(bitbucketServerRepoUrl(personal)).toBe(`${BBS}/users/jdoe/repos/scratch`)
    expect(bitbucketServerCommitUrl(repo, 'abc123')).toBe(`${BBS}/projects/PROJ/repos/app/commits/abc123`)
    expect(bitbucketServerBranchUrl(repo, 'feature/x')).toBe(`${BBS}/projects/PROJ/repos/app/browse?at=refs%2Fheads%2Ffeature%2Fx`)
    expect(bitbucketServerPullRequestUrl(repo, 7)).toBe(`${BBS}/projects/PROJ/repos/app/pull-requests/7`)
    expect(bitbucketServerCompareUrl(repo, 'feature', 'main')).toBe(
      `${BBS}/projects/PROJ/repos/app/compare/commits?sourceBranch=refs%2Fheads%2Ffeature&targetBranch=refs%2Fheads%2Fmain`
    )
    expect(bitbucketServerCreatePrUrl(repo, 'feature', 'main')).toBe(
      `${BBS}/projects/PROJ/repos/app/pull-requests?create&sourceBranch=refs%2Fheads%2Ffeature&targetBranch=refs%2Fheads%2Fmain`
    )
  })
})

describe('token isolation (pure)', () => {
  const p = profileWith({
    bitbucketToken: CLOUD_TOKEN,
    links: { bitbucket: { source: 'git', login: 'me' } },
    bitbucketServers: [
      { url: 'Bitbucket.example.corp/bitbucket/', token: BBS_TOKEN, username: 'jdoe' },
      { url: BBS_B, token: BBS_B_TOKEN }
    ]
  })

  it('bitbucket.org gets the Cloud token and link, nothing else', () => {
    expect(bitbucketAuthFor(p, BITBUCKET_CLOUD)).toEqual({ token: CLOUD_TOKEN, link: { source: 'git', login: 'me' } })
  })

  it('each server gets only its own token (and user name), never a link', () => {
    expect(bitbucketAuthFor(p, BBS)).toEqual({ token: BBS_TOKEN, username: 'jdoe' })
    // No user name and no kind (every entry saved before the choice existed):
    // nothing is fixed, so git keeps the remote URL's name, else x-token-auth.
    expect(bitbucketAuthFor(p, BBS_B)).toEqual({ token: BBS_B_TOKEN })
  })

  // Atlassian, "HTTP access tokens": basic auth with a project or repository token
  // must send x-token-auth; a personal token stands in for its user's password.
  it('only an explicit kind changes the git user name; none is ever inferred', () => {
    const kinds = profileWith({
      bitbucketServers: [
        { url: BBS, token: BBS_TOKEN, username: 'jdoe', tokenKind: 'project' },
        { url: BBS_B, token: BBS_B_TOKEN, tokenKind: 'personal' }
      ]
    })
    expect(bitbucketAuthFor(kinds, BBS)).toEqual({ token: BBS_TOKEN, username: 'x-token-auth', tokenKind: 'project' })
    // A personal token with no name in Settings leaves the name to the remote URL.
    expect(bitbucketAuthFor(kinds, BBS_B)).toEqual({ token: BBS_B_TOKEN, tokenKind: 'personal' })
    // A kind with no token travels nowhere; an unknown one (a hand edit) is "not set".
    const odd = profileWith({ bitbucketServers: [{ url: BBS, token: BBS_TOKEN, tokenKind: 'robot' as never }] })
    expect(bitbucketAuthFor(odd, BBS)).toEqual({ token: BBS_TOKEN })
  })

  // Atlassian, "HTTP access tokens": basic auth with a project or repository token
  // must send x-token-auth; a personal token stands in for its user's password.
  it('not set: the Settings name, else the URL name, else x-token-auth — the behaviour from before the choice', () => {
    expect(bitbucketServerGitUsername('jdoe', 'jsmith')).toBe('jdoe')
    expect(bitbucketServerGitUsername('', 'jsmith')).toBe('jsmith')
    expect(bitbucketServerGitUsername(undefined, '')).toBe('x-token-auth')
  })

  it('project: always x-token-auth, whatever the Settings or URL name', () => {
    expect(bitbucketServerGitUsername('jdoe', 'jsmith', 'project')).toBe('x-token-auth')
    expect(bitbucketServerGitUsername(undefined, 'jsmith', 'project')).toBe('x-token-auth')
  })

  it('personal: the Settings name, else the URL name, never x-token-auth', () => {
    expect(bitbucketServerGitUsername('jdoe', 'jsmith', 'personal')).toBe('jdoe')
    expect(bitbucketServerGitUsername('  ', 'jsmith', 'personal')).toBe('jsmith')
    expect(bitbucketServerGitUsername(undefined, undefined, 'personal')).toBeNull()
  })

  it('a saved address that does not parse is shown without its credentials', () => {
    expect(bitbucketServerDisplayAddress('https://jdoe:hunter2@bbs.corp')).toBe('bbs.corp')
    expect(bitbucketServerDisplayAddress('http://jdoe:hunter2@bbs.corp/bitbucket')).toBe('bbs.corp/bitbucket')
    expect(bitbucketServerDisplayAddress('jdoe:hunter2@bbs.corp:7990/x')).toBe('bbs.corp:7990/x')
    expect(bitbucketServerDisplayAddress('https://jdoe:hun ter2@bad host/x')).not.toContain('hun')
    expect(bitbucketServerDisplayAddress('not a url')).toBe('not a url')
  })

  it('an address that does not parse shows no query or fragment either', () => {
    const shown = bitbucketServerDisplayAddress('https://host:99999/bitbucket?access_token=SECRET')
    expect(shown).toBe('host:99999/bitbucket')
    expect(bitbucketServerDisplayAddress('bad host/x#token=SECRET')).toBe('bad host/x')
  })

  // A `/` in the password ends the authority early for a URL parser: the
  // password used to survive as host and "path".
  it('a password with a slash in it is not shown either', () => {
    for (const raw of ['https://jdoe:pa/ss@bbs.corp/x', 'https://jdoe:12/34@bbs.corp', 'jdoe:a/b/c@bbs.corp:7990', 'https://u:p@ss:/w@rd@bbs.corp/b']) {
      const shown = bitbucketServerDisplayAddress(raw)
      expect(shown).not.toMatch(/pa|ss|34|a\/b|w@rd|jdoe|u:p/)
      expect(shown.startsWith('bbs.corp')).toBe(true)
    }
  })

  it('an unconfigured server, or the same host without its context path, gets nothing', () => {
    expect(bitbucketAuthFor(p, 'https://bitbucket.example.corp')).toEqual({})
    expect(bitbucketAuthFor(p, 'https://unknown.example')).toEqual({})
    expect(bitbucketAuthFor(p, 'not a url')).toEqual({})
  })

  it('git sends the configured user name, else x-token-auth', () => {
    expect(bitbucketServerGitUsername('jdoe')).toBe('jdoe')
    expect(bitbucketServerGitUsername('  ')).toBe('x-token-auth')
    expect(bitbucketServerGitUsername(undefined)).toBe('x-token-auth')
    expect(bitbucketServerGitUsername(undefined, 'jsmith')).toBe('jsmith')
    expect(bitbucketServerGitUsername('x-token-auth', 'jsmith')).toBe('x-token-auth')
  })

  it('collects the configured bases across profiles, de-duplicated', () => {
    expect(bitbucketServerBases([p, profileWith({ bitbucketServers: [{ url: 'BITBUCKET.example.corp/bitbucket', token: '' }] })])).toEqual([
      BBS,
      BBS_B
    ])
  })
})

describe('Data Center tokens in the encrypted store', () => {
  const settingsWith = (servers: Profile['bitbucketServers']): ReturnType<typeof defaultSettings> => ({
    ...defaultSettings(),
    profiles: [profileWith({ id: 'p', bitbucketServers: servers })]
  })

  it('are filed under their server and stripped from the plain settings (and exports)', () => {
    const settings = settingsWith([{ url: BBS, token: BBS_TOKEN, username: 'jdoe' }])
    expect(hasSettingsSecrets(settings)).toBe(true)
    const store = extractSecrets(settings)
    expect(store.p.bitbucketServerTokens).toEqual({ [BBS]: BBS_TOKEN })
    const plain = stripSettingsSecrets(settings)
    // The server and the user name are not secret; the token is.
    expect(plain.profiles[0].bitbucketServers).toEqual([{ url: BBS, token: '', username: 'jdoe' }])
    expect(JSON.stringify(plain)).not.toContain(BBS_TOKEN)
    expect(applySecrets(plain, store).profiles[0].bitbucketServers?.[0].token).toBe(BBS_TOKEN)
  })

  it('never restore a token onto a different server — not even the same host without the context path', () => {
    const store = extractSecrets(settingsWith([{ url: BBS, token: BBS_TOKEN }]))
    const moved = settingsWith([{ url: 'https://bitbucket.example.corp', token: '' }])
    expect(applySecrets(moved, store).profiles[0].bitbucketServers?.[0].token).toBe('')
  })

  it('a save that never held a server token does not drop it', () => {
    const stored = extractSecrets(settingsWith([{ url: BBS, token: BBS_TOKEN }]))
    const next = extractSecrets(settingsWith([{ url: BBS_B, token: BBS_B_TOKEN }]))
    expect(mergeSecretStores(stored, next).p.bitbucketServerTokens).toEqual({ [BBS]: BBS_TOKEN, [BBS_B]: BBS_B_TOKEN })
  })
})

describe('renderer recognition', () => {
  it('offers the PR page for a configured Data Center only', () => {
    const url = 'https://bitbucket.example.corp/bitbucket/scm/proj/app.git'
    expect(isReviewableRemote(url, [], [], [], [BBS])).toBe(true)
    expect(isReviewableRemote(url)).toBe(false)
  })
})

// ─── Documented response shapes ─────────────────────────────────────────────

const user = (name: string, displayName: string): Record<string, unknown> => ({
  name,
  emailAddress: `${name}@example.com`,
  id: 101,
  displayName,
  active: true,
  slug: name,
  type: 'NORMAL'
})

const ref = (branch: string, sha: string, key = 'PROJ', slug = 'app'): Record<string, unknown> => ({
  id: `refs/heads/${branch}`,
  displayId: branch,
  latestCommit: sha,
  type: 'BRANCH',
  repository: { slug, name: slug, project: { key } }
})

function pull(id: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    version: 3,
    title: `Change ${id}`,
    description: 'Does a thing.',
    state: 'OPEN',
    open: true,
    closed: false,
    draft: false,
    createdDate: 1700000000000,
    updatedDate: 1700000500000,
    fromRef: ref(`feature-${id}`, `sha${id}`),
    toRef: ref('main', 'base000'),
    locked: false,
    author: { user: user('dev', 'Dev Eloper'), role: 'AUTHOR', approved: false, status: 'UNAPPROVED' },
    reviewers: [
      { user: user('jdoe', 'Jane Doe'), role: 'REVIEWER', approved: false, status: 'UNAPPROVED' },
      { user: user('rev2', 'Second Reviewer'), role: 'REVIEWER', approved: true, status: 'APPROVED' }
    ],
    participants: [],
    links: { self: [{ href: `${BBS}/projects/PROJ/repos/app/pull-requests/${id}` }] },
    ...over
  }
}

const ACTIVITIES = {
  size: 3,
  limit: 100,
  isLastPage: true,
  start: 0,
  values: [
    {
      id: 3,
      createdDate: 1700000300000,
      user: user('rev2', 'Second Reviewer'),
      action: 'COMMENTED',
      commentAction: 'ADDED',
      comment: {
        id: 12,
        version: 0,
        text: 'This line is off by one.',
        author: user('rev2', 'Second Reviewer'),
        createdDate: 1700000300000,
        comments: [{ id: 13, version: 0, text: 'Fixed.', author: user('dev', 'Dev Eloper'), createdDate: 1700000400000, comments: [] }]
      },
      commentAnchor: { line: 4, lineType: 'ADDED', fileType: 'TO', path: 'src/a.ts', srcPath: 'src/a.ts' }
    },
    {
      id: 2,
      createdDate: 1700000200000,
      user: user('jdoe', 'Jane Doe'),
      action: 'COMMENTED',
      commentAction: 'ADDED',
      comment: { id: 11, version: 0, text: 'Looks good overall.', author: user('jdoe', 'Jane Doe'), createdDate: 1700000200000, comments: [] }
    },
    { id: 1, createdDate: 1700000000000, user: user('dev', 'Dev Eloper'), action: 'OPENED' }
  ]
}

const CHANGES = {
  size: 2,
  limit: 500,
  isLastPage: true,
  start: 0,
  values: [
    { type: 'MODIFY', nodeType: 'FILE', path: { components: ['src', 'a.ts'], name: 'a.ts', toString: 'src/a.ts' } },
    {
      type: 'MOVE',
      nodeType: 'FILE',
      path: { components: ['src', 'b.ts'], name: 'b.ts', toString: 'src/b.ts' },
      srcPath: { components: ['src', 'old.ts'], name: 'old.ts', toString: 'src/old.ts' }
    }
  ]
}

const RAW_DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,3 +1,4 @@',
  ' one',
  '-two',
  '+2',
  '+three',
  ''
].join('\n')

describe('mapping the documented shapes', () => {
  const repo = { base: BBS, projectKey: 'PROJ', repoSlug: 'app' }

  it('a pull request from the list', () => {
    expect(mapBbsPull(pull(7) as never, repo)).toEqual({
      id: 7,
      title: 'Change 7',
      author: 'dev',
      sourceBranch: 'feature-7',
      targetBranch: 'main',
      url: `${BBS}/projects/PROJ/repos/app/pull-requests/7`,
      isDraft: false,
      state: 'open',
      headSha: 'sha7',
      // Only the reviewer who has not answered yet.
      requestedReviewers: ['jdoe']
    })
  })

  it('a pull request from a fork names the fork', () => {
    expect(mapBbsPull(pull(8, { fromRef: ref('f', 'x', '~DEV', 'app') }) as never, repo).headRepo).toBe('~DEV/app')
  })

  it('activities become the conversation and the line threads, oldest first', () => {
    const { comments, reviewThreads } = mapBbsActivities(ACTIVITIES.values as never)
    expect(comments).toEqual([{ author: 'jdoe', body: 'Looks good overall.', createdAt: new Date(1700000200000).toISOString() }])
    expect(reviewThreads).toHaveLength(1)
    expect(reviewThreads[0]).toMatchObject({ path: 'src/a.ts', line: 4, rootId: 12 })
    expect(reviewThreads[0].comments.map((c) => c.body)).toEqual(['This line is off by one.', 'Fixed.'])
  })

  it('reviewer statuses become review verdicts', () => {
    const pr = pull(7, {
      reviewers: [
        { user: user('a', 'A'), role: 'REVIEWER', approved: true, status: 'APPROVED' },
        { user: user('b', 'B'), role: 'REVIEWER', approved: false, status: 'NEEDS_WORK' },
        { user: user('c', 'C'), role: 'REVIEWER', approved: false, status: 'UNAPPROVED' }
      ]
    })
    expect(mapBbsReviews(pr as never)).toEqual([
      { author: 'a', state: 'APPROVED' },
      { author: 'b', state: 'CHANGES_REQUESTED' }
    ])
  })

  it('mergeability, from the documented example and from the 10.2 schema (no canMerge)', () => {
    const vetoed = {
      canMerge: false,
      conflicted: true,
      outcome: 'CONFLICTED',
      vetoes: [{ summaryMessage: 'You may not merge after 6pm on a Friday.', detailedMessage: 'Please try again on Monday.' }]
    }
    expect(bbsCanMerge(vetoed as never)).toBe(false)
    expect(bbsMergeRefusal(vetoed as never)).toEqual({
      code: 'conflictsVetoed',
      vetoes: ['You may not merge after 6pm on a Friday. — Please try again on Monday.']
    })
    expect(bbsCanMerge({ conflicted: false, outcome: 'CLEAN', vetoes: [] })).toBe(true)
    // A veto blocks the merge but is not a conflict: it travels as a blocker, in the server's words.
    const checks = { canMerge: false, conflicted: false, outcome: 'CLEAN' as const, vetoes: [{ summaryMessage: 'Needs 2 approvals' }] }
    expect(bbsCanMerge(checks)).toBe(true)
    expect(bbsMergeBlockers(checks)).toEqual(['Needs 2 approvals'])
    expect(bbsMergeRefusal(checks)).toEqual({ code: 'vetoed', vetoes: ['Needs 2 approvals'] })
    expect(bbsCanMerge({ outcome: 'UNKNOWN' })).toBeNull()
    expect(bbsCanMerge(null)).toBeNull()
    expect(bbsMergeBlockers(null)).toEqual([])
    expect(bbsMergeRefusal({ canMerge: true, vetoes: [] })).toBeNull()
    expect(bbsMergeRefusal({ canMerge: false, conflicted: false, vetoes: [] })).toEqual({ code: 'notAllowed', vetoes: [] })
    expect(bbsMergeRefusal({ canMerge: false, conflicted: true, vetoes: [] })).toEqual({ code: 'conflicts', vetoes: [] })
  })

  it('canMerge false with no veto and no conflict is a refusal, not a clean merge', () => {
    const silent = { canMerge: false, conflicted: false, vetoes: [] }
    expect(bbsCanMerge(silent)).toBeNull()
    expect(bbsMergeRefusedSilently(silent)).toBe(true)
    expect(bbsCanMerge({ canMerge: true })).toBe(true)
    // A veto or a conflict already explains itself.
    expect(bbsMergeRefusedSilently({ canMerge: false, vetoes: [{ summaryMessage: 'Needs 2 approvals' }] })).toBe(false)
    expect(bbsMergeRefusedSilently({ canMerge: false, conflicted: true })).toBe(false)
    expect(bbsMergeRefusedSilently({ canMerge: true })).toBe(false)
    expect(bbsMergeRefusedSilently(null)).toBe(false)
  })

  it('merge methods map to the strategies the repository enables', () => {
    const all = ['no-ff', 'ff', 'ff-only', 'squash', 'squash-ff-only', 'rebase-no-ff', 'rebase-ff-only']
    expect(bbsStrategyFor('merge', all)).toBe('no-ff')
    expect(bbsStrategyFor('squash', all)).toBe('squash')
    expect(bbsStrategyFor('rebase', all)).toBe('rebase-no-ff')
    expect(bbsStrategyFor('merge', ['ff'])).toBe('ff')
    expect(bbsStrategyFor('squash', ['no-ff'])).toBeNull()
    // Settings unreadable: a plain merge uses the server's default.
    expect(bbsStrategyFor('merge', null)).toBeUndefined()
  })

  it('build states map onto the app’s CI states', () => {
    expect(bbsCiStatus([])).toBeNull()
    expect(
      bbsCiStatus([
        { key: 'ci', name: 'CI', state: 'SUCCESSFUL', url: 'https://ci/1' },
        { key: 'lint', state: 'INPROGRESS' }
      ])
    ).toEqual({
      state: 'pending',
      jobs: [
        { name: 'CI', state: 'success', url: 'https://ci/1' },
        { name: 'lint', state: 'pending' }
      ]
    })
    expect(bbsCiStatus([{ key: 'a', state: 'FAILED' }, { key: 'b', state: 'SUCCESSFUL' }])?.state).toBe('failure')
    expect(bbsCiStatus([{ key: 'a', state: 'CANCELLED' }])?.state).toBe('neutral')
  })

  // Counts, not English words: main has no language, the renderer words them.
  it('a cancelled or unknown build is counted as such, not as skipped', async () => {
    const { countChecks } = await import('../src/main/ciSummary')
    const status = bbsCiStatus([
      { key: 'a', state: 'SUCCESSFUL' },
      { key: 'b', state: 'CANCELLED' },
      { key: 'c', state: 'UNKNOWN' }
    ])!
    expect(countChecks(status)).toEqual({ passed: 1, failed: 0, pending: 0, skipped: 0, cancelled: 1, unknown: 1 })
    // Other hosts' neutral jobs are skipped ones.
    expect(countChecks({ state: 'neutral', jobs: [{ name: 'lint', state: 'neutral' }] })).toMatchObject({ skipped: 1, cancelled: 0 })
  })

  it('the file list comes from /changes, the hunks from the raw diff', async () => {
    const { splitUnifiedDiff } = await import('../src/main/forgejo')
    const files = mergeBbsChanges(CHANGES.values as never, splitUnifiedDiff(RAW_DIFF))
    expect(files).toEqual([
      { filename: 'src/a.ts', status: 'modified', additions: 2, deletions: 1, patch: expect.stringContaining('@@ -1,3 +1,4 @@') },
      { filename: 'src/b.ts', status: 'renamed', additions: 0, deletions: 0, previousFilename: 'src/old.ts' }
    ])
  })

  // Bitbucket Data Center runs `git diff --src-prefix=src:// --dst-prefix=dst://` (Atlassian KB,
  // "Understanding diff view in Bitbucket Server"), so its raw diff may carry either prefix style.
  it('the raw diff parses with src:// / dst:// prefixes as well as a/ / b/', async () => {
    const { splitUnifiedDiff } = await import('../src/main/forgejo')
    const srcDst = RAW_DIFF.replace(/a\//g, 'src://').replace(/b\//g, 'dst://')
    expect(srcDst).toContain('diff --git src://src/a.ts dst://src/a.ts')
    const added = [
      'diff --git src://docs/new file.md dst://docs/new file.md',
      'new file mode 100644',
      'index 0000000..3333333',
      '--- /dev/null',
      '+++ dst://docs/new file.md',
      '@@ -0,0 +1,2 @@',
      '+hello',
      '+world',
      ''
    ].join('\n')
    for (const raw of [RAW_DIFF, srcDst]) {
      const files = mergeBbsChanges(CHANGES.values as never, splitUnifiedDiff(raw))
      expect(files[0]).toEqual({
        filename: 'src/a.ts',
        status: 'modified',
        additions: 2,
        deletions: 1,
        patch: expect.stringContaining('@@ -1,3 +1,4 @@')
      })
    }
    expect(splitUnifiedDiff(srcDst + added)).toEqual([
      expect.objectContaining({ filename: 'src/a.ts', additions: 2, deletions: 1 }),
      expect.objectContaining({ filename: 'docs/new file.md', status: 'added', additions: 2, deletions: 0 })
    ])
  })

  it('the two prefix styles are paired: a src:// path containing " b/" is not split there', async () => {
    const { splitUnifiedDiff } = await import('../src/main/forgejo')
    const header = (h: string): string => [h, 'index 1111111..2222222 100644', '@@ -1 +1 @@', '-x', '+y', ''].join('\n')
    // No ---/+++ lines: only the header names the file.
    expect(splitUnifiedDiff(header('diff --git src://lib/my b/x.ts dst://lib/my b/x.ts'))[0].filename).toBe('lib/my b/x.ts')
    expect(splitUnifiedDiff(header('diff --git a/lib/my b/x.ts b/lib/my b/x.ts'))[0].filename).toBe('lib/my b/x.ts')
  })

  // git C-quotes a path with non-ASCII bytes, one octal escape per UTF-8 byte.
  it('C-quoted paths are unquoted, from the header and from the ---/+++ lines', async () => {
    const { splitUnifiedDiff, unquoteGitPath } = await import('../src/main/forgejo')
    expect(unquoteGitPath('"caf\\303\\251.md"')).toBe('café.md')
    expect(unquoteGitPath('"say \\"hi\\".txt"')).toBe('say "hi".txt')
    expect(unquoteGitPath('plain.md')).toBe('plain.md')
    for (const [src, dst] of [['a/', 'b/'], ['src://', 'dst://']]) {
      const raw = [
        `diff --git "${src}caf\\303\\251.md" "${dst}caf\\303\\251.md"`,
        'index 1111111..2222222 100644',
        `--- "${src}caf\\303\\251.md"`,
        `+++ "${dst}caf\\303\\251.md"`,
        '@@ -1 +1 @@',
        '--- not a path',
        '+y',
        ''
      ].join('\n')
      expect(splitUnifiedDiff(raw)).toEqual([expect.objectContaining({ filename: 'café.md', status: 'modified', additions: 1, deletions: 1 })])
      // The header alone (a mode-only change has no ---/+++).
      const headerOnly = [`diff --git "${src}caf\\303\\251.md" "${dst}caf\\303\\251.md"`, 'old mode 100644', 'new mode 100755', ''].join('\n')
      expect(splitUnifiedDiff(headerOnly)[0].filename).toBe('café.md')
    }
  })

  // With core.quotePath off, git prints non-ASCII as is inside a quoted path —
  // an emoji is two UTF-16 units, and splitting them made two U+FFFD.
  it('an emoji in a quoted path survives unquoting', async () => {
    const { unquoteGitPath, splitUnifiedDiff } = await import('../src/main/forgejo')
    expect(unquoteGitPath('"say \\"🎉\\".md"')).toBe('say "🎉".md')
    expect(unquoteGitPath('"🎉\\303\\251🚀"')).toBe('🎉é🚀')
    const raw = ['diff --git "a/🎉 \\"x\\".md" "b/🎉 \\"x\\".md"', '--- "a/🎉 \\"x\\".md"', '+++ "b/🎉 \\"x\\".md"', '@@ -1 +1 @@', '-a', '+b', ''].join('\n')
    expect(splitUnifiedDiff(raw)[0].filename).toBe('🎉 "x".md')
  })

  // A rename from a plain path with a space to one git quotes: the header has
  // one quoted and one plain path and does not split — the chunk is still read.
  it('a header mixing a quoted and a plain path falls back to the ---/+++ and rename lines', async () => {
    const { splitUnifiedDiff } = await import('../src/main/forgejo')
    const renamed = [
      'diff --git a/my notes.md "b/caf\\303\\251 notes.md"',
      'similarity index 90%',
      'rename from my notes.md',
      'rename to "caf\\303\\251 notes.md"',
      'index 1111111..2222222 100644',
      '--- a/my notes.md',
      '+++ "b/caf\\303\\251 notes.md"',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      ''
    ].join('\n')
    expect(splitUnifiedDiff(renamed)).toEqual([
      expect.objectContaining({ filename: 'café notes.md', previousFilename: 'my notes.md', status: 'renamed', additions: 1, deletions: 1 })
    ])
    // A pure rename has no ---/+++: the rename lines alone name both sides.
    const pure = ['diff --git a/my notes.md "b/caf\\303\\251 notes.md"', 'similarity index 100%', 'rename from my notes.md', 'rename to "caf\\303\\251 notes.md"', ''].join('\n')
    expect(splitUnifiedDiff(pure)).toEqual([expect.objectContaining({ filename: 'café notes.md', previousFilename: 'my notes.md', status: 'renamed' })])
  })
})

// ─── Call sites, through the real IPC handlers ──────────────────────────────

interface Call {
  method: string
  url: string
  auth: string | null
  body?: unknown
}
const calls: Call[] = []
// Per-test overrides for the merge check.
let mergeCheck: Record<string, unknown> = { canMerge: true, conflicted: false, outcome: 'CLEAN', vetoes: [] }
// Who the token is (the X-AUSERNAME header), whether the server lets it search users, and PR 1's extras.
let ausername = 'jdoe'
let userSearch = true
let pr1Over: Record<string, unknown> = {}
// A stats request carrying this commit fails, as a flaky server would.
let failStatsFor: string | null = null
// Every commit asked about has builds (a busy list), not only sha1.
let allHaveBuilds = false
// An email-style user name: its slug is not its name (`@` becomes `_`).
const EMAIL_USERS = [
  { ...user('jdoe@corp.com.au', 'Other Jane'), slug: 'jdoe_corp.com.au' },
  { ...user('jdoe@corp.com', 'Jane Corp'), slug: 'jdoe_corp.com' }
]

const json = (data: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json', ...headers } })

function fakeBitbucket(method: string, url: string, body?: unknown): Response {
  const u = new URL(url)
  const path = u.pathname
  const start = Number(u.searchParams.get('start') ?? '0')
  if (u.hostname === 'api.bitbucket.org') return json({ values: [] })
  if (path.endsWith('/rest/api/latest/application-properties')) {
    return json({ version: '8.19.0', buildNumber: '8019000', buildDate: '1700000000000', displayName: 'Bitbucket' }, { 'X-AUSERNAME': ausername })
  }
  if (path.endsWith('/rest/api/latest/users') && method === 'GET') {
    if (!userSearch) return new Response(JSON.stringify({ errors: [{ message: 'forbidden' }] }), { status: 403 })
    // `filter` matches name, display name or email *containing* it.
    const f = (u.searchParams.get('filter') ?? '').toLowerCase()
    const all = [user('jdoe', 'Jane Doe'), ...EMAIL_USERS]
    return json({ size: 0, limit: 25, isLastPage: true, start: 0, values: all.filter((x) => String(x.name).toLowerCase().includes(f)) })
  }
  // The resource takes a *slug*: only a real one answers. `jdoe@corp.com` (a
  // name, not a slug) and `ghost` (no such user) are 404s.
  const bySlug = /\/rest\/api\/latest\/users\/([^/]+)$/.exec(path)
  if (bySlug) {
    const found = [user('jdoe', 'Jane Doe'), ...EMAIL_USERS].find((x) => x.slug === decodeURIComponent(bySlug[1]))
    return found ? json(found) : new Response('{}', { status: 404 })
  }
  if (/\/repos\/app\/pull-requests$/.test(path) && method === 'GET') {
    // Two pages, joined by nextPageStart.
    if (start === 0) return json({ size: 1, limit: 50, isLastPage: false, nextPageStart: 1, start: 0, values: [pull(1)] })
    return json({ size: 1, limit: 50, isLastPage: true, start: 1, values: [pull(2)] })
  }
  if (/\/repos\/app\/pull-requests$/.test(path) && method === 'POST') return json(pull(9))
  if (/\/pull-requests\/1$/.test(path)) return json(pull(1, pr1Over))
  if (/\/pull-requests\/1\/activities$/.test(path)) return json(ACTIVITIES)
  if (/\/pull-requests\/1\/merge$/.test(path)) return json(method === 'GET' ? mergeCheck : pull(1, { state: 'MERGED' }))
  if (/\/pull-requests\/1\/changes$/.test(path)) return json(CHANGES)
  if (/\/pull-requests\/1\.diff$/.test(path)) return new Response(RAW_DIFF, { status: 200, headers: { 'content-type': 'text/plain' } })
  if (/\/pull-requests\/1\/comments$/.test(path)) return json({ id: 99, version: 0, text: 'ok' })
  if (/\/pull-requests\/1\/participants\/[^/]+$/.test(path)) return json({ user: user('jdoe', 'Jane Doe'), role: 'REVIEWER', approved: true, status: 'APPROVED' })
  if (/\/settings\/pull-requests$/.test(path)) {
    return json({
      mergeConfig: {
        strategies: [
          { id: 'no-ff', enabled: true, name: 'Merge commit' },
          { id: 'squash', enabled: true, name: 'Squash' },
          { id: 'rebase-no-ff', enabled: false, name: 'Rebase, merge' }
        ]
      }
    })
  }
  if (path.endsWith('/rest/build-status/latest/commits/stats')) {
    if (failStatsFor && Array.isArray(body) && body.includes(failStatsFor)) return new Response('boom', { status: 500 })
    if (allHaveBuilds && Array.isArray(body)) {
      return json(Object.fromEntries((body as string[]).map((sha) => [sha, { successful: 1, failed: 0, inProgress: 0, cancelled: 0, unknown: 0 }])))
    }
    return json({ sha1: { successful: 1, failed: 1, inProgress: 0, cancelled: 0, unknown: 0 } })
  }
  if (allHaveBuilds && /\/rest\/build-status\/latest\/commits\/[^/]+$/.test(path) && !path.endsWith('/stats')) {
    return json({ size: 1, limit: 100, isLastPage: true, start: 0, values: [{ state: 'SUCCESSFUL', key: 'B', name: 'Build', dateAdded: 1 }] })
  }
  if (/\/rest\/build-status\/latest\/commits\/sha1$/.test(path)) {
    return json({
      size: 2,
      limit: 100,
      isLastPage: true,
      start: 0,
      values: [
        { state: 'SUCCESSFUL', key: 'BUILD', name: 'Build', url: 'https://ci.example.corp/1', description: 'ok', dateAdded: 1 },
        { state: 'FAILED', key: 'TEST', name: 'Tests', url: 'https://ci.example.corp/2', description: 'red', dateAdded: 2 }
      ]
    })
  }
  return json({})
}

describe('call sites, through the real IPC handlers', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    const base = defaultSettings()
    writeFileSync(
      join(dir, 'githuttbr-settings.json'),
      JSON.stringify({
        ...base,
        onboardingCompleted: true,
        profiles: [
          {
            ...base.profiles[0],
            bitbucketToken: CLOUD_TOKEN,
            bitbucketServers: [
              { url: BBS, token: BBS_TOKEN, username: 'jdoe' },
              { url: BBS_B, token: BBS_B_TOKEN },
              { url: 'https://bbs.third.example', token: 'bbs-token-c', tokenKind: 'personal' },
              { url: 'https://bbs.fourth.example', token: 'bbs-token-d', tokenKind: 'project' }
            ]
          }
        ]
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings() // fills the known-server registry, as the app's first read does
    const { registerHostingHandlers } = await import('../src/main/hosting')
    registerHostingHandlers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const headers = (init?.headers ?? {}) as Record<string, string>
        calls.push({ method, url, auth: headers['Authorization'] ?? null, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) })
        return fakeBitbucket(method, url, init?.body ? JSON.parse(String(init.body)) : undefined)
      })
    )
  })
  afterEach(() => {
    calls.length = 0
    mergeCheck = { canMerge: true, conflicted: false, outcome: 'CLEAN', vetoes: [] }
    ausername = 'jdoe'
    userSearch = true
    pr1Over = {}
    failStatsFor = null
    allHaveBuilds = false
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    rmSync(dir, { recursive: true, force: true })
  })

  const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))
  // Settings' check answers a typed result (shared/tokenCheck.ts); these tests want the account or a throw.
  const whoAmI = async (...args: unknown[]): Promise<unknown> => {
    const r = (await call('hosting:whoAmI', ...args)) as TokenCheckResult
    if (!r.ok) throw new Error(r.failure.message)
    return r.account
  }
  // A repository-scoped call's first argument is the repository; '' is none (the active profile).
  const UNBOUND = ''
  const REMOTE = 'https://bitbucket.example.corp/bitbucket/scm/proj/app.git'
  // What the renderer sends: the bitbucket.org token, always. It must never reach a Data Center.
  const tokens = { bitbucket: CLOUD_TOKEN }

  const expectOnlyServerA = (): void => {
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) {
      expect(c.url.startsWith(`${BBS}/rest/`)).toBe(true)
      expect(c.auth).toBe(`Bearer ${BBS_TOKEN}`)
    }
  }

  it('lists open pull requests across pages, with the build status of each head and the ones waiting on you', async () => {
    const res = (await call('hosting:listPRs', UNBOUND, REMOTE, tokens)) as {
      provider: string
      prs: Array<{ id: number; awaitingYou?: boolean; ci?: string; ciCounts?: unknown; ciSummary?: unknown }>
    }
    expect(res.provider).toBe('bitbucket')
    expect(res.prs.map((p) => p.id)).toEqual([1, 2])
    // jdoe — the token's own user, from X-AUSERNAME — is an unanswered reviewer on both.
    expect(res.prs.every((p) => p.awaitingYou)).toBe(true)
    expect(calls.some((c) => c.url === `${API}/application-properties`)).toBe(true)
    expect(res.prs[0].ci).toBe('failure')
    // Counts for the renderer to word in the user's language — no English sentence from main.
    expect(res.prs[0].ciCounts).toEqual({ passed: 1, failed: 1, pending: 0, skipped: 0, cancelled: 0, unknown: 0 })
    expect(res.prs[0].ciSummary).toBeUndefined()
    expectOnlyServerA()
    expect(calls[0].url).toBe(`${REPO_API}/pull-requests?state=OPEN&order=NEWEST&start=0&limit=50`)
    expect(calls[1].url).toBe(`${REPO_API}/pull-requests?state=OPEN&order=NEWEST&start=1&limit=50`)
    const stats = calls.find((c) => c.url === `${BBS}/rest/build-status/latest/commits/stats`)
    expect(stats?.method).toBe('POST')
    expect(stats?.body).toEqual(['sha1', 'sha2'])
  })

  it('reads the detail: the pull request, its activity and whether it can merge', async () => {
    const d = (await call('hosting:prDetail', UNBOUND, REMOTE, tokens, 1)) as { mergeable: boolean; comments: unknown[]; reviewThreads: unknown[] }
    expect(d.mergeable).toBe(true)
    expect(d.comments).toHaveLength(1)
    expect(d.reviewThreads).toHaveLength(1)
    expectOnlyServerA()
    expect(calls.map((c) => c.url)).toEqual(
      expect.arrayContaining([
        `${REPO_API}/pull-requests/1`,
        `${REPO_API}/pull-requests/1/activities?start=0&limit=100`,
        `${REPO_API}/pull-requests/1/merge`
      ])
    )
  })

  it('lists the changed files with their hunks', async () => {
    const files = (await call('hosting:prFiles', UNBOUND, REMOTE, tokens, 1)) as Array<{ filename: string; patch?: string }>
    expect(files.map((f) => f.filename)).toEqual(['src/a.ts', 'src/b.ts'])
    expect(files[0].patch).toContain('+three')
    expectOnlyServerA()
  })

  it('comments, and replies inside a thread', async () => {
    await call('hosting:prComment', UNBOUND, REMOTE, tokens, 1, 'Thanks!')
    expectOnlyServerA()
    expect(calls[0]).toMatchObject({ method: 'POST', url: `${REPO_API}/pull-requests/1/comments`, body: { text: 'Thanks!' } })
    calls.length = 0
    await call('hosting:prReplyReviewComment', UNBOUND, REMOTE, tokens, 1, 12, 'Agreed.')
    expect(calls[0]).toMatchObject({ method: 'POST', url: `${REPO_API}/pull-requests/1/comments`, body: { text: 'Agreed.', parent: { id: 12 } } })
  })

  it('approves as the token’s user, and requests changes the same way', async () => {
    await call('hosting:prReview', UNBOUND, REMOTE, tokens, 1, 'APPROVE', '')
    expectOnlyServerA()
    const put = calls.find((c) => c.method === 'PUT')
    expect(put).toMatchObject({ url: `${REPO_API}/pull-requests/1/participants/jdoe`, body: { status: 'APPROVED' } })
    calls.length = 0
    await call('hosting:prReview', UNBOUND, REMOTE, tokens, 1, 'REQUEST_CHANGES', 'Please add a test.')
    const writes = calls.filter((c) => c.method !== 'GET')
    // The verdict before the comment: a failed status must not leave a comment a retry would repeat.
    expect(writes.map((c) => c.method)).toEqual(['PUT', 'POST'])
    expect(writes[0].body).toEqual({ status: 'NEEDS_WORK' })
    expect(writes[1]).toMatchObject({ url: `${REPO_API}/pull-requests/1/comments`, body: { text: 'Please add a test.' } })
  })

  it('a failed verdict posts no comment', async () => {
    ausername = 'ghost' // the search finds nobody, the PR names nobody → PUT participants/ghost
    const realFetch = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'PUT') {
          calls.push({ method: 'PUT', url: String(input), auth: null })
          return new Response(JSON.stringify({ errors: [{ message: 'no such participant' }] }), { status: 404 })
        }
        return realFetch(input, init)
      })
    )
    try {
      await expect(call('hosting:prReview', UNBOUND, REMOTE, tokens, 1, 'APPROVE', 'LGTM')).rejects.toThrow(/no such participant/)
    } finally {
      vi.stubGlobal('fetch', realFetch)
    }
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('an email-style user is reviewed under its slug, found by an exact name match', async () => {
    ausername = 'jdoe@corp.com'
    await call('hosting:prReview', UNBOUND, REMOTE, tokens, 1, 'APPROVE', '')
    expect(calls.find((c) => c.url.includes('/users?'))?.url).toBe(`${API}/users?filter=jdoe%40corp.com&start=0&limit=100`)
    // Not `jdoe@corp.com` (a 404), and not the `jdoe@corp.com.au` the filter also matched.
    expect(calls.find((c) => c.method === 'PUT')?.url).toBe(`${REPO_API}/pull-requests/1/participants/jdoe_corp.com`)
  })

  // An email-style name with no slug anywhere (no search, not a participant):
  // `PUT participants/jdoe@corp.com` would 404. The deprecated POST …/approve,
  // still in the 10.2 reference, approves as the caller and needs no slug.
  it('a user with no slug to find approves through the legacy resource, and cannot request changes', async () => {
    ausername = 'jdoe@corp.com'
    userSearch = false
    await call('hosting:prReview', UNBOUND, REMOTE, tokens, 1, 'APPROVE', '')
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
    expect(calls.find((c) => c.method === 'POST')?.url).toBe(`${REPO_API}/pull-requests/1/approve`)
    calls.length = 0
    await expect(call('hosting:prReview', UNBOUND, REMOTE, tokens, 1, 'REQUEST_CHANGES', 'no')).rejects.toThrow(
      'Bitbucket Data Center: could not find your user on the server'
    )
    // Nothing written: no verdict, and so no comment.
    expect(calls.some((c) => c.method !== 'GET')).toBe(false)
  })

  it('with no user search allowed, the slug comes from the pull request’s participants', async () => {
    ausername = 'jdoe@corp.com'
    userSearch = false
    pr1Over = { participants: [{ user: EMAIL_USERS[1], role: 'PARTICIPANT', approved: false, status: 'UNAPPROVED' }] }
    await call('hosting:prReview', UNBOUND, REMOTE, tokens, 1, 'REQUEST_CHANGES', '')
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({
      url: `${REPO_API}/pull-requests/1/participants/jdoe_corp.com`,
      body: { status: 'NEEDS_WORK' }
    })
  })

  it('checks a typed token against a Data Center no profile names yet — that token only, nothing saved', async () => {
    const NEW = 'https://bbs.unsaved.example/bitbucket'
    // The onboarding wizard's row: the server is not saved, the token is the one just typed.
    await whoAmI('bitbucket', 'typed-token', NEW, false).catch(() => null)
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) {
      expect(c.url.startsWith(`${NEW}/`)).toBe(true)
      expect(c.auth).toBe('Bearer typed-token')
    }
    // No token in the call: simply not connected, and nothing is sent — never a saved one.
    calls.length = 0
    expect(await whoAmI('bitbucket', '', NEW, false)).toBeNull()
    expect(calls).toHaveLength(0)
    // An address Settings would refuse is refused here too.
    for (const bad of ['http://bbs.unsaved.example', 'https://jdoe:pw@bbs.unsaved.example']) {
      await expect(whoAmI('bitbucket', 'typed-token', bad, false)).rejects.toThrow()
    }
    expect(calls).toHaveLength(0)
    // Saved tokens never leave for the new host.
    const saved = [BBS_TOKEN, BBS_B_TOKEN, CLOUD_TOKEN, 'bbs-token-c', 'bbs-token-d']
    expect(calls.some((c) => saved.some((t) => c.auth?.includes(t)))).toBe(false)
  })

  it('a user search that is not allowed still links a plain user name — once the server confirms the slug', async () => {
    userSearch = false
    const who = (await whoAmI('bitbucket', BBS_TOKEN, BBS, false)) as { login: string; profileUrl?: string }
    expect(who).toMatchObject({ login: 'jdoe', profileUrl: `${BBS}/users/jdoe` })
    expect(calls.filter((c) => c.url === `${API}/users/jdoe`)).toHaveLength(1)
    // A plain name the server does not know as a slug: no link, rather than a 404.
    calls.length = 0
    ausername = 'ghost'
    const ghost = (await whoAmI('bitbucket', BBS_TOKEN, BBS, false)) as { profileUrl?: string }
    expect(ghost.profileUrl).toBeUndefined()
    expect(calls.filter((c) => c.url === `${API}/users/ghost`)).toHaveLength(1)
    // An email-style name is not tried as a slug at all.
    calls.length = 0
    ausername = 'jdoe@corp.com'
    const email = (await whoAmI('bitbucket', BBS_TOKEN, BBS, false)) as { profileUrl?: string }
    expect(email.profileUrl).toBeUndefined()
    expect(calls.some((c) => /\/users\/[^?]+$/.test(c.url))).toBe(false)
  })

  it('a found user is not looked up again by slug', async () => {
    await whoAmI('bitbucket', BBS_TOKEN, BBS, false)
    expect(calls.some((c) => c.url === `${API}/users/jdoe`)).toBe(false)
  })

  it('with no user search and an unknown slug, approving falls back to the participants', async () => {
    ausername = 'ghost'
    userSearch = false
    pr1Over = { participants: [{ user: { ...user('ghost', 'Ghost'), slug: 'ghost-slug' }, role: 'PARTICIPANT', approved: false, status: 'UNAPPROVED' }] }
    await call('hosting:prReview', UNBOUND, REMOTE, tokens, 1, 'APPROVE', '')
    expect(calls.find((c) => c.method === 'PUT')?.url).toBe(`${REPO_API}/pull-requests/1/participants/ghost-slug`)
  })

  it('every head is asked about in stats, but only the first 50 with builds are read in full', async () => {
    const { bbsCiStatuses, BBS_CI_FULL_READS } = await import('../src/main/bitbucketServer')
    allHaveBuilds = true
    const shas = Array.from({ length: 120 }, (_, i) => `h${i}`)
    const ci = await bbsCiStatuses({ base: BBS, projectKey: 'PROJ', repoSlug: 'app' }, BBS_TOKEN, shas)
    expect(BBS_CI_FULL_READS).toBe(50)
    expect(calls.filter((c) => c.url.endsWith('/commits/stats'))).toHaveLength(3)
    const full = calls.filter((c) => /\/commits\/h\d+\?/.test(c.url))
    expect(full).toHaveLength(50)
    // The newest ones, in the list's order.
    expect(Object.keys(ci).sort()).toEqual(shas.slice(0, 50).sort())
  })

  it('one failed build-status batch costs only its own rows their CI', async () => {
    const { bbsCiStatuses } = await import('../src/main/bitbucketServer')
    const fillers = Array.from({ length: 39 }, (_, i) => `f${i}`)
    failStatsFor = 'bad'
    const ci = await bbsCiStatuses({ base: BBS, projectKey: 'PROJ', repoSlug: 'app' }, BBS_TOKEN, ['sha1', ...fillers, 'bad'])
    expect(ci.sha1?.state).toBe('failure')
    expect(calls.filter((c) => c.url.endsWith('/commits/stats'))).toHaveLength(2)
  })

  it('canMerge false with no veto: the detail disables Merge with a reason of its own', async () => {
    mergeCheck = { canMerge: false, conflicted: false, vetoes: [] }
    const d = (await call('hosting:prDetail', UNBOUND, REMOTE, tokens, 1)) as { mergeable: boolean | null; mergeRefused?: boolean }
    expect(d.mergeable).toBeNull()
    expect(d.mergeRefused).toBe(true)
    mergeCheck = { canMerge: true, conflicted: false, outcome: 'CLEAN', vetoes: [] }
    const ok = (await call('hosting:prDetail', UNBOUND, REMOTE, tokens, 1)) as { mergeable: boolean | null; mergeRefused?: boolean }
    expect(ok.mergeable).toBe(true)
    expect(ok.mergeRefused).toBeUndefined()
  })

  it('Settings links an email-style account to its slug’s page', async () => {
    ausername = 'jdoe@corp.com'
    const who = (await whoAmI('bitbucket', BBS_TOKEN, BBS, false)) as { login: string; profileUrl?: string }
    expect(who).toMatchObject({ login: 'jdoe@corp.com', profileUrl: `${BBS}/users/jdoe_corp.com` })
  })

  it('a merge-check veto is not a conflict: the detail carries the server’s words', async () => {
    mergeCheck = {
      canMerge: false,
      conflicted: false,
      outcome: 'CLEAN',
      vetoes: [{ summaryMessage: 'Requires 2 approvals', detailedMessage: 'You still need 1 more approval.' }]
    }
    const d = (await call('hosting:prDetail', UNBOUND, REMOTE, tokens, 1)) as { mergeable: boolean | null; mergeBlockers?: string[] }
    expect(d.mergeable).toBe(true)
    expect(d.mergeBlockers).toEqual(['Requires 2 approvals — You still need 1 more approval.'])
    mergeCheck = { canMerge: false, conflicted: true, outcome: 'CONFLICTED', vetoes: [] }
    const c = (await call('hosting:prDetail', UNBOUND, REMOTE, tokens, 1)) as { mergeable: boolean | null; mergeBlockers?: string[] }
    expect(c.mergeable).toBe(false)
    expect(c.mergeBlockers).toBeUndefined()
  })

  it('merges with the current version and an enabled strategy', async () => {
    await call('hosting:prMerge', UNBOUND, REMOTE, tokens, 1, 'squash')
    expectOnlyServerA()
    const post = calls.find((c) => c.method === 'POST')
    expect(post).toMatchObject({ url: `${REPO_API}/pull-requests/1/merge?version=3`, body: { version: 3, strategyId: 'squash' } })
  })

  it('refuses to merge when a merge check vetoes, saying why — and never sends the merge', async () => {
    mergeCheck = { canMerge: false, conflicted: false, outcome: 'CLEAN', vetoes: [{ summaryMessage: 'Requires 2 approvals', detailedMessage: '' }] }
    await expect(call('hosting:prMerge', UNBOUND, REMOTE, tokens, 1, 'merge')).rejects.toThrow(/Requires 2 approvals/)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('refuses a strategy the repository has turned off, before merging', async () => {
    await expect(call('hosting:prMerge', UNBOUND, REMOTE, tokens, 1, 'rebase')).rejects.toThrow(/does not allow rebase/)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('reads build status for the graph: one stats request, then only the commits with builds', async () => {
    const res = (await call('hosting:ciStatuses', UNBOUND, REMOTE, ['sha1', 'sha2', 'sha3'], CLOUD_TOKEN)) as Record<string, { state: string }>
    expect(Object.keys(res)).toEqual(['sha1'])
    expect(res.sha1.state).toBe('failure')
    expectOnlyServerA()
    expect(calls.map((c) => c.url)).toEqual([
      `${BBS}/rest/build-status/latest/commits/stats`,
      `${BBS}/rest/build-status/latest/commits/sha1?start=0&limit=100`
    ])
  })

  it('pages the build-status stats in batches of 40, so every head gets its CI', async () => {
    const shas = Array.from({ length: 95 }, (_, i) => (i === 90 ? 'sha1' : `x${i}`))
    const res = (await call('hosting:ciStatuses', UNBOUND, REMOTE, shas, CLOUD_TOKEN)) as Record<string, { state: string }>
    const stats = calls.filter((c) => c.url === `${BBS}/rest/build-status/latest/commits/stats`)
    expect(stats.map((c) => (c.body as string[]).length)).toEqual([40, 40, 15])
    // sha1 sits in the third batch — beyond the old 40-commit cut-off.
    expect(res.sha1.state).toBe('failure')
  })

  it('reads the checks on a pull request’s head', async () => {
    const checks = (await call('hosting:prChecks', UNBOUND, REMOTE, tokens, 1)) as Array<{ name: string; conclusion: string | null }>
    expectOnlyServerA()
    // PR 1's head is `sha1` in the fixture.
    expect(checks.map((c) => [c.name, c.conclusion])).toEqual([
      ['Build', 'success'],
      ['Tests', 'failure']
    ])
  })

  it('creates a pull request with fully-qualified refs in this repository', async () => {
    const res = (await call('hosting:createPR', UNBOUND, REMOTE, tokens, { title: 'T', body: 'B', source: 'feature', target: 'main', draft: false })) as {
      number: number
      url: string
    }
    expect(res).toEqual({ number: 9, url: `${BBS}/projects/PROJ/repos/app/pull-requests/9` })
    expectOnlyServerA()
    expect(calls[0].body).toEqual({
      title: 'T',
      description: 'B',
      fromRef: { id: 'refs/heads/feature', repository: { slug: 'app', project: { key: 'PROJ' } } },
      toRef: { id: 'refs/heads/main', repository: { slug: 'app', project: { key: 'PROJ' } } }
    })
  })

  it('opens the create page on the server, under its context path', async () => {
    await call('hosting:openCreatePR', REMOTE, 'feature', 'main')
    expect(opened.pop()).toBe(`${BBS}/projects/PROJ/repos/app/pull-requests?create&sourceBranch=refs%2Fheads%2Ffeature&targetBranch=refs%2Fheads%2Fmain`)
  })

  it('a second server gets its own token, not the first one’s', async () => {
    await call('hosting:prComment', UNBOUND, 'ssh://git@bbs.other.example:7999/team/svc.git', tokens, 1, 'hi')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://bbs.other.example:8443/rest/api/latest/projects/TEAM/repos/svc/pull-requests/1/comments')
    expect(calls[0].auth).toBe(`Bearer ${BBS_B_TOKEN}`)
  })

  it('bitbucket.org is unchanged: its own API, the Cloud token', async () => {
    await call('hosting:listPRs', UNBOUND, 'https://bitbucket.org/team/app.git', tokens)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.bitbucket.org/2.0/repositories/team/app/pullrequests?state=OPEN&pagelen=30')
    expect(calls[0].auth).toBe(`Bearer ${CLOUD_TOKEN}`)
  })

  it('Settings checks a saved server with the token typed for it', async () => {
    const who = (await whoAmI('bitbucket', BBS_TOKEN, BBS, false)) as { login: string; name: string }
    expect(who).toMatchObject({ login: 'jdoe', name: 'Jane Doe', source: 'token' })
    expectOnlyServerA()
    // A server no profile names is checked only with the token the call carries
    // (see the unsaved-server case below); without one nothing is sent.
    calls.length = 0
    expect(await whoAmI('bitbucket', '', 'https://evil.example', false)).toBeNull()
    expect(calls).toHaveLength(0)
  })

  // Settings tells a refused token from a server it could not ask (shared/tokenCheck.ts).
  describe('the check says why there is no account', () => {
    const answering = async (reply: () => Promise<Response>, ...args: unknown[]): Promise<TokenCheckResult> => {
      const stub = vi.mocked(globalThis.fetch)
      const normal = stub.getMockImplementation()
      stub.mockImplementation(reply)
      try {
        return (await call('hosting:whoAmI', ...args)) as TokenCheckResult
      } finally {
        stub.mockImplementation(normal!)
      }
    }
    const status =
      (s: number, headers: Record<string, string> = {}) =>
      async (): Promise<Response> =>
        new Response('{}', { status: s, headers })

    it('Bitbucket Data Center: 401 refused the token, a 503 could not check it', async () => {
      expect(await answering(status(401), 'bitbucket', BBS_TOKEN, BBS, false)).toMatchObject({
        ok: false,
        failure: { kind: 'refused', server: 'bitbucket.example.corp' }
      })
      expect(await answering(status(503), 'bitbucket', BBS_TOKEN, BBS, false)).toMatchObject({
        ok: false,
        failure: { kind: 'unreachable', server: 'bitbucket.example.corp' }
      })
    })

    it('bitbucket.org: 401 refused the app password, a 429 could not check it', async () => {
      expect(await answering(status(401), 'bitbucket', CLOUD_TOKEN, undefined, false)).toMatchObject({
        ok: false,
        failure: { kind: 'refused', server: 'bitbucket.org' }
      })
      expect(await answering(status(429), 'bitbucket', CLOUD_TOKEN, undefined, false)).toMatchObject({
        ok: false,
        failure: { kind: 'unreachable', server: 'bitbucket.org' }
      })
    })
  })

  it('never sends a Data Center token to bitbucket.org for Cloud-only browsing', async () => {
    await expect(call('hosting:listRepos', 'bitbucket', '', BBS)).rejects.toThrow(/not supported/)
    await expect(call('hosting:listOwners', 'bitbucket', '', BBS)).rejects.toThrow(/not supported/)
    expect(calls).toHaveLength(0)
  })

  // Fetch, push and clone resolve through the same profile rule as the API.
  it('the profile resolves each server its own token, and nothing for an unknown host', async () => {
    const { activeProfileAuth } = await import('../src/main/settings')
    expect(await activeProfileAuth('bitbucket', REMOTE)).toEqual({ token: BBS_TOKEN, username: 'jdoe' })
    // No kind set: no name fixed, as before the choice existed.
    expect(await activeProfileAuth('bitbucket', 'ssh://git@bbs.other.example:7999/team/svc.git')).toEqual({ token: BBS_B_TOKEN })
    expect(await activeProfileAuth('bitbucket', 'https://bbs.fourth.example/scm/team/svc.git')).toEqual({
      token: 'bbs-token-d',
      username: 'x-token-auth',
      tokenKind: 'project'
    })
    expect(await activeProfileAuth('bitbucket', 'https://bbs.third.example/scm/team/svc.git')).toEqual({
      token: 'bbs-token-c',
      tokenKind: 'personal'
    })
    // …and the kind reaches the credential push and fetch build.
    const { profileCredentialForUrl } = await import('../src/main/remoteAuthCheck')
    const fourth = await profileCredentialForUrl('/no/such/repo', 'https://jsmith@bbs.fourth.example/scm/team/svc.git')
    expect(fourth.credential).toMatchObject({ token: 'bbs-token-d', gitUsername: 'x-token-auth', gitTokenKind: 'project' })
    expect((await activeProfileAuth('bitbucket', 'https://bitbucket.org/team/app.git')).token).toBe(CLOUD_TOKEN)
    // Same host, no context path: not the configured server.
    expect(await activeProfileAuth('bitbucket', 'https://bitbucket.example.corp/scm/proj/app.git')).toEqual({})
    expect(await activeProfileAuth('bitbucket', 'https://evil.example/scm/proj/app.git')).toEqual({})
  })

  it('a clone from a server carries its token and user name, never the Cloud token the renderer sent', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv(REMOTE, 'bitbucket', CLOUD_TOKEN)) ?? {}
    const text = revealCredentialEnv(env)
    expect(text).toContain(BBS_TOKEN)
    expect(text).not.toContain(CLOUD_TOKEN)
    expect(credentialEnvValues(env)).toContain('jdoe')
    // Scoped to the server's base, context path included — not the whole origin,
    // which another server (a GitLab at its root) may share.
    expect(credentialEnvValues(env)).toContain('credential.https://bitbucket.example.corp/bitbucket.helper')
    expect(credentialEnvValues(env)).not.toContain('credential.https://bitbucket.example.corp.helper')
  })

  it('Clone → URL (no provider sent) uses a configured server’s credential, and nothing for an unknown host', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv(REMOTE, undefined, undefined)) ?? {}
    expect(revealCredentialEnv(env)).toContain(BBS_TOKEN)
    expect(credentialEnvValues(env)).toContain('jdoe')
    expect(await cloneCredentialEnv('https://bitbucket.example.corp/scm/proj/app.git', undefined, undefined)).toBeNull()
    expect(await cloneCredentialEnv('https://evil.example/bitbucket/scm/proj/app.git', undefined, CLOUD_TOKEN)).toBeNull()
    expect(await cloneCredentialEnv('https://github.com/o/r.git', undefined, CLOUD_TOKEN)).toBeNull()
    // remoteBranches (the clone dialog's branch list) goes through the same function.
    const second = (await cloneCredentialEnv('https://bbs.other.example:8443/scm/team/svc.git', undefined, undefined)) ?? {}
    expect(revealCredentialEnv(second)).toContain(BBS_B_TOKEN)
    expect(revealCredentialEnv(second)).not.toContain(BBS_TOKEN)
  })

  // Bitbucket's own clone URLs carry the copying user's name; a project or
  // repository token must still go as x-token-auth (Atlassian, "HTTP access tokens").
  it('a token marked project goes as x-token-auth even when the clone URL names a user', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv('https://jsmith@bbs.fourth.example/scm/team/svc.git', undefined, undefined)) ?? {}
    expect(revealCredentialEnv(env)).toContain('bbs-token-d')
    expect(credentialEnvValues(env)).toContain('x-token-auth')
    expect(credentialEnvValues(env)).not.toContain('jsmith')
    // A personal token with no name in Settings takes the URL's.
    const personal = (await cloneCredentialEnv('https://jsmith@bbs.third.example/scm/team/svc.git', undefined, undefined)) ?? {}
    expect(revealCredentialEnv(personal)).toContain('bbs-token-c')
    expect(credentialEnvValues(personal)).toContain('jsmith')
    // …and with no name anywhere, no credential at all rather than x-token-auth.
    expect(await cloneCredentialEnv('https://bbs.third.example/scm/team/svc.git', undefined, undefined)).toBeNull()
    // Picked in the dialog, that same server is cloned as nobody — git's helper
    // for it switched off, not left to answer with another account.
    const id = defaultSettings().profiles[0].id
    for (const host of ['bitbucket', undefined] as const) {
      const picked = (await cloneCredentialEnv('https://bbs.third.example/scm/team/svc.git', host, undefined, id)) ?? {}
      expect(blanksOnly(picked, 'https://bbs.third.example'), String(host)).toBe(true)
      expect(revealCredentialEnv(picked)).not.toContain('bbs-token-c')
    }
  })

  // An entry with an empty user name and no kind — every personal-token setup
  // from before the choice existed — keeps the remote URL's name.
  it('a token with no kind set keeps the clone URL’s user name, as before', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv('https://jsmith@bbs.other.example:8443/scm/team/svc.git', undefined, undefined)) ?? {}
    expect(revealCredentialEnv(env)).toContain(BBS_B_TOKEN)
    expect(credentialEnvValues(env)).toContain('jsmith')
    expect(credentialEnvValues(env)).not.toContain('x-token-auth')
  })

  it('push and fetch send the token as password, with the user name or x-token-auth', async () => {
    const { basicAuthFor } = await import('../src/main/git')
    expect(basicAuthFor('bitbucket', BBS_TOKEN, REMOTE, 'jdoe')).toEqual({ username: 'jdoe', password: BBS_TOKEN })
    // No name in Settings: the one in Bitbucket's own clone URL, before x-token-auth.
    expect(basicAuthFor('bitbucket', BBS_B_TOKEN, 'https://jsmith@bbs.other.example:8443/scm/team/svc.git')).toEqual({
      username: 'jsmith',
      password: BBS_B_TOKEN
    })
    expect(basicAuthFor('bitbucket', BBS_B_TOKEN, 'https://jsmith@bbs.other.example:8443/scm/team/svc.git', 'ops')).toEqual({
      username: 'ops',
      password: BBS_B_TOKEN
    })
    expect(basicAuthFor('bitbucket', BBS_B_TOKEN, 'https://bbs.other.example:8443/scm/team/svc.git')).toEqual({
      username: 'x-token-auth',
      password: BBS_B_TOKEN
    })
    const named = 'https://jsmith@bbs.other.example:8443/scm/team/svc.git'
    expect(basicAuthFor('bitbucket', BBS_B_TOKEN, named, undefined, 'project')).toEqual({ username: 'x-token-auth', password: BBS_B_TOKEN })
    expect(basicAuthFor('bitbucket', BBS_B_TOKEN, named, undefined, 'personal')).toEqual({ username: 'jsmith', password: BBS_B_TOKEN })
    expect(basicAuthFor('bitbucket', BBS_B_TOKEN, 'https://bbs.other.example:8443/scm/team/svc.git', undefined, 'personal')).toBeNull()
    // bitbucket.org keeps its own rules.
    expect(basicAuthFor('bitbucket', 'me:app-pass', 'https://bitbucket.org/team/app.git')).toEqual({ username: 'me', password: 'app-pass' })
  })

  it('the push-account check asks the server who the token is', async () => {
    const { profileCredentialForUrl } = await import('../src/main/remoteAuthCheck')
    const res = await profileCredentialForUrl('/nowhere', REMOTE)
    expect(res.credential).toMatchObject({ token: BBS_TOKEN, source: 'token', gitUsername: 'jdoe' })
  })
})
