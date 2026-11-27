import type { CommitEditAbove, CommitEditPreview, CommitEditStep } from '../../../shared/types'
import type { TranslationKey } from '../i18n'

/**
 * Pure pieces of the commit editor's layout: the header's change count, the
 * edited commit's line in "What will happen", the cascade rows, the remote the
 * force-push warning names and the "Add file" search. Messages come back as a
 * key plus variables, so they follow a language switch.
 */

export interface PanelMessage {
  key: TranslationKey
  vars: Record<string, string | number>
}

/** The header pill: the message counts once, each edited file once. */
export function countUnappliedChanges(messageChanged: boolean, changedFiles: number): number {
  return (messageChanged ? 1 : 0) + changedFiles
}

/** The pill's text, singular apart from the rest. */
export function describeUnappliedChanges(n: number): PanelMessage {
  return n === 1 ? { key: 'commitEdit.unappliedOne', vars: {} } : { key: 'commitEdit.unapplied', vars: { n } }
}

/** What changes in the edited commit itself, for its row in the side panel. */
export function describeEditedCommit(messageChanged: boolean, changedFiles: number): PanelMessage {
  const n = changedFiles
  if (messageChanged && n === 1) return { key: 'commitEdit.thisCommitBothOne', vars: {} }
  if (messageChanged && n > 1) return { key: 'commitEdit.thisCommitBoth', vars: { n } }
  if (messageChanged) return { key: 'commitEdit.thisCommitMessage', vars: {} }
  if (n === 1) return { key: 'commitEdit.thisCommitFile', vars: {} }
  if (n > 1) return { key: 'commitEdit.thisCommitFiles', vars: { n } }
  return { key: 'commitEdit.thisCommitNone', vars: {} }
}

export interface CascadeRow extends CommitEditAbove {
  /** The last preview's verdict; absent until a preview ran. */
  step?: CommitEditStep
}

/** The commits above, newest first, each joined to its preview step by sha. */
export function buildCascadeRows(above: CommitEditAbove[], preview: CommitEditPreview | null): CascadeRow[] {
  if (!preview) return above.map((c) => ({ ...c }))
  const bySha = new Map(preview.steps.map((s) => [s.sha, s]))
  return above.map((c) => ({ ...c, step: bySha.get(c.sha) }))
}

/** A step's status line, or null when it has none to show. */
export function describeCascadeStep(step: CommitEditStep | undefined): PanelMessage | null {
  if (!step) return null
  if (step.status === 'clean') return { key: 'commitEdit.stepClean', vars: {} }
  if (step.status === 'blocked') return { key: 'commitEdit.stepBlocked', vars: {} }
  const [file = '', ...rest] = step.files
  return rest.length > 0
    ? { key: 'commitEdit.stepConflictMore', vars: { file, n: rest.length } }
    : { key: 'commitEdit.stepConflict', vars: { file } }
}

/** The first file the cascade conflicts on, for the line under the buttons. */
export function firstConflictFile(preview: CommitEditPreview | null): string | null {
  const step = preview?.steps.find((s) => s.status === 'conflict')
  return step?.files[0] ?? null
}

/**
 * The remote branch the force-push warning names: the current branch's
 * upstream when it holds the commit, since that is the push that will need
 * forcing; otherwise the first one git listed.
 */
export function pickPushedBranch(
  remoteBranches: string[],
  upstream: string | null
): { remote: string; branch: string } | null {
  const ref = (upstream && remoteBranches.includes(upstream) ? upstream : remoteBranches[0]) ?? null
  if (!ref) return null
  const slash = ref.indexOf('/')
  return slash < 0 ? { remote: ref, branch: ref } : { remote: ref.slice(0, slash), branch: ref.slice(slash + 1) }
}

/**
 * Paths for the "Add file" search: case-insensitive substring match, the ones
 * already listed left out, file-name matches before directory-only ones, capped
 * so a huge snapshot cannot flood the list.
 */
export function filterEditableFiles(all: string[], query: string, listed: Set<string>, limit = 50): string[] {
  const q = query.trim().toLowerCase()
  const byName: string[] = []
  const byDir: string[] = []
  for (const path of all) {
    if (listed.has(path)) continue
    const lower = path.toLowerCase()
    if (q && !lower.includes(q)) continue
    const name = lower.slice(lower.lastIndexOf('/') + 1)
    if (!q || name.includes(q)) byName.push(path)
    else byDir.push(path)
    if (byName.length >= limit) break
  }
  return [...byName, ...byDir].slice(0, limit)
}
