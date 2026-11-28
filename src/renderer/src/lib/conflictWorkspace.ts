// The conflict workspace's bookkeeping: which files this step stopped on, which
// of them are settled, what is left, and how each was answered. Pure — no React,
// no IPC — so the progress bar and the file strip are tested against plain data.
import type { TranslationKey } from '../i18n'
import type { ConflictFileInfo, ConflictFileKind, ConflictOpKind } from '../../../shared/types'
import type { ConflictChoiceCounts } from './conflict'

/**
 * One conflicted step — a merge, or one commit of a rebase. git forgets a file
 * the moment it is staged, so the workspace remembers every file it has seen
 * conflicted, to say "2 of 5 resolved" rather than only "3 left".
 */
export interface ConflictSession {
  key: string
  files: string[]
  /** Rename/rename halves, folded into their original's card. */
  folded: string[]
  choices: Record<string, ConflictChoiceCounts>
}

/** Fold what the latest overview shows into the session for `key`; a new key
 *  (the next rebase step, another merge) starts over. */
export function nextConflictSession(
  prev: ConflictSession | undefined,
  key: string,
  files: ConflictFileInfo[],
  listed: string[]
): ConflictSession {
  const base: ConflictSession =
    prev && prev.key === key ? prev : { key, files: [], folded: [], choices: {} }
  const folded = new Set(base.folded)
  for (const f of files) if (f.renameOf) folded.add(f.path)
  const seen = new Set(base.files)
  for (const p of [...files.map((f) => f.path), ...listed]) if (!folded.has(p)) seen.add(p)
  const nextFiles = [...seen].filter((p) => !folded.has(p)).sort((a, b) => a.localeCompare(b))
  const same =
    nextFiles.length === base.files.length &&
    nextFiles.every((p, i) => p === base.files[i]) &&
    folded.size === base.folded.length
  return same ? base : { ...base, files: nextFiles, folded: [...folded] }
}

/** The session key: the operation plus the commit coming in, so each rebase
 *  step is its own session. */
export function conflictSessionKey(kind: ConflictOpKind | null, theirsSha: string | undefined): string {
  return `${kind ?? 'none'}:${theirsSha ?? ''}`
}

export type StripState = 'resolved' | 'open'

export interface StripEntry {
  path: string
  state: StripState
  /** Unresolved only: what it is, and how many blocks it holds. */
  info?: ConflictFileInfo
}

/** The strip: every file of the step, in a stable order, each marked settled or not. */
export function stripEntries(session: ConflictSession | undefined, files: ConflictFileInfo[]): StripEntry[] {
  const open = new Map(files.filter((f) => !f.renameOf).map((f) => [f.path, f]))
  const all = new Set([...(session?.files ?? []), ...open.keys()])
  return [...all]
    .sort((a, b) => a.localeCompare(b))
    .map((path) => {
      const info = open.get(path)
      return info ? { path, state: 'open' as const, info } : { path, state: 'resolved' as const }
    })
}

export interface ConflictProgress {
  total: number
  resolved: number
  /** Conflict blocks still open across every file; a file with nothing to
   *  merge line by line (deleted, renamed) counts as one. */
  left: number
}

export function conflictProgress(entries: StripEntry[]): ConflictProgress {
  let left = 0
  for (const e of entries) {
    if (e.state !== 'open' || !e.info) continue
    left += lineByLine(e.info.kind) ? Math.max(1, e.info.conflicts) : 1
  }
  return { total: entries.length, resolved: entries.filter((e) => e.state === 'resolved').length, left }
}

/** The next unresolved file after `current`, wrapping; null when none is left. */
export function nextOpenFile(entries: StripEntry[], current: string): string | null {
  const open = entries.filter((e) => e.state === 'open').map((e) => e.path)
  if (open.length === 0) return null
  const all = entries.map((e) => e.path)
  const at = all.indexOf(current)
  for (let i = 1; i <= all.length; i++) {
    const path = all[(at + i + all.length) % all.length]
    if (open.includes(path) && path !== current) return path
  }
  return open.includes(current) ? current : open[0]
}

/** Whether the three-pane editor applies — the file has text to merge. */
export function lineByLine(kind: ConflictFileKind): boolean {
  return kind === 'both-modified' || kind === 'both-added'
}

const KIND_KEYS: Record<ConflictFileKind, TranslationKey> = {
  'both-modified': 'conflictWs.kindBothModified',
  'both-added': 'conflictWs.kindBothAdded',
  'deleted-by-us': 'conflictWs.kindDeleted',
  'deleted-by-them': 'conflictWs.kindDeleted',
  'added-by-us': 'conflictWs.kindAddedOne',
  'added-by-them': 'conflictWs.kindAddedOne',
  'renamed-both': 'conflictWs.kindRenamedBoth'
}

export function conflictKindKey(kind: ConflictFileKind): TranslationKey {
  return KIND_KEYS[kind]
}

/** Every file's answers added up, for the "all resolved" summary. */
export function sumChoices(choices: Record<string, ConflictChoiceCounts>): ConflictChoiceCounts & { total: number } {
  const sum = { ours: 0, theirs: 0, both: 0, edited: 0, total: 0 }
  for (const c of Object.values(choices)) {
    sum.ours += c.ours
    sum.theirs += c.theirs
    sum.both += c.both
    sum.edited += c.edited
  }
  sum.total = sum.ours + sum.theirs + sum.both + sum.edited
  return sum
}

/** How many lines one side changed relative to the base, from a unified diff:
 *  the larger of what it added and what it removed. */
export function changedLineCount(diff: string | null): number {
  if (!diff) return 0
  let add = 0
  let del = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+')) add++
    else if (line.startsWith('-')) del++
  }
  return Math.max(add, del)
}
