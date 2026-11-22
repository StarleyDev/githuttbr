// The part of the terminal registry the rest of the app needs at startup —
// the handle map, the appearance prefs, dispose. It must never import xterm at
// runtime: xterm (and everything that drives it) lives in terminalRegistry.ts,
// which loads the first time a terminal mounts. Before that the map is empty,
// so applying prefs only records them and disposing is a no-op.
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { TerminalThemeColors } from '../../../shared/types'
import { TERMINAL_THEMES } from '../theme/themes'

export interface TermHandle {
  term: Terminal
  fit: FitAddon
  container: HTMLDivElement
  ptyId: number | null
  // Scroll position snapshotted by the host component just before the
  // container leaves the DOM — the only moment viewportY is guaranteed to
  // reflect what the user actually saw. Consumed by the next fitSafely.
  suspendViewportY: number | null
  suspendAtBottom: boolean
  suspend(): void
  fitSafely(): void
  pasteText(text: string): void
  dispose(): void
}

// Persisted across React mounts / repo switches. xterm instance + PTY survive
// because the DOM container is moved in/out of the live tree, never destroyed.
export const registry = new Map<string, TermHandle>()

export interface TerminalPrefs {
  theme: TerminalThemeColors
  fontSize: number
  fontFamily: string
}

// Terminal appearance comes from Settings (preset + font). The defaults below
// are what a fresh install sees; App.tsx calls applyTerminalPrefs on start and
// on every change so existing terminals — which live in the registry across
// tab switches — pick the new palette/font without a restart, and terminals
// created later read them through terminalPrefs().
const DEFAULT_FONT_FAMILY = 'SF Mono, JetBrains Mono, Menlo, monospace'
let prefs: TerminalPrefs = { theme: TERMINAL_THEMES[0].colors, fontSize: 12.5, fontFamily: DEFAULT_FONT_FAMILY }

/** The prefs a terminal created now should start with. */
export function terminalPrefs(): TerminalPrefs {
  return prefs
}

// Palette/font options apply instantly, but the refit they imply does not:
// every fitSafely reflows the whole scrollback per terminal, and a font-size
// slider drag fires applyTerminalPrefs per tick — coalesce refits into a
// single trailing-edge pass instead of N terminals × M ticks of reflows.
let prefRefitTimer = 0
export function applyTerminalPrefs(theme: TerminalThemeColors, fontSize: number, fontFamily: string): void {
  prefs = { theme, fontSize: fontSize || 12.5, fontFamily: fontFamily.trim() || DEFAULT_FONT_FAMILY }
  registry.forEach((h) => {
    h.term.options.theme = theme
    h.term.options.fontSize = prefs.fontSize
    h.term.options.fontFamily = prefs.fontFamily
    h.container.style.background = theme.background
  })
  if (prefRefitTimer) window.clearTimeout(prefRefitTimer)
  prefRefitTimer = window.setTimeout(() => {
    prefRefitTimer = 0
    // A font change alters cell metrics — refit so cols/rows and the pty
    // follow the new size instead of stretching the old grid.
    registry.forEach((h) => h.fitSafely())
  }, 150)
}

/** Dispose a terminal and its pty. A panel whose terminal was never created
 *  (it never mounted, or xterm has not loaded yet) has nothing to dispose. */
export function disposeTerm(panelId: string): void {
  registry.get(panelId)?.dispose()
}

type RegistryModule = typeof import('./terminalRegistry')
let loaded: RegistryModule | null = null
let loading: Promise<RegistryModule> | null = null

/** The xterm side of the registry, if it has already loaded — lets every
 *  terminal after the first mount synchronously, exactly as before the split. */
export function loadedTerminalRegistry(): RegistryModule | null {
  return loaded
}

/** Load the xterm side of the registry once. A failed chunk load is not
 *  cached, so the next terminal to mount tries again. */
export function loadTerminalRegistry(): Promise<RegistryModule> {
  if (loaded) return Promise.resolve(loaded)
  loading ??= import('./terminalRegistry').then(
    (m) => (loaded = m),
    (err: unknown) => {
      loading = null
      throw err
    }
  )
  return loading
}
