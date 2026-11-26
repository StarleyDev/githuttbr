import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'
import type { PrDiffCommits, PrImageContent } from '../src/shared/prImage'

// The pull request image preview's host side, per host: the raw-file URL each
// one is asked (paths with spaces and non-ASCII characters encoded), the
// headers, the size cap, GitHub's large-file path through the blobs API, and
// the merge base the Files tab compares against. The real IPC handlers run
// against a fake fetch and a real settings file.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-pr-image-'))
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
const BBS = 'https://bitbucket.example.corp'

type Answer = { status?: number; body: unknown; headers?: Record<string, string> }
let routes: Array<[string, Answer]> = []
const asked: Array<{ url: string; headers: Record<string, string>; redirect?: string }> = []

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const sha = (c: string): string => c.repeat(40)
const PATH = 'assets/ícone novo 🎨.png'

const content = (remote: string, commit: string, path: string): Promise<PrImageContent> =>
  Promise.resolve().then(() => handlers.get('hosting:prFileContent')!({}, '', remote, {}, commit, path) as Promise<PrImageContent>)
const commits = (remote: string): Promise<PrDiffCommits | null> =>
  Promise.resolve().then(() => handlers.get('hosting:prDiffCommits')!({}, '', remote, {}, 7) as Promise<PrDiffCommits | null>)

