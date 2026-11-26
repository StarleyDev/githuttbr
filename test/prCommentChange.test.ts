import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings, type PrCommentHandle } from '../src/shared/types'

// Editing and deleting one of your own comments on a pull request, per host:
// the request each one is sent (URL, method, payload), Data Center's version,
// and how each refusal is named for the toast. The real IPC handlers run
// against a fake fetch and a real settings file.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-pr-comment-change-'))
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
const BBS_REMOTE = `${BBS}/scm/proj/app.git`

interface Sent {
  url: string
  method: string
  body: unknown
}
/** [method, URL prefix, status, body]. The first match answers; anything else is 200 {}. */
let routes: Array<[string, string, number, unknown]> = []
const sent: Sent[] = []

const edit = (remote: string, handle: unknown, body: unknown = 'Better wording.'): Promise<unknown> =>
  Promise.resolve().then(() => handlers.get('hosting:prEditComment')!({}, '', remote, {}, 7, handle, body))
const remove = (remote: string, handle: unknown): Promise<unknown> =>
  Promise.resolve().then(() => handlers.get('hosting:prDeleteComment')!({}, '', remote, {}, 7, handle))
const writes = (): Sent[] => sent.filter((s) => s.method !== 'GET')
const failure = (p: Promise<unknown>): Promise<Error> =>
  p.then(
    () => {
      throw new Error('expected a failure')
    },
    (e: Error) => e
  )

const CONVERSATION: PrCommentHandle = { id: 41, kind: 'conversation' }
const REVIEW: PrCommentHandle = { id: 42, kind: 'review' }

