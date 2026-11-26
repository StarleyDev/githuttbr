#!/usr/bin/env node
/**
 * Build a release's notes: the standing notices that cover this version, then
 * its CHANGELOG entry. Run by the release workflow (`node scripts/release-notes.mjs
 * <version> > release-notes.md`).
 *
 * The update banner of the version a user still runs shows the notes of the
 * newest release, and an old install jumps straight to it (a Mac on 4.52 was
 * offered 4.59). So a warning about an upgrade has to ride on every release for
 * a while, not only the one that caused it: each notice in
 * .github/release-notices/*.md says which versions carry it, in front matter.
 *
 *   ---
 *   from: 4.59.0      first version that shows it
 *   until: 4.65.0     first version that no longer does
 *   ---
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const NOTICES_DIR = '.github/release-notices'

/** [major, minor, patch]; a pre-release suffix (4.26.0-huttbr.1) counts as its base version. */
function parts(version) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())
  if (!m) throw new Error(`Not a version: ${version}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export function compareVersions(a, b) {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

/** Split a notice into its range and body. A notice without both bounds is a mistake, not "always". */
export function parseNotice(text, name = 'notice') {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'))
  if (!m) throw new Error(`${name}: missing front matter with from/until`)
  const field = (key) => new RegExp(`^${key}:\\s*(\\S+)`, 'm').exec(m[1])?.[1]
  const from = field('from')
  const until = field('until')
  if (!from || !until) throw new Error(`${name}: front matter needs both from and until`)
  parts(from)
  parts(until)
  return { from, until, body: m[2].trim() }
}

export function noticeApplies(notice, version) {
  return compareVersions(version, notice.from) >= 0 && compareVersions(version, notice.until) < 0
}

/** The CHANGELOG section for a version, blank lines dropped, at most 100 lines (as before). */
export function changelogSection(changelog, version) {
  const out = []
  let inside = false
  for (const line of changelog.split('\n')) {
    if (line.startsWith('## ')) {
      if (inside) break
      inside = line.startsWith(`## [${version}]`)
      continue
    }
    if (inside && line.trim() !== '') out.push(line)
  }
  return out.slice(0, 100)
}

export function buildReleaseNotes(version, changelog, notices) {
  const parts = notices.filter((n) => noticeApplies(n, version)).map((n) => n.body)
  const section = changelogSection(changelog, version).join('\n')
  if (section) parts.push(section)
  return parts.join('\n\n') + '\n'
}

function readNotices(root) {
  const dir = join(root, NOTICES_DIR)
  let files = []
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
  } catch {
    return []
  }
  return files.map((f) => parseNotice(readFileSync(join(dir, f), 'utf8'), f))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const version = (process.argv[2] ?? '').replace(/^v/, '')
  parts(version)
  const root = process.cwd()
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
  process.stdout.write(buildReleaseNotes(version, changelog, readNotices(root)))
}
