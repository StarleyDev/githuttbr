import { useCallback, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { translate, useT, useUiLanguage, interp, type TranslationKey } from '../i18n'
import {
  SETTINGS_PAGE_KEYS,
  countSettingsByPage,
  searchSettings,
  type SettingsEntry,
  type SettingsPageId
} from '../lib/settingsSearch'

export interface SettingsSearchState {
  query: string
  setQuery: (q: string) => void
  /** Ranked, best first. Empty while the field is empty. */
  matches: SettingsEntry[]
  counts: Partial<Record<SettingsPageId, number>>
  active: boolean
}

/** The search's state, read in the reader's language and in English at once. */
export function useSettingsSearch(): SettingsSearchState {
  // The language, not `useT()`'s function (a new one every render), keys the memo.
  const lang = useUiLanguage()
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    // English too: a Portuguese reader typing "token" or "font" still lands
    // on the right row. Deduped so an untranslated key is not scored twice.
    const read = (key: TranslationKey): string[] => {
      const local = translate(lang, key)
      const english = translate('en', key)
      return english === local ? [local] : [local, english]
    }
    return searchSettings(query, read)
  }, [query, lang])
  const counts = useMemo(() => countSettingsByPage(matches), [matches])
  return { query, setQuery, matches, counts, active: query.trim().length > 0 }
}

/** The field in the Settings header, beside the modal's close button. */
export function SettingsSearchField({
  search,
  onPickFirst
}: {
  search: SettingsSearchState
  onPickFirst: () => void
}): React.JSX.Element {
  const t = useT()
  return (
    <div className="settings-search">
      <Search size={13} aria-hidden="true" />
      {/* type="search" brings Chromium's own clear button — no extra control or copy. */}
      <input
        type="search"
        value={search.query}
        placeholder={t('settings.searchPlaceholder')}
        aria-label={t('settings.searchLabel')}
        spellCheck={false}
        onChange={(e) => search.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && search.query) {
            // First Esc clears the search; only an empty field lets the
            // modal's own Esc close Settings.
            e.preventDefault()
            e.stopPropagation()
            search.setQuery('')
          } else if (e.key === 'Enter' && search.matches.length > 0) {
            e.preventDefault()
            onPickFirst()
          }
        }}
      />
    </div>
  )
}

/** The matches, grouped by page in the order their best match ranks. */
export function SettingsSearchResults({
  search,
  onPick
}: {
  search: SettingsSearchState
  onPick: (entry: SettingsEntry) => void
}): React.JSX.Element {
  const t = useT()
  const groups = useMemo(() => {
    const out: { page: SettingsPageId; entries: SettingsEntry[] }[] = []
    for (const m of search.matches) {
      const g = out.find((x) => x.page === m.page)
      if (g) g.entries.push(m)
      else out.push({ page: m.page, entries: [m] })
    }
    return out
  }, [search.matches])

  if (groups.length === 0) {
    return (
      <div className="settings-search-empty">
        <Search size={28} strokeWidth={1.3} aria-hidden="true" />
        <p>{interp(t('settings.searchNoResults'), { query: search.query.trim() })}</p>
      </div>
    )
  }

  return (
    <div className="settings-search-results" role="list">
      {groups.map((g) => (
        <section key={g.page} className="settings-search-group">
          <h4 className="settings-section-title">{t(SETTINGS_PAGE_KEYS[g.page])}</h4>
          {g.entries.map((entry) => (
            <button
              key={`${entry.page}:${entry.key}`}
              type="button"
              role="listitem"
              className="settings-search-hit"
              onClick={() => onPick(entry)}
            >
              <strong>{t(entry.key)}</strong>
              {entry.hint && <span className="settings-hint">{t(entry.hint)}</span>}
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}

// The rows a found label can sit in, innermost first is not needed: closest()
// walks up from the label to the first of these.
const ROW_SELECTOR =
  '.settings-toggle-card, .settings-field, .settings-general-header, .theme-section-header, .settings-section-title'

/**
 * Scroll the setting with this label into view and flash it. Pages and their
 * sections can render a frame or two late (a lazy list, an async load), so it
 * looks for a short while before giving up quietly — the page is open either
 * way. Returns a cleanup that cancels the search and the flash.
 */
export function revealSettingRow(container: HTMLElement, key: TranslationKey, label: string): () => void {
  let frame = 0
  let raf = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const find = (): HTMLElement | null => {
    // A control without a visible label carries its key instead.
    const tagged = container.querySelector<HTMLElement>(`[data-setting="${CSS.escape(key)}"]`)
    if (tagged) return tagged
    const wanted = label.trim()
    for (const el of container.querySelectorAll<HTMLElement>('strong, .settings-field-label, h4')) {
      if (el.textContent?.trim() === wanted) return el.closest<HTMLElement>(ROW_SELECTOR) ?? el
    }
    return null
  }
  const tick = (): void => {
    const row = find()
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      row.classList.add('settings-flash')
      timer = setTimeout(() => row.classList.remove('settings-flash'), 1800)
      return
    }
    if (++frame < 40) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(raf)
    if (timer) clearTimeout(timer)
  }
}

/** Remembers which setting to reveal once its page has rendered. */
export function useSettingReveal(): {
  pending: SettingsEntry | null
  requestReveal: (entry: SettingsEntry) => void
  clearReveal: () => void
} {
  const [pending, setPending] = useState<SettingsEntry | null>(null)
  const requestReveal = useCallback((entry: SettingsEntry) => setPending(entry), [])
  const clearReveal = useCallback(() => setPending(null), [])
  return { pending, requestReveal, clearReveal }
}
