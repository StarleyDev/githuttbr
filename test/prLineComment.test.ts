import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings, type PrLineAnchor } from '../src/shared/types'

// A comment started on one line of a PR's diff, per host: the request each one
// is sent (URL, method, payload) and the side a line lands on — a deleted line
// is the old side everywhere, added and unchanged lines the new. The real IPC
// handler runs against a fake fetch and a real settings file.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-pr-line-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: { openExternal: () => undefined },
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

const GITHUB = 'https://github.com/team/app.git'
const GITLAB = 'https://gitlab.example.corp'
const FORGEJO = 'https://git.example.corp'
const AZURE = 'https://dev.azure.com/acme/proj/_git/app'
const BB_CLOUD = 'https://bitbucket.org/team/app.git'
const BBS = 'https://bitbucket.example.corp'

const ADDED: PrLineAnchor = { path: 'src/app.ts', kind: 'add', oldLine: null, newLine: 12 }
const DELETED: PrLineAnchor = { path: 'src/app.ts', kind: 'del', oldLine: 9, newLine: null }
const CONTEXT: PrLineAnchor = { path: 'src/app.ts', kind: 'ctx', oldLine: 7, newLine: 8 }
const RENAMED: PrLineAnchor = { path: 'src/new.ts', oldPath: 'src/old.ts', kind: 'del', oldLine: 4, newLine: null }

interface Sent {
  url: string
  method: string
  body: unknown
}
/** [method, URL prefix, status, body]. The first match answers; anything else is 200 {}. */
let routes: Array<[string, string, number, unknown]> = []
const sent: Sent[] = []

const post = (remote: string, anchor: unknown, body = 'Nit: name this.'): Promise<unknown> =>
  Promise.resolve().then(() => handlers.get('hosting:prCommentOnLine')!({}, '', remote, {}, 7, anchor, body))
const posts = (): Sent[] => sent.filter((s) => s.method === 'POST')
const failure = (p: Promise<unknown>): Promise<Error> =>
  p.then(
    () => {
      throw new Error('expected a failure')
    },
    (e: Error) => e
  )

