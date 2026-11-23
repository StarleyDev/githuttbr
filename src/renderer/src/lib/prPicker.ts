import { PR_META_FIELDS } from '../../../shared/prMeta'
import type { PrMetaField, PrPickerLabel, PrPickerOptions, PrPickerPerson } from '../../../shared/types'

/**
 * The create-PR dialog's reviewer / assignee / label pickers, minus React:
 * one row shape for people and labels, the type-to-filter match, and a short
 * per-remote cache so reopening the dialog does not walk the lists again.
 */

/** One row of a picker: a person or a label, flattened. */
export interface PickerItem {
  id: string
  primary: string
  secondary?: string
  avatarUrl?: string
  color?: string
}

export function personItem(p: PrPickerPerson): PickerItem {
  return {
    id: p.id,
    primary: p.login,
    ...(p.name && p.name !== p.login ? { secondary: p.name } : {}),
    ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {})
  }
}

export function labelItem(l: PrPickerLabel): PickerItem {
  return { id: l.id, primary: l.name, ...(l.color ? { color: l.color } : {}) }
}

/** At most this many rows are drawn: past it, typing narrows the list. */
export const PICKER_ROWS = 50

/**
 * Rows not yet picked whose login, name or label contains every word typed,
 * ignoring case — `ana sil` finds `asilva (Ana Silva)`. Login matches that
 * start with the query come first.
 */
export function filterPicker(items: PickerItem[], query: string, picked: string[]): PickerItem[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const taken = new Set(picked)
  const hits = items.filter((i) => {
    if (taken.has(i.id)) return false
    const hay = `${i.primary} ${i.secondary ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  const q = words.join(' ')
  if (!q) return hits.slice(0, PICKER_ROWS)
  const starts = hits.filter((i) => i.primary.toLowerCase().startsWith(q))
  const rest = hits.filter((i) => !i.primary.toLowerCase().startsWith(q))
  return [...starts, ...rest].slice(0, PICKER_ROWS)
}

/** A typed label to offer as new, for a host that takes free labels — never a duplicate of one picked or listed. */
export function freeLabelCandidate(query: string, items: PickerItem[], picked: string[]): string | null {
  const v = query.trim()
  if (!v || v.includes(',')) return null
  const lower = v.toLowerCase()
  if (picked.some((p) => p.toLowerCase() === lower)) return null
  if (items.some((i) => i.primary.toLowerCase() === lower)) return null
  return v
}

/** The fields the dialog shows: supported ones, in a fixed order. */
export function shownFields(options: PrPickerOptions | null): PrMetaField[] {
  if (!options) return []
  return PR_META_FIELDS.filter((f) => options.supports[f])
}

/** Picks for fields the host supports — a pick in a hidden field is never sent. */
export function picksToSend(
  options: PrPickerOptions | null,
  picked: Record<PrMetaField, string[]>
): Partial<Record<PrMetaField, string[]>> {
  const out: Partial<Record<PrMetaField, string[]>> = {}
  for (const f of shownFields(options)) if (picked[f].length) out[f] = picked[f]
  return out
}

const CACHE_MS = 5 * 60_000

/** Read-through cache, one entry per repository + remote. A failed read is not kept. */
export function createPickerCache(now: () => number = Date.now): {
  get: (key: string, load: () => Promise<PrPickerOptions>) => Promise<PrPickerOptions>
  clear: () => void
} {
  const entries = new Map<string, { at: number; value: Promise<PrPickerOptions> }>()
  return {
    get(key, load) {
      const hit = entries.get(key)
      if (hit && now() - hit.at < CACHE_MS) return hit.value
      const value = load()
      entries.set(key, { at: now(), value })
      value.then(
        (v) => {
          // A list that failed is asked for again next time, not remembered empty.
          if (v.failed.length) entries.delete(key)
        },
        () => entries.delete(key)
      )
      return value
    },
    clear: () => entries.clear()
  }
}
