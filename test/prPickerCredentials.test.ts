import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings, type CreatePrResult, type PrPickerOptions } from '../src/shared/types'

// Opening the create-PR dialog reads reviewer / label choices. With a borrowed
// git credential (no token in Settings), a 401 on such a read — an Azure PAT
// without the Project and Team scope, say — must cost the list and nothing
// else: never evict the credential the user's pushes and the create rely on.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-pr-picker-cred-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
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

const forgetCredential = vi.fn(async () => undefined)
vi.mock('../src/main/credentials', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/main/credentials')>()
  return {
    ...real,
    // Every hosting call borrows a git credential, as with no token in Settings.
    apiToken: vi.fn(async () => ({
      token: 'borrowed-pat',
      source: 'git',
      login: 'ana',
      cred: { protocol: 'https', host: 'dev.azure.com', username: 'ana', password: 'borrowed-pat' }
    })),
    forgetCredential
  }
})

const AZURE = 'https://dev.azure.com/acme/proj/_git/app'
const GITHUB = 'https://github.com/team/app.git'
const BITBUCKET = 'https://bitbucket.org/ws/app.git'
const GITLAB = 'https://gitlab.com/team/app.git'
let status = 401

beforeAll(async () => {
  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
  writeFileSync(join(dir, 'gitcito-settings.json'), JSON.stringify({ ...defaultSettings(), onboardingCompleted: true }))
  const { readSettings } = await import('../src/main/settings')
  await readSettings()
  const { registerHostingHandlers } = await import('../src/main/hosting')
  registerHostingHandlers()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      // The create itself still works; every list read is refused.
      if (init?.method === 'POST' && url.pathname.endsWith('/pullrequests')) {
        return new Response(JSON.stringify({ pullRequestId: 3 }), { status: 200 })
      }
      return new Response(JSON.stringify({ message: 'denied' }), { status })
    })
  )
})
beforeEach(() => forgetCredential.mockClear())
afterAll(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

const call = <R>(channel: string, remote: string, ...args: unknown[]): Promise<R> =>
  Promise.resolve(handlers.get(channel)!({}, '', remote, {}, ...args)) as Promise<R>

describe('picker reads never evict a saved credential', () => {
  it('Azure: a 401 on teams marks reviewers failed, forgets nothing, and the create still works', async () => {
    const o = await call<PrPickerOptions>('hosting:prPickerOptions', AZURE)
    expect(o.failed).toEqual(['reviewers'])
    expect(forgetCredential).not.toHaveBeenCalled()
    const res = await call<CreatePrResult>('hosting:createPR', AZURE, { title: 'T', body: '', source: 'f', target: 'main', draft: false })
    expect(res.number).toBe(3)
    expect(forgetCredential).not.toHaveBeenCalled()
  })

  for (const [name, remote] of [
    ['GitHub', GITHUB],
    ['GitLab', GITLAB],
    ['bitbucket.org', BITBUCKET]
  ] as const) {
    it(`${name}: 401 and 403 on every list forget nothing`, async () => {
      for (const s of [401, 403]) {
        status = s
        const o = await call<PrPickerOptions>('hosting:prPickerOptions', remote)
        expect(o.failed.length).toBeGreaterThan(0)
      }
      expect(forgetCredential).not.toHaveBeenCalled()
      status = 401
    })
  }
})
