import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FuseV1Options } from '@electron/fuses'
import { spawnSync } from 'node:child_process'
import yaml from 'js-yaml'
import { ROOT } from './helpers'

const require = createRequire(import.meta.url)
const afterPack = require('../scripts/after-pack.cjs') as { fuseConfig(): Promise<Record<string, unknown>> }
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  homepage?: string
  build: { appId: string; afterPack?: string; linux?: { desktop?: { entry?: Record<string, string> } } }
}

interface Step {
  name?: string
  if?: string
  env?: Record<string, string>
  run?: string
}

describe('packaging hardening', () => {
  it('electron-builder runs the fuse hook', () => {
    expect(pkg.build.afterPack).toBe('./scripts/after-pack.cjs')
  })

  it('turns off NODE_OPTIONS and --inspect, and keeps RunAsNode for the CLI', async () => {
    const config = await afterPack.fuseConfig()
    expect(config[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(false)
    expect(config[FuseV1Options.EnableNodeCliInspectArguments]).toBe(false)
    // resources/cli/githuttbr runs its headless verbs with ELECTRON_RUN_AS_NODE.
    expect(config[FuseV1Options.RunAsNode]).toBe(true)
  })

  it('macOS entitlements no longer let DYLD_* variables inject code', () => {
    const plist = readFileSync(join(ROOT, 'build/entitlements.mac.plist'), 'utf8')
    expect(plist).not.toContain('allow-dyld-environment-variables')
    expect(plist).not.toContain('disable-library-validation')
  })

  // electron-builder before 26.15 (app-builder-lib, GHSA-7g7r-gx96-252g) wrote an AppImage AppRun with
  // `LD_LIBRARY_PATH="${APPDIR}/usr/lib:${LD_LIBRARY_PATH}"`: an empty entry, i.e. the cwd, whenever the
  // variable was unset. Read the launcher template the installed builder actually ships.
  it('the AppImage launcher never leaves an empty LD_LIBRARY_PATH entry', () => {
    const tpl = readFileSync(join(ROOT, 'node_modules/app-builder-lib/out/targets/appimage/appImageUtil.js'), 'utf8')
    expect(tpl).toContain('export LD_LIBRARY_PATH="\\${APPDIR}/usr/lib\\${LD_LIBRARY_PATH:+:\\${LD_LIBRARY_PATH}}"')
    expect(tpl).not.toMatch(/usr\/lib:\\?\$\{LD_LIBRARY_PATH\}/)
  })

  it('keeps the linux packaging metadata electron-builder 26 requires', () => {
    // fpm refuses to build the .deb without a project homepage.
    expect(pkg.homepage).toMatch(/^https:\/\//)
    // electron-builder 26 reads desktop keys from `desktop.entry`; top-level keys fail schema validation.
    expect(pkg.build.linux?.desktop?.entry?.StartupWMClass).toBe('githuttbr')
  })

  it('the source-checkout shim opens the app by the appId in package.json', () => {
    const shim = readFileSync(join(ROOT, 'resources/cli/githuttbr'), 'utf8')
    expect(shim).toContain(`open -n -b ${pkg.build.appId} --args`)
    // The old lookup by name: "Gitcito" stopped matching when the bundle was renamed.
    expect(shim).not.toContain('open -n -a "Gitcito"')
  })

  describe('release workflow: a signed macOS build must also be notarized', () => {
    const wf = yaml.load(readFileSync(join(ROOT, '.github/workflows/release.yml'), 'utf8')) as {
      jobs: { release: { steps: Step[] } }
    }
    const steps = wf.jobs.release.steps
    const check = steps.find((s) => s.name === 'Check notarization credentials')

    it('checks the three notarization secrets before the signed build, only when signing', () => {
      expect(check).toBeDefined()
      expect(check!.if).toBe("matrix.os == 'macos-latest' && env.HAS_APPLE_CERT == 'true'")
      for (const k of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
        expect(check!.env?.[k]).toBe(`\${{ secrets.${k} }}`)
      }
      const at = (name: string): number => steps.findIndex((s) => s.name === name)
      expect(at('Check notarization credentials')).toBeLessThan(at('Build and publish (signed macOS)'))
    })

    it('fails when any one of them is empty, and passes when all are set', () => {
      const full = { APPLE_ID: 'a@b.c', APPLE_APP_SPECIFIC_PASSWORD: 'pw', APPLE_TEAM_ID: 'TEAM' }
      const run = (env: Record<string, string>): number | null =>
        spawnSync('bash', ['-c', check!.run!], { env: { PATH: process.env.PATH ?? '', ...env } }).status
      expect(run(full)).toBe(0)
      for (const k of Object.keys(full)) expect(run({ ...full, [k]: '' })).toBe(1)
      expect(run({})).toBe(1)
    })
  })
})
