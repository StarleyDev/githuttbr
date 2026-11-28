import { useEffect, useRef, useState } from 'react'
import { hostingApi } from '../infrastructure/api'
import { useSettingsStore } from '../stores/settings'
import { getPrFileCountKey, getPrFileCountRequests, toPrFileCountMap } from '../lib/prFileCounts'
import type { PrListItem } from '../lib/prList'

/** Rows per call: each answer is one state update, so the page redraws per batch, not per PR. */
const COUNT_BATCH = 25

/**
 * The changed-file counts of the rows the PR list page draws, for Azure DevOps
 * — whose list has none. Read only here, never with the sidebar's periodic
 * refresh: each count costs the host two calls, and main keeps them by head
 * commit, so a refresh or a re-opened page asks only for PRs pushed to since.
 * A row asked once is not asked again while the page lives, answered or not:
 * a failure leaves the cell blank rather than retrying in a loop.
 */
export function usePrFileCounts(
  repoPath: string,
  remoteUrl: string | undefined,
  enabled: boolean,
  rows: PrListItem[]
): Record<string, number> {
  const azureToken = useSettingsStore((s) => s.activeProfile().azureToken)
  const scope = remoteUrl ? `${repoPath}\n${remoteUrl}` : ''
  const [counts, setCounts] = useState<{ of: string; map: Record<string, number> }>({ of: '', map: {} })
  const asked = useRef<{ of: string; keys: Set<string> }>({ of: '', keys: new Set() })
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !remoteUrl) return
    if (asked.current.of !== scope) asked.current = { of: scope, keys: new Set() }
    const round = asked.current
    const requests = getPrFileCountRequests(rows, round.keys)
    if (!requests.length) return
    for (const r of requests) round.keys.add(getPrFileCountKey(r.id, r.headSha))
    // Not cancelled when the rows change (a CI badge, a filter): main is already
    // reading these, and asking again would only cost the host twice.
    void (async () => {
      for (let i = 0; i < requests.length; i += COUNT_BATCH) {
        if (!mounted.current || asked.current !== round) return
        const batch = requests.slice(i, i + COUNT_BATCH)
        const answer = await hostingApi
          .getPrFileCounts(repoPath, remoteUrl, { azure: azureToken || undefined }, batch)
          .catch(() => ({}) as Record<number, number>)
        if (!mounted.current || asked.current !== round) return
        const found = toPrFileCountMap(batch, answer)
        if (!Object.keys(found).length) continue
        setCounts((cur) => ({ of: scope, map: { ...(cur.of === scope ? cur.map : {}), ...found } }))
      }
    })()
  }, [enabled, remoteUrl, scope, repoPath, rows, azureToken])

  return counts.of === scope ? counts.map : NO_COUNTS
}

const NO_COUNTS: Record<string, number> = Object.freeze({}) as Record<string, number>
