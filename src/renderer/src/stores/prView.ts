import type { PageContent } from '../../../shared/types'
import { useSettingsStore } from './settings'
import { useUIStore } from './ui'
import {
  getClosedPrViewKeys,
  getOpenPrPages,
  getPrViewKey,
  hasUnsentDrafts,
  prViewStates
} from '../lib/prViewState'
import { t, interp } from '../i18n'

// The pull request pages' remembered places (lib/prViewState.ts) follow the
// tab list: closing a PR page forgets its place, ‹ › and the list's replace
// keep each PR's own. Watching the tabs here funnels every close path — the
// tab's ✕, the chip's ✕, close others, close all — through one rule.

type PrPage = Extract<PageContent, { type: 'pr' }>

let open = getOpenPrPages(useSettingsStore.getState().settings.tabs)
useSettingsStore.subscribe((s) => {
  const next = getOpenPrPages(s.settings.tabs)
  const closed = getClosedPrViewKeys(open, next, (key) => {
    // A peek: watching the tabs must not count as a use and reorder the LRU.
    const state = prViewStates.peekViewState(key)
    return !!state && hasUnsentDrafts(state)
  })
  open = next
  for (const key of closed) prViewStates.removeViewState(key)
})

/**
 * Close a pull request page — its tab or its chip — asking first when it holds
 * text nobody sent. Confirmed, its place and its drafts are discarded with it.
 */
export function requestClosePrPage(page: PrPage, close: () => void): void {
  const key = getPrViewKey(page.repoPath, page.remoteUrl, page.number)
  const state = prViewStates.peekViewState(key)
  if (!state || !hasUnsentDrafts(state)) {
    prViewStates.removeViewState(key)
    close()
    return
  }
  useUIStore.getState().openModal({
    kind: 'confirm',
    title: t('prView.closeDraftTitle'),
    message: interp(t('prView.closeDraftMessage'), { n: page.number }),
    danger: true,
    confirmLabel: t('common.close'),
    onConfirm: () => {
      prViewStates.removeViewState(key)
      close()
    }
  })
}
