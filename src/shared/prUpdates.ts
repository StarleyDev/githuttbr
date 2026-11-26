import type { PrCommit, PrUpdate, PrUpdateKind } from './types'
import { orderOldestFirst, toPrCommit, type RawPrCommit } from './prCommits'

/**
 * A pull request's updates — its pushes — told apart the same way whatever
 * host recorded them. Each host reads its own record (Azure's iterations,
 * GitLab's diff versions, Data Center's rescopes, GitHub's timeline, Forgejo's
 * push comments) into drafts; these functions number them, fill in what each
 * one is compared against, and cap the list. Pure: the hosts' tests feed it
 * fixtures, and the renderer never sees a host's vocabulary.
 */

/** The most updates the tab lists; the newest are kept. */
export const PR_UPDATES_MAX = 100

/** An update before it is numbered. */
export type PrUpdateDraft = Omit<PrUpdate, 'index' | 'added' | 'removed'> & {
  added: PrCommit[]
  removed?: PrCommit[]
}

/** A host's commits as the tab shows them, oldest first. */
export function toUpdateCommits(raws: readonly RawPrCommit[], newestFirst: boolean): PrCommit[] {
  return orderOldestFirst([...raws], newestFirst).map(toPrCommit)
}

/** A commit the host names only by its sha (it is gone from the branch, or was never listed). */
export function shaOnlyCommit(sha: string): PrCommit {
  return toPrCommit({ sha, message: '', authorName: '', authoredAt: '' })
}

/**
 * Number the drafts (oldest first, from 1), give each its comparison base —
 * the previous update's head unless the host named one — and keep the newest
 * PR_UPDATES_MAX. The numbers are counted before the cut, so "Update 140"
 * stays 140 when the oldest ones are dropped.
 */
export function finishPrUpdates(drafts: readonly PrUpdateDraft[]): { updates: PrUpdate[]; truncated: boolean } {
  const all = drafts.map((d, i): PrUpdate => {
    const previous = i > 0 ? drafts[i - 1].headSha : undefined
    const fromSha = d.fromSha ?? previous
    return {
      ...d,
      index: i + 1,
      added: d.added,
      removed: d.removed ?? [],
      ...(fromSha ? { fromSha } : {})
    }
  })
  const truncated = all.length > PR_UPDATES_MAX
  return { updates: truncated ? all.slice(all.length - PR_UPDATES_MAX) : all, truncated }
}

/** Which of `list` are not in `seen`, keeping the order. */
function without(list: readonly PrCommit[], seen: ReadonlySet<string>): PrCommit[] {
  return list.filter((c) => !seen.has(c.sha))
}

/**
 * Each update's own commits, when the host lists every update's commits but
 * does not say whether a list is the whole branch or only the push (Azure's
 * iterations): a commit counts in the first update that lists it.
 */
export function keepFirstListing(lists: readonly PrCommit[][]): PrCommit[][] {
  const seen = new Set<string>()
  return lists.map((list) => {
    const own = without(list, seen)
    for (const c of list) seen.add(c.sha)
    return own
  })
}

// ── GitLab: diff versions (heads) plus the commit graph ─────────────────────

/** One head the host recorded, oldest first: a GitLab diff version. */
export interface HeadVersion {
  id: string
  createdAt: string
  headSha: string
  /** The merge base the version was diffed against. */
  baseSha?: string
  pusher?: string
}

/**
 * The commits reachable from `head` through `graph`, newest first. The graph
 * holds only the pull request's own commits, so the walk stops where the
 * target branch begins.
 */
export function reachableCommits(head: string, graph: ReadonlyMap<string, RawPrCommit>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const queue = [head]
  while (queue.length) {
    const sha = queue.shift()!
    if (seen.has(sha)) continue
    seen.add(sha)
    const c = graph.get(sha)
    if (!c) continue
    out.push(sha)
    for (const p of c.parentShas ?? []) queue.push(p)
  }
  return out
}

/**
 * Updates from a list of heads and the commits behind them. What each update
 * added is what its head reaches and the previous head did not; what it
 * removed, the other way round. A previous head the new one does not reach is
 * a rewritten history.
 */
export function groupUpdatesByHeads(versions: readonly HeadVersion[], graph: ReadonlyMap<string, RawPrCommit>): PrUpdateDraft[] {
  const commitOf = (sha: string): PrCommit => {
    const raw = graph.get(sha)
    return raw ? toPrCommit(raw) : shaOnlyCommit(sha)
  }
  let previous: string[] = []
  let previousHead: string | undefined
  return versions.map((v, i) => {
    const reach = reachableCommits(v.headSha, graph)
    const now = new Set(reach)
    const before = new Set(previous)
    // Newest first from the walk: reversed for the tab's oldest first.
    const added = reach.filter((s) => !before.has(s)).reverse().map(commitOf)
    const removed = previous.filter((s) => !now.has(s)).reverse().map(commitOf)
    const rewritten = i > 0 && (removed.length > 0 || (!!previousHead && previousHead !== v.headSha && !now.has(previousHead) && graph.has(previousHead)))
    const kind: PrUpdateKind = i === 0 ? 'opened' : rewritten ? 'rewrite' : 'push'
    previous = reach
    previousHead = v.headSha
    return {
      id: v.id,
      kind,
      createdAt: v.createdAt,
      ...(v.pusher ? { pusher: v.pusher } : {}),
      headSha: v.headSha,
      // The first version is compared with the merge base it was opened on.
      ...(i === 0 && v.baseSha ? { fromSha: v.baseSha } : {}),
      added,
      removed
    }
  })
}

