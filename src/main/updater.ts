import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { UpdateState, UpdateInfo, RollbackReleasesReply, RollbackState, RollbackSupport } from '../shared/types'
import { isNewerVersion } from '../shared/version'
import { isOfferedAfterRollback, previousVersions, releaseDownloadUrl, type GithubReleaseJson } from '../shared/rollback'
import { readSettings } from './settings'
import { backupSettings } from './settingsBackups'
import { githubPublicGet } from './credentials'
import { APP_RELEASES_API, APP_REPO } from '../shared/appRepo'
import { GITHUB_COM, GITHUB_COM_ENDPOINTS } from '../shared/githubEnterprise'
import { isShotMode } from './shotMode'
import { isMissingChannelFile } from './updaterErrors'

const REPO = APP_REPO
const releaseUrl = (version: string): string =>
  `${GITHUB_COM}/${REPO}/releases/tag/v${version.replace(/^v/, '')}`

// Single source of truth for update state; pushed to every renderer on change.
const state: UpdateState = {
  status: 'idle',
  info: null,
  progress: null,
  error: null,
  supported: app.isPackaged,
  staged: null
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update:event', state)
  }
}

function setState(patch: Partial<UpdateState>): void {
  Object.assign(state, patch)
  broadcast()
}

/** A failed check or download. The feed lacking this OS's channel file (macOS
 *  not uploaded yet for a published release) is "nothing to install", logged
 *  and shown as not-available; anything else is a real error. */
function setFailed(err: unknown, fallback: string): void {
  if (isMissingChannelFile(err)) {
    console.warn('[updater] the latest release has no update file for this platform yet:', (err as Error).message)
    if (state.status === 'downloaded') return
    setState({ status: 'not-available', error: null })
    return
  }
  setState({ status: 'error', error: (err as Error)?.message ?? (err == null ? fallback : String(err)) })
}

/** Coerce electron-updater's releaseNotes (string | {note}[] | null) to text. */
function notesToText(notes: unknown): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) {
    return notes
      .map((n) => (typeof n === 'string' ? n : (n as { note?: string }).note ?? ''))
      .filter(Boolean)
      .join('\n\n')
  }
  return null
}

/** Dev / unpackaged builds can't run electron-updater. Poll the GitHub API so
 *  the "new version available" UI still works (download falls back to the page). */
async function checkViaGitHub(): Promise<void> {
  // Scripted runs (screenshots, probes, real-app checks) launch the app many times
  // an hour; GitHub's anonymous limit is 60 per address, shared with the real app.
  if (isShotMode()) {
    setState({ status: 'not-available' })
    return
  }
  try {
    const res = await githubPublicGet(`${GITHUB_COM_ENDPOINTS.apiBase}/repos/${REPO}/releases/latest`)
    if (!res.ok) {
      setState({ status: 'not-available' })
      return
    }
    const json = (await res.json()) as { tag_name?: string; body?: string | null; published_at?: string }
    const latest = (json.tag_name ?? '').replace(/^v/, '')
    if (latest && isNewerVersion(latest, app.getVersion()) && (await isOfferable(latest))) {
      const info: UpdateInfo = {
        version: latest,
        notes: json.body ?? null,
        releaseDate: json.published_at,
        url: releaseUrl(latest)
      }
      setState({ status: 'available', info })
    } else {
      setState({ status: 'not-available' })
    }
  } catch {
    setState({ status: 'error', error: 'Could not reach the update server.' })
  }
}

/** Whether a version may be offered: never the one a rollback left, nor older (see `isOfferedAfterRollback`). */
async function isOfferable(version: string): Promise<boolean> {
  const settings = await readSettings().catch(() => null)
  return isOfferedAfterRollback(version, settings?.versionRollback)
}

// A check the user did not ask for — priming before a download, or the
// background re-check below. Suppresses the 'checking' UI flip so the banner
// doesn't flicker or disappear under them. A depth counter, not a boolean,
// because a background tick can overlap a download prime.
let silentDepth = 0

