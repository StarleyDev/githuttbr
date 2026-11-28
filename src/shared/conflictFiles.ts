// Reading git's unmerged state into what the conflict workspace shows: one entry
// per file, with the kind of conflict it is in. Pure string work, so it is tested
// without a repository.
import type { ConflictFileInfo, ConflictFileKind } from './types'

const KIND_BY_CODE: Record<string, ConflictFileKind> = {
  UU: 'both-modified',
  AA: 'both-added',
  DU: 'deleted-by-us',
  UD: 'deleted-by-them',
  AU: 'added-by-us',
  UA: 'added-by-them',
  // "Both deleted" only happens when both sides renamed the file — each to a
  // different name — so that is what it is called here.
  DD: 'renamed-both'
}

/** The kind behind a two-letter unmerged code, or null for a merged entry. */
export function conflictKindOf(code: string): ConflictFileKind | null {
  return KIND_BY_CODE[code] ?? null
}

/** `git status --porcelain=v1 -z` → the unmerged entries, as [code, path]. */
export function parseUnmergedStatus(z: string): { code: string; path: string }[] {
  const out: { code: string; path: string }[] = []
  const parts = z.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (entry.length < 4) continue
    const code = entry.slice(0, 2)
    // A rename entry carries its source as the next NUL field; skip it.
    if (code[0] === 'R' || code[0] === 'C') i++
    if (conflictKindOf(code)) out.push({ code, path: entry.slice(3) })
  }
  return out
}

/** One line of `git ls-files -u -s -z`: mode, blob, stage and path. */
export interface UnmergedStage {
  mode: string
  sha: string
  stage: number
  path: string
}

export function parseUnmergedStages(z: string): UnmergedStage[] {
  const out: UnmergedStage[] = []
  for (const rec of z.split('\0')) {
    const m = /^(\d+) ([0-9a-f]+) (\d)\t(.+)$/s.exec(rec)
    if (m) out.push({ mode: m[1], sha: m[2], stage: Number(m[3]), path: m[4] })
  }
  return out
}

/** How many conflict blocks a file holds: lines opening with `<<<<<<<`. */
export function countConflictBlocks(text: string): number {
  let n = 0
  for (const line of text.split('\n')) if (line.startsWith('<<<<<<<')) n++
  return n
}

/**
 * Pair each rename/rename original (`DD`) with the name each side gave it: the
 * `AU` path is ours, the `UA` path theirs. git records no link between them, so
 * they are matched by content — the same blob in the base and on that side — and
 * failing that, when there is exactly one of each, by elimination.
 */
export function pairRenames(files: ConflictFileInfo[], stages: UnmergedStage[]): ConflictFileInfo[] {
  const originals = files.filter((f) => f.kind === 'renamed-both')
  if (originals.length === 0) return files
  const blob = (path: string, stage: number): string | undefined =>
    stages.find((s) => s.path === path && s.stage === stage)?.sha
  const ours = files.filter((f) => f.kind === 'added-by-us').map((f) => f.path)
  const theirs = files.filter((f) => f.kind === 'added-by-them').map((f) => f.path)
  const taken = new Set<string>()
  const pairs = new Map<string, { ours: string; theirs: string }>()

  const pick = (pool: string[], stage: number, baseSha: string | undefined): string | undefined => {
    const free = pool.filter((p) => !taken.has(p))
    const byBlob = baseSha ? free.find((p) => blob(p, stage) === baseSha) : undefined
    if (byBlob) return byBlob
    return originals.length === 1 && free.length === 1 ? free[0] : undefined
  }

  for (const orig of originals) {
    const baseSha = blob(orig.path, 1)
    const o = pick(ours, 2, baseSha)
    const t = pick(theirs, 3, baseSha)
    if (!o || !t) continue
    taken.add(o)
    taken.add(t)
    pairs.set(orig.path, { ours: o, theirs: t })
  }

  const halfOf = new Map<string, string>()
  for (const [orig, p] of pairs) {
    halfOf.set(p.ours, orig)
    halfOf.set(p.theirs, orig)
  }
  return files.map((f) => {
    const pair = pairs.get(f.path)
    if (pair) return { ...f, renamedTo: pair }
    const orig = halfOf.get(f.path)
    return orig ? { ...f, renameOf: orig } : f
  })
}

/** The paths listed under `# Conflicts:` in MERGE_MSG. */
export function parseMergeMsgConflicts(msg: string): string[] {
  const out: string[] = []
  let inList = false
  for (const line of msg.split('\n')) {
    if (/^#\s*Conflicts:\s*$/.test(line)) {
      inList = true
      continue
    }
    if (!inList) continue
    const m = /^#\t(.+)$/.exec(line)
    if (m) out.push(m[1])
    else if (line.trim() !== '#') inList = false
  }
  return out
}
