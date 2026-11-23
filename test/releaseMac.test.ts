import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './helpers'
// @ts-expect-error — plain .mjs scripts, untyped on purpose
import { parseUpdateInfo, publishGate, macUploadPlan, macUploadCheck, hasMac, assetNames } from '../scripts/release-assets.mjs'
// @ts-expect-error — plain .mjs scripts, untyped on purpose
import { pickTarget, issueTitle, issueBody, releaseState, hasMacBuild, BACKFILL_WINDOW_HOURS } from '../scripts/release-mac.mjs'

const V = '4.40.0'
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  build: { productName: string; artifactName: string; mac: { target: Array<{ target: string; arch: string[] }> } }
}

// Shaped like electron-builder 26's latest-mac.yml: zips first, then dmgs.
const macYml = (version = V, archs = ['arm64', 'x64']): string =>
  [
    `version: ${version}`,
    'files:',
    ...archs.flatMap((a) => [`  - url: GitHuttBr-${version}-${a}.zip`, '    sha512: abc', '    size: 1']),
    ...archs.flatMap((a) => [`  - url: GitHuttBr-${version}-${a}.dmg`, '    sha512: abc', '    size: 1']),
    `path: GitHuttBr-${version}-${archs[0]}.zip`,
    'sha512: abc',
    "releaseDate: '2026-11-23T10:00:00.000Z'"
  ].join('\n')

const macDist = (version = V): string[] =>
  ['arm64', 'x64'].flatMap((a) => [
    `GitHuttBr-${version}-${a}.zip`,
    `GitHuttBr-${version}-${a}.zip.blockmap`,
    `GitHuttBr-${version}-${a}.dmg`,
    `GitHuttBr-${version}-${a}.dmg.blockmap`
  ])

describe('update files', () => {
  it('reads the version and every url, quoted or not', () => {
    const info = parseUpdateInfo(macYml().replace(`version: ${V}`, `version: '${V}'`))
    expect(info.version).toBe(V)
    expect(info.urls).toEqual([
      `GitHuttBr-${V}-arm64.zip`,
      `GitHuttBr-${V}-x64.zip`,
      `GitHuttBr-${V}-arm64.dmg`,
      `GitHuttBr-${V}-x64.dmg`
    ])
  })

  it('names the mac files the way package.json build config does', () => {
    // artifactName ${productName}-${version}-${arch}.${ext}, dmg + zip for both archs.
    expect(pkg.build.artifactName).toBe('${productName}-${version}-${arch}.${ext}')
    expect(pkg.build.productName).toBe('GitHuttBr')
    const targets = pkg.build.mac.target.map((t) => [t.target, [...t.arch].sort()])
    expect(targets).toEqual([
      ['dmg', ['arm64', 'x64']],
      ['zip', ['arm64', 'x64']]
    ])
  })
})

describe('publish gate (Linux + Windows)', () => {
  const linux = `version: ${V}\nfiles:\n  - url: GitHuttBr-${V}-x86_64.AppImage\npath: GitHuttBr-${V}-x86_64.AppImage\n`
  const win = `version: ${V}\nfiles:\n  - url: GitHuttBr-Setup-${V}.exe\npath: GitHuttBr-Setup-${V}.exe\n`
  const all = ['latest.yml', 'latest-linux.yml', `GitHuttBr-${V}-x86_64.AppImage`, `GitHuttBr-Setup-${V}.exe`]

  it('passes when both ymls and the files they name are attached, with or without macOS', () => {
    expect(publishGate(all, { 'latest.yml': win, 'latest-linux.yml': linux })).toEqual({ ok: true, missing: [] })
  })

  it('refuses a release missing a yml or a file a yml points at', () => {
    expect(publishGate(all.filter((n) => n !== 'latest.yml'), { 'latest-linux.yml': linux })).toEqual({
      ok: false,
      missing: ['latest.yml']
    })
    const noExe = all.filter((n) => !n.endsWith('.exe'))
    expect(publishGate(noExe, { 'latest.yml': win, 'latest-linux.yml': linux }).missing).toEqual([`GitHuttBr-Setup-${V}.exe`])
    expect(publishGate(all, { 'latest.yml': 'version: x\n', 'latest-linux.yml': linux }).missing).toEqual(['latest.yml (names no file)'])
  })

  it('reads gh release view --json assets', () => {
    const names = assetNames({ assets: [{ name: 'latest-mac.yml' }, { name: 'x' }] })
    expect(names).toEqual(['latest-mac.yml', 'x'])
    expect(hasMac(names)).toBe(true)
    expect(hasMac(['latest.yml'])).toBe(false)
  })
})