async function runCheck(silent: boolean): Promise<void> {
  if (silent) silentDepth++
  try {
    await autoUpdater.checkForUpdates()
  } finally {
    if (silent) silentDepth--
  }
}

// A session left open for days used to keep offering whatever the launch check
// found, so the What's-new page (which refetches from GitHub every time it
// opens) could name a newer version than the updater had ever heard of.
const RECHECK_MS = 3 * 60 * 60 * 1000
let recheckTimer: NodeJS.Timeout | null = null

function scheduleRechecks(): void {
  if (recheckTimer) return
  recheckTimer = setInterval(() => {
    // Never interrupt a transfer in flight; it re-checks when it finishes. Nor
    // a version switch: the feed points at the older release meanwhile.
    if (state.status === 'downloading' || rollback) return
    void runCheck(true).catch(() => {})
  }, RECHECK_MS)
  recheckTimer.unref?.()
}

let wired = false
function wireAutoUpdater(): void {
  if (wired) return
  wired = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    if (rollback) return setRollback({ status: 'checking' })
    if (silentDepth > 0) return
    setState({ status: 'checking', error: null })
  })
  autoUpdater.on('update-available', (info) => {
    // A rollback's own check: `startRollback` reads its result, nothing to offer.
    if (rollback) return
    void offer(info)
  })
  const offer = async (info: { version: string; releaseNotes?: unknown; releaseDate?: string }): Promise<void> => {
    // The version a rollback left (or anything older) is not offered again.
    if (!(await isOfferable(info.version))) {
      if (state.status !== 'downloaded' && state.status !== 'downloading') setState({ status: 'not-available' })
      return
    }
    // Every check re-announces whatever the feed holds, compared against the
    // *installed* version — so a re-check with something already staged would
    // otherwise knock the banner back from "restart" to "download".
    if (state.staged && !isNewerVersion(info.version, state.staged)) return
    setState({
      status: 'available',
      progress: null,
      info: {
        version: info.version,
        notes: notesToText(info.releaseNotes),
        releaseDate: info.releaseDate,
        url: releaseUrl(info.version)
      }
    })
  }
  autoUpdater.on('update-not-available', () => {
    if (rollback) return
    // A staged build is still installable even if the feed now says we're current.
    if (state.status === 'downloaded') return
    setState({ status: 'not-available' })
  })
  autoUpdater.on('download-progress', (p) =>
    rollback
      ? setRollback({ status: 'downloading', percent: p.percent })
      : setState({
      status: 'downloading',
      progress: {
        percent: p.percent,
        bytesPerSecond: p.bytesPerSecond,
        transferred: p.transferred,
        total: p.total
      }
    })
  )
  autoUpdater.on('update-downloaded', (info) => {
    if (rollback) return setRollback({ status: 'downloaded', percent: 100 })
    // A version switch is coming: copy the settings first (quitting installs it too).
    void backupSettings(info.version, 'update')
    setState({
      status: 'downloaded',
      progress: null,
      staged: info.version,
      info: {
        version: info.version,
        notes: notesToText(info.releaseNotes),
        releaseDate: info.releaseDate,
        url: releaseUrl(info.version)
      }
    })
  })
  autoUpdater.on('error', (err) => {
    if (rollback) return
    // A failed background re-check must not bury an update already on disk.
    if (state.status === 'downloaded') return
    setFailed(err, 'Update check failed.')
  })
}

