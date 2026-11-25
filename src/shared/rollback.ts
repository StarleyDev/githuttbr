/**
 * Going back to an earlier version: which versions qualify, which updates stay
 * hidden afterwards, and how the settings copies taken on the way are named and
 * kept. Pure, shared by main (the backups, the install) and the renderer (the
 * list, the banners), and tested in `test/rollback.test.ts`.
 */
import type { RollbackRelease, SettingsBackup, VersionRollback } from './types'
import { compareVersions, isNewerVersion } from './version'

/**
 * The newest version a rollback refuses. Versions up to it do not promise to
 * keep settings they do not know (`shared/settingsFormat.ts` arrived after it)
 * and know nothing of a rollback: they would offer the version just left as an
 * update straight away. Every version newer than this one is a safe target.
 */
export const LAST_UNSAFE_ROLLBACK_VERSION = '4.50.0'

export function isRollbackSafe(version: string): boolean {
  return isNewerVersion(version, LAST_UNSAFE_ROLLBACK_VERSION)
}

/** How many settings copies are kept; the oldest beyond this go. */
export const BACKUPS_KEPT = 5

/** A GitHub release as the public API lists it — only the fields read here. */
export interface GithubReleaseJson {
  tag_name?: unknown
  body?: unknown
  published_at?: unknown
  html_url?: unknown
  draft?: unknown
  prerelease?: unknown
}

/**
 * The first line of release notes worth showing: not a heading, a rule, a
 * badge or an empty bullet. Markdown links keep their text, emphasis goes.
 */
