import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
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
  bbsMergeRefusal,
  bbsStrategyFor,
  mapBbsActivities,
  mapBbsPull,
  mapBbsReviews,
  mergeBbsChanges
} from '../src/main/bitbucketServer'
import { isReviewableRemote } from '../src/renderer/src/lib/hosting'

// Bitbucket Data Center: one resolver for every Data Center URL, a token that
// only ever reaches the server it was saved for, and call sites checked through
// the real IPC handlers against a fake fetch that answers in the documented
// shapes (developer.atlassian.com/server/bitbucket/rest/, OpenAPI 10.2).

const dir = mkdtempSync(join(tmpdir(), 'gitcito-bbs-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const opened: string[] = []

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: { openExternal: (url: string) => opened.push(url) },
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
    expect(bitbucketAuthFor(p, BBS_B)).toEqual({ token: BBS_B_TOKEN })
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
    expect(bbsMergeRefusal(vetoed as never)).toBe(
      'the pull request has conflicts that must be resolved first; You may not merge after 6pm on a Friday. — Please try again on Monday.'
    )
    expect(bbsCanMerge({ conflicted: false, outcome: 'CLEAN', vetoes: [] })).toBe(true)
    expect(bbsCanMerge({ conflicted: false, outcome: 'CLEAN', vetoes: [{ summaryMessage: 'Needs 2 approvals' }] })).toBe(false)
    expect(bbsCanMerge(null)).toBeNull()
    expect(bbsMergeRefusal({ canMerge: true, vetoes: [] })).toBeNull()
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

  it('the file list comes from /changes, the hunks from the raw diff', async () => {
    const { splitUnifiedDiff } = await import('../src/main/forgejo')
    const files = mergeBbsChanges(CHANGES.values as never, splitUnifiedDiff(RAW_DIFF))
    expect(files).toEqual([
      { filename: 'src/a.ts', status: 'modified', additions: 2, deletions: 1, patch: expect.stringContaining('@@ -1,3 +1,4 @@') },
      { filename: 'src/b.ts', status: 'renamed', additions: 0, deletions: 0, previousFilename: 'src/old.ts' }
    ])
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

const json = (data: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json', ...headers } })

function fakeBitbucket(method: string, url: string): Response {
  const u = new URL(url)
  const path = u.pathname
  const start = Number(u.searchParams.get('start') ?? '0')
  if (u.hostname === 'api.bitbucket.org') return json({ values: [] })
  if (path.endsWith('/rest/api/latest/application-properties')) {
    return json({ version: '8.19.0', buildNumber: '8019000', buildDate: '1700000000000', displayName: 'Bitbucket' }, { 'X-AUSERNAME': 'jdoe' })
  }
  if (path.endsWith('/rest/api/latest/users/jdoe')) return json(user('jdoe', 'Jane Doe'))
  if (/\/repos\/app\/pull-requests$/.test(path) && method === 'GET') {
    // Two pages, joined by nextPageStart.
    if (start === 0) return json({ size: 1, limit: 50, isLastPage: false, nextPageStart: 1, start: 0, values: [pull(1)] })
    return json({ size: 1, limit: 50, isLastPage: true, start: 1, values: [pull(2)] })
  }
  if (/\/repos\/app\/pull-requests$/.test(path) && method === 'POST') return json(pull(9))
  if (/\/pull-requests\/1$/.test(path)) return json(pull(1))
  if (/\/pull-requests\/1\/activities$/.test(path)) return json(ACTIVITIES)
  if (/\/pull-requests\/1\/merge$/.test(path)) return json(method === 'GET' ? mergeCheck : pull(1, { state: 'MERGED' }))
  if (/\/pull-requests\/1\/changes$/.test(path)) return json(CHANGES)
  if (/\/pull-requests\/1\.diff$/.test(path)) return new Response(RAW_DIFF, { status: 200, headers: { 'content-type': 'text/plain' } })
  if (/\/pull-requests\/1\/comments$/.test(path)) return json({ id: 99, version: 0, text: 'ok' })
  if (/\/pull-requests\/1\/participants\/jdoe$/.test(path)) return json({ user: user('jdoe', 'Jane Doe'), role: 'REVIEWER', approved: true, status: 'APPROVED' })
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
    return json({ sha1: { successful: 1, failed: 1, inProgress: 0, cancelled: 0, unknown: 0 } })
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
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    const base = defaultSettings()
    writeFileSync(
      join(dir, 'gitcito-settings.json'),
      JSON.stringify({
        ...base,
        onboardingCompleted: true,
        profiles: [
          {
            ...base.profiles[0],
            bitbucketToken: CLOUD_TOKEN,
            bitbucketServers: [
              { url: BBS, token: BBS_TOKEN, username: 'jdoe' },
              { url: BBS_B, token: BBS_B_TOKEN }
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
        return fakeBitbucket(method, url)
      })
    )
  })
  afterEach(() => {
    calls.length = 0
    mergeCheck = { canMerge: true, conflicted: false, outcome: 'CLEAN', vetoes: [] }
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    rmSync(dir, { recursive: true, force: true })
  })

  const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))
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
    const res = (await call('hosting:listPRs', REMOTE, tokens)) as {
      provider: string
      prs: Array<{ id: number; awaitingYou?: boolean; ci?: string }>
    }
    expect(res.provider).toBe('bitbucket')
    expect(res.prs.map((p) => p.id)).toEqual([1, 2])
    // jdoe — the token's own user, from X-AUSERNAME — is an unanswered reviewer on both.
    expect(res.prs.every((p) => p.awaitingYou)).toBe(true)
    expect(calls.some((c) => c.url === `${API}/application-properties`)).toBe(true)
    expect(res.prs[0].ci).toBe('failure')
    expectOnlyServerA()
    expect(calls[0].url).toBe(`${REPO_API}/pull-requests?state=OPEN&order=NEWEST&start=0&limit=50`)
    expect(calls[1].url).toBe(`${REPO_API}/pull-requests?state=OPEN&order=NEWEST&start=1&limit=50`)
    const stats = calls.find((c) => c.url === `${BBS}/rest/build-status/latest/commits/stats`)
    expect(stats?.method).toBe('POST')
    expect(stats?.body).toEqual(['sha1', 'sha2'])
  })

  it('reads the detail: the pull request, its activity and whether it can merge', async () => {
    const d = (await call('hosting:prDetail', REMOTE, tokens, 1)) as { mergeable: boolean; comments: unknown[]; reviewThreads: unknown[] }
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
    const files = (await call('hosting:prFiles', REMOTE, tokens, 1)) as Array<{ filename: string; patch?: string }>
    expect(files.map((f) => f.filename)).toEqual(['src/a.ts', 'src/b.ts'])
    expect(files[0].patch).toContain('+three')
    expectOnlyServerA()
  })

  it('comments, and replies inside a thread', async () => {
    await call('hosting:prComment', REMOTE, tokens, 1, 'Thanks!')
    expectOnlyServerA()
    expect(calls[0]).toMatchObject({ method: 'POST', url: `${REPO_API}/pull-requests/1/comments`, body: { text: 'Thanks!' } })
    calls.length = 0
    await call('hosting:prReplyReviewComment', REMOTE, tokens, 1, 12, 'Agreed.')
    expect(calls[0]).toMatchObject({ method: 'POST', url: `${REPO_API}/pull-requests/1/comments`, body: { text: 'Agreed.', parent: { id: 12 } } })
  })

  it('approves as the token’s user, and requests changes the same way', async () => {
    await call('hosting:prReview', REMOTE, tokens, 1, 'APPROVE', '')
    expectOnlyServerA()
    const put = calls.find((c) => c.method === 'PUT')
    expect(put).toMatchObject({ url: `${REPO_API}/pull-requests/1/participants/jdoe`, body: { status: 'APPROVED' } })
    calls.length = 0
    await call('hosting:prReview', REMOTE, tokens, 1, 'REQUEST_CHANGES', 'Please add a test.')
    expect(calls[0]).toMatchObject({ method: 'POST', url: `${REPO_API}/pull-requests/1/comments`, body: { text: 'Please add a test.' } })
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ status: 'NEEDS_WORK' })
  })

  it('merges with the current version and an enabled strategy', async () => {
    await call('hosting:prMerge', REMOTE, tokens, 1, 'squash')
    expectOnlyServerA()
    const post = calls.find((c) => c.method === 'POST')
    expect(post).toMatchObject({ url: `${REPO_API}/pull-requests/1/merge?version=3`, body: { version: 3, strategyId: 'squash' } })
  })

  it('refuses to merge when a merge check vetoes, saying why — and never sends the merge', async () => {
    mergeCheck = { canMerge: false, conflicted: false, outcome: 'CLEAN', vetoes: [{ summaryMessage: 'Requires 2 approvals', detailedMessage: '' }] }
    await expect(call('hosting:prMerge', REMOTE, tokens, 1, 'merge')).rejects.toThrow(/Requires 2 approvals/)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('refuses a strategy the repository has turned off, before merging', async () => {
    await expect(call('hosting:prMerge', REMOTE, tokens, 1, 'rebase')).rejects.toThrow(/does not allow rebase/)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('reads build status for the graph: one stats request, then only the commits with builds', async () => {
    const res = (await call('hosting:ciStatuses', REMOTE, ['sha1', 'sha2', 'sha3'], CLOUD_TOKEN)) as Record<string, { state: string }>
    expect(Object.keys(res)).toEqual(['sha1'])
    expect(res.sha1.state).toBe('failure')
    expectOnlyServerA()
    expect(calls.map((c) => c.url)).toEqual([
      `${BBS}/rest/build-status/latest/commits/stats`,
      `${BBS}/rest/build-status/latest/commits/sha1?start=0&limit=100`
    ])
  })

  it('reads the checks on a pull request’s head', async () => {
    const checks = (await call('hosting:prChecks', REMOTE, tokens, 1)) as Array<{ name: string; conclusion: string | null }>
    expectOnlyServerA()
    // PR 1's head is `sha1` in the fixture.
    expect(checks.map((c) => [c.name, c.conclusion])).toEqual([
      ['Build', 'success'],
      ['Tests', 'failure']
    ])
  })

  it('creates a pull request with fully-qualified refs in this repository', async () => {
    const res = (await call('hosting:createPR', REMOTE, tokens, { title: 'T', body: 'B', source: 'feature', target: 'main', draft: false })) as {
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
    await call('hosting:prComment', 'ssh://git@bbs.other.example:7999/team/svc.git', tokens, 1, 'hi')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://bbs.other.example:8443/rest/api/latest/projects/TEAM/repos/svc/pull-requests/1/comments')
    expect(calls[0].auth).toBe(`Bearer ${BBS_B_TOKEN}`)
  })

  it('bitbucket.org is unchanged: its own API, the Cloud token', async () => {
    await call('hosting:listPRs', 'https://bitbucket.org/team/app.git', tokens)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.bitbucket.org/2.0/repositories/team/app/pullrequests?state=OPEN&pagelen=30')
    expect(calls[0].auth).toBe(`Bearer ${CLOUD_TOKEN}`)
  })

  it('Settings checks a server with the token typed for it, and refuses one no profile names', async () => {
    const who = (await call('hosting:whoAmI', 'bitbucket', BBS_TOKEN, BBS, false)) as { login: string; name: string }
    expect(who).toMatchObject({ login: 'jdoe', name: 'Jane Doe', source: 'token' })
    expectOnlyServerA()
    calls.length = 0
    await expect(call('hosting:whoAmI', 'bitbucket', BBS_TOKEN, 'https://evil.example', false)).rejects.toThrow(/not saved/)
    expect(calls).toHaveLength(0)
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
    expect(await activeProfileAuth('bitbucket', 'ssh://git@bbs.other.example:7999/team/svc.git')).toEqual({ token: BBS_B_TOKEN })
    expect((await activeProfileAuth('bitbucket', 'https://bitbucket.org/team/app.git')).token).toBe(CLOUD_TOKEN)
    // Same host, no context path: not the configured server.
    expect(await activeProfileAuth('bitbucket', 'https://bitbucket.example.corp/scm/proj/app.git')).toEqual({})
    expect(await activeProfileAuth('bitbucket', 'https://evil.example/scm/proj/app.git')).toEqual({})
  })

  it('a clone from a server carries its token and user name, never the Cloud token the renderer sent', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv(REMOTE, 'bitbucket', CLOUD_TOKEN)) ?? {}
    const text = JSON.stringify(env)
    expect(text).toContain(BBS_TOKEN)
    expect(text).not.toContain(CLOUD_TOKEN)
    expect(Object.values(env)).toContain('jdoe')
    // Scoped to the server's origin, nowhere else.
    expect(Object.values(env)).toContain('credential.https://bitbucket.example.corp.helper')
  })

  it('push and fetch send the token as password, with the user name or x-token-auth', async () => {
    const { basicAuthFor } = await import('../src/main/git')
    expect(basicAuthFor('bitbucket', BBS_TOKEN, REMOTE, 'jdoe')).toEqual({ username: 'jdoe', password: BBS_TOKEN })
    expect(basicAuthFor('bitbucket', BBS_B_TOKEN, 'https://bbs.other.example:8443/scm/team/svc.git')).toEqual({
      username: 'x-token-auth',
      password: BBS_B_TOKEN
    })
    // bitbucket.org keeps its own rules.
    expect(basicAuthFor('bitbucket', 'me:app-pass', 'https://bitbucket.org/team/app.git')).toEqual({ username: 'me', password: 'app-pass' })
  })

  it('the push-account check asks the server who the token is', async () => {
    const { profileCredentialForUrl } = await import('../src/main/remoteAuthCheck')
    const res = await profileCredentialForUrl('/nowhere', REMOTE)
    expect(res.credential).toMatchObject({ token: BBS_TOKEN, source: 'token', gitUsername: 'jdoe' })
  })
})
