import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Guards the guard: if the global setup stopped isolating git, every test that
// silently leans on the machine's config would start passing again here and
// failing elsewhere.
describe('the suite runs git hermetically', () => {
  it('points the global config at the suite’s own file and turns the system one off', () => {
    expect(process.env.GIT_CONFIG_GLOBAL).toMatch(/gitcito-test-gitconfig-/)
    expect(process.env.GIT_CONFIG_NOSYSTEM).toBe('1')
    const keys = execFileSync('git', ['config', '--global', '--list'], { encoding: 'utf8' })
    expect(keys.trim()).toBe('user.useconfigonly=true')
  })

  it('refuses to commit without an explicit identity', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gitcito-hermetic-'))
    try {
      execFileSync('git', ['init', '-q', '-b', 'main', dir])
      expect(() =>
        execFileSync('git', ['-C', dir, 'commit', '-q', '--allow-empty', '-m', 'x'], { stdio: 'pipe' })
      ).toThrow()
      execFileSync('git', ['-C', dir, '-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'x'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
