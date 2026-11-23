import type { HostingProvider, PrMetaField, PrPickerLabel, PrPickerPerson } from './types'

/**
 * Reviewers, assignees and labels on a new pull request: which host takes
 * which, and the small normalisations every provider's answer goes through.
 * Pure, so the provider table is testable without a server.
 */

export const PR_META_FIELDS: readonly PrMetaField[] = ['reviewers', 'assignees', 'labels']

const yes = (reviewers: boolean, assignees: boolean, labels: boolean): Record<PrMetaField, boolean> => ({
  reviewers,
  assignees,
  labels
})

/**
 * The fields a host's API can set when a PR is opened.
 * - GitHub (and Enterprise Server), GitLab: all three.
 * - Azure DevOps: reviewers and labels; it has no assignees.
 * - Bitbucket (cloud and Data Center): reviewers only.
 * - Forgejo, or a host not recognised: none — the dialog shows no field.
 */
export function prMetaSupport(provider: HostingProvider): Record<PrMetaField, boolean> {
  switch (provider) {
    case 'github':
    case 'gitlab':
      return yes(true, true, true)
    case 'azure':
      return yes(true, false, true)
    case 'bitbucket':
      return yes(true, false, false)
    default:
      return yes(false, false, false)
  }
}

/** One entry per id, first one wins, in the order the host listed them. */
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((i) => (i.id && !seen.has(i.id) ? (seen.add(i.id), true) : false))
}

/** The list without the signed-in account — for a host that refuses self-review. */
export function withoutSelf(people: PrPickerPerson[], self: string | null | undefined): PrPickerPerson[] {
  if (!self) return people
  const me = self.toLowerCase()
  return people.filter((p) => p.id.toLowerCase() !== me && p.login.toLowerCase() !== me)
}

/** A host's colour as `#rrggbb`: GitHub sends `d73a4a`, GitLab `#d73a4a`. Anything else is dropped. */
export function labelColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const hex = raw.trim().replace(/^#/, '')
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : undefined
}

/** Labels sorted by name, ignoring case — hosts list them in creation order. */
export function sortLabels(labels: PrPickerLabel[]): PrPickerLabel[] {
  return [...labels].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** The picks that were asked for — strings only, trimmed, once each — or `undefined` when there are none. */
export function picks(list: unknown): string[] | undefined {
  if (!Array.isArray(list)) return undefined
  const out = list.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean)
  return out.length ? [...new Set(out)] : undefined
}

/**
 * Create options with the picks normalised. A field nobody picked is dropped
 * entirely, so a PR created with no picks sends exactly the request it always did.
 */
export function cleanPrMeta<T extends { reviewers?: unknown; assignees?: unknown; labels?: unknown }>(
  opts: T
): Omit<T, PrMetaField> & Partial<Record<PrMetaField, string[]>> {
  const { reviewers, assignees, labels, ...rest } = opts
  const out: Omit<T, PrMetaField> & Partial<Record<PrMetaField, string[]>> = rest
  for (const [field, list] of [['reviewers', reviewers], ['assignees', assignees], ['labels', labels]] as const) {
    const p = picks(list)
    if (p) out[field] = p
  }
  return out
}
