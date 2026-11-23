import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { sanitizeDirList, sanitizePreload, sanitizeSearchPathEnv } from '../src/main/searchPathEnv'

const linux = { platform: 'linux' as const }

describe('sanitizeDirList', () => {
  it('removes empty entries wherever they sit', () => {
    expect(sanitizeDirList('/a/lib:', false)).toBe('/a/lib')
    expect(sanitizeDirList(':/a/lib', false)).toBe('/a/lib')
    expect(sanitizeDirList('/a::/b', false)).toBe('/a:/b')
    expect(sanitizeDirList(':::', false)).toBe('')
    expect(sanitizeDirList('', false)).toBe('')
  })

  it('removes `.` always', () => {
    expect(sanitizeDirList('.:/usr/bin:.', false)).toBe('/usr/bin')
  })

  it('keeps other relative entries unless told to drop them', () => {
    expect(sanitizeDirList('/usr/bin:bin:./tools:../x', false)).toBe('/usr/bin:bin:./tools:../x')
    expect(sanitizeDirList('/usr/bin:bin:./tools:../x', true)).toBe('/usr/bin')
  })

  it('leaves absolute entries and their order untouched', () => {
    const value = '/tmp/.mount_Gitcito/usr/lib:/usr/local/lib:/opt/x y/lib'
    expect(sanitizeDirList(value, true)).toBe(value)
  })
})

describe('sanitizePreload', () => {
  it('returns the value as written when nothing reads from the cwd', () => {
    // Empty tokens are skipped by the loader; bare names go through the lib path.
    expect(sanitizePreload('libjemalloc.so.2  /usr/lib/libfoo.so:', true)).toBe('libjemalloc.so.2  /usr/lib/libfoo.so:')
  })

  it('drops cwd-relative library paths only when dropping relatives', () => {
    expect(sanitizePreload('./evil.so /usr/lib/ok.so lib/x.so', false)).toBe('./evil.so /usr/lib/ok.so lib/x.so')
    expect(sanitizePreload('./evil.so /usr/lib/ok.so lib/x.so libbare.so', true)).toBe('/usr/lib/ok.so:libbare.so')
  })
})

describe('sanitizeSearchPathEnv', () => {
  it('repairs the AppImage launcher shape: an unset LD_LIBRARY_PATH leaves a trailing empty entry', () => {
    const env: NodeJS.ProcessEnv = {
      APPIMAGE: '/home/u/Gitcito.AppImage',
      LD_LIBRARY_PATH: '/tmp/.mount_Gitci/usr/lib:',
      PATH: '/tmp/.mount_Gitci:/usr/bin::bin',
      XDG_DATA_DIRS: '/tmp/.mount_Gitci/usr/share/:/usr/share:'
    }
    expect(sanitizeSearchPathEnv(env, linux).sort()).toEqual(['LD_LIBRARY_PATH', 'PATH', 'XDG_DATA_DIRS'])
    expect(env).toEqual({
      APPIMAGE: '/home/u/Gitcito.AppImage',
      LD_LIBRARY_PATH: '/tmp/.mount_Gitci/usr/lib',
      PATH: '/tmp/.mount_Gitci:/usr/bin',
      XDG_DATA_DIRS: '/tmp/.mount_Gitci/usr/share/:/usr/share'
    })
  })

  it('outside an AppImage keeps a deliberate relative entry but not an empty one', () => {
    const env: NodeJS.ProcessEnv = { PATH: 'node_modules/.bin:/usr/bin:', LD_PRELOAD: './x.so' }
    expect(sanitizeSearchPathEnv(env, linux)).toEqual(['PATH'])
    expect(env).toEqual({ PATH: 'node_modules/.bin:/usr/bin', LD_PRELOAD: './x.so' })
  })

  it('deletes a variable left with no entries instead of setting it to an empty string', () => {
    const env: NodeJS.ProcessEnv = { LD_LIBRARY_PATH: ':', APPIMAGE: '/a', LD_PRELOAD: './only.so' }
    sanitizeSearchPathEnv(env, linux)
    expect('LD_LIBRARY_PATH' in env).toBe(false)
    expect('LD_PRELOAD' in env).toBe(false)
  })

  it('changes nothing when every entry is absolute', () => {
    const env: NodeJS.ProcessEnv = { PATH: '/usr/bin:/bin', LD_LIBRARY_PATH: '/opt/lib', APPIMAGE: '/a' }
    expect(sanitizeSearchPathEnv(env, linux)).toEqual([])
    expect(env).toEqual({ PATH: '/usr/bin:/bin', LD_LIBRARY_PATH: '/opt/lib', APPIMAGE: '/a' })
  })

  it('is a no-op on Windows, whose PATH is not colon-separated', () => {
    const env: NodeJS.ProcessEnv = { PATH: 'C:\\Windows;C:\\Git\\bin', LD_LIBRARY_PATH: ':' }
    expect(sanitizeSearchPathEnv(env, { platform: 'win32' })).toEqual([])
    expect(env.LD_LIBRARY_PATH).toBe(':')
  })
})

// The startup module mutates process.env itself, and children spawned without
// an explicit env — simple-git, execFile — inherit exactly that.
describe.skipIf(process.platform === 'win32')('hardenEnv at startup', () => {
  const saved = { ...process.env }
  let repo = ''

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'githuttbr-searchpath-'))
    execFileSync('git', ['init', '-q', repo])
    // An alias runs as git's own child, with cwd = the repository.
    execFileSync('git', ['-C', repo, 'config', 'alias.ldp', '!printf %s "$LD_LIBRARY_PATH"'])
  })

  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
    rmSync(repo, { recursive: true, force: true })
  })

  it('leaves git, run in a repository, with no cwd-relative library path', async () => {
    process.env['APPIMAGE'] = '/home/u/Gitcito.AppImage'
    process.env['LD_LIBRARY_PATH'] = '/tmp/.mount_Gitci/usr/lib:'
    vi.resetModules()
    await import('../src/main/hardenEnv')

    const seen = await simpleGit(repo).raw(['ldp'])
    expect(seen).toBe('/tmp/.mount_Gitci/usr/lib')
    const viaExecFile = execFileSync('sh', ['-c', 'printf %s "$LD_LIBRARY_PATH"'], { cwd: repo, encoding: 'utf8' })
    expect(viaExecFile.split(':')).not.toContain('')
  })
})
