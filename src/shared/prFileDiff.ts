import type { PrFile, PrFileDiffSource, PrNoPatchReason } from './types'
import { unifiedDiff } from './lineDiff'
import type { FileBytesVerdict } from './prFileText'

/**
 * The pieces every host's pull request file list shares once the diffs are in:
 * a diff computed from the two versions of a file, and the reason a file has
 * no diff when it has none. Pure, so the decisions are tested without a host.
 */

export type FileDiffResult = Pick<PrFile, 'additions' | 'deletions' | 'patch' | 'noPatchReason'>

/** Added and removed lines of a hunk-only patch. */
export function countPatchLines(patch: string): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of patch.split('\n')) {
    if (line.startsWith('+')) additions++
    else if (line.startsWith('-')) deletions++
  }
  return { additions, deletions }
}

/**
 * A file's diff from its two versions, each already sorted into text or binary
 * (`decodeFileBytes`). An added file has no old version, a removed one no new
 * one: pass `{ kind: 'text', text: '' }` for the missing side.
 */
export function diffFileVersions(before: FileBytesVerdict, after: FileBytesVerdict): FileDiffResult {
  if (before.kind === 'binary' || after.kind === 'binary') return { additions: 0, deletions: 0, noPatchReason: 'binary' }
  const patch = unifiedDiff(before.text, after.text)
  if (patch === null) return { additions: 0, deletions: 0, noPatchReason: 'tooLarge' }
  if (patch === '') {
    // The same text in another encoding (a BOM added, UTF-16 to UTF-8) is a change, not "nothing".
    const recoded = !!before.encoding && !!after.encoding && before.encoding !== after.encoding
    return { additions: 0, deletions: 0, noPatchReason: recoded ? 'encodingChanged' : 'noChanges' }
  }
  return { patch, ...countPatchLines(patch) }
}

/** The reasons a file can be read again for: the others will not change by asking. */
const RETRYABLE: ReadonlySet<PrNoPatchReason> = new Set(['notLoaded', 'failed', 'hostOmitted'])

export function canReadDiffAgain(reason: PrNoPatchReason | undefined): boolean {
  return !!reason && RETRYABLE.has(reason)
}

/**
 * Every file without a patch gets a reason — `fallback` when nothing more
 * precise was set (a host's list that just left the patch out) — and, when it
 * is worth reading again, where to read it from. A file with a patch is left
 * as it is.
 */
export function withNoPatchReasons(files: PrFile[], fallback: PrNoPatchReason, source: PrFileDiffSource | null): PrFile[] {
  return files.map((f) => {
    if (f.patch) return f
    // A rename the host counts no line for is a pure rename, not a diff left out.
    const pureRename = f.status === 'renamed' && f.additions === 0 && f.deletions === 0
    const noPatchReason = f.noPatchReason ?? (pureRename ? 'noChanges' : fallback)
    return {
      ...f,
      noPatchReason,
      ...(source && canReadDiffAgain(noPatchReason) ? { diffSource: source } : {})
    }
  })
}
