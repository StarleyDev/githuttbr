import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROOT } from './helpers'

/**
 * The shell shims in resources/cli, run against a fake packaged layout:
 *
 *   <root>/Git HuttBr/gitcito-bin          the "app executable" (echoes how it was run)
 *   <root>/Git HuttBr/resources/app.asar/  stands in for the archive
 *   <root>/Git HuttBr/resources/cli/       the shims + app-binary
 *
 * plus a `node` on PATH and an out/main/cliEntry.js in the working directory,
 * both planted: a packaged shim must reach neither.
 */

const require = createRequire(import.meta.url)
const afterPack = require('../scripts/after-pack.cjs') as {
  cliAppBinary(context: unknown): { resources: string; relative: string }
  writeCliAppBinary(context: unknown): Promise<void>
}

let root = ''
let app = ''
let res = ''
let cwd = ''
let fakeBinDir = ''

function exe(path: string, body: string): void {
  writeFileSync(path, `#!/bin/sh\n${body}\n`)
  chmodSync(path, 0o755)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gitcito-shim-'))
  app = join(root, 'Git HuttBr')
  res = join(app, 'resources')
  mkdirSync(join(res, 'cli'), { recursive: true })
  mkdirSync(join(res, 'app.asar', 'out', 'main'), { recursive: true })
  for (const f of ['gitcito', 'gitcito-textconv']) {
    copyFileSync(join(ROOT, 'resources/cli', f), join(res, 'cli', f))
    chmodSync(join(res, 'cli', f), 0o755)
  }
  exe(
    join(app, 'gitcito-bin'),
    `line="APP RUN_AS_NODE=\${ELECTRON_RUN_AS_NODE:-} $*"\necho "$line"\necho "$line" >> '${join(root, 'launch.log')}'`
  )
  writeFileSync(join(res, 'cli', 'app-binary'), '../gitcito-bin\n')

  // The planted interpreter and the planted entry point.
  fakeBinDir = join(root, 'path-bin')
  mkdirSync(fakeBinDir)
  exe(join(fakeBinDir, 'node'), 'echo "PLANTED NODE $*"')
  cwd = join(root, 'evil-repo')
  mkdirSync(join(cwd, 'out', 'main'), { recursive: true })
  writeFileSync(join(cwd, 'out', 'main', 'cliEntry.js'), 'console.log("PLANTED ENTRY")\n')

  // Installed the way cli.ts installs it: an absolute symlink in a PATH dir.
  mkdirSync(join(root, 'local-bin'))
  symlinkSync(join(res, 'cli', 'gitcito'), join(root, 'local-bin', 'gitcito'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function run(cmd: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { PATH: `${fakeBinDir}:/usr/bin:/bin`, HOME: root }
  })
  return { status: r.status, stdout: r.stdout, stderr: r.stderr }
}

describe('resources/cli/gitcito, packaged', () => {
  it('runs headless verbs through the app binary as Node, via a PATH symlink', () => {
    const r = run(join(root, 'local-bin', 'gitcito'), ['--version'])
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(`APP RUN_AS_NODE=1 ${res}/app.asar/out/main/cliEntry.js --version`)
    expect(r.stdout).not.toContain('PLANTED')
  })

  it('fails closed, without a PATH node, when the app binary cannot be found', () => {
    rmSync(join(res, 'cli', 'app-binary'))
    const r = run(join(root, 'local-bin', 'gitcito'), ['doctor'])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/incomplete/)
    expect(r.stdout).not.toContain('PLANTED')
  })

  it('fails closed when app-binary names something that is not there', () => {
    writeFileSync(join(res, 'cli', 'app-binary'), '../MacOS/Gitcito\n')
    const r = run(join(root, 'local-bin', 'gitcito'), ['status'])
    expect(r.status).not.toBe(0)
    expect(r.stdout).not.toContain('PLANTED')
  })

  it('opens a window with the app binary itself, not with run-as-node', () => {
    // Even with the variable already in the caller's environment.
    const r = run('sh', ['-c', `ELECTRON_RUN_AS_NODE=1 '${join(root, 'local-bin', 'gitcito')}' . ; sleep 0.3`])
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
    expect(readFileSync(join(root, 'launch.log'), 'utf8').trim()).toBe(`APP RUN_AS_NODE= --open=${cwd}`)
  })
})

describe('resources/cli/gitcito-textconv, packaged', () => {
  it('runs the converter through the app binary as Node', () => {
    const r = run(join(res, 'cli', 'gitcito-textconv'), ['/tmp/some file.docx'])
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(`APP RUN_AS_NODE=1 ${res}/app.asar/out/main/textconvCli.js /tmp/some file.docx`)
  })

  it('fails closed, without a PATH node, when the app binary cannot be found', () => {
    rmSync(join(res, 'cli', 'app-binary'))
    const r = run(join(res, 'cli', 'gitcito-textconv'), ['x.docx'])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/incomplete/)
    expect(r.stdout).not.toContain('PLANTED')
  })
})

describe('after-pack writes cli/app-binary', () => {
  const ctx = (platform: string): unknown => ({
    appOutDir: '/out',
    electronPlatformName: platform,
    packager: { appInfo: { productFilename: 'Git HuttBr' }, executableName: 'gitcito' }
  })

  it('points each platform at its real executable', () => {
    expect(afterPack.cliAppBinary(ctx('linux'))).toEqual({ resources: '/out/resources', relative: '../gitcito' })
    expect(afterPack.cliAppBinary(ctx('win32'))).toEqual({ resources: '/out/resources', relative: '../Git HuttBr.exe' })
    expect(afterPack.cliAppBinary(ctx('darwin'))).toEqual({
      resources: '/out/Git HuttBr.app/Contents/Resources',
      relative: '../MacOS/Git HuttBr'
    })
  })

  it('writes the file the shims read, and refuses a layout without the shims', async () => {
    const out = join(root, 'linux-unpacked')
    mkdirSync(join(out, 'resources'), { recursive: true })
    exe(join(out, 'gitcito'), 'true')
    const context = {
      appOutDir: out,
      electronPlatformName: 'linux',
      packager: { appInfo: { productFilename: 'Git HuttBr' }, executableName: 'gitcito' }
    }
    await expect(afterPack.writeCliAppBinary(context)).rejects.toThrow()
    mkdirSync(join(out, 'resources', 'cli'))
    writeFileSync(join(out, 'resources', 'cli', 'gitcito'), '')
    await afterPack.writeCliAppBinary(context)
    expect(readFileSync(join(out, 'resources', 'cli', 'app-binary'), 'utf8')).toBe('../gitcito\n')
  })
})
