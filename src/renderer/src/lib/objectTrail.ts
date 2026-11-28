import type { GitObjectKind } from '../../../shared/types'

/**
 * The object explorer's path and its history.
 *
 * A trail is the chain of objects walked from one starting point — a ref, or
 * whatever was typed — down to the object on screen: `branch main → commit →
 * root → src/ → app.ts`. The history is a browser's: every move pushes a new
 * trail, Back and Forward step between them, and a move made after going back
 * drops what was ahead. Kept free of React and IPC so it can be tested on its own.
 */

/** Where a trail started, when that was a ref rather than a bare expression. */
export interface TrailOrigin {
  /** Full ref name (`refs/heads/main`) or `HEAD`. */
  ref: string
  role: RefRole
  /** What the chip shows: `main`, `v1.0.0`, `origin/main`, `HEAD`. */
  name: string
}

export type RefRole = 'head' | 'branch' | 'tag' | 'remote' | 'other'

/** One object on the trail, and how it was reached. */
export interface TrailStep {
  sha: string
  kind: GitObjectKind
  /** The revision that names it, as it would be typed into the box. */
  rev: string
  /** A commit's own tree: the chip says "root". */
  root?: boolean
  /** The entry name the parent tree gave it (a blob or tree has none of its own). */
  name?: string
  /** That entry's mode, as the parent tree listed it. */
  mode?: string
  /** Path from the root tree, when the walk went through one. */
  path?: string
  /** The commit (sha, or the revision typed) whose tree that path is in. */
  commit?: string
  /** How that commit was named, so a path can be retyped as `<commitRev>:<path>`. */
  commitRev?: string
}

export interface Trail {
  origin: TrailOrigin | null
  steps: TrailStep[]
}

export interface ObjectHistory {
  entries: Trail[]
  index: number
}

/** How the object on screen links to the next one. */
export type StepLink =
  | { via: 'tree' }
  | { via: 'parent' }
  | { via: 'target' }
  | { via: 'entry'; name: string; mode: string }

export const EMPTY_HISTORY: ObjectHistory = { entries: [], index: -1 }

/** The role of a full ref name. */
export function getRefRole(ref: string): RefRole {
  if (ref === 'HEAD') return 'head'
  if (ref.startsWith('refs/heads/')) return 'branch'
  if (ref.startsWith('refs/tags/')) return 'tag'
  if (ref.startsWith('refs/remotes/')) return 'remote'
  return 'other'
}