describe('pull request image preview — main, per host', () => {
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
        asked.push({ url, headers: (init?.headers ?? {}) as Record<string, string>, redirect: init?.redirect })
        const hit = routes.filter(([prefix]) => url.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0]
        const a = hit?.[1] ?? { status: 404, body: {} }
        const raw = Buffer.isBuffer(a.body) ? new Uint8Array(a.body) : JSON.stringify(a.body)
        return new Response(raw, {
          status: a.status ?? 200,
          headers: { 'content-type': Buffer.isBuffer(a.body) ? 'application/octet-stream' : 'application/json', ...a.headers }
        })
      })
    )
  })
  afterEach(() => {
    routes = []
    asked.length = 0
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    rmSync(dir, { recursive: true, force: true })
  })

  describe('GitHub', () => {
    const API = 'https://api.github.com/repos/team/app'
    const CONTENTS = `${API}/contents/assets/%C3%ADcone%20novo%20%F0%9F%8E%A8.png?ref=${sha('a')}`

    it('a small file comes inline from the contents API, object media type, path encoded per segment', async () => {
      routes = [[CONTENTS, { body: { type: 'file', size: PNG.length, sha: sha('b'), encoding: 'base64', content: PNG.toString('base64') } }]]
      const r = await content(GITHUB, sha('a'), PATH)
      expect(asked.map((c) => c.url)).toEqual([CONTENTS])
      expect(asked[0].headers).toMatchObject({ Authorization: 'Bearer gh-token', Accept: 'application/vnd.github.object+json' })
      expect(r).toEqual({ status: 'ok', dataUrl: `data:image/png;base64,${PNG.toString('base64')}` })
    })

    it('past the contents API’s 1 MB, the bytes come from the blobs API by the blob id, as raw', async () => {
      routes = [
        [CONTENTS, { body: { type: 'file', size: 2_000_000, sha: sha('b'), encoding: 'none', content: '' } }],
        [`${API}/git/blobs/${sha('b')}`, { body: PNG }]
      ]
      const r = await content(GITHUB, sha('a'), PATH)
      expect(asked.map((c) => c.url)).toEqual([CONTENTS, `${API}/git/blobs/${sha('b')}`])
      expect(asked[1].headers).toMatchObject({ Accept: 'application/vnd.github.raw+json', Authorization: 'Bearer gh-token' })
      expect(r.status).toBe('ok')
    })

    it('over the cap by the size the contents API names: refused before any bytes move', async () => {
      routes = [[CONTENTS, { body: { type: 'file', size: 40 * 1024 * 1024, sha: sha('b'), encoding: 'none', content: '' } }]]
      expect(await content(GITHUB, sha('a'), PATH)).toEqual({ status: 'tooLarge', size: 40 * 1024 * 1024 })
      expect(asked).toHaveLength(1)
    })

    it('no such file at that commit is "missing", not an error', async () => {
      expect(await content(GITHUB, sha('a'), 'gone.png')).toEqual({ status: 'missing' })
    })

    it('the merge base comes from a compare of the base tip and the head', async () => {
      routes = [
        [`${API}/pulls/7`, { body: { head: { sha: sha('h') }, base: { sha: sha('t') } } }],
        [`${API}/compare/${sha('t')}...${sha('h')}`, { body: { merge_base_commit: { sha: sha('m') } } }]
      ]
      expect(await commits(GITHUB)).toEqual({ baseSha: sha('m'), headSha: sha('h') })
      expect(asked[1].url).toBe(`${API}/compare/${sha('t')}...${sha('h')}?per_page=1&page=1`)
    })
  })

  it('GitLab: the raw endpoint, the whole path encoded (slashes too), LFS resolved, no redirect', async () => {
    const url = `${GITLAB}/api/v4/projects/team%2Fapp/repository/files/assets%2F%C3%ADcone%20novo%20%F0%9F%8E%A8.png/raw?ref=${sha('a')}&lfs=true`
    routes = [[url, { body: PNG }]]
    const r = await content(`${GITLAB}/team/app.git`, sha('a'), PATH)
    expect(asked.map((c) => c.url)).toEqual([url])
    expect(asked[0].headers).toMatchObject({ 'PRIVATE-TOKEN': 'gl-token' })
    expect(asked[0].redirect).toBe('error')
    expect(r.status).toBe('ok')
  })

  it('GitLab: the merge request’s diff refs name the merge base', async () => {
    routes = [[`${GITLAB}/api/v4/projects/team%2Fapp/merge_requests/7`, { body: { diff_refs: { base_sha: sha('m'), head_sha: sha('h') } } }]]
    expect(await commits(`${GITLAB}/team/app.git`)).toEqual({ baseSha: sha('m'), headSha: sha('h') })
  })

  it('Azure DevOps: Items - Get by commit, octet-stream, LFS resolved', async () => {
    const url =
      `https://dev.azure.com/acme/proj/_apis/git/repositories/app/items?path=%2Fassets%2F%C3%ADcone%20novo%20%F0%9F%8E%A8.png` +
      `&versionDescriptor.version=${sha('a')}&versionDescriptor.versionType=commit&resolveLfs=true&api-version=7.1`
    routes = [[url, { body: PNG }]]
    const r = await content(AZURE, sha('a'), PATH)
    expect(asked.map((c) => c.url)).toEqual([url])
    expect(asked[0].headers).toMatchObject({ Accept: 'application/octet-stream' })
    expect(asked[0].headers.Authorization).toMatch(/^Basic /)
    expect(r.status).toBe('ok')
  })

  it('Azure DevOps: a sign-in page (203, HTML) is a refused credential, never an image', async () => {
    routes = [['https://dev.azure.com/acme/proj/_apis/git/repositories/app/items', { status: 203, body: '<html>', headers: { 'content-type': 'text/html' } }]]
    await expect(content(AZURE, sha('a'), 'logo.png')).rejects.toThrow(/refused/)
  })

  it('Forgejo: /media/ at the commit, the token scheme', async () => {
    const url = `${FORGEJO}/api/v1/repos/team/app/media/assets/%C3%ADcone%20novo%20%F0%9F%8E%A8.png?ref=${sha('a')}`
    routes = [[url, { body: PNG }]]
    const r = await content(`${FORGEJO}/team/app.git`, sha('a'), PATH)
    expect(asked.map((c) => c.url)).toEqual([url])
    expect(asked[0].headers).toMatchObject({ Authorization: 'token fj-token' })
    expect(r.status).toBe('ok')
  })

  it('Bitbucket Data Center: raw at the commit; the changes’ other end is the base', async () => {
    const API = `${BBS}/rest/api/latest/projects/PROJ/repos/app`
    const url = `${API}/raw/assets/%C3%ADcone%20novo%20%F0%9F%8E%A8.png?at=${sha('a')}`
    routes = [[url, { body: PNG }]]
    const r = await content(`${BBS}/scm/proj/app.git`, sha('a'), PATH)
    expect(asked.map((c) => c.url)).toEqual([url])
    expect(asked[0].headers).toMatchObject({ Authorization: 'Bearer bbs-token' })
    expect(r.status).toBe('ok')

    asked.length = 0
    routes = [
      [`${API}/pull-requests/7`, { body: { id: 7, title: 'x', fromRef: { latestCommit: sha('h') }, toRef: { latestCommit: sha('t') } } }],
      [`${API}/pull-requests/7/changes`, { body: { fromHash: sha('h'), toHash: sha('m'), values: [] } }]
    ]
    expect(await commits(`${BBS}/scm/proj/app.git`)).toEqual({ baseSha: sha('m'), headSha: sha('h') })
  })

  it('a body past the cap with no Content-Length is cut off as it streams', async () => {
    const { readCappedBody } = await import('../src/main/prFileContent')
    const big = new Response(new Uint8Array(5000))
    big.headers.delete('content-length')
    expect(await readCappedBody(big, 1000)).toEqual({ tooLarge: expect.any(Number) })
    const declared = new Response(new Uint8Array(10), { headers: { 'content-length': '999999' } })
    expect(await readCappedBody(declared, 1000)).toEqual({ tooLarge: 999999 })
    const small = await readCappedBody(new Response(new Uint8Array([1, 2, 3])), 1000)
    expect('bytes' in small && [...small.bytes]).toEqual([1, 2, 3])
  })

  it('a short id, a path that climbs out, or a file that is not an image never reaches a URL', async () => {
    await expect(content(GITHUB, 'abc123', 'logo.png')).rejects.toThrow()
    await expect(content(GITHUB, sha('a'), '../secret.png')).rejects.toThrow()
    await expect(content(GITHUB, sha('a'), '/etc/passwd.png')).rejects.toThrow()
    await expect(content(GITHUB, sha('a'), '.env')).rejects.toThrow()
    expect(asked).toEqual([])
  })
})
