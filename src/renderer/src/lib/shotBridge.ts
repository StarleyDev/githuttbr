// Screenshot/automation bridge.
//
// Only loaded in screenshot mode (see main.tsx): `--shot` on an unpackaged
// build, decided by main (src/main/shotMode.ts) — a packaged app ignores the
// flag. It exposes the app's zustand stores on `window.__shot` so an external
// Playwright driver (examples/screenshots/capture.mjs) can put the UI into an
// exact state — open a conflict, preview a file, show a settings page — and
// screenshot it, without depending on fragile click paths. The module is in
// every build as a lazy chunk, but nothing imports it unless that gate is on.
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { useRepoStore, repoActions } from '../stores/repo'
import { useUpdatesStore } from '../stores/updates'
import { useLaunchStore } from '../stores/launch'
import { useTerminalsStore } from '../stores/terminals'
import { useRepoChatStore } from '../stores/chat'
import { useProblemsStore } from '../stores/problems'
import { useClonesStore } from '../stores/clones'

export interface ShotBridge {
  settings: typeof useSettingsStore
  ui: typeof useUIStore
  repo: typeof useRepoStore
  updates: typeof useUpdatesStore
  launch: typeof useLaunchStore
  /** Terminal groups and panels — needed to drive split/group shots. */
  terminals: typeof useTerminalsStore
  /** Repository chat threads, so a shot can seed a finished exchange rather
   *  than calling a real provider. */
  chat: typeof useRepoChatStore
  /** The analyzer dock: which tab, which filters, which grouping. */
  problems: typeof useProblemsStore
  /** Background clones, so a shot can show the tray mid-clone instead of
   *  racing a real one that a local playground repo finishes in a blink. */
  clones: typeof useClonesStore
  repoActions: typeof repoActions
  /** True once the bridge has attached; the driver polls for this. */
  ready: true
  /** Resolves once the given repo has finished its initial load. */
  waitForRepo(path: string, timeoutMs?: number): Promise<void>
}

declare global {
  interface Window {
    __shot?: ShotBridge
  }
}

export function installShotBridge(): void {
  const waitForRepo = (path: string, timeoutMs = 15000): Promise<void> =>
    new Promise((resolve, reject) => {
      const start = performance.now()
      const tick = (): void => {
        const repo = useRepoStore.getState().repos[path]
        if (repo && !repo.loading) return resolve()
        if (performance.now() - start > timeoutMs) return reject(new Error(`repo ${path} did not load`))
        setTimeout(tick, 80)
      }
      tick()
    })

  window.__shot = { settings: useSettingsStore, ui: useUIStore, repo: useRepoStore, updates: useUpdatesStore, launch: useLaunchStore, terminals: useTerminalsStore, chat: useRepoChatStore, problems: useProblemsStore, clones: useClonesStore, repoActions, ready: true, waitForRepo }
}
