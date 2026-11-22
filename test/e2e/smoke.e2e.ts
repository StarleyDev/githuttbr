import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { repoPath } from '../helpers'
import { en, type TranslationKey } from '../../src/renderer/src/i18n/en'
import { ptBR } from '../../src/renderer/src/i18n/pt-BR'
import { de } from '../../src/renderer/src/i18n/de'
import { interp } from '../../src/renderer/src/i18n/interp'
import { startApp, visibleCopy, type RunningApp, type StartOptions } from './app'
import { captureFirstFrame } from './firstFrame'

// Smoke tests against the real built app — the checks every change used to end
// with as "someone open the app and look". Each case launches its own instance
// on a private copy of a playground repo (see app.ts for what is isolated).

let running: RunningApp | null = null

async function start(opts?: StartOptions): Promise<RunningApp> {
  running = await startApp(opts)
  return running
}

afterEach(async () => {
  await running?.close()
  running = null
})

/** Toolbar labels present on every repo view, whose wording differs per locale. */
const TOOLBAR: TranslationKey[] = ['toolbar.undo', 'toolbar.redo', 'toolbar.tools', 'toolbar.settings']

const git = (repo: string, ...args: string[]): string =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()

/** Text of the toolbar's buttons, one entry per button. */
/** Script chunks the window fetched whose file name starts with `prefix`. */
const chunksLoaded = async (r: RunningApp, prefix: string): Promise<string[]> =>
  r.requests().filter((u) => u.split('/').pop()!.startsWith(prefix) && u.endsWith('.js'))

const toolbarText = (r: RunningApp): Promise<string[]> =>
  r.page.locator('.toolbar button').allInnerTexts().then((all) => all.map((s) => s.trim()).filter(Boolean))