describe('a comment on one line of a pull request — main', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    writeFileSync(
      join(dir, 'githuttbr-settings.json'),
      JSON.stringify({
        ...defaultSettings(),
        onboardingCompleted: true,
        activeProfileId: 'work',
        profiles: [
          {
            ...defaultSettings().profiles[0],
            id: 'work',
            name: 'Work',
            githubToken: 'gh-token',
            gitlabServers: [{ url: GITLAB, token: 'gl-token' }],
            forgejoUrl: FORGEJO,
            forgejoToken: 'fj-token',
            forgejoTokenIssuer: FORGEJO,
            azureToken: 'az-token',
            azureOrg: 'acme',
            bitbucketToken: 'bb-token',
            bitbucketServers: [{ url: BBS, token: 'bbs-token', username: 'work' }]
          }
        ]
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings()
    const hosting = await import('../src/main/hosting')
    hosting.registerHostingHandlers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const method = (init?.method ?? 'GET').toUpperCase()
        sent.push({ url, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined })
        const hit = routes.find(([m, prefix]) => m === method && url.startsWith(prefix))
        const [, , status, body] = hit ?? ['', '', 200, {}]
        return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
      })
    )
  })
  afterEach(() => {
    routes = []
    sent.length = 0
  })
  afterAll(() => vi.unstubAllGlobals())

  describe('GitHub', () => {
    const PR = 'https://api.github.com/repos/team/app/pulls/7'
    const head = (): void => {
      routes = [['GET', PR, 200, { head: { sha: 'abc123' } }], ['POST', `${PR}/comments`, 201, { id: 1 }]]
    }

    it('an added line: RIGHT, its new number, against the head commit', async () => {
      head()
      await post(GITHUB, ADDED)
      expect(posts()).toEqual([
        {
          url: `${PR}/comments`,
          method: 'POST',
          body: { body: 'Nit: name this.', commit_id: 'abc123', path: 'src/app.ts', line: 12, side: 'RIGHT' }
        }
      ])
    })

    it('a deleted line: LEFT, its old number', async () => {
      head()
      await post(GITHUB, DELETED)
      expect(posts()[0].body).toMatchObject({ line: 9, side: 'LEFT' })
    })

    it('an unchanged line: RIGHT, its new number', async () => {
      head()
      await post(GITHUB, CONTEXT)
      expect(posts()[0].body).toMatchObject({ line: 8, side: 'RIGHT' })
    })

    it('a 422 says the line is outside the diff; a 403 that the account was refused', async () => {
      routes = [['GET', PR, 200, { head: { sha: 'abc123' } }], ['POST', `${PR}/comments`, 422, { message: 'line must be part of the diff' }]]
      expect((await failure(post(GITHUB, ADDED))).message).toMatch(/^Line comment \[outsideDiff\]: GitHub: line must be part of the diff/)
      routes = [['GET', PR, 200, { head: { sha: 'abc123' } }], ['POST', `${PR}/comments`, 403, { message: 'Resource not accessible' }]]
      expect((await failure(post(GITHUB, ADDED))).message).toMatch(/^Line comment \[refused\]: /)
    })
  })

  describe('GitLab', () => {
    const MR = `${GITLAB}/api/v4/projects/team%2Fapp/merge_requests/7`
    const refs = (): void => {
      routes = [
        ['GET', MR, 200, { diff_refs: { base_sha: 'b1', start_sha: 's1', head_sha: 'h1' } }],
        ['POST', `${MR}/discussions`, 201, { id: 'd1' }]
      ]
    }
    const position = (extra: Record<string, unknown>): Record<string, unknown> => ({
      position_type: 'text',
      base_sha: 'b1',
      start_sha: 's1',
      head_sha: 'h1',
      old_path: 'src/app.ts',
      new_path: 'src/app.ts',
      ...extra
    })

    it('an added line: a discussion with new_line only, on the MR’s diff refs', async () => {
      refs()
      await post(`${GITLAB}/team/app.git`, ADDED)
      expect(posts()).toEqual([
        { url: `${MR}/discussions`, method: 'POST', body: { body: 'Nit: name this.', position: position({ new_line: 12 }) } }
      ])
    })

    it('a deleted line: old_line only', async () => {
      refs()
      await post(`${GITLAB}/team/app.git`, DELETED)
      expect(posts()[0].body).toEqual({ body: 'Nit: name this.', position: position({ old_line: 9 }) })
    })

    it('an unchanged line: both old_line and new_line', async () => {
      refs()
      await post(`${GITLAB}/team/app.git`, CONTEXT)
      expect(posts()[0].body).toEqual({ body: 'Nit: name this.', position: position({ old_line: 7, new_line: 8 }) })
    })

    it('a renamed file names both paths', async () => {
      refs()
      await post(`${GITLAB}/team/app.git`, RENAMED)
      expect((posts()[0].body as { position: unknown }).position).toMatchObject({ old_path: 'src/old.ts', new_path: 'src/new.ts' })
    })

    it('a 400 (no line code for that position) is outside the diff', async () => {
      routes = [
        ['GET', MR, 200, { diff_refs: { base_sha: 'b1', start_sha: 's1', head_sha: 'h1' } }],
        ['POST', `${MR}/discussions`, 400, { message: '400 Bad request - Note {:line_code=>["can\'t be blank"]}' }]
      ]
      expect((await failure(post(`${GITLAB}/team/app.git`, ADDED))).message).toMatch(/^Line comment \[outsideDiff\]: GitLab: /)
    })

    it('without diff refs nothing is posted', async () => {
      routes = [['GET', MR, 200, { diff_refs: null }]]
      await failure(post(`${GITLAB}/team/app.git`, ADDED))
      expect(posts()).toEqual([])
    })
  })

  describe('Azure DevOps', () => {
    const PR = 'https://dev.azure.com/acme/proj/_apis/git/repositories/app/pullrequests/7'
    const iterations = (): void => {
      routes = [
        ['GET', `${PR}/iterations/3/changes`, 200, { changeEntries: [{ item: { path: '/src/app.ts' }, changeTrackingId: 5 }] }],
        ['GET', `${PR}/iterations`, 200, { value: [{ id: 1 }, { id: 2 }, { id: 3 }] }],
        ['POST', `${PR}/threads`, 200, { id: 40 }]
      ]
    }

    it('an added line: rightFileStart/End, the last iteration and the change’s tracking id', async () => {
      iterations()
      await post(AZURE, ADDED)
      expect(posts()).toEqual([
        {
          url: `${PR}/threads?api-version=7.1`,
          method: 'POST',
          body: {
            comments: [{ parentCommentId: 0, content: 'Nit: name this.', commentType: 1 }],
            status: 1,
            threadContext: { filePath: '/src/app.ts', rightFileStart: { line: 12, offset: 1 }, rightFileEnd: { line: 12, offset: 1 } },
            pullRequestThreadContext: { changeTrackingId: 5, iterationContext: { firstComparingIteration: 3, secondComparingIteration: 3 } }
          }
        }
      ])
    })

    it('a deleted line: leftFileStart/End, its old number', async () => {
      iterations()
      await post(AZURE, DELETED)
      const ctx = (posts()[0].body as { threadContext: Record<string, unknown> }).threadContext
      expect(ctx).toEqual({ filePath: '/src/app.ts', leftFileStart: { line: 9, offset: 1 }, leftFileEnd: { line: 9, offset: 1 } })
    })

    it('an unchanged line: the right side, its new number', async () => {
      iterations()
      await post(AZURE, CONTEXT)
      const ctx = (posts()[0].body as { threadContext: Record<string, unknown> }).threadContext
      expect(ctx).toMatchObject({ rightFileStart: { line: 8, offset: 1 } })
    })

    it('a 403 is refused', async () => {
      routes = [
        ['GET', `${PR}/iterations`, 200, { value: [{ id: 1 }] }],
        ['POST', `${PR}/threads`, 403, { message: 'TF401027: You need the Git Contribute to pull requests permission' }]
      ]
      expect((await failure(post(AZURE, ADDED))).message).toMatch(/^Line comment \[refused\]: /)
    })
  })

  describe('Forgejo', () => {
    const PULL = `${FORGEJO}/api/v1/repos/team/app/pulls/7`

    it('an added line: one COMMENT review holding one new_position comment', async () => {
      await post(`${FORGEJO}/team/app.git`, ADDED)
      expect(posts()).toEqual([
        {
          url: `${PULL}/reviews`,
          method: 'POST',
          body: { event: 'COMMENT', body: '', comments: [{ path: 'src/app.ts', body: 'Nit: name this.', new_position: 12 }] }
        }
      ])
    })

    it('a deleted line: old_position', async () => {
      await post(`${FORGEJO}/team/app.git`, DELETED)
      expect((posts()[0].body as { comments: unknown[] }).comments).toEqual([
        { path: 'src/app.ts', body: 'Nit: name this.', old_position: 9 }
      ])
    })

    it('an unchanged line: new_position', async () => {
      await post(`${FORGEJO}/team/app.git`, CONTEXT)
      expect((posts()[0].body as { comments: unknown[] }).comments).toEqual([
        { path: 'src/app.ts', body: 'Nit: name this.', new_position: 8 }
      ])
    })

    it('a 422 is outside the diff', async () => {
      routes = [['POST', `${PULL}/reviews`, 422, { message: 'line not in diff' }]]
      expect((await failure(post(`${FORGEJO}/team/app.git`, ADDED))).message).toMatch(/^Line comment \[outsideDiff\]: Forgejo: /)
    })
  })

  describe('bitbucket.org', () => {
    const URL = 'https://api.bitbucket.org/2.0/repositories/team/app/pullrequests/7/comments'

    it('an added line: inline `to` its new number', async () => {
      await post(BB_CLOUD, ADDED)
      expect(posts()).toEqual([
        { url: URL, method: 'POST', body: { content: { raw: 'Nit: name this.' }, inline: { path: 'src/app.ts', to: 12 } } }
      ])
    })

    it('a deleted line: inline `from` its old number', async () => {
      await post(BB_CLOUD, DELETED)
      expect((posts()[0].body as { inline: unknown }).inline).toEqual({ path: 'src/app.ts', from: 9 })
    })

    it('an unchanged line: `to` its new number', async () => {
      await post(BB_CLOUD, CONTEXT)
      expect((posts()[0].body as { inline: unknown }).inline).toEqual({ path: 'src/app.ts', to: 8 })
    })

    it('a 401 is refused', async () => {
      routes = [['POST', URL, 401, { error: { message: 'Unauthorized' } }]]
      expect((await failure(post(BB_CLOUD, ADDED))).message).toMatch(/^Line comment \[refused\]: Bitbucket: Unauthorized/)
    })
  })

  describe('Bitbucket Data Center', () => {
    const URL = `${BBS}/rest/api/latest/projects/PROJ/repos/app/pull-requests/7/comments`
    const REMOTE = `${BBS}/scm/proj/app.git`

    it('an added line: ADDED in the destination (TO) of the effective diff', async () => {
      await post(REMOTE, ADDED)
      expect(posts()).toEqual([
        {
          url: URL,
          method: 'POST',
          body: {
            text: 'Nit: name this.',
            anchor: { path: 'src/app.ts', line: 12, lineType: 'ADDED', fileType: 'TO', diffType: 'EFFECTIVE' }
          }
        }
      ])
    })

    it('a deleted line: REMOVED in the source (FROM), its old number', async () => {
      await post(REMOTE, DELETED)
      expect((posts()[0].body as { anchor: unknown }).anchor).toEqual({
        path: 'src/app.ts',
        line: 9,
        lineType: 'REMOVED',
        fileType: 'FROM',
        diffType: 'EFFECTIVE'
      })
    })

    it('an unchanged line: CONTEXT, TO, its new number; a rename names srcPath', async () => {
      await post(REMOTE, CONTEXT)
      expect((posts()[0].body as { anchor: unknown }).anchor).toMatchObject({ line: 8, lineType: 'CONTEXT', fileType: 'TO' })
      sent.length = 0
      await post(REMOTE, RENAMED)
      expect((posts()[0].body as { anchor: unknown }).anchor).toMatchObject({ path: 'src/new.ts', srcPath: 'src/old.ts' })
    })

    it('a 409 is outside the diff', async () => {
      routes = [['POST', URL, 409, { errors: [{ message: 'The line is not part of the diff' }] }]]
      expect((await failure(post(REMOTE, ADDED))).message).toMatch(/^Line comment \[outsideDiff\]: Bitbucket Data Center: /)
    })
  })

  describe('the threads a host returns say which side their line is on', () => {
    it('Data Center: FROM is old, TO new; an orphaned anchor is not placed', async () => {
      const { mapBbsActivities } = await import('../src/main/bitbucketServer')
      const act = (id: number, anchor: Record<string, unknown>): Record<string, unknown> => ({
        id,
        action: 'COMMENTED',
        createdDate: id,
        comment: { id, text: 'x', author: { name: 'ana' } },
        commentAnchor: { path: 'src/app.ts', line: 4, ...anchor }
      })
      const { reviewThreads } = mapBbsActivities([
        act(1, { fileType: 'FROM' }),
        act(2, { fileType: 'TO' }),
        act(3, { fileType: 'TO', orphaned: true })
      ] as never)
      expect(reviewThreads.map((t) => t.side)).toEqual(['old', 'new', undefined])
    })

    it('Azure DevOps: a right-file position is new, a left-file one old', async () => {
      const { mapAzurePr } = await import('../src/main/azurePr')
      const th = (id: number, ctx: Record<string, unknown>): Record<string, unknown> => ({
        id,
        comments: [{ id: 1, content: 'x', commentType: 'text' }],
        threadContext: { filePath: '/src/app.ts', ...ctx }
      })
      const pr = mapAzurePr(
        { org: 'acme', project: 'proj', repo: 'app' },
        { pullRequestId: 7, title: 'T', status: 'active' } as never,
        [th(1, { rightFileStart: { line: 3 } }), th(2, { leftFileStart: { line: 5 } })] as never
      )
      expect(pr.reviewThreads.map((t) => [t.line, t.side])).toEqual([
        [3, 'new'],
        [5, 'old']
      ])
    })
  })

  describe('a diff read before a push is not posted on as if it were current', () => {
    const at = (remote: string, anchor: unknown, revision: unknown): Promise<unknown> =>
      Promise.resolve().then(() => handlers.get('hosting:prCommentOnLine')!({}, '', remote, {}, 7, anchor, 'Nit.', revision))

    it('GitHub: the comment names the commit the diff was read at, without asking for the head', async () => {
      const PR = 'https://api.github.com/repos/team/app/pulls/7'
      await at(GITHUB, ADDED, { headSha: 'read-at' })
      expect(sent.filter((s) => s.method === 'GET')).toEqual([])
      expect(posts()[0]).toMatchObject({ url: `${PR}/comments`, body: { commit_id: 'read-at', line: 12, side: 'RIGHT' } })
    })

    it('GitLab: a different head or merge base is refused, nothing posted; the same refs post', async () => {
      const MR = `${GITLAB}/api/v4/projects/team%2Fapp/merge_requests/7`
      routes = [['GET', MR, 200, { diff_refs: { base_sha: 'b1', start_sha: 's1', head_sha: 'h2' } }]]
      const err = await failure(at(`${GITLAB}/team/app.git`, ADDED, { headSha: 'h1', baseSha: 'b1' }))
      expect(err.message).toMatch(/^Line comment \[stale\]: /)
      expect(posts()).toEqual([])
      routes = [['GET', MR, 200, { diff_refs: { base_sha: 'b2', start_sha: 's1', head_sha: 'h1' } }]]
      await failure(at(`${GITLAB}/team/app.git`, ADDED, { headSha: 'h1', baseSha: 'b1' }))
      expect(posts()).toEqual([])
      routes = [['GET', MR, 200, { diff_refs: { base_sha: 'b1', start_sha: 's1', head_sha: 'h1' } }]]
      await at(`${GITLAB}/team/app.git`, ADDED, { headSha: 'h1', baseSha: 'b1' })
      expect(posts()).toHaveLength(1)
    })

    it('Azure DevOps: a newer iteration is refused', async () => {
      const PR = 'https://dev.azure.com/acme/proj/_apis/git/repositories/app/pullrequests/7'
      routes = [['GET', `${PR}/iterations`, 200, { value: [{ id: 1 }, { id: 2 }, { id: 4 }] }]]
      const err = await failure(at(AZURE, DELETED, { headSha: 'x', iteration: 3 }))
      expect(err.message).toMatch(/^Line comment \[stale\]: /)
      expect(posts()).toEqual([])
    })

    it('Forgejo: another head is refused; the same one posts against that commit', async () => {
      const PULL = `${FORGEJO}/api/v1/repos/team/app/pulls/7`
      routes = [['GET', PULL, 200, { number: 7, head: { sha: 'new' } }]]
      await failure(at(`${FORGEJO}/team/app.git`, DELETED, { headSha: 'old' }))
      expect(posts()).toEqual([])
      routes = [['GET', PULL, 200, { number: 7, head: { sha: 'old' } }]]
      await at(`${FORGEJO}/team/app.git`, DELETED, { headSha: 'old' })
      expect(posts()[0].body).toMatchObject({ commit_id: 'old', comments: [{ old_position: 9 }] })
    })

    it('Data Center: another source head is refused', async () => {
      const PULL = `${BBS}/rest/api/latest/projects/PROJ/repos/app/pull-requests/7`
      routes = [['GET', PULL, 200, { id: 7, fromRef: { latestCommit: 'new' } }]]
      const err = await failure(at(`${BBS}/scm/proj/app.git`, ADDED, { headSha: 'old' }))
      expect(err.message).toMatch(/^Line comment \[stale\]: /)
      expect(posts()).toEqual([])
    })

    it('the files come with the revision they were read at — none when a push landed while reading', async () => {
      const PR = 'https://api.github.com/repos/team/app/pulls/7'
      routes = [
        ['GET', `${PR}/files`, 200, [{ filename: 'a.ts', status: 'modified', additions: 1, deletions: 0, patch: '@@ -1 +1 @@\n+x' }]],
        ['GET', PR, 200, { head: { sha: 'h1' } }]
      ]
      const list = (await handlers.get('hosting:prFiles')!({}, '', GITHUB, {}, 7)) as { files: unknown[]; revision: unknown }
      expect(list.files).toHaveLength(1)
      expect(list.revision).toEqual({ headSha: 'h1' })
      // The head read before the files is not the one read after them.
      vi.mocked(fetch).mockImplementationOnce(async () => new Response(JSON.stringify({ head: { sha: 'h0' } })))
      const moved = (await handlers.get('hosting:prFiles')!({}, '', GITHUB, {}, 7)) as { revision: unknown }
      expect(moved.revision).toBeNull()
    })

    it('a revision that is not one is ignored, not trusted', async () => {
      const { validRevision, isSameRevision } = await import('../src/shared/prLineAnchor')
      expect(validRevision({ headSha: '' })).toBeNull()
      expect(validRevision('abc')).toBeNull()
      expect(validRevision({ headSha: 'a', iteration: 2.5, baseSha: 7 })).toEqual({ headSha: 'a' })
      expect(isSameRevision({ headSha: 'a', iteration: 2 }, { headSha: 'b', iteration: 2 })).toBe(true)
      expect(isSameRevision({ headSha: 'a', baseSha: 'x' }, { headSha: 'a' })).toBe(true)
      expect(isSameRevision({ headSha: 'a', baseSha: 'x' }, { headSha: 'a', baseSha: 'y' })).toBe(false)
    })
  })

  describe('threads read back: which ones the Files tab may draw on a line', () => {
    it('Forgejo: an old-side comment (position 0) is the old side at its original_position', async () => {
      const R = `${FORGEJO}/api/v1/repos/team/app`
      routes = [
        ['GET', `${R}/pulls/7/reviews/1/comments`, 200, [
          { id: 10, body: 'new side', user: { login: 'ana' }, path: 'src/app.ts', position: 12, original_position: 0, created_at: '2026-11-01' },
          { id: 11, body: 'old side', user: { login: 'ana' }, path: 'src/app.ts', position: 0, original_position: 9, created_at: '2026-11-02' }
        ]],
        ['GET', `${R}/pulls/7/reviews`, 200, [{ id: 1, state: 'COMMENT', user: { login: 'ana' } }]],
        ['GET', `${R}/pulls/7`, 200, { number: 7, title: 'T', state: 'open', html_url: 'x', user: { login: 'sam' }, head: { ref: 'f', sha: 's' }, base: { ref: 'main' } }],
        ['GET', `${R}/issues/7/comments`, 200, []]
      ]
      const pr = (await handlers.get('hosting:prDetail')!({}, '', `${FORGEJO}/team/app.git`, {}, 7)) as {
        reviewThreads: Array<{ line: number | null; side?: string }>
      }
      expect(pr.reviewThreads.map((t) => [t.line, t.side])).toEqual([
        [12, 'new'],
        [9, 'old']
      ])
    })

    it('GitLab: a note written against an older head has no side (conversation only)', async () => {
      const MR = `${GITLAB}/api/v4/projects/team%2Fapp/merge_requests/7`
      const note = (id: number, head: string, pos: Record<string, unknown>): Record<string, unknown> => ({
        id: `d${id}`,
        notes: [{ id, system: false, author: { username: 'ana' }, body: 'x', created_at: '2026-11-01', position: { new_path: 'src/app.ts', old_path: 'src/app.ts', head_sha: head, ...pos } }]
      })
      routes = [
        ['GET', `${MR}/discussions`, 200, [note(1, 'h1', { new_line: 4 }), note(2, 'h0', { new_line: 5 }), note(3, 'h1', { old_line: 6 })]],
        ['GET', `${MR}/approvals`, 200, {}],
        ['GET', `${MR}/commits`, 200, []],
        ['GET', MR, 200, { iid: 7, title: 'T', state: 'opened', web_url: 'x', author: { username: 'sam' }, source_branch: 'f', target_branch: 'main', diff_refs: { head_sha: 'h1' } }]
      ]
      const pr = (await handlers.get('hosting:prDetail')!({}, '', `${GITLAB}/team/app.git`, {}, 7)) as {
        reviewThreads: Array<{ line: number | null; side?: string }>
      }
      expect(pr.reviewThreads.map((t) => [t.line, t.side])).toEqual([
        [4, 'new'],
        [5, undefined],
        [6, 'old']
      ])
    })

    it('Azure DevOps: threads are read tracked to the last iteration', async () => {
      const PR = 'https://dev.azure.com/acme/proj/_apis/git/repositories/app/pullrequests/7'
      routes = [
        ['GET', `${PR}/iterations`, 200, { value: [{ id: 1 }, { id: 3, sourceRefCommit: { commitId: 'h3' } }] }],
        ['GET', `${PR}/threads`, 200, { value: [] }],
        ['GET', `${PR}/workitems`, 200, { value: [] }],
        ['GET', PR, 200, { pullRequestId: 7, title: 'T', status: 'active' }]
      ]
      await handlers.get('hosting:prDetail')!({}, '', AZURE, {}, 7)
      expect(sent.find((s) => s.url.startsWith(`${PR}/threads`))?.url).toBe(`${PR}/threads?$iteration=3&$baseIteration=0&api-version=7.1`)
    })
  })

  describe('what the toast says', () => {
    it('refused and outside-the-diff get their own explanation, through the IPC wrapper', async () => {
      const { explainGitError } = await import('../src/renderer/src/lib/gitErrorHint')
      const wrap = (m: string): string => `Error invoking remote method 'hosting:prCommentOnLine': Error: ${m}`
      expect(explainGitError(wrap('Line comment [refused]: GitHub: Resource not accessible by integration'))?.key).toBe(
        'gitError.lineCommentRefused'
      )
      expect(explainGitError(wrap('Line comment [outsideDiff]: GitLab: 400 Bad request'))?.key).toBe('gitError.lineCommentOutsideDiff')
      expect(explainGitError(wrap('Line comment [stale]: the pull request changed since this diff was loaded.'))?.key).toBe(
        'gitError.lineCommentStale'
      )
    })
  })

  describe('what is refused before anything is sent', () => {
    it('an anchor without numbers for its kind, or an empty comment', async () => {
      await failure(post(GITHUB, { path: 'a.ts', kind: 'add', oldLine: 3, newLine: 3 }))
      await failure(post(GITHUB, { path: 'a.ts', kind: 'ctx', oldLine: 3, newLine: null }))
      await failure(post(GITHUB, { path: '', kind: 'del', oldLine: 3, newLine: null }))
      await failure(post(GITHUB, ADDED, '   '))
      expect(sent).toEqual([])
    })
  })
})