describe('mac upload plan', () => {
  it('uploads dmg, zip and blockmaps for both archs, latest-mac.yml last', () => {
    const plan = macUploadPlan([...macDist(), 'latest-mac.yml', 'builder-debug.yml', 'mac-arm64', 'mac'], macYml(), V)
    expect(plan.ok).toBe(true)
    expect(plan.upload).toHaveLength(9)
    expect(plan.upload.at(-1)).toBe('latest-mac.yml')
    expect(plan.upload).not.toContain('builder-debug.yml')
    // Every url electron-updater will fetch is uploaded under that exact name.
    for (const u of parseUpdateInfo(macYml()).urls) expect(plan.upload).toContain(u)
  })

  it('refuses when the yml is absent, for another version, one-arch, or names a missing file', () => {
    expect(macUploadPlan(macDist(), null, V)).toEqual({ ok: false, error: 'latest-mac.yml was not written by the build' })
    expect(macUploadPlan(macDist(), macYml('4.39.1'), V).error).toContain('expected 4.40.0')
    expect(macUploadPlan(macDist(), macYml(V, ['arm64']), V).error).toContain('no x64 zip')
    expect(macUploadPlan(macDist().filter((f) => f !== `GitHuttBr-${V}-x64.zip`), macYml(), V).error).toContain(
      `GitHuttBr-${V}-x64.zip`
    )
  })
})

// Two macOS builds of one tag (Release's job or its re-run, and a backfill)
// must not interleave uploads: latest-mac.yml from one, zips from the other.
describe('mac upload check, right before uploading', () => {
  it('uploads when nothing macOS is attached yet', () => {
    expect(macUploadCheck(['latest.yml', 'latest-linux.yml'])).toEqual({ upload: true })
  })

  it('finishes a half-done upload: binaries attached but no latest-mac.yml', () => {
    expect(macUploadCheck(['latest.yml', ...macDist()])).toEqual({ upload: true })
  })

  it('skips, never clobbers, once another run attached latest-mac.yml', () => {
    const c = macUploadCheck(['latest.yml', ...macDist(), 'latest-mac.yml'])
    expect(c.upload).toBe(false)
    expect(c.reason).toContain('already attached')
  })
})

describe('backfill target', () => {
  const now = Date.parse('2026-11-23T12:00:00Z')
  const hoursAgo = (h: number): string => new Date(now - h * 3600_000).toISOString()
  const release = (over: Record<string, unknown> = {}) => ({
    tagName: 'v4.40.0',
    isDraft: false,
    publishedAt: hoursAgo(2),
    assets: [{ name: 'latest.yml' }, { name: 'latest-linux.yml' }],
    ...over
  })

  it('picks a recent published release that lacks latest-mac.yml', () => {
    expect(pickTarget({ release: release(), runs: [], now })).toEqual({ tag: 'v4.40.0' })
  })

  it('is idempotent: a release with latest-mac.yml is left alone', () => {
    const r = release({ assets: [{ name: 'latest-mac.yml' }] })
    expect(pickTarget({ release: r, runs: [], now })).toEqual({ skip: 'v4.40.0 already has latest-mac.yml' })
  })

  it('a run by hand builds even while a Release run for the tag is still queued', () => {
    const runs = [{ status: 'queued', headBranch: 'v4.40.0' }]
    expect(pickTarget({ release: release(), runs, now, explicitTag: 'v4.40.0' })).toEqual({ tag: 'v4.40.0' })
  })

  it('waits while a Release run for the tag is still going', () => {
    const runs = [{ status: 'queued', headBranch: 'v4.40.0' }, { status: 'completed', headBranch: 'v4.39.1' }]
    expect('skip' in pickTarget({ release: release(), runs, now })).toBe(true)
    expect(pickTarget({ release: release(), runs: [{ status: 'completed', headBranch: 'v4.40.0' }], now })).toEqual({
      tag: 'v4.40.0'
    })
  })

  it(`stops trying ${BACKFILL_WINDOW_HOURS} h after publishing, unless asked by hand`, () => {
    const old = release({ publishedAt: hoursAgo(BACKFILL_WINDOW_HOURS + 1) })
    expect(pickTarget({ release: old, runs: [], now }).skip).toContain('automatic tries have stopped')
    expect(pickTarget({ release: old, runs: [], now, explicitTag: 'v4.40.0' })).toEqual({ tag: 'v4.40.0' })
  })

  it('leaves drafts to a person, and refuses odd tags', () => {
    expect(pickTarget({ release: release({ isDraft: true, publishedAt: null }), runs: [], now }).skip).toContain('draft')
    expect(pickTarget({ release: release({ isDraft: true }), runs: [], now, explicitTag: 'v4.40.0' })).toEqual({ tag: 'v4.40.0' })
    expect(pickTarget({ release: release(), runs: [], now, explicitTag: 'v1;rm -rf' }).skip).toContain('not vX.Y.Z')
    expect(pickTarget({ release: release({ tagName: 'nightly' }), runs: [], now }).skip).toContain('not vX.Y.Z')
    expect(pickTarget({ release: null, runs: [], now })).toEqual({ skip: 'no release found' })
  })
})