describe('e2e smoke', () => {
  it('boots on a playground repo and draws its commits, with a clean console', async () => {
    const r = await start()
    const subjects = git(r.repo, 'log', '--all', '--format=%s').split('\n')
    expect(subjects.length).toBeGreaterThan(3)

    // One graph row per commit, each carrying its subject.
    await r.page.locator('.graph-row').nth(subjects.length - 1).waitFor()
    const rows = await r.page.locator('.graph-row').allInnerTexts()
    expect(rows).toHaveLength(subjects.length)
    for (const s of subjects) expect(rows.some((row) => row.includes(s)), s).toBe(true)

    // The store agrees with git about what it loaded.
    const loaded = await r.page.evaluate((p) => window.__shot!.repo.getState().repos[p]?.commits.length, r.repo)
    expect(loaded).toBe(subjects.length)

    // No error boundary anywhere, nothing logged at error level, and nothing
    // tried to leave the machine other than the avatar lookups.
    expect(await r.page.locator('.error-boundary, .root-error-reload').count()).toBe(0)
    expect(r.errors()).toEqual([])
    const unexpected = r.externalRequests().filter((u) => !u.startsWith('https://gravatar.com/avatar/'))
    expect(unexpected).toEqual([])
  })

  it('cold-starts in Portuguese with no English on the first frame', async () => {
    const r = await start({ language: 'pt-BR' })
    const frame = await captureFirstFrame(r.page)
    const lines = frame.text.split('\n').map((l) => l.trim())
    for (const key of TOOLBAR) {
      expect(ptBR[key]).not.toBe(en[key])
      expect(lines, `first frame shows ${key} in Portuguese`).toContain(ptBR[key])
      expect(lines, `first frame shows ${key} in English`).not.toContain(en[key])
    }
    expect(frame.lang).toBe('pt-BR')
    expect(r.errors()).toEqual([])
  })

  it('cold-starts in Arabic right-to-left', async () => {
    const r = await start({ language: 'ar' })
    const frame = await captureFirstFrame(r.page)
    expect(frame.dir, 'dir on the first frame with copy').toBe('rtl')
    expect(await r.page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    expect(await r.page.evaluate(() => document.documentElement.lang)).toBe('ar')
    expect(r.errors()).toEqual([])
  })

  it('switches language at runtime without showing raw keys', async () => {
    const r = await start()
    expect(await toolbarText(r)).toContain(en['toolbar.settings'])

    await r.page.evaluate(() => window.__shot!.settings.getState().update((s) => ({ ...s, language: 'de' })))
    // The German chunk loads on demand; wait for it to land in the toolbar.
    await expect
      .poll(() => toolbarText(r), { timeout: 10_000 })
      .toContain(de['toolbar.settings'])
    const labels = await toolbarText(r)
    for (const key of TOOLBAR) {
      if (de[key] === en[key]) continue
      expect(labels).toContain(de[key])
      expect(labels).not.toContain(en[key])
    }
    expect(await r.page.evaluate(() => document.documentElement.lang)).toBe('de')

    // `t()` falls back to the key itself only when even English lacks it, so a
    // visible string equal to a key is a key that reached the screen raw.
    const keys = new Set(Object.keys(en))
    const copy = await visibleCopy(r.page)
    expect(copy.filter((s) => keys.has(s))).toEqual([])
    // A placeholder `interp` was never given renders as `{name}`.
    expect(copy.filter((s) => /\{[a-zA-Z]+\}/.test(s))).toEqual([])
    expect(r.errors()).toEqual([])
  })

  it('loads the lazy 3D cosmos view and the licenses page', async () => {
    const r = await start()
    // Neither chunk is part of startup — that is the point of making them lazy.
    expect(await chunksLoaded(r, 'CosmosScene-')).toEqual([])
    expect(await chunksLoaded(r, 'LicensesPage-')).toEqual([])

    // Cosmos: the three.js chunk arrives with the overlay, from file://.
    await r.page.evaluate((p) => window.__shot!.ui.getState().openCosmos(p), r.repo)
    await r.page.locator('.cosmos-canvas canvas').waitFor({ timeout: 15_000 })
    await r.page.locator('.cosmos-caption').waitFor()
    expect(await r.page.locator('.cosmos-error').count()).toBe(0)
    expect(await chunksLoaded(r, 'CosmosScene-')).toEqual([expect.stringMatching(/^file:\/\//)])
    await r.page.evaluate(() => window.__shot!.ui.getState().closeCosmos())
    await r.page.locator('.cosmos-overlay').waitFor({ state: 'detached' })

    // Licenses: a page tab whose module (and ~1 MB of notices) loads on open.
    await r.page.evaluate(() => window.__shot!.settings.getState().openPageTab({ type: 'licenses' }))
    await r.page.locator('.licenses-list').waitFor({ timeout: 15_000 })
    expect(await r.page.locator('.licenses-row-btn').count()).toBeGreaterThan(50)
    expect(await r.page.locator('.licenses-header h1').innerText()).toBe(en['licenses.title'])
    expect(await chunksLoaded(r, 'LicensesPage-')).toEqual([expect.stringMatching(/^file:\/\//)])

    expect(await r.page.locator('.error-boundary, .root-error-reload').count()).toBe(0)
    expect(r.errors()).toEqual([])
  })

  it('renders seeded tasks in the clone tray', async () => {
    const r = await start()
    await r.page.evaluate(() => {
      const task = (name: string, progress: unknown, extra = {}): Record<string, unknown> => ({
        id: `e2e-${name}`,
        name,
        url: `https://example.invalid/studio/${name}.git`,
        progress,
        queued: false,
        cancelling: false,
        attached: false,
        ...extra
      })
      window.__shot!.clones.setState({
        tasks: [
          task('api', { stage: 'receiving', progress: 64, processed: 6400, total: 10000 }),
          task('web', { stage: 'resolving', progress: 91, processed: 910, total: 1000 }),
          task('infra', null, { queued: true })
        ]
      } as never)
    })
    const items = r.page.locator('.clone-tray-item')
    await items.nth(2).waitFor()
    expect(await items.count()).toBe(3)
    expect(await r.page.locator('.clone-tray-name').allInnerTexts()).toEqual(
      ['api', 'web', 'infra'].map((name) => interp(en['clone.trayTitle'], { name }))
    )
    expect(await items.nth(0).locator('.clone-progress-pct').innerText()).toBe('64%')
    expect(await items.nth(2).innerText()).toContain(en['clone.queued'])
    expect(r.errors()).toEqual([])
  })

  it('pushes several branches to the remote in one go', async () => {
    const r = await start({ scenario: 'multi-branch-push' })
    // The scenario's remote is a sibling bare repo (`../multi-branch-push-origin.git`);
    // copy it next to the private clone so the push is real, local and offline.
    const origin = join(dirname(r.repo), 'multi-branch-push-origin.git')
    cpSync(join(dirname(repoPath('multi-branch-push')), 'multi-branch-push-origin.git'), origin, { recursive: true })

    await r.page.evaluate((p) => window.__shot!.ui.getState().openModal({ kind: 'push-branches', repoPath: p }), r.repo)
    const rows = r.page.locator('.push-branch-row')
    await rows.first().waitFor()
    const states = Object.fromEntries(
      await rows.evaluateAll((els) => els.map((el) => [el.getAttribute('data-branch'), el.getAttribute('data-state')]))
    )
    expect(states['agent/billing-fix']).toBe('diverged')
    expect(await rows.locator('[data-state="diverged"] input, [data-state="behind"] input').count()).toBe(0)
    const ticked = await r.page
      .locator('.push-branch-row.selected')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-branch')))
    expect(ticked).toEqual(expect.arrayContaining(['agent/auth-refresh', 'agent/flaky-tests', 'agent/perf-cache']))
    expect(ticked).not.toContain('agent/billing-fix')

    await r.page.locator('.push-branches-submit').click()
    const results = r.page.locator('.push-result')
    await results.first().waitFor({ timeout: 20_000 })
    const outcome = Object.fromEntries(
      await results.evaluateAll((els) => els.map((el) => [el.getAttribute('data-branch'), el.getAttribute('data-status')]))
    )
    for (const b of ticked) expect(['pushed', 'created']).toContain(outcome[b as string])

    // The remote really has them now, at the local tips — and nothing diverged was forced.
    for (const b of ticked) {
      const dest = b === 'feature/old-name' ? 'feature/new-name' : (b as string)
      expect(git(origin, 'rev-parse', `refs/heads/${dest}`)).toBe(git(r.repo, 'rev-parse', `refs/heads/${b}`))
    }
    expect(git(origin, 'rev-parse', 'refs/heads/agent/billing-fix')).not.toBe(
      git(r.repo, 'rev-parse', 'refs/heads/agent/billing-fix')
    )
    expect(r.errors()).toEqual([])
  })
})