// ── GitHub: the timeline's commits and force pushes ─────────────────────────

/** One item of GitHub's timeline, in the order the timeline lists them. */
export type GithubTimelineItem =
  | { type: 'commit'; commit: RawPrCommit; committedAt: string }
  | { type: 'forcePush'; at: string; actor?: string; beforeSha?: string; afterSha?: string }

/** Whether `at` is later than `than` (both ISO); an unreadable date is not later. */
function isLater(at: string, than: string): boolean {
  const a = Date.parse(at)
  const b = Date.parse(than)
  return !Number.isNaN(a) && !Number.isNaN(b) && a > b
}

/**
 * GitHub keeps no record of a plain push — only of a force push — so updates
 * are reconstructed: the pull request's opening and each force push start
 * one, and a commit committed after the update it would fall in began must
 * have been pushed later, so it starts the next. Several plain pushes in a
 * row land in one update; the tab says the grouping is approximate.
 */
export function groupGithubTimeline(
  items: readonly GithubTimelineItem[],
  opened: { at: string; author?: string }
): PrUpdateDraft[] {
  type Open = { draft: PrUpdateDraft; raws: RawPrCommit[] }
  const groups: Open[] = []
  const start = (kind: PrUpdateKind, at: string, extra: Partial<PrUpdateDraft> = {}): Open => {
    const g: Open = { draft: { id: '', kind, createdAt: at, added: [], ...extra }, raws: [] }
    groups.push(g)
    return g
  }
  let current = start('opened', opened.at, opened.author ? { pusher: opened.author } : {})
  for (const item of items) {
    if (item.type === 'forcePush') {
      current = start('rewrite', item.at, {
        ...(item.actor ? { pusher: item.actor } : {}),
        ...(item.afterSha ? { headSha: item.afterSha } : {}),
        ...(item.beforeSha ? { fromSha: item.beforeSha } : {})
      })
      continue
    }
    if (isLater(item.committedAt, current.draft.createdAt)) current = start('push', item.committedAt)
    current.raws.push(item.commit)
  }
  return groups.map(({ draft, raws }, i) => {
    const added = raws.map(toPrCommit)
    const head = draft.headSha ?? added[added.length - 1]?.sha
    return {
      ...draft,
      // Each update is known by its head; one without (an opening whose commits
      // were all rewritten since) by its place and date.
      id: head ? `${draft.kind}:${head}` : `${draft.kind}:${i}:${draft.createdAt}`,
      ...(head ? { headSha: head } : {}),
      added
    }
  })
}

// ── Forgejo / Gitea: the timeline's push comments ───────────────────────────

/** A `pull_push` comment, in timeline order. A force push names [old, new]. */
export interface ForgejoPush {
  id: string
  at: string
  pusher?: string
  force: boolean
  commitIds: string[]
}

/**
 * Forgejo records each push to a pull request as a comment naming the commits
 * it added — or, for a force push, the old and the new head. What no push
 * names was there when the pull request was opened.
 */
export function groupForgejoPushes(
  pushes: readonly ForgejoPush[],
  opened: { at: string; author?: string },
  commits: readonly RawPrCommit[]
): PrUpdateDraft[] {
  const bySha = new Map(commits.map((c) => [c.sha, c]))
  const commitOf = (sha: string): PrCommit => {
    const raw = bySha.get(sha)
    return raw ? toPrCommit(raw) : shaOnlyCommit(sha)
  }
  const pushed = new Set(pushes.filter((p) => !p.force).flatMap((p) => p.commitIds))
  // The PR's own list is oldest first (finishPrCommits ordered it).
  const initial = commits.filter((c) => !pushed.has(c.sha)).map(toPrCommit)
  const first: PrUpdateDraft = {
    id: 'opened',
    kind: 'opened',
    createdAt: opened.at,
    ...(opened.author ? { pusher: opened.author } : {}),
    ...(initial.length ? { headSha: initial[initial.length - 1].sha } : {}),
    added: initial
  }
  const later = pushes.map((p): PrUpdateDraft => {
    if (p.force) {
      const [before, after] = p.commitIds
      return {
        id: p.id,
        kind: 'rewrite',
        createdAt: p.at,
        ...(p.pusher ? { pusher: p.pusher } : {}),
        ...(after ? { headSha: after } : {}),
        ...(before ? { fromSha: before } : {}),
        added: []
      }
    }
    // Listed newest first, as `git rev-list` gives them; the parents settle it when known.
    const raws = p.commitIds.map((s) => bySha.get(s) ?? { sha: s, message: '', authorName: '', authoredAt: '' })
    const added = orderOldestFirst(raws, true).map((r) => commitOf(r.sha))
    return {
      id: p.id,
      kind: 'push',
      createdAt: p.at,
      ...(p.pusher ? { pusher: p.pusher } : {}),
      ...(added.length ? { headSha: added[added.length - 1].sha } : {}),
      added
    }
  })
  return [first, ...later]
}

/** Every commit in one update, when the host records no pushes at all. */
export function singleUpdate(commits: readonly RawPrCommit[], opened: { at: string; author?: string }): PrUpdateDraft[] {
  const added = commits.map(toPrCommit)
  return [
    {
      id: 'opened',
      kind: 'opened',
      createdAt: opened.at,
      ...(opened.author ? { pusher: opened.author } : {}),
      ...(added.length ? { headSha: added[added.length - 1].sha } : {}),
      added
    }
  ]
}