export function releaseSummary(body: string | null | undefined, max = 120): string {
  for (const raw of (body ?? '').split(/\r?\n/)) {
    let line = raw.trim()
    if (!line || /^(#|---|\*\*\*|___|<|!\[|```|>)/.test(line)) continue
    line = line
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      // A conventional-commit prefix and a trailing commit or PR reference say nothing to a reader.
      .replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '')
      .replace(/\s*\(([0-9a-f]{7,40}|#\d+)\)\s*$/i, '')
      .trim()
    if (!line) continue
    return line.length > max ? `${line.slice(0, max - 1)}…` : line
  }
  return ''
}

/**
 * The versions older than `current` that a user can go back to, newest first:
 * published (no draft, no pre-release), with a version tag, and not the one
 * running. Safety (`isRollbackSafe`) is the caller's to show, not to filter:
 * a refused version is listed with the reason.
 */
export function previousVersions(releases: GithubReleaseJson[], current: string): RollbackRelease[] {
  const out: RollbackRelease[] = []
  const seen = new Set<string>()
  for (const r of releases) {
    if (r.draft === true || r.prerelease === true || typeof r.tag_name !== 'string') continue
    const version = r.tag_name.replace(/^v/i, '')
    if (!/^\d+\.\d+\.\d+$/.test(version) || seen.has(version)) continue
    if (compareVersions(version, current) >= 0) continue
    seen.add(version)
    out.push({
      version,
      publishedAt: typeof r.published_at === 'string' ? r.published_at : '',
      summary: releaseSummary(typeof r.body === 'string' ? r.body : null),
      url: typeof r.html_url === 'string' ? r.html_url : ''
    })
  }
  return out.sort((a, b) => compareVersions(b.version, a.version))
}

/** Where a release's update files live: every release carries its own latest*.yml beside the installers. */
export function releaseDownloadUrl(repo: string, version: string): string {
  return `https://github.com/${repo}/releases/download/v${version.replace(/^v/i, '')}/`
}

/**
 * Whether an update to `version` may be offered. The version left by a
 * rollback, and anything older, stays hidden: only a version newer than the
 * one that made the user go back can carry the fix.
 */
export function isOfferedAfterRollback(version: string, rollback: VersionRollback | undefined): boolean {
  if (!rollback?.from) return true
  return isNewerVersion(version, rollback.from)
}

/**
 * What a start-up finds when it compares the version that ran last with the
 * one running now. `back`: a newer build ran before this one — the user went
 * back, by this app or by hand. `forward`: an update. Null on the first run
 * that records a version, or the same one again.
 */
export function versionChange(
  lastSeen: string | undefined,
  current: string
): { kind: 'back' | 'forward'; from: string; to: string } | null {
  if (!lastSeen || compareVersions(lastSeen, current) === 0) return null
  return { kind: isNewerVersion(lastSeen, current) ? 'back' : 'forward', from: lastSeen, to: current }
}

/**
 * The rollback record a start-up on an older version leaves: the one the build
 * that switched wrote, when it names this very switch, or a new one when the
 * user went back by hand (an installer, a package manager) — so the banner
 * shows and the version left is not offered again either way.
 */
export function rollbackOnArrival(
  record: VersionRollback | undefined,
  change: { from: string; to: string },
  now: string
): VersionRollback {
  if (record && record.from === change.from && record.to === change.to) return record
  return { from: change.from, to: change.to, at: now }
}

/**
 * Once a version newer than the one gone back to is running, the rollback is
 * over: the restore question can be asked (if a copy exists) and the record dropped.
 */
export function isPastRollback(record: VersionRollback | undefined, current: string): boolean {
  return !!record && isNewerVersion(current, record.to)
}

// ── Settings copies ────────────────────────────────────────────────────────

// A version is `1.2.3` or `1.2.3-rc.1`: the pre-release part never holds a `-`
// (`fileVersion`), so `-to-` and the reason always split the name the same way.
const VERSION = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?`
const BACKUP_RE = new RegExp(
  String.raw`^settings-(${VERSION})-to-(${VERSION})-(rollback|update|restore)-(\d{8}T\d{6}(?:\d{3})?Z)\.json$`
)

/** A version as a file name can hold it: no leading `v`, no build metadata, dots for a `-` inside a pre-release. */
function fileVersion(version: string): string {
  // Build metadata (`+build.7`) does not order versions: it goes.
  const v = version.trim().replace(/^v/i, '').replace(/\+.*$/, '')
  const cut = v.indexOf('-')
  const core = cut < 0 ? v : v.slice(0, cut)
  const pre = cut < 0 ? '' : v.slice(cut + 1).replace(/[^0-9A-Za-z.]+/g, '.')
  return pre ? `${core}-${pre}` : core
}

/** `2026-11-25T10:04:05.120Z` → `20261125T100405120Z`: sortable, and valid in every file system. */
function stamp(iso: string): string {
  return iso.replace(/[-:.]/g, '')
}

function unstamp(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})?Z$/.exec(s)
  if (!m) return ''
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7] ?? '000'}Z`
}

export function backupFileName(
  version: string,
  target: string,
  reason: SettingsBackup['reason'],
  createdAt: string
): string {
  return `settings-${fileVersion(version)}-to-${fileVersion(target)}-${reason}-${stamp(createdAt)}.json`
}

/** A backup's details read back from its name, or null for any other file in the folder. */
export function parseBackupFileName(name: string): SettingsBackup | null {
  const m = BACKUP_RE.exec(name)
  if (!m) return null
  const createdAt = unstamp(m[4])
  if (!createdAt) return null
  return { name, version: m[1], target: m[2], reason: m[3] as SettingsBackup['reason'], createdAt }
}

/** Newest first. */
export function sortBackups(backups: SettingsBackup[]): SettingsBackup[] {
  return [...backups].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

/**
 * Which copies to delete so `keep` remain — the oldest. A copy `protect` names
 * (the one a pending rollback record points at) is never deleted, even when old:
 * the restore question after updating needs it.
 */
export function backupsToPrune(backups: SettingsBackup[], keep = BACKUPS_KEPT, protect?: string): string[] {
  const sorted = sortBackups(backups)
  const kept = sorted.slice(0, keep).map((b) => b.name)
  return sorted
    .slice(keep)
    .map((b) => b.name)
    .filter((n) => n !== protect && !kept.includes(n))
}
