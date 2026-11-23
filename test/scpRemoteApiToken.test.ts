import { beforeEach, describe, expect, it, vi } from 'vitest'

// A profile linked to a machine login, on a repository whose remote is
// scp-style ssh (`git@github.com:o/r.git`). `new URL` cannot read that form, so
// the link used to resolve to nothing and every PR, issue, CI and avatar call
// for a private repository ran unauthenticated. The helper is mocked, as in
// credentials.test.ts: what matters is what Gitcito asks for.

type ExecCallback = (err: (Error & { killed?: boolean }) | null, stdout: string) => void
interface Spawn {
  cmd: string
  args: string[]
  input: string
  answer: ExecCallback
}

const spawns: Spawn[] = []

vi.mock('child_process', () => ({
  execFile: (cmd: string, args: string[], _opts: unknown, cb: ExecCallback) => {
    const spawn: Spawn = { cmd, args, input: '', answer: cb }
    spawns.push(spawn)
    return { stdin: { on: () => undefined, end: (input: string) => (spawn.input = input) } }
  }
}))

const { apiToken, clearCredentialCache } = await import('../src/main/credentials')

const flush = (): Promise<void> => new Promise((r) => setImmediate(r))

beforeEach(() => {
  spawns.length = 0
  clearCredentialCache()
})

describe('apiToken — a linked machine login on an scp remote', () => {
  it("asks git's helper for the https form of the remote, as the linked account", async () => {
    const pending = apiToken('git@github.com:acme/widgets.git', { link: { source: 'git', login: 'me' } })
    await flush()
    const fill = spawns.find((s) => s.cmd === 'git' && s.args.includes('fill'))
    expect(fill).toBeDefined()
    expect(fill!.input).toContain('protocol=https\n')
    expect(fill!.input).toContain('host=github.com\n')
    expect(fill!.input).toContain('path=acme/widgets\n')
    expect(fill!.input).toContain('username=me\n')
    fill!.answer(null, 'protocol=https\nhost=github.com\nusername=me\npassword=helper-token\n')
    expect((await pending)?.token).toBe('helper-token')
  })

  it("asks the GitHub CLI for the linked account on github.com", async () => {
    const pending = apiToken('git@github.com:acme/widgets.git', { link: { source: 'gh', login: 'me' } })
    await flush()
    const gh = spawns.find((s) => s.cmd === 'gh')
    expect(gh?.args).toEqual(['auth', 'token', '--hostname', 'github.com', '--user=me'])
    gh!.answer(null, 'gh-token\n')
    expect(await pending).toMatchObject({ token: 'gh-token', source: 'gh', login: 'me' })
  })

  it('an ssh:// remote with its own port is asked about at the web host, without that port', async () => {
    const pending = apiToken('ssh://git@github.com:22/acme/widgets.git', { link: { source: 'git', login: 'me' } })
    await flush()
    const fill = spawns.find((s) => s.cmd === 'git' && s.args.includes('fill'))
    expect(fill!.input).toContain('host=github.com\n')
    fill!.answer(null, 'protocol=https\nhost=github.com\nusername=me\npassword=t\n')
    expect((await pending)?.token).toBe('t')
  })

  it('a look-alike scp host is never treated as GitHub by the CLI', async () => {
    const pending = apiToken('git@github.com.evil.net:acme/widgets.git', { link: { source: 'gh', login: 'me' } })
    await flush()
    expect(spawns.some((s) => s.cmd === 'gh')).toBe(false)
    expect(await pending).toBeNull()
  })
})
