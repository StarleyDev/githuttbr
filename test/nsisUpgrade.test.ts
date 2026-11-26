import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './helpers'

// The Windows upgrade from the builds that shipped appId com.gitcito.desktop.
// NSIS cannot run here, so this pins what the script relies on; the upgrade
// itself needs a real Windows machine (notes/backlog.md).
const require = createRequire(import.meta.url)
const { UUID } = require('builder-util-runtime') as {
  UUID: { parse(s: string): Buffer; v5(name: string, ns: Buffer): string }
}
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  build: { appId: string; nsis: { include?: string; deleteAppDataOnUninstall?: boolean } }
}
const nsh = readFileSync(join(ROOT, 'build/installer.nsh'), 'utf8')

/** The namespace electron-builder hashes the appId with to get the uninstall GUID. */
function electronBuilderNamespace(): string {
  const src = readFileSync(join(ROOT, 'node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js'), 'utf8')
  const m = /ELECTRON_BUILDER_NS_UUID = [\w.]+\.UUID\.parse\("([0-9a-f-]+)"\)/.exec(src)
  if (!m) throw new Error('electron-builder no longer derives the GUID the way installer.nsh assumes')
  return m[1]
}

const guidFor = (appId: string): string => UUID.v5(appId, UUID.parse(electronBuilderNamespace()))

describe('NSIS upgrade from the old appId', () => {
  it('the installer includes the script and never deletes app data on uninstall', () => {
    expect(pkg.build.nsis.include).toBe('build/installer.nsh')
    expect(pkg.build.nsis.deleteAppDataOnUninstall).toBe(false)
  })

  it('hardcodes the GUID electron-builder computed from com.gitcito.desktop', () => {
    const old = guidFor('com.gitcito.desktop')
    expect(nsh).toContain(`!define GITHUTTBR_OLD_GUID "${old}"`)
    // The new identity gets a different GUID, which is why the script exists.
    expect(guidFor(pkg.build.appId)).not.toBe(old)
  })

  it('looks under both HKCU and HKLM', () => {
    expect(nsh).toContain('githuttbrRemoveOldInstall HKCU "/currentuser"')
    expect(nsh).toContain('githuttbrRemoveOldInstall HKLM "/allusers"')
  })

  it('removes the entry only when its DisplayName is GitHuttBr, never Gitcito', () => {
    expect(nsh).toContain('${If} $R7 == "GitHuttBr"')
    expect(nsh).toContain('${OrIf} $R8 == "Git HuttBr"')
    // No branch of the script acts on a Gitcito name.
    expect(nsh).not.toMatch(/== "Gitcito/i)
  })

  it('runs the old uninstaller silently, keeping app data, and waits for it', () => {
    expect(nsh).toMatch(/ExecWait '"\$PLUGINSDIR\\old-githuttbr-uninstaller\.exe" \/S \/KEEP_APP_DATA \$\{MODE_FLAG\} --updated _\?=\$R9'/)
    expect(nsh).not.toMatch(/ExecWait[^\n]*--delete-app-data/)
  })
})
