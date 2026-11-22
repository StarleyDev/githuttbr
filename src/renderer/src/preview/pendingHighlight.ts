import { useCallback, useRef } from 'react'
import { highlightAuto, highlightCode, isLanguageReady, loadLanguage, onLanguageRegistered } from '../lib/highlight'

/** Marks a fenced block renderMarkdown left plain until its language loads. */
export const PENDING_ATTR = 'data-hl-pending'

/** The slice of a DOM element this module touches — so the logic runs on a fake in tests. */
export interface PendingBlock {
  textContent: string | null
  innerHTML: string
  getAttribute(name: string): string | null
  removeAttribute(name: string): void
  classList: { add(token: string): void }
}

export interface BlockRoot {
  querySelectorAll(selector: string): ArrayLike<PendingBlock>
}

const SELECTOR = `code[${PENDING_ATTR}]`

function settle(el: PendingBlock, lang: string, ok: boolean): void {
  const text = el.textContent || ''
  el.innerHTML = ok ? highlightCode(text, lang) : highlightAuto(text)
  el.removeAttribute(PENDING_ATTR)
  el.classList.add('hljs')
}

/** Highlight every pending block under `root` whose language is ready now.
 *  Returns the languages still missing. Idempotent: a settled block loses its mark. */
export function upgradePendingIn(root: BlockRoot): Set<string> {
  const missing = new Set<string>()
  for (const el of Array.from(root.querySelectorAll(SELECTOR))) {
    const lang = el.getAttribute(PENDING_ATTR)
    if (!lang) continue
    if (isLanguageReady(lang)) settle(el, lang, true)
    else missing.add(lang)
  }
  return missing
}

/** Give up on `lang` under `root`: its chunk failed, so fall back to auto-detection. */
export function settleFailedIn(root: BlockRoot, lang: string): void {
  for (const el of Array.from(root.querySelectorAll(SELECTOR))) {
    if (el.getAttribute(PENDING_ATTR) === lang) settle(el, lang, false)
  }
}

/**
 * Upgrade `root`'s pending blocks now, and again whenever a language registers,
 * until none is left. Covers markup rendered before its language arrived and
 * mounted after — a memoised string, a tab that was hidden — which the
 * document-wide upgrade in renderMarkdown could not reach. Returns the stop.
 */
export function watchPending(root: BlockRoot): () => void {
  const missing = upgradePendingIn(root)
  if (missing.size === 0) return () => undefined
  let live = true
  const off = onLanguageRegistered(() => {
    if (live && upgradePendingIn(root).size === 0) stop()
  })
  const stop = (): void => {
    live = false
    off()
  }
  // Deduplicated in loadLanguage: usually the load renderMarkdown already started.
  for (const lang of missing) {
    void loadLanguage(lang).then((ok) => {
      if (live && !ok) settleFailedIn(root, lang)
    })
  }
  return stop
}

/**
 * A ref for an element holding renderMarkdown's output. `html` is that output:
 * a new string gives a new ref, so React re-attaches it and the fresh markup is
 * checked too. React 18 refs have no cleanup, so the stop is kept here.
 */
export function usePendingHighlight(html: string | null | undefined): (el: HTMLElement | null) => void {
  const stop = useRef<(() => void) | null>(null)
  return useCallback(
    (el: HTMLElement | null) => {
      stop.current?.()
      stop.current = el && html ? watchPending(el) : null
    },
    [html]
  )
}
