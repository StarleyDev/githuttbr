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

/**
 * Whether a field takes what was typed, as well as what is listed: labels on a
 * host that creates them by name, and people on a host whose id is the login —
 * but only when the list could not be read, since a loaded list is everyone
 * the host would accept anyway.
 */
export function freeEntry(options: PrPickerOptions | null, field: PrMetaField): boolean {
  if (!options) return false
  if (field === 'labels') return !!options.freeLabels
  return !!options.freePeople && options.failed.includes(field)
}

/** What a key in the picker's field does. Pure, so the IME and closed-list cases are testable. */
export type PickerKeyAction =
  | { kind: 'none' }
  | { kind: 'open' }
  | { kind: 'move'; cursor: number }
  | { kind: 'add'; row: number }
  | { kind: 'close' }
  | { kind: 'removeLast' }

export interface PickerKeyState {
  key: string
  /** An IME composition is in progress (ja / zh / ko): Enter confirms the text there, not a pick. */
  composing: boolean
  open: boolean
  cursor: number
  rowCount: number
  text: string
  picked: number
}

/**
 * The picker's keys. Enter never submits the dialog, and never adds a row the
 * user cannot see: with the list closed it only opens it. During an IME
 * composition every key is the input method's.
 */
export function pickerKey(s: PickerKeyState): PickerKeyAction {
  if (s.composing) return { kind: 'none' }
  switch (s.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      if (!s.open) return { kind: 'open' }
      return { kind: 'move', cursor: Math.min(Math.max(0, s.rowCount - 1), Math.max(0, s.cursor + (s.key === 'ArrowDown' ? 1 : -1))) }
    case 'Enter':
      if (!s.open) return { kind: 'open' }
      return s.rowCount ? { kind: 'add', row: Math.min(s.cursor, s.rowCount - 1) } : { kind: 'none' }
    case 'Escape':
      return s.open ? { kind: 'close' } : { kind: 'none' }
    case 'Backspace':
      return !s.text && s.picked ? { kind: 'removeLast' } : { kind: 'none' }
    default:
      return { kind: 'none' }
  }
}

/** A short, non-reversible tag of the tokens a read was made with — the cache key never holds a token. */
export function tokenFingerprint(tokens: Record<string, string | undefined>): string {
  // FNV-1a over the sorted slots: enough to tell one credential set from another, nothing to recover.
  let h = 0x811c9dc5
  const text = Object.keys(tokens)
    .sort()
    .map((k) => `${k}=${tokens[k] ?? ''}`)
    .join('\n')
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * The picker cache key: repository, remote, the profiles whose credentials may
 * answer (active and bound), and the tokens' fingerprint — so switching
 * profile or pasting a new token never serves another account's lists.
 */
export function pickerCacheKey(
  repoPath: string,
  remoteUrl: string,
  profileIds: Array<string | null | undefined>,
  tokens: Record<string, string | undefined>
): string {
  return [repoPath, remoteUrl, profileIds.map((p) => p ?? '').join(','), tokenFingerprint(tokens)].join('\n')
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