export function registerUpdaterHandlers(): void {
  ipcMain.handle('update:getState', (): UpdateState => state)

  // `silent` keeps the banner as it is instead of flipping to 'checking' — for
  // checks the user did not ask for, like opening the What's-new page.
  ipcMain.handle('update:check', async (_e, silent?: boolean) => {
    // The feed points at an older release while a version switch runs.
    if (rollback) return
    if (!app.isPackaged) {
      await checkViaGitHub()
      return
    }
    wireAutoUpdater()
    try {
      await runCheck(silent === true)
    } catch (err) {
      if (silent === true) return
      setFailed(err, 'Update check failed.')
    }
  })

  ipcMain.handle('update:download', async () => {
    // Unsupported (dev): open the release page; the renderer also handles this,
    // but guard here in case it calls through anyway.
    if (!app.isPackaged) {
      if (state.info?.url) await shell.openExternal(state.info.url)
      return
    }
    wireAutoUpdater()
    try {
      // electron-updater's downloadUpdate() depends on internal state populated
      // by a successful checkForUpdates(). That state can be missing or stale if
      // the launch check raced with / lost to the renderer's check, which makes
      // the first Download click silently no-op (a reload re-checks and fixes
      // it). Re-prime with a silent check first so the button always works.
      if (state.status !== 'downloading') await runCheck(true)
      await autoUpdater.downloadUpdate()
    } catch (err) {
      setFailed(err, 'Download failed.')
    }
  })

  // Quit and install the downloaded update. Fire-and-forget (the app exits).
  ipcMain.on('update:install', () => {
    if (state.status !== 'downloaded' || rollback) return
    // The copy taken when the download finished is replaced by one of the settings as they are now.
    const version = state.staged ?? state.info?.version
    void (version ? backupSettings(version, 'update') : Promise.resolve(null)).finally(() =>
      setImmediate(() => autoUpdater.quitAndInstall())
    )
  })

  ipcMain.handle('rollback:releases', () => listPreviousVersions())
  ipcMain.handle('rollback:support', (): RollbackSupport => rollbackSupport())
  ipcMain.handle('rollback:getState', (): RollbackState => rollbackState)
  ipcMain.handle('rollback:start', (_e, version: unknown) =>
    typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) ? startRollback(version) : undefined
  )
  // Only once the renderer has recorded the switch (the version left, the
  // copy taken) and flushed the settings: quitting before that would land on
  // the older version with nothing to say why.
  ipcMain.on('rollback:install', () => {
    if (!rollback || rollbackState.status !== 'downloaded') return
    setImmediate(() => autoUpdater.quitAndInstall())
  })
  ipcMain.handle('rollback:cancel', () => endRollback({ status: 'idle', target: null, percent: 0, error: null, backup: null }))
}

// ── Going back to an earlier version ─────────────────────────────────────

/**
 * A version switch in progress. While set, electron-updater's events belong to
 * it (see the handlers above), the feed points at the target release's own
 * download folder, and downgrades are allowed — all undone by `endRollback`,
 * and by any restart, since none of it is persisted.
 */
let rollback: { target: string } | null = null
const rollbackState: RollbackState = { status: 'idle', target: null, percent: 0, error: null, backup: null }

/** A rollback download left behind (an error after it, a cancel): quitting must not install it. */
let abandonedDownload = false

function setRollback(patch: Partial<RollbackState>): void {
  Object.assign(rollbackState, patch)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('rollback:event', rollbackState)
  }
}

/**
 * Whether this install can replace itself with an older version. The updater
 * does it for the AppImage, the .deb (asking for the administrator password,
 * as an update does), the Windows installer and the signed macOS build. An
 * unpackaged run and any other package (rpm, a tarball, a distribution's own)
 * cannot: the caller opens the Releases page instead.
 */
export function rollbackSupport(): RollbackSupport {
  if (!app.isPackaged) return { supported: false, reason: 'dev', kind: 'other' }
  if (process.platform === 'win32') return { supported: true, kind: 'nsis' }
  if (process.platform === 'darwin') return { supported: true, kind: 'mac' }
  if (process.platform === 'linux') {
    if (process.env['APPIMAGE']) return { supported: true, kind: 'appimage' }
    const identity = join(process.resourcesPath, 'package-type')
    try {
      if (existsSync(identity) && readFileSync(identity, 'utf8').trim() === 'deb') return { supported: true, kind: 'deb' }
    } catch {
      // Unreadable: treated as a package the updater cannot replace.
    }
  }
  return { supported: false, reason: 'platform', kind: 'other' }
}

