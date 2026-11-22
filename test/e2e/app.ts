import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication, Page } from 'playwright'
import { repoPath } from '../helpers'
import { makeUserDataDir, seedProfile, launchApp, dismissKeychainConsent, closeApp } from '../../examples/screenshots/harness.mjs'

/**
 * Console noise a healthy boot produces, each with the reason it is not a bug.
 * Anything else logged at `error` level fails the case that saw it. Keep this
 * list short and specific — a pattern broad enough to swallow a real failure
 * defeats the suite.
 */
export const BENIGN_CONSOLE: { pattern: RegExp; why: string }[] = [
  {
    // Chromium logs every non-2xx resource load at error level. Avatar.tsx asks
    // gravatar with `d=404` on purpose — "no picture" is a 404 by design, and
    // the component falls back to the generated avatar. The suite answers
    // every external request with that 404 (see the route below), so this is
    // the expected line, not a failure.
    pattern: /^console\.error: Failed to load resource: .*404.*\(https:\/\/gravatar\.com\/avatar\/[0-9a-f]+\?/,
    why: 'gravatar lookup for an author without a picture (404 by design)'
  }
]

export interface RunningApp {
  app: ElectronApplication
  page: Page
  /** The throwaway copy of the playground repo the app opened. */
  repo: string
  /** `console.error` lines and uncaught page errors seen so far, minus the allow-list. */
  errors: () => string[]
  /** http(s) requests the renderer attempted (all answered locally with a 404). */
  externalRequests: () => string[]
  /** Every URL the window requested, file:// included, in order. */
  requests: () => string[]
  close: () => Promise<void>
}

export interface StartOptions {
  /** Playground scenario to open (copied first — the app never touches the shared one). */
  scenario?: string
  language?: string
  /** Extra settings merged over the seeded ones. */
  settings?: Record<string, unknown>
}

/**
 * Launch the built app on a private copy of a playground repo.
 *
 * Everything the app could read from the machine is redirected into a temp
 * dir: HOME (so ~/.ssh, ~/.gitconfig and the XDG dirs are empty fakes), the
 * global and system git config, and the SSH dir the app honours under --shot.
 * The keychain question is answered "declined" before launch, and the seeded
 * profile carries no tokens and has AI off, so nothing asks the OS keyring and
 * nothing goes to the network. A test passing here says nothing about — and
 * depends on nothing in — the account that ran it.
 */
export async function startApp(opts: StartOptions = {}): Promise<RunningApp> {
  const scenario = opts.scenario ?? 'octopus-merge'
  const sandbox = mkdtempSync(join(tmpdir(), 'gitcito-e2e-'))
  const repo = join(sandbox, scenario)
  cpSync(repoPath(scenario), repo, { recursive: true })

  const home = join(sandbox, 'home')
  mkdirSync(join(home, '.ssh'), { recursive: true })
  const gitconfig = join(home, '.gitconfig')
  writeFileSync(gitconfig, '[user]\n\tname = Gitcito E2E\n\temail = e2e@example.invalid\n')
  const env = {
    HOME: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    XDG_CACHE_HOME: join(home, '.cache'),
    GIT_CONFIG_GLOBAL: gitconfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GITCITO_SSH_DIR: join(home, '.ssh'),
    // A stray value from the shell would make every git message localised.
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8'
  }

  const tab = { id: 'e2e-tab', kind: 'repo', name: scenario, repos: [{ path: repo, name: scenario }], activeRepoPath: repo }
  const settings = {
    profiles: [
      {
        id: 'default',
        name: 'Gitcito E2E',
        gitName: 'Gitcito E2E',
        gitEmail: 'e2e@example.invalid',
        githubToken: '',
        azureToken: '',
        gitlabToken: '',
        bitbucketToken: '',
        ai: {
          enabled: false,
          provider: 'openai',
          endpoint: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4o-mini',
          commitStyle: 'conventional',
          explainStyle: 'normal',
          conflictStyle: 'clean',
          branchNamingStyle: 'prefix/description',
          customInstructions: '',
          generateDescription: true,
          coAuthor: true
        }
      }
    ],
    activeProfileId: 'default',
    tabs: [tab],
    activeTabId: tab.id,
    recentRepos: [],
    themeMode: 'dark',
    onboardingCompleted: true,
    language: opts.language ?? 'en',
    ...opts.settings
  }

  const userDataDir = await makeUserDataDir('gitcito-e2e-profile-')
  await seedProfile(userDataDir, settings)

  const seen: string[] = []
  const external: string[] = []
  const requests: string[] = []
  const record = (line: string): void => {
    if (!BENIGN_CONSOLE.some((b) => b.pattern.test(line))) seen.push(line)
  }
  let launched: { app: ElectronApplication; page: Page }
  try {
    launched = await launchApp({
      userDataDir,
      env,
      // --disable-gpu (the harness default, for deterministic pixels) leaves
      // no WebGL at all, and the cosmos view needs it. SwiftShader is
      // Chromium's CPU WebGL: no GPU on a CI runner, same result everywhere.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      onPage: async (page: Page) => {
        page.on('console', (m) => {
          if (m.type() !== 'error') return
          const url = m.location().url
          record(`console.error: ${m.text()}${url ? ` (${url})` : ''}`)
        })
        page.on('pageerror', (e) => record(`pageerror: ${e.message}`))
        // Playwright's own request events skip file://, which is exactly where
        // the built app's lazy chunks come from; the DevTools protocol does not.
        const cdp = await page.context().newCDPSession(page)
        cdp.on('Network.requestWillBeSent', (e) => requests.push(e.request.url))
        await cdp.send('Network.enable')
        // No request leaves the machine. Commit avatars ask gravatar for a
        // hash of each author's email; answered here with the 404 gravatar
        // gives for an unknown address, which is the path most users see and
        // keeps the run offline and deterministic. Every such request is kept,
        // so a case can assert nothing *else* tried to reach the network.
        await page.context().route(/^https?:\/\//, (route) => {
          external.push(route.request().url())
          return route.fulfill({ status: 404, body: '' })
        })
      }
    })
  } catch (e) {
    await closeApp(null, userDataDir)
    rmSync(sandbox, { recursive: true, force: true })
    throw e
  }
  const { app, page } = launched
  await page.evaluate((p) => window.__shot!.waitForRepo(p), repo)
  await dismissKeychainConsent(page)

  return {
    app,
    page,
    repo,
    errors: () => [...seen],
    externalRequests: () => [...external],
    requests: () => [...requests],
    close: async () => {
      await closeApp(app, userDataDir)
      rmSync(sandbox, { recursive: true, force: true })
    }
  }
}

/** Every visible piece of UI copy: text nodes plus the attributes a user reads. */
export function visibleCopy(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim()
      if (text) out.push(text)
    }
    for (const el of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        const v = el.getAttribute(attr)?.trim()
        if (v) out.push(v)
      }
    }
    return out
  })
}
