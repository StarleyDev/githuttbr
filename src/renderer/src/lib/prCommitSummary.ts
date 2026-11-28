import type { PrCommit } from '../../../shared/types'
import { CC_TYPES, parseCcPrefix } from './commitLint'

/** A Conventional Commit type's colour role: the chip on a row and in the summary. */
export type CommitTypeTone = 'green' | 'red' | 'accent' | 'yellow' | 'neutral'

// What a reviewer scans for: new features, fixes (and reverts), tests and
// performance stand out; the housekeeping types share one quiet tone.
const TONES: Partial<Record<string, CommitTypeTone>> = {
  feat: 'green',
  fix: 'red',
  revert: 'red',
  test: 'accent',
  perf: 'yellow'
}

export function getCommitTypeTone(type: string): CommitTypeTone {
  return TONES[type] ?? 'neutral'
}

/** A subject split into its Conventional Commit parts; `type` is '' for any other subject. */
export interface CommitSubjectParts {
  type: string
  /** The scope without its parentheses; '' when none. */
  scope: string
  /** A `!` breaking-change mark. */
  breaking: boolean
  /** The subject after the prefix — the whole subject when there is no type. */
  rest: string
}

export function getCommitSubjectParts(subject: string): CommitSubjectParts {
  const { type, scope, bang, rest } = parseCcPrefix(subject)
  if (!type) return { type: '', scope: '', breaking: false, rest: subject }
  return { type, scope: scope.replace(/^\(|\)$/g, ''), breaking: bang === '!', rest }
}

/** The Commits tab's summary line: how many commits, by how many people, of which types. */
export interface PrCommitSummary {
  commits: number
  authors: number
  /** Types present with their counts: the coloured ones first (as `TONES` lists them), then the rest. */
  types: { type: string; count: number }[]
}

export function getPrCommitSummary(commits: readonly PrCommit[]): PrCommitSummary {
  const counts = new Map<string, number>()
  const authors = new Set<string>()
  for (const c of commits) {
    // The host account when matched; a name alone otherwise, case-folded so
    // "Ana" and "ana" on two machines read as one person.
    authors.add(c.authorLogin ? `@${c.authorLogin.toLowerCase()}` : c.authorName.trim().toLowerCase())
    const { type } = getCommitSubjectParts(c.subject)
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  // The chips a reviewer scans for lead the line; the quiet ones follow in the composer's order.
  const toned = Object.keys(TONES)
  const rank = (ty: string): number => (toned.includes(ty) ? toned.indexOf(ty) : toned.length)
  const types = CC_TYPES.filter((ty) => counts.has(ty))
    .sort((a, b) => rank(a) - rank(b))
    .map((type) => ({ type, count: counts.get(type) ?? 0 }))
  return { commits: commits.length, authors: authors.size, types }
}

/**
 * The two commits picked for a comparison as base and tip: the one listed
 * first (the list is oldest first) is the base. Null unless both are in the list.
 */
export function getCompareEnds(
  commits: readonly PrCommit[],
  picked: readonly string[]
): { base: string; tip: string } | null {
  if (picked.length !== 2) return null
  const [a, b] = picked.map((sha) => commits.findIndex((c) => c.sha === sha))
  if (a < 0 || b < 0 || a === b) return null
  return a < b ? { base: picked[0], tip: picked[1] } : { base: picked[1], tip: picked[0] }
}
