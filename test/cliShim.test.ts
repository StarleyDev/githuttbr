import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROOT } from './helpers'

/**
 * The shell shims in resources/cli, run against a fake packaged layout:
 *
 *   <root>/GitHuttBr/githuttbr-bin          the "app executable" (echoes how it was run)
 *   <root>/GitHuttBr/resources/app.asar/  stands in for the archive
 *   <root>/GitHuttBr/resources/cli/       the shims + app-binary
 *
 * plus a `node` on PATH and an out/main/cliEntry.js in the working directory,
 * both planted: a packaged shim must reach neither.
 */

const require = createRequire(import.meta.url)
const afterPack = require('../scripts/after-pack.cjs') as {
  cliAppBinary(context: unknown): { resources: string; relative: string }
  writeCliAppBinary(context: unknown): Promise<void>
  markCliExecutable(context: unknown): Promise<void>
  CLI_SHIMS: string[]
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
  root = mkdtempSync(join(tmpdir(), 'githuttbr-shim-'))
  app = join(root, 'GitHuttBr')
  res = join(app, 'resources')
  mkdirSync(join(res, 'cli'), { recursive: true })
  mkdirSync(join(res, 'app.asar', 'out', 'main'), { recursive: true })
  for (const f of ['githuttbr', 'githuttbr-textconv']) {
    copyFileSync(join(ROOT, 'resources/cli', f), join(res, 'cli', f))
    chmodSync(join(res, 'cli', f), 0o755)
  }
  exe(
    join(app, 'githuttbr-bin'),
    `line="APP RUN_AS_NODE=\${ELECTRON_RUN_AS_NODE:-} $*"\necho "$line"\necho "$line" >> '${join(root, 'launch.log')}'`
  )
  writeFileSync(join(res, 'cli', 'app-binary'), '../githuttbr-bin\n')

  // The planted interpreter and the planted entry point.
  fakeBinDir = join(root, 'path-bin')
  mkdirSync(fakeBinDir)
  exe(join(fakeBinDir, 'node'), 'echo "PLANTED NODE $*"')
  cwd = join(root, 'evil-repo')
  mkdirSync(join(cwd, 'out', 'main'), { recursive: true })
  writeFileSync(join(cwd, 'out', 'main', 'cliEntry.js'), 'console.log("PLANTED ENTRY")\n')

  // Installed the way cli.ts installs it: an absolute symlink in a PATH dir.
  mkdirSync(join(root, 'local-bin'))
  symlinkSync(join(res, 'cli', 'githuttbr'), join(root, 'local-bin', 'githuttbr'))
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

describe('resources/cli/githuttbr, packaged', () => {
  it('runs headless verbs through the app binary as Node, via a PATH symlink', () => {
    const r = run(join(root, 'local-bin', 'githuttbr'), ['--version'])
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(`APP RUN_AS_NODE=1 ${res}/app.asar/out/main/cliEntry.js --version`)
    expect(r.stdout).not.toContain('PLANTED')
  })

  it('fails closed, without a PATH node, when the app binary cannot be found', () => {
    rmSync(join(res, 'cli', 'app-binary'))
    const r = run(join(root, 'local-bin', 'githuttbr'), ['doctor'])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/incomplete/)
    expect(r.stdout).not.toContain('PLANTED')
  })

  it('fails closed when app-binary names something that is not there', () => {
    writeFileSync(join(res, 'cli', 'app-binary'), '../MacOS/Missing\n')
    const r = run(join(root, 'local-bin', 'githuttbr'), ['status'])
    expect(r.status).not.toBe(0)
    expect(r.stdout).not.toContain('PLANTED')
  })

  it('opens a window with the app binary itself, not with run-as-node', () => {
    // Even with the variable already in the caller's environment.
    const r = run('sh', ['-c', `ELECTRON_RUN_AS_NODE=1 '${join(root, 'local-bin', 'githuttbr')}' . ; sleep 0.3`])
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
    expect(readFileSync(join(root, 'launch.log'), 'utf8').trim()).toBe(`APP RUN_AS_NODE= --open=${cwd}`)
  })
})

