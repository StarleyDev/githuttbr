import { describe, it, expect, afterEach, vi } from 'vitest'
import { glJson, glJobToCheck, diffLineCounts, getGitlabJobId } from '../src/main/hosting'

const TOKEN = 'glpat-abcdefghijklmnop'

function stubFetch(status: number, body: string | null): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => new Response(body, { status, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('glJson', () => {
  it('sends a Settings token as PRIVATE-TOKEN', async () => {
    const fn = stubFetch(200, '{"ok":true}')
    await glJson('https://gitlab.com/api/v4/x', { token: TOKEN })
    const init = fn.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe(TOKEN)
  })

  it('sends a borrowed git credential as Bearer', async () => {
    const fn = stubFetch(200, '{"ok":true}')
    await glJson('https://gitlab.com/api/v4/x', { token: TOKEN, cred: { username: 'oauth2', password: TOKEN } })
    const init = fn.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('surfaces a string error message', async () => {
    stubFetch(403, JSON.stringify({ message: '403 Forbidden' }))
    await expect(glJson('https://gitlab.com/api/v4/x', { token: TOKEN })).rejects.toThrow('GitLab: 403 Forbidden')
  })

  it('joins an array error message', async () => {
    // GitLab validation errors arrive as {message: ["a", "b"]}.
    stubFetch(422, JSON.stringify({ message: ['source is invalid', 'target is protected'] }))
    await expect(glJson('https://gitlab.com/api/v4/x', { token: TOKEN })).rejects.toThrow(
      'GitLab: source is invalid; target is protected'
    )
  })

  it('falls back to the status code for unparseable errors', async () => {
    stubFetch(500, 'not json')
    await expect(glJson('https://gitlab.com/api/v4/x', { token: TOKEN })).rejects.toThrow('GitLab API error (500)')
  })

  it('tolerates an empty 2xx body', async () => {
    stubFetch(204, null)
    await expect(glJson('https://gitlab.com/api/v4/x', { token: TOKEN })).resolves.toBeUndefined()
  })
})

describe('glJobToCheck', () => {
  it('maps running jobs to in_progress with no conclusion', () => {
    expect(glJobToCheck({ name: 'build', status: 'running', web_url: 'https://x' })).toEqual({
      name: 'build',
      status: 'in_progress',
      conclusion: null,
      url: 'https://x'
    })
  })

  it('carries the pipeline, the times and the log of a finished job', () => {
    const c = glJobToCheck(
      {
        name: 'test',
        status: 'failed',
        web_url: 'https://gitlab.example.org/studio/catalog/-/jobs/456',
        started_at: '2026-11-20T10:00:00Z',
        finished_at: '2026-11-20T10:01:12Z'
      },
      { id: 78, sha: 'a41c9e2' }
    )
    expect(c).toMatchObject({ hasLog: true, runId: '78', sha: 'a41c9e2', startedAt: Date.parse('2026-11-20T10:00:00Z') })
    expect(c.finishedAt! - c.startedAt!).toBe(72_000)
  })

  it('reads a job id only from a job link', () => {
    expect(getGitlabJobId('https://gitlab.example.org/a/b/-/jobs/456')).toBe('456')
    expect(getGitlabJobId('https://gitlab.example.org/a/b/-/pipelines/456')).toBeNull()
  })

  it('maps terminal states to the check-run vocabulary', () => {
    expect(glJobToCheck({ name: 'a', status: 'success' }).conclusion).toBe('success')
    expect(glJobToCheck({ name: 'a', status: 'failed' }).conclusion).toBe('failure')
    expect(glJobToCheck({ name: 'a', status: 'canceled' }).conclusion).toBe('cancelled')
    expect(glJobToCheck({ name: 'a', status: 'skipped' }).conclusion).toBe('skipped')
    expect(glJobToCheck({ name: 'a', status: 'manual' }).conclusion).toBe('action_required')
  })

  it('treats queued-ish states as queued', () => {
    for (const s of ['created', 'pending', 'waiting_for_resource', 'preparing', 'scheduled']) {
      expect(glJobToCheck({ name: 'a', status: s }).status).toBe('queued')
    }
  })

  it('does not crash on an unknown status', () => {
    expect(glJobToCheck({ name: 'a', status: 'somethingnew' })).toEqual({
      name: 'a',
      status: 'completed',
      conclusion: 'neutral',
      url: ''
    })
  })
})

describe('diffLineCounts', () => {
  it('counts added and removed lines, skipping file headers', () => {
    const diff = ['--- a/f.txt', '+++ b/f.txt', '@@ -1,3 +1,3 @@', ' ctx', '-old', '+new', '+more'].join('\n')
    expect(diffLineCounts(diff)).toEqual({ additions: 2, deletions: 1 })
  })

  it('returns zeros for an empty diff', () => {
    expect(diffLineCounts('')).toEqual({ additions: 0, deletions: 0 })
  })
})
