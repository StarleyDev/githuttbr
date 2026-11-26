import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  AZURE_EAGER_FILES,
  AZURE_FILES_DEADLINE_MS,
  AzureThrottle,
  azureFileDiff,
  azurePrFiles,
  parseRetryAfter,
  withThrottleRetry,
  type Ado,
  type AdoBytes
} from '../src/main/azurePr'
import { adoBytes } from '../src/main/hosting'

// Azure DevOps sends no patch: each file's two versions are read and diffed
// here. A PR of 279 files used to stop diffing at 200, swallow throttling and
// trust Azure's isBinary, and every one of those showed as "binary or too large".

const R = { org: 'example-org', project: 'My Project', repo: 'app' }
const BASE = 'a'.repeat(40)
const HEAD = 'b'.repeat(40)
const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

/** A clock that moves only when someone sleeps — waits are recorded, nothing really waits. */
function fakeClock(): { throttle: AzureThrottle; waits: number[]; advance: (ms: number) => void } {
  let now = 1_000_000
  const waits: number[] = []
  const throttle = new AzureThrottle(
    async (ms) => {
      waits.push(ms)
      now += ms
    },
    () => now
  )
  return { throttle, waits, advance: (ms) => (now += ms) }
}

/** A fake Azure: one iteration, `n` modified text files, every version served as raw bytes. */
function fakeAzure(
  n: number,
  version: (path: string, commit: string) => Uint8Array | Error = (p, c) => enc(`${p}\n${c === HEAD ? 'new' : 'old'}\n`),
  pages: { nextSkip?: number; nextTop?: number } = {}
) {
  const paths = Array.from({ length: n }, (_, i) => `/src/file${i + 1}.cs`)
  const reads: string[] = []
  const ado: Ado = async <T,>(url: string): Promise<T> => {
    if (url.includes('/iterations?')) {
      return { value: [{ id: 3, sourceRefCommit: { commitId: HEAD }, commonRefCommit: { commitId: BASE } }] } as T
    }
    if (url.includes('/iterations/3/changes')) {
      return { changeEntries: paths.map((p) => ({ changeType: 'edit', item: { path: p, gitObjectType: 'blob' } })), ...pages } as T
    }
    throw new Error(`unexpected ${url}`)
  }
  const bytes: AdoBytes = async (url) => {
    const u = new URL(url)
    const path = u.searchParams.get('path')!
    const commit = u.searchParams.get('versionDescriptor.version')!
    // Raw bytes come by the Accept header alone: no `$format` on the URL.
    expect(u.searchParams.has('$format')).toBe(false)
    reads.push(path)
    const v = version(path, commit)
    if (v instanceof Error) throw v
    return v
  }
  return { ado, bytes, reads }
}

describe('Azure DevOps PR files — every file gets its diff', () => {
  it('a PR of 279 text files: the first ones diffed now, the rest read when opened — none "binary"', async () => {
    const az = fakeAzure(279)
    const { files, truncated } = await azurePrFiles(az.ado, az.bytes, R, 7)
    expect(truncated).toBe(false)
    expect(files).toHaveLength(279)
    expect(files.some((f) => f.noPatchReason === 'binary' || f.noPatchReason === 'tooLarge')).toBe(false)
    const eager = files.slice(0, AZURE_EAGER_FILES)
    expect(eager.every((f) => f.patch && f.additions === 1 && f.deletions === 1)).toBe(true)
    const later = files.slice(AZURE_EAGER_FILES)
    expect(later.every((f) => f.noPatchReason === 'notLoaded' && !f.patch)).toBe(true)
    // Opening the last one reads it.
    const last = await azureFileDiff(az.bytes, R, later[later.length - 1], BASE, HEAD)
    expect(last.filename).toBe('src/file279.cs')
    expect(last.patch).toContain('+new')
    expect(last.noPatchReason).toBeUndefined()
  })

  it('decides binary from the bytes: a NUL-filled image is binary, a UTF-16 file and a Latin-1 file are text', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52])
    const utf16 = (s: string): Uint8Array => new Uint8Array(Buffer.from(`﻿${s}`, 'utf16le'))
    const latin1 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'latin1'))
    const az = fakeAzure(3, (p, c) =>
      p.endsWith('1.cs') ? png : p.endsWith('2.cs') ? utf16(`olá\n${c === HEAD ? 'mundo' : 'world'}\n`) : latin1(`ação ${c === HEAD ? 2 : 1}\n`)
    )
    const [image, wide, legacy] = (await azurePrFiles(az.ado, az.bytes, R, 7)).files
    expect(image.noPatchReason).toBe('binary')
    expect(wide.patch).toContain('+mundo')
    expect(wide.patch).toContain(' olá')
    expect(legacy.patch).toContain('+ação 2')
  })

  it('a read that keeps failing is `failed` with the reason — not binary, and the other files still load', async () => {
    const az = fakeAzure(3, (p, c) =>
      p.endsWith('2.cs') ? Object.assign(new Error('Azure DevOps: TF401019: not found'), { status: 404 }) : enc(`${p} ${c}\n`)
    )
    const { files } = await azurePrFiles(az.ado, az.bytes, R, 7)
    expect(files[1]).toMatchObject({ noPatchReason: 'failed', noPatchError: 'Azure DevOps: TF401019: not found' })
    expect(files[0].patch).toBeTruthy()
    expect(files[2].patch).toBeTruthy()
  })

  it('a version over the size cap is tooLarge', async () => {
    const az = fakeAzure(1)
    const big: AdoBytes = async () => 'tooLarge'
    const [f] = (await azurePrFiles(az.ado, big, R, 7)).files
    expect(f.noPatchReason).toBe('tooLarge')
  })

  it('says when the ten-page cap cut the list', async () => {
    const az = fakeAzure(2, undefined, { nextSkip: 2000, nextTop: 2000 })
    expect((await azurePrFiles(az.ado, az.bytes, R, 7)).truncated).toBe(true)
  })

  it('past the shared deadline, the files not read yet stay notLoaded', async () => {
    const clock = fakeClock()
    let reads = 0
    const az = fakeAzure(30)
    const slow: AdoBytes = async (url, max) => {
      // Every read costs a quarter of the deadline: a few files in, the time is up.
      if (++reads % 2 === 0) clock.advance(AZURE_FILES_DEADLINE_MS / 4)
      return az.bytes(url, max)
    }
    const { files } = await azurePrFiles(az.ado, slow, R, 7, clock.throttle)
    const read = files.filter((f) => f.patch).length
    expect(read).toBeGreaterThan(0)
    expect(read).toBeLessThan(10)
    expect(files.filter((f) => f.noPatchReason === 'notLoaded')).toHaveLength(30 - read)
  })
})