describe('editing and deleting a pull request comment — main', () => {
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
        // A 204 carries no body: the clients must not try to read one.
        if (status === 204) return new Response(null, { status })
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
    const API = 'https://api.github.com/repos/team/app'

    it('a conversation comment is edited and deleted through the issue comments endpoint', async () => {
      await edit(GITHUB, CONVERSATION)
      routes = [['DELETE', `${API}/issues/comments/41`, 204, null]]
      await remove(GITHUB, CONVERSATION)
      expect(writes()).toEqual([
        { url: `${API}/issues/comments/41`, method: 'PATCH', body: { body: 'Better wording.' } },
        { url: `${API}/issues/comments/41`, method: 'DELETE', body: undefined }
      ])
    })

    it('a review comment goes through the pull comments endpoint', async () => {
      await edit(GITHUB, REVIEW, '  Trimmed.  ')
      routes = [['DELETE', `${API}/pulls/comments/42`, 204, null]]
      await remove(GITHUB, REVIEW)
      expect(writes()).toEqual([
        { url: `${API}/pulls/comments/42`, method: 'PATCH', body: { body: 'Trimmed.' } },
        { url: `${API}/pulls/comments/42`, method: 'DELETE', body: undefined }
      ])
    })

    it('a 403 is "not allowed", a 404 "gone", a 401 "refused"', async () => {
      routes = [['PATCH', API, 403, { message: 'Must have admin rights' }]]
      expect((await failure(edit(GITHUB, CONVERSATION))).message).toMatch(/^Comment change \[notAllowed\]: GitHub: Must have admin rights/)
      routes = [['DELETE', API, 404, { message: 'Not Found' }]]
      expect((await failure(remove(GITHUB, REVIEW))).message).toMatch(/^Comment change \[gone\]: /)
      routes = [['PATCH', API, 401, { message: 'Bad credentials' }]]
      expect((await failure(edit(GITHUB, CONVERSATION))).message).toMatch(/^Comment change \[refused\]: /)
    })

    it('a spent rate limit keeps its own message', async () => {
      routes = [['PATCH', API, 403, { message: 'API rate limit exceeded' }]]
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockImplementationOnce(
        async () =>
          new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000000000' }
          })
      )
      expect((await failure(edit(GITHUB, CONVERSATION))).message).toMatch(/^GitHub rate limit exceeded/)
    })
  })

  describe('GitLab', () => {
    const MR = `${GITLAB}/api/v4/projects/team%2Fapp/merge_requests/7`

    it('both kinds go through the merge request notes endpoint', async () => {
      await edit(`${GITLAB}/team/app.git`, REVIEW)
      routes = [['DELETE', `${MR}/notes/41`, 204, null]]
      await remove(`${GITLAB}/team/app.git`, CONVERSATION)
      expect(writes()).toEqual([
        { url: `${MR}/notes/42`, method: 'PUT', body: { body: 'Better wording.' } },
        { url: `${MR}/notes/41`, method: 'DELETE', body: undefined }
      ])
    })

    it('a 403 is "not allowed"', async () => {
      routes = [['PUT', MR, 403, { message: '403 Forbidden' }]]
      expect((await failure(edit(`${GITLAB}/team/app.git`, REVIEW))).message).toMatch(/^Comment change \[notAllowed\]: GitLab: /)
    })
  })

  describe('Azure DevOps', () => {
    const PR = 'https://dev.azure.com/acme/proj/_apis/git/repositories/app/pullrequests/7'
    const IN_THREAD: PrCommentHandle = { id: 2, kind: 'review', threadId: 9 }

    it('the comment is reached through its thread', async () => {
      await edit(AZURE, IN_THREAD)
      await remove(AZURE, IN_THREAD)
      expect(writes()).toEqual([
        { url: `${PR}/threads/9/comments/2?api-version=7.1`, method: 'PATCH', body: { content: 'Better wording.' } },
        { url: `${PR}/threads/9/comments/2?api-version=7.1`, method: 'DELETE', body: undefined }
      ])
    })

    it('without a thread nothing is sent', async () => {
      await failure(edit(AZURE, { id: 2, kind: 'conversation' }))
      expect(writes()).toEqual([])
    })

    it('a 403 is "not allowed"', async () => {
      routes = [['DELETE', PR, 403, { message: 'You do not have permission' }]]
      expect((await failure(remove(AZURE, IN_THREAD))).message).toMatch(/^Comment change \[notAllowed\]: Azure DevOps: /)
    })
  })

  describe('Forgejo', () => {
    const API = `${FORGEJO}/api/v1/repos/team/app`

    it('a conversation comment goes through the issue comments endpoint', async () => {
      await edit(`${FORGEJO}/team/app.git`, CONVERSATION)
      routes = [['DELETE', `${API}/issues/comments/41`, 204, null]]
      await remove(`${FORGEJO}/team/app.git`, CONVERSATION)
      expect(writes()).toEqual([
        { url: `${API}/issues/comments/41`, method: 'PATCH', body: { body: 'Better wording.' } },
        { url: `${API}/issues/comments/41`, method: 'DELETE', body: undefined }
      ])
    })

    it('a review comment is refused before anything is sent: the API cannot edit one', async () => {
      await failure(edit(`${FORGEJO}/team/app.git`, REVIEW))
      await failure(remove(`${FORGEJO}/team/app.git`, REVIEW))
      expect(writes()).toEqual([])
    })
  })

  describe('bitbucket.org', () => {
    const URL = 'https://api.bitbucket.org/2.0/repositories/team/app/pullrequests/7/comments/41'

    it('PUT with the raw content, and DELETE', async () => {
      await edit(BB_CLOUD, CONVERSATION)
      routes = [['DELETE', URL, 204, null]]
      await remove(BB_CLOUD, CONVERSATION)
      expect(writes()).toEqual([
        { url: URL, method: 'PUT', body: { content: { raw: 'Better wording.' } } },
        { url: URL, method: 'DELETE', body: undefined }
      ])
    })

    it('a 403 is "not allowed"', async () => {
      routes = [['PUT', URL, 403, { error: { message: 'Forbidden' } }]]
      expect((await failure(edit(BB_CLOUD, CONVERSATION))).message).toMatch(/^Comment change \[notAllowed\]: Bitbucket: Forbidden/)
    })
  })

  describe('Bitbucket Data Center', () => {
    const URL = `${BBS}/rest/api/latest/projects/PROJ/repos/app/pull-requests/7/comments/41`
    const VERSIONED: PrCommentHandle = { id: 41, kind: 'conversation', version: 3 }

    it('the version the page read rides in the edit body and the delete query', async () => {
      await edit(BBS_REMOTE, VERSIONED)
      routes = [['DELETE', URL, 204, null]]
      await remove(BBS_REMOTE, VERSIONED)
      expect(writes()).toEqual([
        { url: URL, method: 'PUT', body: { text: 'Better wording.', version: 3 } },
        { url: `${URL}?version=3`, method: 'DELETE', body: undefined }
      ])
    })

    it('version 0 is a version', async () => {
      await edit(BBS_REMOTE, { ...VERSIONED, version: 0 })
      expect(writes()[0].body).toEqual({ text: 'Better wording.', version: 0 })
    })

    it('without a version nothing is sent', async () => {
      await failure(edit(BBS_REMOTE, CONVERSATION))
      await failure(remove(BBS_REMOTE, CONVERSATION))
      expect(writes()).toEqual([])
    })

    it('a 409 on an edit is "changed"; on a delete it may also be replies: "conflict"', async () => {
      routes = [['PUT', URL, 409, { errors: [{ message: 'You are attempting to modify a comment based on out-of-date information.' }] }]]
      expect((await failure(edit(BBS_REMOTE, VERSIONED))).message).toMatch(/^Comment change \[changed\]: Bitbucket Data Center: /)
      routes = [['DELETE', URL, 409, { errors: [{ message: 'This comment has replies which must be deleted first.' }] }]]
      expect((await failure(remove(BBS_REMOTE, VERSIONED))).message).toMatch(/^Comment change \[conflict\]: /)
    })

    it('a 401 (this resource: not allowed to change it) is "refused"', async () => {
      routes = [['PUT', URL, 401, { errors: [{ message: 'You are not permitted to update this comment.' }] }]]
      expect((await failure(edit(BBS_REMOTE, VERSIONED))).message).toMatch(/^Comment change \[refused\]: /)
    })
  })

  describe('what is refused before anything is sent', () => {
    it('a malformed handle, an empty edit, a bad number', async () => {
      await failure(edit(GITHUB, { id: 0, kind: 'conversation' }))
      await failure(edit(GITHUB, { id: 1.5, kind: 'conversation' }))
      await failure(edit(GITHUB, { id: 4, kind: 'note' }))
      await failure(edit(GITHUB, { id: 4, kind: 'review', version: -1 }))
      await failure(edit(GITHUB, '4'))
      await failure(edit(GITHUB, CONVERSATION, '   '))
      await failure(edit(GITHUB, CONVERSATION, 42))
      await failure(Promise.resolve().then(() => handlers.get('hosting:prDeleteComment')!({}, '', GITHUB, {}, 0, CONVERSATION)))
      expect(writes()).toEqual([])
    })
  })

  describe('what the toast says', () => {
    it('each refusal gets its own explanation, through the IPC wrapper', async () => {
      const { explainGitError } = await import('../src/renderer/src/lib/gitErrorHint')
      const wrap = (m: string): string => `Error invoking remote method 'hosting:prEditComment': Error: ${m}`
      expect(explainGitError(wrap('Comment change [refused]: GitHub: Bad credentials'))?.key).toBe('gitError.commentRefused')
      expect(explainGitError(wrap('Comment change [notAllowed]: GitLab: 403 Forbidden'))?.key).toBe('gitError.commentNotAllowed')
      expect(explainGitError(wrap('Comment change [gone]: GitHub: Not Found'))?.key).toBe('gitError.commentGone')
      expect(explainGitError(wrap('Comment change [changed]: Bitbucket Data Center: out-of-date'))?.key).toBe('gitError.commentChanged')
      expect(explainGitError(wrap('Comment change [conflict]: Bitbucket Data Center: has replies'))?.key).toBe('gitError.commentConflict')
    })
  })

  describe('what the mappers hand the page', () => {
    it('GitHub: a conversation handle, and "edited" when updated_at is past created_at', async () => {
      const { mapGhIssueComment } = await import('../src/main/hosting')
      const c = mapGhIssueComment({
        id: 5,
        user: { login: 'ana' },
        body: 'x',
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-01T10:05:00Z'
      })
      expect(c.handle).toEqual({ id: 5, kind: 'conversation' })
      expect(c.edited).toBe(true)
      expect(mapGhIssueComment({ id: 6, user: null, body: 'y', created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' }).edited).toBeUndefined()
    })

    it('Azure DevOps: thread and comment id; deleted comments hidden; edited from the content date', async () => {
      const { mapAzurePr } = await import('../src/main/azurePr')
      const pr = mapAzurePr(
        { org: 'acme', project: 'proj', repo: 'app' },
        { pullRequestId: 7, title: 'T', status: 'active' } as never,
        [
          {
            id: 9,
            comments: [
              { id: 1, content: 'gone', isDeleted: true, commentType: 'text' },
              {
                id: 2,
                content: 'kept',
                commentType: 'text',
                publishedDate: '2026-01-01T10:00:00Z',
                lastContentUpdatedDate: '2026-01-02T10:00:00Z'
              }
            ]
          },
          { id: 10, comments: [{ id: 1, content: 'line', commentType: 'text' }], threadContext: { filePath: '/a.ts', rightFileStart: { line: 2 } } }
        ] as never
      )
      expect(pr.comments).toHaveLength(1)
      expect(pr.comments[0].handle).toEqual({ id: 2, kind: 'conversation', threadId: 9 })
      expect(pr.comments[0].edited).toBe(true)
      expect(pr.reviewThreads[0].comments[0].handle).toEqual({ id: 1, kind: 'review', threadId: 10 })
    })

    it('Data Center: the version is carried, conversation and review alike', async () => {
      const { mapBbsActivities } = await import('../src/main/bitbucketServer')
      const { comments, reviewThreads } = mapBbsActivities([
        { id: 1, action: 'COMMENTED', createdDate: 1, comment: { id: 11, version: 2, text: 'a', author: { name: 'ana' } } },
        {
          id: 2,
          action: 'COMMENTED',
          createdDate: 2,
          comment: { id: 12, version: 0, text: 'b', author: { name: 'ana' }, createdDate: 1000, updatedDate: 90000 },
          commentAnchor: { path: 'a.ts', line: 3, fileType: 'TO' }
        }
      ] as never)
      expect(comments[0].handle).toEqual({ id: 11, kind: 'conversation', version: 2 })
      expect(reviewThreads[0].comments[0].handle).toEqual({ id: 12, kind: 'review', version: 0 })
      expect(reviewThreads[0].comments[0].edited).toBe(true)
    })

    it('Forgejo: conversation comments get a handle; review comments none', async () => {
      const { mapForgejoComment } = await import('../src/main/forgejo')
      expect(mapForgejoComment({ id: 3, body: 'x', created_at: '2026-01-01T10:00:00Z' }).handle).toEqual({ id: 3, kind: 'conversation' })
    })
  })
})
