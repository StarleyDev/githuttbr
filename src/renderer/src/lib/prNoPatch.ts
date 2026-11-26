import type { PrFile, PrNoPatchReason } from '../../../shared/types'
import type { TranslationKey } from '../i18n'

/**
 * What the Files tab says about a pull request file with no diff on screen,
 * from the reason the main process gave. Pure: the component renders the keys.
 */

/** The reasons a file's diff was simply not read: its 0/0 is "unknown", not "nothing changed". */
const UNREAD: ReadonlySet<PrNoPatchReason> = new Set(['notLoaded', 'failed', 'hostOmitted'])

/**
 * A file's +/− counts are known unless its diff was not read and nobody
 * counted it: a binary file or a pure rename really is +0 −0, and a host that
 * counts the lines of a patch it leaves out (GitHub) is believed.
 */
export function hasKnownLineCounts(file: Pick<PrFile, 'patch' | 'additions' | 'deletions' | 'noPatchReason'>): boolean {
  if (file.patch || file.additions > 0 || file.deletions > 0) return true
  return !UNREAD.has(file.noPatchReason ?? 'hostOmitted')
}

/** What the notice can offer to do about it. */
export type NoPatchAction = 'load' | 'retry' | 'fetch' | null

export interface NoPatchNotice {
  messageKey: TranslationKey
  action: NoPatchAction
  /** Read without being asked — the file was simply not read yet. */
  autoLoad: boolean
}

const NOTICES: Record<PrNoPatchReason, NoPatchNotice> = {
  binary: { messageKey: 'prPage.noPatchBinary', action: null, autoLoad: false },
  tooLarge: { messageKey: 'prPage.noPatchTooLarge', action: null, autoLoad: false },
  notLoaded: { messageKey: 'prPage.noPatchNotLoaded', action: 'load', autoLoad: true },
  failed: { messageKey: 'prPage.noPatchFailed', action: 'retry', autoLoad: false },
  hostOmitted: { messageKey: 'prPage.noPatchHostOmitted', action: 'fetch', autoLoad: false },
  noChanges: { messageKey: 'prPage.noPatchNoChanges', action: null, autoLoad: false },
  encodingChanged: { messageKey: 'prPage.noPatchEncodingChanged', action: null, autoLoad: false }
}

/**
 * The notice for a file. A file from before reasons existed (or a host path
 * that set none) reads as `hostOmitted` — the honest "the host sent none". An
 * action needs somewhere to read the file from; without `diffSource` it is dropped.
 */
export function getNoPatchNotice(file: Pick<PrFile, 'noPatchReason' | 'diffSource'>): NoPatchNotice {
  const notice = NOTICES[file.noPatchReason ?? 'hostOmitted']
  return file.diffSource ? notice : { ...notice, action: null, autoLoad: false }
}