describe('throttling — retried, never swallowed', () => {
  it('parses Retry-After as seconds or a date', () => {
    expect(parseRetryAfter('3')).toBe(3000)
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:05 GMT', Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'))).toBe(5000)
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter('soon')).toBeNull()
  })

  it('waits as long as the server asks on a 429, then succeeds', async () => {
    const clock = fakeClock()
    let calls = 0
    const out = await withThrottleRetry(async () => {
      if (++calls < 3) throw Object.assign(new Error('throttled'), { status: 429, retryAfterMs: 1500 })
      return 'ok'
    }, clock.throttle)
    expect(out).toBe('ok')
    expect(clock.waits).toEqual([1500, 1500])
  })

  it('backs off on a 503 without Retry-After, and gives up with the last error', async () => {
    const clock = fakeClock()
    const run = withThrottleRetry(async () => {
      throw Object.assign(new Error('unavailable'), { status: 503, retryAfterMs: null })
    }, clock.throttle)
    await expect(run).rejects.toThrow('unavailable')
    expect(clock.waits).toEqual([500, 1000, 2000])
  })

  it('does not retry a refusal that will not change (404, 401)', async () => {
    let calls = 0
    await expect(
      withThrottleRetry(async () => {
        calls++
        throw Object.assign(new Error('nope'), { status: 404 })
      }, fakeClock().throttle)
    ).rejects.toThrow('nope')
    expect(calls).toBe(1)
  })

  it('one 429 holds every worker sharing the throttle — a circuit breaker, not three hammers', async () => {
    const clock = fakeClock()
    const started: number[] = []
    let throttled = false
    const call = (id: number) =>
      withThrottleRetry(async () => {
        started.push(id)
        if (!throttled) {
          throttled = true
          throw Object.assign(new Error('throttled'), { status: 429, retryAfterMs: 4000 })
        }
        return id
      }, clock.throttle)
    // The first call trips the breaker; the next two, started after, wait it out before their first try.
    const first = call(1)
    await Promise.resolve()
    const others = [call(2), call(3)]
    expect(await Promise.all([first, ...others])).toEqual([1, 2, 3])
    expect(clock.waits.length).toBeGreaterThan(0)
    expect(clock.waits.every((w) => w <= 4000)).toBe(true)
    // Nobody started a second request before the pause was over: one try each after the first's failure.
    expect(started.filter((id) => id === 1)).toHaveLength(2)
  })
})

describe('adoBytes — a file read over real HTTP', () => {
  let server: Server
  let base = ''
  let hits = 0
  const accepts: string[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      accepts.push(req.headers.accept ?? '')
      if (req.url?.startsWith('/throttled')) {
        hits++
        if (hits === 1) {
          res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' })
          res.end(JSON.stringify({ message: 'Request was blocked due to exceeding usage of resource' }))
          return
        }
        res.writeHead(200, { 'content-type': 'application/octet-stream' })
        res.end(Buffer.from([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]))
        return
      }
      if (req.url === '/big') {
        res.writeHead(200, { 'content-type': 'application/octet-stream' })
        res.end(Buffer.alloc(4096, 0x61))
        return
      }
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html>sign in</html>')
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))

  it('asks for raw bytes; a 429 carries its status and Retry-After, and the retry reads the bytes', async () => {
    const clock = fakeClock()
    const out = await withThrottleRetry(() => adoBytes(`${base}/throttled`, 'fake-token', 1 << 20), clock.throttle)
    expect(clock.waits).toEqual([])
    expect(Array.from(out as Uint8Array)).toEqual([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00])
    expect(accepts.every((a) => a === 'application/octet-stream')).toBe(true)
  })

  it('stops at the size cap, and treats a sign-in page as a refusal', async () => {
    expect(await adoBytes(`${base}/big`, 'fake-token', 1024)).toBe('tooLarge')
    await expect(adoBytes(`${base}/login`, 'fake-token', 1024)).rejects.toMatchObject({ status: 401 })
  })
})
