import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PrFile } from '../../../shared/types'
import { useSettingsStore } from '../stores/settings'
import { getPrFileOrder, getUnviewedFile, type PrFileFilter } from '../lib/prFilesProgress'
import { useT, interp, type TranslationKey } from '../i18n'

const FILTERS: { id: PrFileFilter; labelKey: TranslationKey }[] = [
  { id: 'all', labelKey: 'prFiles.filterAll' },
  { id: 'unviewed', labelKey: 'prFiles.filterUnviewed' },
  { id: 'commented', labelKey: 'prFiles.filterCommented' }
]

/**
 * The Files tab's header line: how far the review has come (viewed of total,
 * as words and as a bar), steps back and forth through the files not viewed
 * yet — the forward one optionally marking the open file viewed on the way —
 * and which files the list shows.
 */
export function PrFilesProgress({
  files,
  shown,
  viewed,
  selected,
  filter,
  onFilterChange,
  onSelectFile,
  onSetFilesViewed
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
  /** Marks files viewed — "Next" uses it when "Mark as viewed when moving on" is on. */
  onSetFilesViewed: (paths: string[], viewed: boolean) => void
}): React.JSX.Element {
  const t = useT()
  const view = useSettingsStore((s) => s.settings.fileListView ?? 'path')
  const viewedCount = useMemo(() => files.reduce((n, f) => n + (viewed.has(f.filename) ? 1 : 0), 0), [files, viewed])
  const markOnNext = useSettingsStore((s) => s.settings.prMarkViewedOnNext === true)
  const update = useSettingsStore((s) => s.update)
  const order = useMemo(() => getPrFileOrder(shown, view), [shown, view])
  const prev = getUnviewedFile(order, viewed, selected, -1)
  const next = getUnviewedFile(order, viewed, selected, 1)
  const goNext = (): void => {
    if (!next) return
    if (markOnNext && selected && !viewed.has(selected)) onSetFilesViewed([selected], true)
    onSelectFile(next)
  }
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
      <span className="prf-steps">
        <button
          type="button"
          className="prf-next"
          disabled={!prev}
          title={prev ? t('prFiles.prevUnviewedTitle') : t('prFiles.allViewed')}
          onClick={() => prev && onSelectFile(prev)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {t('prFiles.prevUnviewed')}
        </button>
        <button
          type="button"
          className="prf-next"
          disabled={!next}
          title={next ? t('prFiles.nextUnviewedTitle') : t('prFiles.allViewed')}
          onClick={goNext}
        >
          {t('prFiles.nextUnviewed')}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </span>
      <label className="prf-mark-on-next" title={t('prFiles.markOnNextTitle')}>
        <input
          type="checkbox"
          checked={markOnNext}
          onChange={(e) => {
            const on = e.target.checked
            update((s) => ({ ...s, prMarkViewedOnNext: on }))
          }}
        />
        {t('prFiles.markOnNext')}
      </label>
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
