import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FuseV1Options } from '@electron/fuses'
import { spawnSync } from 'node:child_process'
import yaml from 'js-yaml'
import { ROOT } from './helpers'
import { BUNDLE_ID } from '../src/main/appIdentity'

const require = createRequire(import.meta.url)
const afterPack = require('../scripts/after-pack.cjs') as { fuseConfig(): Promise<Record<string, unknown>> }
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  homepage?: string
  build: {
    appId: string
    afterPack?: string
    linux?: { executableName?: string; desktop?: { entry?: Record<string, string> } }
    deb?: { fpm?: string[] }
    rpm?: { fpm?: string[] }
  }
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

  it('owns its identity, the reverse-DNS form of git.huttbr.com', () => {
    // The macOS bundle id, the NSIS uninstall GUID and the updater all hang off it. The old
    // com.gitcito.desktop made an install replace a real Gitcito on Windows and collide on macOS.
    expect(pkg.build.appId).toBe(BUNDLE_ID)
    expect(BUNDLE_ID).toBe('com.huttbr.git')
  })

  it('the linux packages coexist with gitcito: no replaces, conflicts or provides', () => {
    expect(pkg.build.linux?.executableName).toBe('githuttbr')
    for (const fpm of [pkg.build.deb?.fpm, pkg.build.rpm?.fpm]) {
      expect((fpm ?? []).join(' ')).not.toMatch(/gitcito/i)
    }
  })

  it('the source-checkout shim opens the app by the appId in package.json', () => {
    const shim = readFileSync(join(ROOT, 'resources/cli/githuttbr'), 'utf8')
    expect(shim).toContain(`open -n -b ${pkg.build.appId} --args`)
    expect(shim).not.toMatch(/gitcito/i)
  })

  describe('release workflow: a signed macOS build must also be notarized', () => {
    // macOS builds in its own reusable workflow, called by Release and by the backfill.
    const wf = yaml.load(readFileSync(join(ROOT, '.github/workflows/release-mac.yml'), 'utf8')) as {
      jobs: { build: { steps: Step[] } }
    }
    const steps = wf.jobs.build.steps
    const check = steps.find((s) => s.name === 'Check notarization credentials')

    it('checks the three notarization secrets before the signed build, only when signing', () => {
      expect(check).toBeDefined()
      expect(check!.if).toBe("env.HAS_APPLE_CERT == 'true'")
      for (const k of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
        expect(check!.env?.[k]).toBe(`\${{ secrets.${k} }}`)
      }
      const at = (name: string): number => steps.findIndex((s) => s.name === name)
      expect(at('Check notarization credentials')).toBeLessThan(at('Build (signed macOS)'))
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

describe('afterPack order on macOS', () => {
  // flipFuses re-signs the bundle ad hoc and seals the files present then; an
  // unsigned build is never signed again, so a file written afterwards leaves
  // macOS a "damaged" app (4.38.0–4.40.1).
  it('writes the CLI files before flipping the fuses', () => {
    const src = readFileSync(join(ROOT, 'scripts/after-pack.cjs'), 'utf8')
    const body = src.slice(src.indexOf('async function afterPack'))
    const flip = body.indexOf('await flipFuses(')
    expect(flip).toBeGreaterThan(-1)
    expect(body.indexOf('await writeCliAppBinary(')).toBeGreaterThan(-1)
    expect(body.indexOf('await writeCliAppBinary(')).toBeLessThan(flip)
    expect(body.indexOf('await markCliExecutable(')).toBeLessThan(flip)
  })
})
