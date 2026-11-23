import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cliInstallRefusal, isStaleCliTarget } from '../src/main/cliInstall'

describe('when the CLI may be installed', () => {
  it('refuses on Windows and under any AppImage', () => {
    expect(cliInstallRefusal('C:\\x\\gitcito', 'win32', {})).toBe('windows')
    expect(cliInstallRefusal('/tmp/.mount_GitHu1234/resources/cli/gitcito', 'linux', { APPIMAGE: '/a.AppImage' })).toBe(
      'appimage'
    )
    // APPIMAGE alone is enough: an extract-and-run root need not look like a mount.
    expect(cliInstallRefusal('/opt/odd/resources/cli/gitcito', 'linux', { APPIMAGE: '/a.AppImage' })).toBe('appimage')
    expect(cliInstallRefusal('/tmp/.mount_GitHu1234/resources/cli/gitcito', 'linux', {})).toBe('appimage')
  })

  it('allows a .deb or a macOS bundle', () => {
    expect(cliInstallRefusal('/opt/Git HuttBr/resources/cli/gitcito', 'linux', {})).toBeNull()
    expect(cliInstallRefusal('/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito', 'darwin', {})).toBeNull()
  })

  it('calls a link into an AppImage mount stale, and nothing else', () => {
    expect(isStaleCliTarget('/tmp/.mount_Git HuO2TrCj/resources/cli/gitcito')).toBe(true)
    expect(isStaleCliTarget('/tmp/appimage_extracted_ab12/resources/cli/gitcito')).toBe(true)
    expect(isStaleCliTarget('/opt/Git HuttBr/resources/cli/gitcito')).toBe(false)
    expect(isStaleCliTarget('/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito')).toBe(false)
  })

  it('judges a stale link by its target name, not by whether the target exists', () => {
    const root = mkdtempSync(join(tmpdir(), '.mount_GitcitoTest'))
    try {
      writeFileSync(join(root, 'gitcito'), '#!/bin/sh\necho planted\n')
      expect(isStaleCliTarget(join(root, 'gitcito'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
