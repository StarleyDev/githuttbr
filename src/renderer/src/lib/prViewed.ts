import type { PrFile } from '../../../shared/types'

/** Which files of a pull request are ticked as viewed, and at which version of
 *  each: filename → the file's fingerprint when it was ticked. Pure, so the
 *  rules (a new push un-views what it touched; the old format migrates once)
 *  are testable without storage. */
export type ViewedMarks = Record<string, string>

/** The storage key of the marks — one per repo + PR. Its own key: the older
 *  path-only list (`LEGACY_VIEWED_KEY`) held a different shape. */
export function getViewedMarksKey(remoteUrl: string, number: number): string {
  return `githuttbr-pr-viewed-marks:${remoteUrl}#${number}`
}

/** The path-only list the page wrote before marks carried a version. Read once
 *  to migrate, then removed. */
export function getLegacyViewedKey(remoteUrl: string, number: number): string {
  return `githuttbr-pr-viewed:${remoteUrl}#${number}`
}

// cyrb53: a fast 53-bit string hash. Not cryptographic — it only has to tell
// one version of a file's diff from the next.
function hashText(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * The version of a file's change, as far as the host lets us tell: no host's
 * file list here carries a blob sha, so it is the diff itself plus what
 * surrounds it. A push that edits the file changes its patch; a push elsewhere
 * (or a new head commit alone) does not. A file without a patch (binary, too
 * large) falls back to its status and line counts, which a change can leave
 * equal.
 */
export function getFileFingerprint(file: PrFile): string {
  // Each tick re-reads every file's state; hashing a large PR's patches once
  // per loaded list (a refresh brings new objects) keeps a tick cheap.
  let fp = fingerprints.get(file)
  if (fp === undefined) {
    fp = hashText(
      [file.status, file.previousFilename ?? '', file.additions, file.deletions, file.patch ?? ''].join(
        '\u0000'
      )
    )
    fingerprints.set(file, fp)
  }
  return fp
}
const fingerprints = new WeakMap<PrFile, string>()

/** Marks from storage; anything unreadable is no marks at all. */
export function parseViewedMarks(raw: string | null): ViewedMarks {
  if (!raw) return {}
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    const out: ViewedMarks = {}
    for (const [k, v] of Object.entries(data)) if (typeof v === 'string') out[k] = v
    return out
  } catch {
    return {}
  }
}

/** Fold the old path-only list into marks: each path still in the PR counts as
 *  viewed at the version shown now — the closest the old data allows. A mark
 *  already in the new format wins. */
export function migrateLegacyViewed(
  legacyRaw: string | null,
  files: PrFile[],
  marks: ViewedMarks
): ViewedMarks {
  let paths: unknown
  try {
    paths = JSON.parse(legacyRaw || '[]')
  } catch {
    return marks
  }
  if (!Array.isArray(paths)) return marks
  const byName = new Map(files.map((f) => [f.filename, f]))
  const out: ViewedMarks = { ...marks }
  for (const p of paths) {
    const file = typeof p === 'string' ? byName.get(p) : undefined
    if (file && !(file.filename in out)) out[file.filename] = getFileFingerprint(file)
  }
  return out
}

export interface ViewedState {
  /** Ticked at the version shown now. */
  viewed: Set<string>
  /** Ticked once, but the file changed since: shown as not viewed, flagged. */
  changed: Set<string>
}

/** Split the PR's files by their marks. Marks of files no longer in the PR
 *  count for nothing. */
export function getViewedState(marks: ViewedMarks, files: PrFile[]): ViewedState {
  const viewed = new Set<string>()
  const changed = new Set<string>()
  for (const f of files) {
    const mark = marks[f.filename]
    if (mark === undefined) continue
    if (mark === getFileFingerprint(f)) viewed.add(f.filename)
    else changed.add(f.filename)
  }
  return { viewed, changed }
}

/** Marks with `files` ticked at their current version (`on`), or unticked. */
export function setViewedMarks(marks: ViewedMarks, files: PrFile[], on: boolean): ViewedMarks {
  const out: ViewedMarks = { ...marks }
  for (const f of files) {
    if (on) out[f.filename] = getFileFingerprint(f)
    else delete out[f.filename]
  }
  return out
}