describe('the maintainer issue', () => {
  const body = issueBody({
    tag: 'v4.40.0',
    repo: 'StarleyDev/githuttbr',
    runUrl: 'https://github.com/StarleyDev/githuttbr/actions/runs/42',
    result: 'cancelled',
    runner: 'macos-26',
    deadline: '2026-11-25 10:00 UTC'
  })

  it('has one stable title per release, which the workflows search for', () => {
    expect(issueTitle('v4.40.0')).toBe('v4.40.0: macOS build missing')
  })

  it('links the run and the release, says why, what follows and how to do it by hand', () => {
    expect(body).toContain('https://github.com/StarleyDev/githuttbr/actions/runs/42')
    expect(body).toContain('https://github.com/StarleyDev/githuttbr/releases/tag/v4.40.0')
    expect(body).toContain('never got a runner')
    expect(body).toContain('2026-11-25 10:00 UTC')
    expect(body).toContain('Release mac backfill')
    expect(body).toContain('latest-mac.yml')
  })

  it('names a real build failure as such', () => {
    const b = issueBody({ tag: 'v4.40.0', repo: 'o/r', runUrl: 'u', result: 'failure', deadline: null })
    expect(b).toContain('ended with `failure`')
    expect(b).toContain('every 6 hours for 48 h')
  })

  it('says Linux and Windows are out only when the release is published', () => {
    const published = issueBody({ tag: 'v4.40.0', repo: 'o/r', runUrl: 'u', result: 'cancelled', draft: false, deadline: 'D' })
    expect(published).toContain('Linux and Windows are published')
    expect(published).toContain('retries every 6 hours until **D**')
    expect(published).not.toContain('draft')
  })

  it('on a draft, says nothing is public and that the backfill skips drafts', () => {
    const draft = issueBody({ tag: 'v4.40.0', repo: 'o/r', runUrl: 'u', result: 'cancelled', draft: true })
    expect(draft).toContain('still a **draft**: nothing is public yet')
    expect(draft).toContain('skips drafts')
    expect(draft).toContain('run it by hand')
    expect(draft).not.toContain('Linux and Windows are published')
    expect(draft).not.toContain('retries every 6 hours until')
  })

  it('claims neither when the release state could not be read', () => {
    const unknown = issueBody({ tag: 'v4.40.0', repo: 'o/r', runUrl: 'u', result: 'cancelled' })
    expect(unknown).not.toContain('Linux and Windows are published')
    expect(unknown).not.toContain('still a **draft**')
    expect(unknown).toContain('could not be read')
  })

  it('reads the release state from gh release view', () => {
    expect(releaseState({ isDraft: true, publishedAt: null })).toEqual({ draft: true, deadline: null })
    expect(releaseState({ isDraft: false, publishedAt: '2026-11-23T10:00:00Z' })).toEqual({
      draft: false,
      deadline: '2026-11-25 10:00 UTC'
    })
    expect(releaseState(null)).toEqual({ draft: null, deadline: null })
    expect(releaseState({})).toEqual({ draft: null, deadline: null })
  })
})

