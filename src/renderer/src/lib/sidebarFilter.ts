/**
 * The sidebar's one filter box, and the section bookkeeping around it.
 *
 * Everything here is pure: the component owns the state, this decides what a
 * query matches, what each section header counts, which sections fold into the
 * "no matches" line, and how a reorder or a keyboard move rewrites the order.
 */

/** The fields of an item that a query is matched against. */
export type SearchFields<T> = (item: T) => ReadonlyArray<string | number | null | undefined>

/**
 * An item list with its searchable text lowercased once. Built when a filter
 * starts, not per keystroke: lowercasing ten thousand ref names on every key
 * is the cost this exists to avoid.
 */
export interface SearchIndex<T> {
  items: T[]
  hay: string[]
}

/** Trimmed and lowercased; an empty result means "not filtering". */
export function normalizeSidebarQuery(raw: string): string {
  return raw.trim().toLowerCase()
}

export function buildSearchIndex<T>(items: T[], fields: SearchFields<T>): SearchIndex<T> {
  const hay = new Array<string>(items.length)
  for (let i = 0; i < items.length; i++) {
    // A newline cannot be typed into the one-line box, so a query never
    // matches across the seam between two fields.
    hay[i] = fields(items[i])
      .filter((v) => v !== null && v !== undefined && v !== '')
      .join('\n')
      .toLowerCase()
  }
  return { items, hay }
}

/**
 * The items whose text contains the (already normalized) query. An empty query
 * hands back the original array, so a caller memoizing on it keeps its identity
 * and nothing downstream recomputes.
 */
export function filterSearchIndex<T>(index: SearchIndex<T>, query: string): T[] {
  if (!query) return index.items
  const out: T[] = []
  for (let i = 0; i < index.items.length; i++) if (index.hay[i].includes(query)) out.push(index.items[i])
  return out
}

/** One-off match without an index — for short lists and single items. */
export function matchesSidebarQuery(
  query: string,
  ...fields: ReadonlyArray<string | number | null | undefined>
): boolean {
  if (!query) return true
  return fields.some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(query))
}

/** What one section holds: how many rows match the filter, out of how many. */
export interface SectionTally {
  matched: number
  total: number
}

/** A header's count: the plain total, or "matched of total" while filtering. */
export type SectionCount = { kind: 'plain'; n: number } | { kind: 'of'; n: number; total: number }

export function sectionCount(tally: SectionTally, filtering: boolean): SectionCount {
  return filtering ? { kind: 'of', n: tally.matched, total: tally.total } : { kind: 'plain', n: tally.total }
}

/**
 * Splits the visible sections into those that show (in order) and those that
 * fold into the compact "no matches" line. Without a filter nothing folds: an
 * empty Stashes section is still a place you might want to open.
 */
export function splitSectionsByMatches(
  order: readonly string[],
  tallies: Readonly<Record<string, SectionTally | undefined>>,
  filtering: boolean
): { shown: string[]; empty: string[] } {
  if (!filtering) return { shown: [...order], empty: [] }
  const shown: string[] = []
  const empty: string[] = []
  for (const id of order) ((tallies[id]?.matched ?? 0) > 0 ? shown : empty).push(id)
  return { shown, empty }
}

/** Every match across the given sections — the "N results" line. */
export function totalMatches(ids: readonly string[], tallies: Readonly<Record<string, SectionTally | undefined>>): number {
  let n = 0
  for (const id of ids) n += tallies[id]?.matched ?? 0
  return n
}

/**
 * The saved order reconciled with the sections that exist now: ids no longer
 * rendered (a host without issues) drop out, sections added since the order
 * was saved join at the end, and a duplicate keeps its first place.
 */
export function mergeSectionOrder(saved: readonly string[] | undefined, available: readonly string[]): string[] {
  const avail = new Set(available)
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of saved ?? []) {
    if (avail.has(id) && !seen.has(id)) {
      out.push(id)
      seen.add(id)
    }
  }
  for (const id of available) if (!seen.has(id)) out.push(id)
  return out
}

/** Drag-and-drop: `from` lands just before `to`, or at the end when `to` is unknown. */
export function moveSectionBefore(order: readonly string[], from: string, to: string): string[] {
  if (from === to || !order.includes(from)) return [...order]
  const next = order.filter((id) => id !== from)
  const idx = next.indexOf(to)
  next.splice(idx < 0 ? next.length : idx, 0, from)
  return next
}

/**
 * The keyboard alternative to dragging: one step up (-1) or down (+1) past the
 * neighbouring *visible* section. Hidden sections keep their slots, so showing
 * one again puts it back where it was. At either end it is a no-op.
 */
export function moveSectionBy(
  order: readonly string[],
  id: string,
  delta: -1 | 1,
  visible: readonly string[] = order
): string[] {
  const pos = visible.indexOf(id)
  const neighbour = visible[pos + delta]
  if (pos < 0 || neighbour === undefined) return [...order]
  const next = order.filter((x) => x !== id)
  const at = next.indexOf(neighbour)
  next.splice(delta < 0 ? at : at + 1, 0, id)
  return next
}

/** Whether a move in that direction would do anything — drives the menu's disabled state. */
export function canMoveSection(visible: readonly string[], id: string, delta: -1 | 1): boolean {
  const pos = visible.indexOf(id)
  return pos >= 0 && visible[pos + delta] !== undefined
}

/**
 * Whether a section or folder is open.
 *
 * Without a filter: the persisted per-repository choice, else the default.
 * While filtering: a choice made during this filter, else `filterDefault` —
 * the persisted layout is left alone, so clearing the box restores exactly the
 * arrangement the user had.
 */
export function resolveSectionOpen(opts: {
  key: string
  persisted: Readonly<Record<string, boolean>> | undefined
  defaultOpen: boolean
  filtering: boolean
  session: Readonly<Record<string, boolean>>
  filterDefault: boolean
}): boolean {
  if (opts.filtering) return opts.session[opts.key] ?? opts.filterDefault
  return opts.persisted?.[opts.key] ?? opts.defaultOpen
}