/** `refs/heads/main` reads better as `main` once the group is obvious. */
export function getShortRefName(ref: string): string {
  return ref.replace(/^refs\/(heads|tags|remotes)\//, '')
}

/**
 * The ref a typed revision names, if it names one exactly — `main`, `v1.0.0`,
 * `origin/main`, `refs/heads/main`, `HEAD`. Looked up in git's own order:
 * full name, then tags, branches, remotes. `HEAD~1` or a sha names no ref.
 */
export function findRefForRev(rev: string, refNames: readonly string[]): string | null {
  const wanted = rev.trim()
  if (!wanted) return null
  const names = new Set(refNames)
  for (const candidate of [
    wanted,
    `refs/${wanted}`,
    `refs/tags/${wanted}`,
    `refs/heads/${wanted}`,
    `refs/remotes/${wanted}`
  ]) {
    if (names.has(candidate)) return candidate
  }
  return null
}

/** The origin for a revision that names a ref; null otherwise. */
export function getTrailOrigin(rev: string, refNames: readonly string[]): TrailOrigin | null {
  const ref = findRefForRev(rev, refNames)
  if (!ref) return null
  return { ref, role: getRefRole(ref), name: ref === 'HEAD' ? 'HEAD' : getShortRefName(ref) }
}

/**
 * What a typed `<rev>:<path>` tells us before git answers: the path, and the
 * commit side. `HEAD:src/app.ts` → `{ commit: 'HEAD', path: 'src/app.ts' }`.
 * `:path` (the index) and `HEAD^{tree}` carry no path.
 */
export function parsePathRev(rev: string): { commit: string; path: string } | null {
  const trimmed = rev.trim()
  // `^{...}` peels can hold a colon only inside a `/:regex` search — not a path.
  const colon = trimmed.indexOf(':')
  if (colon <= 0 || trimmed.slice(0, colon).includes('{')) return null
  const path = trimmed.slice(colon + 1).replace(/^\.?\/+/, '').replace(/\/+$/, '')
  if (!path) return null
  return { commit: trimmed.slice(0, colon), path }
}

export function getCurrentTrail(history: ObjectHistory): Trail | null {
  return history.entries[history.index] ?? null
}

export function getCurrentStep(history: ObjectHistory): TrailStep | null {
  const trail = getCurrentTrail(history)
  return trail ? (trail.steps[trail.steps.length - 1] ?? null) : null
}

export function canGoBack(history: ObjectHistory): boolean {
  return history.index > 0
}

export function canGoForward(history: ObjectHistory): boolean {
  return history.index < history.entries.length - 1
}

export function goBack(history: ObjectHistory): ObjectHistory {
  return canGoBack(history) ? { ...history, index: history.index - 1 } : history
}

export function goForward(history: ObjectHistory): ObjectHistory {
  return canGoForward(history) ? { ...history, index: history.index + 1 } : history
}

/** Push a trail as the new present, dropping whatever was ahead of it. */
function pushTrail(history: ObjectHistory, trail: Trail): ObjectHistory {
  const entries = [...history.entries.slice(0, history.index + 1), trail]
  return { entries, index: entries.length - 1 }
}

/**
 * A revision typed, picked from the refs or from the examples: a new trail.
 * A path revision keeps its path so a blob can still say what it is called.
 */
export function startTrail(
  history: ObjectHistory,
  rev: string,
  object: { sha: string; kind: GitObjectKind },
  refNames: readonly string[]
): ObjectHistory {
  const origin = getTrailOrigin(rev, refNames)
  const step: TrailStep = { sha: object.sha, kind: object.kind, rev: rev.trim() || 'HEAD' }
  const pathRev = parsePathRev(rev)
  if (pathRev) {
    step.path = pathRev.path
    step.name = pathRev.path.split('/').pop()
    step.commit = pathRev.commit
    step.commitRev = pathRev.commit
  }
  return pushTrail(history, { origin, steps: [step] })
}

/**
 * Follow a link out of the object on screen. A commit's tree becomes the
 * root; a tree entry takes its name and mode from the row clicked, and its
 * path from the tree it was listed in.
 */
export function stepInto(
  history: ObjectHistory,
  object: { sha: string; kind: GitObjectKind },
  link: StepLink
): ObjectHistory {
  const trail = getCurrentTrail(history)
  const from = getCurrentStep(history)
  const step: TrailStep = { sha: object.sha, kind: object.kind, rev: object.sha }
  if (link.via === 'tree' && from) {
    step.root = true
    step.path = ''
    step.commit = from.sha
    step.commitRev = from.rev
    step.rev = `${from.rev}^{tree}`
  } else if (link.via === 'entry' && from) {
    step.name = link.name
    step.mode = link.mode
    step.path = from.path ? `${from.path}/${link.name}` : link.name
    if (from.commit) step.commit = from.commit
    // `main:src/app.ts` says where the object is; its sha only says what it is.
    if (from.commitRev) {
      step.commitRev = from.commitRev
      step.rev = `${from.commitRev}:${step.path}`
    }
  }
  if (!trail) return pushTrail(history, { origin: null, steps: [step] })
  return pushTrail(history, { origin: trail.origin, steps: [...trail.steps, step] })
}

/** A chip clicked: back to that step, as a new move — what was past it is gone. */
export function goToStep(history: ObjectHistory, stepIndex: number): ObjectHistory {
  const trail = getCurrentTrail(history)
  if (!trail || stepIndex < 0 || stepIndex >= trail.steps.length - 1) return history
  return pushTrail(history, { origin: trail.origin, steps: trail.steps.slice(0, stepIndex + 1) })
}

/** Six-digit tree modes, and what each one means. */
export type ModeMeaning = 'file' | 'executable' | 'folder' | 'symlink' | 'submodule' | 'unknown'

export function getModeMeaning(mode: string): ModeMeaning {
  switch (mode) {
    case '100644':
    case '100664':
      return 'file'
    case '100755':
      return 'executable'
    case '040000':
    case '40000':
      return 'folder'
    case '120000':
      return 'symlink'
    case '160000':
      return 'submodule'
    default:
      return 'unknown'
  }
}

/** The order a tree lists its entries in: what kind of thing each one is. */
const MODE_ORDER: ModeMeaning[] = ['folder', 'file', 'executable', 'symlink', 'submodule', 'unknown']

/**
 * Folders, then files, executables, symlinks and submodules — each group in the
 * tree's own (byte) order, which a stable sort keeps.
 */
export function sortTreeEntries<T extends { mode: string }>(entries: readonly T[]): T[] {
  const rank = (e: T): number => MODE_ORDER.indexOf(getModeMeaning(e.mode))
  return [...entries].sort((a, b) => rank(a) - rank(b))
}
