// What happens once the host has created a pull request: whether the browser
// opens, and what the app says. Kept free of React and IPC so the decision is
// tested against stable keys; stores/prCreated.ts carries it out.
import type { TranslationKey } from '../i18n'
import type { CreatePrResult, PrMetaField } from '../../../shared/types'

/** localStorage key for "open the PR in the browser after creating it". */
export const PR_OPEN_AFTER_CREATE_KEY = 'githuttbr-pr-open-after-create'

/** The slice of Storage this needs, so tests can pass a Map-backed stub. */
export interface PrefStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * Off unless the user turned it on: a new PR is listed in the app, and a
 * browser window jumping in front of it is an interruption nobody asked for.
 * Unreadable storage (private profile, quota) counts as off.
 */
export function readOpenAfterCreate(store: PrefStore | undefined): boolean {
  try {
    return store?.getItem(PR_OPEN_AFTER_CREATE_KEY) === 'on'
  } catch {
    return false
  }
}

export function writeOpenAfterCreate(store: PrefStore | undefined, on: boolean): void {
  try {
    store?.setItem(PR_OPEN_AFTER_CREATE_KEY, on ? 'on' : 'off')
  } catch {
    // A preference that cannot be saved only costs remembering it next time.
  }
}

export interface PrCreatedMessage {
  key: TranslationKey
  vars: Record<string, string | number>
}

export interface PrCreatedPlan {
  /** The URL to hand to the browser, or null to stay in the app. */
  openUrl: string | null
  /** The success notice — said in both modes, so the PR's number is always on screen. */
  notice: PrCreatedMessage
  /** Fields the host refused; the caller names them in the user's language. */
  metaFailed: PrMetaField[]
}

export function planPrCreated(res: CreatePrResult, openInBrowser: boolean): PrCreatedPlan {
  return {
    openUrl: openInBrowser && res.url ? res.url : null,
    notice: { key: 'createPR.createdFollow', vars: { n: res.number } },
    metaFailed: res.metaFailed ?? []
  }
}
