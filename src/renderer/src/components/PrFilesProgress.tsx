import { useMemo } from 'react'
import type { PrFile } from '../../../shared/types'
import { useSettingsStore } from '../stores/settings'
import { getNextUnviewedFile, getPrFileOrder, type PrFileFilter } from '../lib/prFilesProgress'
import { useT, interp, type TranslationKey } from '../i18n'

const FILTERS: { id: PrFileFilter; labelKey: TranslationKey }[] = [
  { id: 'all', labelKey: 'prFiles.filterAll' },
  { id: 'unviewed', labelKey: 'prFiles.filterUnviewed' },
  { id: 'commented', labelKey: 'prFiles.filterCommented' }
]

/**
 * The Files tab's header line: how far the review has come (viewed of total,
 * as words and as a bar), a jump to the next file not viewed yet, and which
 * files the list shows.
 */
export function PrFilesProgress({
  files,
  shown,
  viewed,
  selected,
  filter,
  onFilterChange,
  onSelectFile
}: {
  /** Every file of the pull request: what the count is out of. */
  files: PrFile[]
  /** The files the list shows under the filter: where "next" walks. */
  shown: PrFile[]
  viewed: ReadonlySet<string>
  /** The filename whose diff is open. */
  selected: string
  filter: PrFileFilter
  onFilterChange: (filter: PrFileFilter) => void
  onSelectFile: (filename: string) => void
}): React.JSX.Element {
  const t = useT()
  const view = useSettingsStore((s) => s.settings.fileListView ?? 'path')
  const viewedCount = useMemo(() => files.reduce((n, f) => n + (viewed.has(f.filename) ? 1 : 0), 0), [files, viewed])
  const order = useMemo(() => getPrFileOrder(shown, view), [shown, view])
  const next = getNextUnviewedFile(order, viewed, selected)
  const pct = files.length ? Math.round((viewedCount / files.length) * 100) : 0
  return (
    <div className="prf-progress">
      <span className="prf-progress-count">
        {interp(t('prFiles.viewedProgress'), { viewed: viewedCount, total: files.length })}
      </span>
      <span
        className="prf-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={files.length}
        aria-valuenow={viewedCount}
        aria-label={t('prFiles.viewedProgressLabel')}
      >
        <span style={{ width: `${pct}%` }} />
      </span>
      <button
        type="button"
        className="prf-next"
        disabled={!next}
        title={next ? t('prFiles.nextUnviewedTitle') : t('prFiles.allViewed')}
        onClick={() => next && onSelectFile(next)}
      >
        {t('prFiles.nextUnviewed')}
      </button>
      <span className="prf-progress-gap" />
      <span className="prf-filter-label" id="prf-filter-label">
        {t('prFiles.filterLabel')}
      </span>
      <span className="prf-filter" role="radiogroup" aria-labelledby="prf-filter-label">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            className={filter === f.id ? 'active' : ''}
            onClick={() => onFilterChange(f.id)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </span>
    </div>
  )
}
