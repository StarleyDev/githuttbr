/**
 * GitLab and Forgejo have no draft flag to set on an existing pull request:
 * a title that starts with a draft marker is the draft. Every spelling the
 * hosts read as one is recognised, so turning a draft back into a ready pull
 * request never leaves "WIP:" or "[Draft]" behind.
 */
const DRAFT_MARKER = /^\s*(?:\[(?:draft|wip)\]|\((?:draft|wip)\)|draft:|wip:)\s*/i

/** The title without any leading draft marker. */
export function withoutDraftMarker(title: string): string {
  let rest = title
  // "Draft: WIP: x" — a title marked twice is cleaned whole.
  while (DRAFT_MARKER.test(rest)) rest = rest.replace(DRAFT_MARKER, '')
  return rest.trim()
}

/**
 * The title marked as a draft with `marker` (GitLab: "Draft:", Forgejo:
 * "WIP:"), or unmarked when `draft` is false.
 */
export function titleForDraft(title: string, draft: boolean, marker: 'Draft:' | 'WIP:'): string {
  const rest = withoutDraftMarker(title)
  return draft ? `${marker} ${rest}` : rest
}