describe('resources/cli/githuttbr-textconv, packaged', () => {
  it('runs the converter through the app binary as Node', () => {
    const r = run(join(res, 'cli', 'githuttbr-textconv'), ['/tmp/some file.docx'])
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(`APP RUN_AS_NODE=1 ${res}/app.asar/out/main/textconvCli.js /tmp/some file.docx`)
  })

  it('fails closed, without a PATH node, when the app binary cannot be found', () => {
    rmSync(join(res, 'cli', 'app-binary'))
    const r = run(join(res, 'cli', 'githuttbr-textconv'), ['x.docx'])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/incomplete/)
    expect(r.stdout).not.toContain('PLANTED')
  })
})

// The converter's pre-4.39 name, which the upstream app also ships: this app does not any more.
describe('resources/cli/<old converter name>', () => {
  it('is gone from the app', () => {
    expect(existsSync(join(ROOT, 'resources/cli/gitcito-textconv'))).toBe(false) // upstream-name: gone
    expect(afterPack.CLI_SHIMS).toEqual(['githuttbr', 'githuttbr-textconv'])
  })
})

describe('after-pack writes cli/app-binary', () => {
  const ctx = (platform: string): unknown => ({
    appOutDir: '/out',
    electronPlatformName: platform,
    packager: { appInfo: { productFilename: 'GitHuttBr' }, executableName: 'githuttbr' }
  })

  it('points each platform at its real executable', () => {
    expect(afterPack.cliAppBinary(ctx('linux'))).toEqual({ resources: '/out/resources', relative: '../githuttbr' })
    expect(afterPack.cliAppBinary(ctx('win32'))).toEqual({ resources: '/out/resources', relative: '../GitHuttBr.exe' })
    expect(afterPack.cliAppBinary(ctx('darwin'))).toEqual({
      resources: '/out/GitHuttBr.app/Contents/Resources',
      relative: '../MacOS/GitHuttBr'
    })
  })

  it('writes the file the shims read, and refuses a layout without the shims', async () => {
    const out = join(root, 'linux-unpacked')
    mkdirSync(join(out, 'resources'), { recursive: true })
    exe(join(out, 'githuttbr'), 'true')
    const context = {
      appOutDir: out,
      electronPlatformName: 'linux',
      packager: { appInfo: { productFilename: 'GitHuttBr' }, executableName: 'githuttbr' }
    }
    await expect(afterPack.writeCliAppBinary(context)).rejects.toThrow()
    mkdirSync(join(out, 'resources', 'cli'))
    writeFileSync(join(out, 'resources', 'cli', 'githuttbr'), '')
    await afterPack.writeCliAppBinary(context)
    expect(readFileSync(join(out, 'resources', 'cli', 'app-binary'), 'utf8')).toBe('../githuttbr\n')
  })

  it('marks every shim executable, and refuses a layout without one', async () => {
    const out = join(root, 'linux-unpacked')
    const cli = join(out, 'resources', 'cli')
    mkdirSync(cli, { recursive: true })
    const context = {
      appOutDir: out,
      electronPlatformName: 'linux',
      packager: { appInfo: { productFilename: 'GitHuttBr' }, executableName: 'githuttbr' }
    }
    writeFileSync(join(cli, 'githuttbr'), '', { mode: 0o644 })
    await expect(afterPack.markCliExecutable(context)).rejects.toThrow()
    writeFileSync(join(cli, 'githuttbr-textconv'), '', { mode: 0o644 })
    await afterPack.markCliExecutable(context)
    for (const f of afterPack.CLI_SHIMS) expect(statSync(join(cli, f)).mode & 0o777).toBe(0o755)
  })
})