/**
 * The published versions older than this one, from the same repository the
 * updater uses, over the public API. Not cached: a list that is offline or
 * rate-limited says so, rather than offering a version from an old answer.
 */
async function listPreviousVersions(): Promise<RollbackReleasesReply> {
  // Scripted runs stay off GitHub so they cannot spend the real app's hourly quota.
  if (isShotMode()) return { ok: false, reason: 'offline' }
  let res: Response
  try {
    res = await githubPublicGet(`${APP_RELEASES_API}?per_page=40`)
  } catch {
    return { ok: false, reason: 'offline' }
  }
  if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) {
    return { ok: false, reason: 'rate-limited' }
  }
  if (!res.ok) return { ok: false, reason: 'failed' }
  try {
    const json: unknown = await res.json()
    if (!Array.isArray(json)) return { ok: false, reason: 'failed' }
    return { ok: true, releases: previousVersions(json as GithubReleaseJson[], app.getVersion()) }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/** Points the updater back at the normal feed — what app-update.yml names, `build.publish` in package.json. */
function restoreFeed(): void {
  const [owner, repo] = REPO.split('/')
  autoUpdater.allowDowngrade = false
  autoUpdater.setFeedURL({ provider: 'github', owner, repo })
}

function endRollback(final: Partial<RollbackState>): void {
  if (rollback && rollbackState.status === 'downloaded') abandonedDownload = true
  rollback = null
  restoreFeed()
  autoUpdater.autoInstallOnAppQuit = !abandonedDownload
  setRollback(final)
}

/**
 * Downloads `version` from its own release folder, over the installed one.
 * Every release carries latest.yml / latest-mac.yml / latest-linux.yml beside
 * its installers, so a generic feed on that folder is the release as the
 * updater would have seen it then — signed, with its checksums. The install
 * is a separate step (`rollback:install`).
 */
async function startRollback(version: string): Promise<void> {
  if (!rollbackSupport().supported) return
  if (rollback || state.status === 'downloading') return
  if (rollbackState.status === 'checking' || rollbackState.status === 'downloading') return
  // The copy first: a switch without one is not started at all.
  setRollback({ status: 'checking', target: version, percent: 0, error: null, backup: null })
  const backup = await backupSettings(version, 'rollback')
  if (!backup) {
    setRollback({ status: 'error', error: 'backup-failed' })
    return
  }
  wireAutoUpdater()
  rollback = { target: version }
  // Until the user's switch is recorded, quitting installs nothing.
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = true
  autoUpdater.setFeedURL({ provider: 'generic', url: releaseDownloadUrl(REPO, version), useMultipleRangeRequest: false })
  setRollback({ backup: backup.name })
  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result || result.updateInfo.version !== version || !result.isUpdateAvailable) {
      throw new Error(`v${version} could not be found in its release.`)
    }
    // A staged update is replaced by this download: the restart installs the older version.
    if (state.staged) setState({ staged: null, status: 'idle', info: null })
    await autoUpdater.downloadUpdate()
    // Some versions of the updater resolve before the event; either way it is on disk.
    if (rollbackState.status !== 'downloaded') setRollback({ status: 'downloaded', percent: 100 })
  } catch (err) {
    const error = isMissingChannelFile(err) ? 'missing-platform' : ((err as Error)?.message ?? String(err))
    endRollback({ status: 'error', error })
  }
}

/** Kick a silent check shortly after launch (packaged builds only). */
export function checkForUpdatesOnLaunch(): void {
  if (!app.isPackaged) return
  wireAutoUpdater()
  scheduleRechecks()
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      setFailed(err, 'Update check failed.')
    })
  }, 4000)
}
