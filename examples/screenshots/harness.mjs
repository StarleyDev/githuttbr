// Launching the built app under automation — shared by the screenshot capture
// (capture.mjs) and the end-to-end smoke suite (test/e2e/). Both need the same
// things from a launch: the `--shot` flag that attaches the store bridge, a
// throwaway userData dir with a seeded settings file, the keychain question
// answered before it is asked, and an environment an editor's terminal cannot
// poison. Keeping it in one place means a launch fix lands in both.
import { _electron as electron } from 'playwright'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(HERE, '..', '..')
/** The built main-process entry; `npm run build` writes it. */
export const MAIN = join(ROOT, 'out', 'main', 'index.js')

/**
 * The environment the app starts with. ELECTRON_RUN_AS_NODE is dropped: an
 * editor built on Electron (VS Code, Cursor) sets it for its own terminals, and
 * inherited it makes Electron start as plain Node — the launch then fails with
 * nothing but "Process failed to launch".
 */
export function appEnv(extra = {}) {
  const env = { ...process.env, ...extra }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

/** Extra switches for this machine's display, from SHOT_ELECTRON_ARGS — on a
 *  Wayland desktop, `--ozone-platform=x11` (with WAYLAND_DISPLAY unset) runs
 *  the app through XWayland. */
export function displayArgs() {
  return (process.env.SHOT_ELECTRON_ARGS ?? '').split(/\s+/).filter(Boolean)
}

/** A fresh userData dir. Each launch gets its own, so runs never share state
 *  and never touch the real profile — and the single-instance lock, which lives
 *  in this dir, lets several launches run side by side. */
export function makeUserDataDir(prefix = 'githuttbr-shot-') {
  return mkdtemp(join(tmpdir(), prefix))
}

/**
 * Write the settings file and the keychain answer into `userDataDir`.
 *
 * `settings` is partial: the app's loader fills in every other default.
 *
 * The keychain answer is 'declined' unless asked otherwise: refusing keeps
 * tokens in memory and the app fully working, while granting makes macOS raise
 * its own "GitHuttBr Safe Storage" dialog — an OS window Playwright cannot
 * dismiss, which stalls the run. A seeded profile carrying any token would
 * otherwise raise the consent explainer on every launch, since each launch has
 * a fresh userData dir.
 */
export async function seedProfile(userDataDir, settings, { keychain = false } = {}) {
  await writeFile(join(userDataDir, 'githuttbr-settings.json'), JSON.stringify(settings, null, 2))
  await writeFile(
    join(userDataDir, 'githuttbr-keychain.json'),
    JSON.stringify({ consent: keychain ? 'granted' : 'declined', explained: true }, null, 2)
  )
}

/**
 * Launch the built app with `--shot` against a seeded userData dir and wait for
 * the store bridge. Returns the Electron application and its main window.
 *
 * `onPage` runs as soon as the first window exists — before the bridge waits —
 * so a caller collecting console output sees boot, not only what follows it.
 * `args` adds Chromium switches for this caller (before SHOT_ELECTRON_ARGS).
 */
export async function launchApp({ userDataDir, env = {}, args = [], width = 1440, height = 900, onPage, timeout = 20000 }) {
  const app = await electron.launch({
    // --disable-gpu forces software (CPU) rasterization so pixel output is
    // identical across runs, eliminating GPU/subpixel-antialiasing drift.
    args: [MAIN, '--shot', `--user-data-dir=${userDataDir}`, '--disable-gpu', ...args, ...displayArgs()],
    env: appEnv(env),
    cwd: ROOT
  })
  try {
    const page = await app.firstWindow()
    if (onPage) await onPage(page)
    await app.evaluate(
      ({ BrowserWindow }, { w, h }) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(w, h)
      },
      { w: width, h: height }
    )
    await waitForBridge(page, timeout)
    return { app, page }
  } catch (e) {
    await app.close().catch(() => {})
    throw e
  }
}

/**
 * Wait until the renderer's `window.__shot` bridge is attached.
 *
 * Options are the *third* argument (the second is `arg`). Interval polling, not
 * the default requestAnimationFrame: a window the compositor considers hidden
 * (Wayland, another workspace, a headless X server) never gets a frame, so rAF
 * polling never runs and the wait times out with the bridge long since ready.
 */
export function waitForBridge(page, timeout = 20000) {
  return page.waitForFunction(() => window.__shot?.ready === true, undefined, { timeout, polling: 250 })
}

/** Second line of defence behind the seeded consent file: if anything still
 *  raises the keychain explainer, drop it. Only that one kind — every other
 *  modal is something the caller asked for. */
export async function dismissKeychainConsent(page) {
  await page
    .evaluate(() => {
      const ui = window.__shot.ui.getState()
      if (ui.modal?.kind === 'keychain-consent') ui.closeModal()
    })
    .catch(() => {})
}

/** Close the app and remove its userData dir. A crashed app makes close() and
 *  rm() throw too — never let cleanup mask the real error. */
export async function closeApp(app, userDataDir) {
  await app?.close().catch(() => {})
  if (userDataDir) await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
}
