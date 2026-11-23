import type { CiCounts } from '../../../shared/types'
import type { TranslationKey } from '../i18n'

const ORDER: { field: keyof CiCounts; key: TranslationKey }[] = [
  { field: 'passed', key: 'ci.countPassed' },
  { field: 'failed', key: 'ci.countFailed' },
  { field: 'pending', key: 'ci.countPending' },
  { field: 'skipped', key: 'ci.countSkipped' },
  { field: 'cancelled', key: 'ci.countCancelled' },
  { field: 'unknown', key: 'ci.countUnknown' }
]

/** The non-zero counts as translation keys, in reading order — "2 passed · 1 failing". */
export function ciCountParts(counts: CiCounts | undefined): { key: TranslationKey; vars: { n: number } }[] {
  if (!counts) return []
  return ORDER.filter((o) => counts[o.field] > 0).map((o) => ({ key: o.key, vars: { n: counts[o.field] } }))
}
