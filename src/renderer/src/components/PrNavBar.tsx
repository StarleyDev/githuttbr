import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PageContent } from '../../../shared/types'
import { useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { stepPr, takePendingFocus, usePrListStore } from '../stores/prList'
import { interp, useT, type TranslationKey } from '../i18n'
import { filterSummary, hasActiveFilters, prListItems, resolvePrNav } from '../lib/prList'
import { enterpriseBasesOf } from '../lib/hosting'
import { NO_ITEMS } from '../lib/stableEmpty'
import { effectiveBindings, formatCombo } from '../lib/shortcuts'

type PrPage = Extract<PageContent, { type: 'pr' }>

const TAB_KEY: Record<string, TranslationKey> = {
  open: 'prList.tabOpen',
  drafts: 'prList.tabDrafts',
  merged: 'prList.tabMerged',
  closed: 'prList.tabClosed'
}

/**
 * The strip above a PR's page: back to the list (its filters as they were),
 * and ‹ k of n › through the list this PR was opened from — or, opened from
 * anywhere else, through the repository's open PRs. Hidden arrows mean the PR
 * is on neither walk.
 */
export function PrNavBar({ page }: { page: PrPage }): React.JSX.Element {
  const t = useT()
  const listNav = usePrListStore((s) => s.navs[page.repoPath])
  const prs = useRepoStore((s) => s.repos[page.repoPath]?.prs) ?? NO_ITEMS
  const upstreamPrs = useRepoStore((s) => s.repos[page.repoPath]?.upstreamPrs) ?? NO_ITEMS
  const remotes = useRepoStore((s) => s.repos[page.repoPath]?.remotes) ?? NO_ITEMS
  const profiles = useSettingsStore((s) => s.settings.profiles)
  const custom = useSettingsStore((s) => s.settings.shortcuts)

  const nav = useMemo(
    () => resolvePrNav(page, listNav, prListItems(prs, upstreamPrs, remotes, enterpriseBasesOf(profiles))),
    [page, listNav, prs, upstreamPrs, remotes, profiles]
  )
  const keys = useMemo(() => {
    const b = effectiveBindings(custom)
    return { prev: formatCombo(b['pr-previous']), next: formatCombo(b['pr-next']) }
  }, [custom])

  const pos = nav.position
  // Arrived here by ‹ ›: the arrow keeps the focus (the page remounted under
  // it), and the new place is said aloud — set after mount, so it is announced.
  const prevRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [announce, setAnnounce] = useState('')
  // Kept on a ref: a development double-run of the effect must not lose it.
  const arrival = useRef<-1 | 1 | null | undefined>(undefined)
  useEffect(() => {
    if (arrival.current === undefined) arrival.current = takePendingFocus()
    const dir = arrival.current
    if (!dir || !pos) return
    const first = dir < 0 ? prevRef.current : nextRef.current
    const target = first && !first.disabled ? first : dir < 0 ? nextRef.current : prevRef.current
    target?.focus()
    // A live region filled in the same frame it mounts is often not read: wait a beat.
    const text = interp(t('prNav.position'), { k: pos.index + 1, n: pos.total })
    const timer = window.setTimeout(() => setAnnounce(text), 100)
    return () => window.clearTimeout(timer)
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const where = nav.fromList
    ? hasActiveFilters(nav.fromList.filters)
      ? interp(t('prNav.fromFiltered'), {
          filters: filterSummary(nav.fromList.filters)
            .map((p) => interp(t(p.key), p.vars))
            .join(', ')
        })
      : interp(t('prNav.fromTab'), { tab: t(TAB_KEY[nav.fromList.tab] ?? 'prList.tabOpen') })
    : t('prNav.fromOpen')

  return (
    <div className="prn-bar">
      <button
        className="prn-back"
        onClick={() => useSettingsStore.getState().openPageTab({ type: 'pull-requests', repoPath: page.repoPath })}
        title={t('prNav.backTitle')}
      >
        <ArrowLeft size={14} /> {t('prList.title')}
      </button>
      {pos && (
        <>
          <span className="prn-sep" aria-hidden="true" />
          <div className="prn-steps">
            <button
              ref={prevRef}
              className="prn-step"
              disabled={!pos.prev}
              onClick={() => stepPr(page, -1)}
              aria-label={t('prNav.previous')}
              title={
                pos.prev
                  ? interp(t('prNav.previousTitle'), { n: pos.prev.number, title: pos.prev.title, keys: keys.prev })
                  : t('prNav.atFirst')
              }
            >
              <ChevronLeft size={16} />
            </button>
            <span className="prn-pos">{interp(t('prNav.position'), { k: pos.index + 1, n: pos.total })}</span>
            <button
              ref={nextRef}
              className="prn-step"
              disabled={!pos.next}
              onClick={() => stepPr(page, 1)}
              aria-label={t('prNav.next')}
              title={
                pos.next
                  ? interp(t('prNav.nextTitle'), { n: pos.next.number, title: pos.next.title, keys: keys.next })
                  : t('prNav.atLast')
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="prn-where">{where}</span>
          <span className="prn-live" aria-live="polite">
            {announce}
          </span>
          <span className="prn-keys">{interp(t('prNav.keysHint'), { prev: keys.prev, next: keys.next })}</span>
        </>
      )}
    </div>
  )
}
