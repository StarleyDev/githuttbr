import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'

// A push to two servers opens one credential endpoint per server. When opening
// the second one failed, the first stayed open — a socket and a helper script
// nobody would release. No network: the environment is built, never used.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-cred-leak-'))

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: () => undefined, on: () => undefined },
  dialog: {},
  shell: { openExternal: () => undefined, trashItem: async () => undefined },
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

// The real broker, with a switch that makes the Nth open fail.
const failAt = { n: 0, calls: 0 }
vi.mock('../src/main/credentialBroker', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/main/credentialBroker')>()
  return {
    ...real,
    openCredentialEndpoint: (...args: Parameters<typeof real.openCredentialEndpoint>) => {
      failAt.calls++
      if (failAt.calls === failAt.n) throw new Error('Could not open a credential endpoint for git (test).')
      return real.openCredentialEndpoint(...args)
    }
  }
})

const origin = 'https://127.0.0.1:9'
const repo = join(dir, 'bound')
const saved = { ...process.env }

beforeAll(async () => {
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
  execFileSync('git', ['init', '-q', repo], { env })
  execFileSync('git', ['-C', repo, 'remote', 'add', 'both', `${origin}/group/app.git`], { env })
  execFileSync('git', ['-C', repo, 'remote', 'set-url', '--add', '--push', 'both', `${origin}/group/app.git`], { env })
  execFileSync('git', ['-C', repo, 'remote', 'set-url', '--add', '--push', 'both', `${origin}/b/scm/proj/app.git`], { env })
  writeFileSync(join(dir, 'gitconfig'), '')
  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
  const base = defaultSettings().profiles[0]
  writeFileSync(
    join(dir, 'gitcito-settings.json'),
    JSON.stringify({
      ...defaultSettings(),
      onboardingCompleted: true,
      activeProfileId: 'work',
      repoProfiles: { [repo]: 'work' },
      profiles: [
        {
          ...base,
          id: 'work',
          name: 'Work',
          gitlabServers: [{ url: origin, token: 'glpat-leak-0123456789' }],
          bitbucketServers: [{ url: `${origin}/b`, token: 'bbs-leak-0123456789', username: 'worker' }]
        }
      ]
    })
  )
  Object.assign(process.env, { HOME: dir, GIT_CONFIG_GLOBAL: join(dir, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' })
  const { readSettings } = await import('../src/main/settings')
  await readSettings()
})

afterAll(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  rmSync(dir, { recursive: true, force: true })
})

describe('a credential endpoint that fails to open', () => {
  it('both servers get an endpoint when nothing fails', async () => {
    const { remoteOperationEnv } = await import('../src/main/git')
    const { openCredentialEndpoints, releaseCredentialEnv } = await import('../src/main/credentialBroker')
    failAt.n = 0
    const { env } = await remoteOperationEnv(repo, 'both', 'push')
    expect(openCredentialEndpoints()).toBe(2)
    releaseCredentialEnv(env)
    expect(openCredentialEndpoints()).toBe(0)
  })

  it('takes the ones already opened for the same operation down with it', async () => {
    const { remoteOperationEnv } = await import('../src/main/git')
    const { openCredentialEndpoints } = await import('../src/main/credentialBroker')
    failAt.calls = 0
    failAt.n = 2
    await expect(remoteOperationEnv(repo, 'both', 'push')).rejects.toThrow(/credential endpoint/)
    expect(openCredentialEndpoints()).toBe(0)
  })
})