describe('release workflows', () => {
  type Job = {
    needs?: string | string[]
    uses?: string
    with?: Record<string, unknown>
    permissions?: Record<string, string>
    concurrency?: { group: string; 'cancel-in-progress': boolean }
    steps?: Array<{ name?: string; uses?: string; run?: string; with?: Record<string, unknown> }>
  }
  const load = (f: string) =>
    yaml.load(readFileSync(join(ROOT, '.github/workflows', f), 'utf8')) as { jobs: Record<string, Job> }
  const release = load('release.yml')

  it('publishes after Linux and Windows only, never waiting for macOS', () => {
    expect(release.jobs.publish.needs).toBe('release')
    const matrix = (release.jobs.release as { strategy: { matrix: { os: string[] } } }).strategy.matrix.os
    expect([...matrix].sort()).toEqual(['ubuntu-latest', 'windows-latest'])
    expect(release.jobs.mac.uses).toBe('./.github/workflows/release-mac.yml')
    expect(release.jobs.mac.with?.runner).toBe('macos-15-intel')
  })

  it('opens the issue only once the automatic re-runs are used up', () => {
    const retry = readFileSync(join(ROOT, '.github/workflows/release-retry.yml'), 'utf8')
    const max = Number(/MAX_ATTEMPTS: (\d+)/.exec(retry)?.[1])
    expect(release.jobs.mac.with?.['notify-from-attempt']).toBe(max)
  })

  it('builds macOS without electron-builder publishing, and uploads with --clobber', () => {
    const mac = readFileSync(join(ROOT, '.github/workflows/release-mac.yml'), 'utf8')
    expect(mac).not.toContain('npm run release')
    expect(mac.match(/electron-builder --mac --publish never/g)).toHaveLength(2)
    expect(mac).toContain('--clobber')
  })

  it('serializes every macOS build of a tag, whichever workflow called it', () => {
    const mac = load('release-mac.yml')
    expect(mac.jobs.build.concurrency).toEqual({ group: 'release-mac-${{ inputs.tag }}', 'cancel-in-progress': false })
    // Both callers go through the same reusable workflow, so through that group.
    expect(release.jobs.mac.uses).toBe('./.github/workflows/release-mac.yml')
    expect(load('release-mac-backfill.yml').jobs.mac.uses).toBe('./.github/workflows/release-mac.yml')
  })

  it('checks for an existing latest-mac.yml before uploading, with scripts from the workflow commit', () => {
    const steps = load('release-mac.yml').jobs.build.steps ?? []
    const names = steps.map((s) => s.name)
    const scripts = steps.find((s) => s.name === 'Checkout the release scripts')
    expect(scripts?.with).toMatchObject({ ref: '${{ github.workflow_sha }}', path: '.release-ci', 'persist-credentials': false })
    // After the build, so nothing of it lands in the packaged app.
    expect(names.indexOf('Checkout the release scripts')).toBeGreaterThan(names.indexOf('Build (unsigned macOS)'))
    const upload = steps.find((s) => s.name === 'Upload to the release')?.run ?? ''
    expect(upload.indexOf('mac-upload-check')).toBeGreaterThan(-1)
    expect(upload.indexOf('mac-upload-check')).toBeLessThan(upload.indexOf('gh release upload'))
    // Never the tag's own copy, which an older tag does not have.
    expect(upload).not.toMatch(/node scripts\//)
  })

  it('pins every action by SHA and keeps no credentials in checkout', () => {
    for (const f of readdirSync(join(ROOT, '.github/workflows'))) {
      for (const job of Object.values(load(f).jobs)) {
        for (const s of job.steps ?? []) {
          if (!s.uses) continue
          expect(s.uses, `${f}: ${s.uses}`).toMatch(/@[0-9a-f]{40}$/)
          if (s.uses.startsWith('actions/checkout@')) expect(s.with?.['persist-credentials'], f).toBe(false)
        }
      }
    }
  })
})

describe('hasMacBuild — a missed run is not news once macOS is attached', () => {
  it('sees latest-mac.yml uploaded by another run or by hand', () => {
    expect(hasMacBuild({ assets: [{ name: 'latest.yml' }, { name: 'latest-mac.yml' }] })).toBe(true)
  })
  it('is false without it, and for an unreadable release', () => {
    expect(hasMacBuild({ assets: [{ name: 'GitHuttBr-4.40.1-arm64.zip' }] })).toBe(false)
    expect(hasMacBuild(null)).toBe(false)
  })
})
