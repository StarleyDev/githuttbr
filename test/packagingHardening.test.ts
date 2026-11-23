import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FuseV1Options } from '@electron/fuses'
import { ROOT } from './helpers'

const require = createRequire(import.meta.url)
const afterPack = require('../scripts/after-pack.cjs') as { fuseConfig(): Promise<Record<string, unknown>> }
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { build: { afterPack?: string } }

describe('packaging hardening', () => {
  it('electron-builder runs the fuse hook', () => {
    expect(pkg.build.afterPack).toBe('./scripts/after-pack.cjs')
  })

  it('turns off NODE_OPTIONS and --inspect, and keeps RunAsNode for the CLI', async () => {
    const config = await afterPack.fuseConfig()
    expect(config[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(false)
    expect(config[FuseV1Options.EnableNodeCliInspectArguments]).toBe(false)
    // resources/cli/gitcito runs its headless verbs with ELECTRON_RUN_AS_NODE.
    expect(config[FuseV1Options.RunAsNode]).toBe(true)
  })

  it('macOS entitlements no longer let DYLD_* variables inject code', () => {
    const plist = readFileSync(join(ROOT, 'build/entitlements.mac.plist'), 'utf8')
    expect(plist).not.toContain('allow-dyld-environment-variables')
    expect(plist).not.toContain('disable-library-validation')
  })
})
