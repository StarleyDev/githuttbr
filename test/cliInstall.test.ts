import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appleScriptString,
  cliInstallRefusal,
  isStaleCliTarget,
  posixQuote,
  privilegedLinkCommand,
  privilegedScript,
  privilegedUnlinkCommand
} from '../src/main/cliInstall'

const NASTY = [
  'Git HuttBr.app',
  "it's",
  "a'b'c''",
  '$HOME',
  '$(touch pwned)',
  '`touch pwned`',
  'semi; touch pwned',
  'back\\slash',
  'new\nline',
  '"double"',
  ''
]

describe('posixQuote', () => {
  it('round-trips through a real shell for every awkward character', () => {
    for (const value of NASTY) {
      const out = execFileSync('sh', ['-c', `printf '%s' ${posixQuote(value)}`], { encoding: 'utf8' })
      expect(out).toBe(value)
    }
  })
})

describe('the privileged install command', () => {
  it('links and unlinks paths with spaces, quotes, $ and backticks without running them', () => {
    const root = mkdtempSync(join(tmpdir(), 'githuttbr-cli-quote-'))
    try {
      const dir = join(root, "bin dir $(touch pwned) `touch pwned` it's")
      const shim = join(root, "Git HuttBr.app/Contents/Resources/cli/githuttbr $HOME")
      const link = join(dir, 'githuttbr')
      execFileSync('sh', ['-c', privilegedLinkCommand(dir, shim, link)], { cwd: root })
      expect(lstatSync(link).isSymbolicLink()).toBe(true)
      expect(readlinkSync(link)).toBe(shim)
      expect(existsSync(join(root, 'pwned'))).toBe(false)

      execFileSync('sh', ['-c', privilegedUnlinkCommand(link)], { cwd: root })
      expect(existsSync(link)).toBe(false)
      expect(existsSync(join(root, 'pwned'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('embeds the command in an AppleScript string that escapes only \\ and "', () => {
    expect(appleScriptString('a "b" \\c')).toBe('"a \\"b\\" \\\\c"')
    const script = privilegedScript(privilegedLinkCommand('/usr/local/bin', '/Applications/Git HuttBr.app/x', '/usr/local/bin/githuttbr'))
    expect(script).toBe(
      `do shell script "mkdir -p '/usr/local/bin' && ln -sf '/Applications/Git HuttBr.app/x' '/usr/local/bin/githuttbr'" with administrator privileges`
    )
  })

  it('round-trips the AppleScript literal when osascript is available', () => {
    let hasOsascript = true
    try {
      execFileSync('osascript', ['-e', 'return 1'])
    } catch {
      hasOsascript = false
    }
    if (!hasOsascript) return
    for (const value of NASTY.filter((v) => !v.includes('\n'))) {
      const out = execFileSync('osascript', ['-e', `return ${appleScriptString(value)}`], { encoding: 'utf8' })
      expect(out.replace(/\n$/, '')).toBe(value)
    }
  })
})

describe('when the CLI may be installed', () => {
  it('refuses on Windows and under any AppImage', () => {
    expect(cliInstallRefusal('C:\\x\\githuttbr', 'win32', {})).toBe('windows')
    expect(cliInstallRefusal('/tmp/.mount_GitHu1234/resources/cli/githuttbr', 'linux', { APPIMAGE: '/a.AppImage' })).toBe(
      'appimage'
    )
    // APPIMAGE alone is enough: an extract-and-run root need not look like a mount.
    expect(cliInstallRefusal('/opt/odd/resources/cli/githuttbr', 'linux', { APPIMAGE: '/a.AppImage' })).toBe('appimage')
    expect(cliInstallRefusal('/tmp/.mount_GitHu1234/resources/cli/githuttbr', 'linux', {})).toBe('appimage')
  })

  it('allows a .deb or a macOS bundle', () => {
    expect(cliInstallRefusal('/opt/Git HuttBr/resources/cli/githuttbr', 'linux', {})).toBeNull()
    expect(cliInstallRefusal('/Applications/Git HuttBr.app/Contents/Resources/cli/githuttbr', 'darwin', {})).toBeNull()
  })

  it('calls a link into an AppImage mount stale, and nothing else', () => {
    expect(isStaleCliTarget('/tmp/.mount_Git HuO2TrCj/resources/cli/githuttbr')).toBe(true)
    expect(isStaleCliTarget('/tmp/appimage_extracted_ab12/resources/cli/githuttbr')).toBe(true)
    expect(isStaleCliTarget('/opt/Git HuttBr/resources/cli/githuttbr')).toBe(false)
    expect(isStaleCliTarget('/Applications/Git HuttBr.app/Contents/Resources/cli/githuttbr')).toBe(false)
  })

  it('judges a stale link by its target name, not by whether the target exists', () => {
    const root = mkdtempSync(join(tmpdir(), '.mount_GitcitoTest'))
    try {
      writeFileSync(join(root, 'githuttbr'), '#!/bin/sh\necho planted\n')
      expect(isStaleCliTarget(join(root, 'githuttbr'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
