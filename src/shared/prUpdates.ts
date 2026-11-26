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
 * stays 140 when the oldest ones are dropped. `startCut`: the host's record
 * was read from its newest end and stopped short of the opening — the first
 * listed is no opening, and the tab counts back from the latest instead.
 */
export function finishPrUpdates(
  drafts: readonly PrUpdateDraft[],
  startCut = false
): { updates: PrUpdate[]; truncated: boolean; startCut: boolean } {
  const all = drafts.map((d, i): PrUpdate => {
    const previous = i > 0 ? drafts[i - 1].headSha : undefined
    const fromSha = d.fromSha ?? previous
    return {
      ...d,
      ...(startCut && d.kind === 'opened' ? { kind: 'push' as const } : {}),
      index: i + 1,
      added: d.added,
      removed: d.removed ?? [],
      ...(fromSha ? { fromSha } : {})
    }
  })
  const capped = all.length > PR_UPDATES_MAX
  return { updates: capped ? all.slice(all.length - PR_UPDATES_MAX) : all, truncated: capped || startCut, startCut }
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
 * The longest pause between two commits of one inferred push. Commits a push
 * carries are usually made minutes apart; a longer silence is read as the
 * work of a later push.
 */
export const GITHUB_PUSH_WINDOW_MS = 10 * 60 * 1000

/** Whether more than the push window separates two ISO dates (unreadable: no). */
function isPastWindow(at: string, since: string): boolean {
  const a = Date.parse(at)
  const b = Date.parse(since)
  return !Number.isNaN(a) && !Number.isNaN(b) && a - b > GITHUB_PUSH_WINDOW_MS
}

/**
 * GitHub keeps no record of a plain push — only of a force push — so updates
 * are inferred from commit times. An update is a run of commits that chain by
 * parent (each on the one before it), between force pushes; a commit that
 * does not chain on, or comes more than GITHUB_PUSH_WINDOW_MS after the one
 * before it, starts the next. Commits committed after the pull request was
 * opened, or after a force push, cannot have been in it. So one push may come
 * out split in two, or two quick pushes as one; the tab says the grouping is
 * approximate. A rebase's new commits listed just before its force push are
 * moved into it rather than shown twice.
 */
export function groupGithubTimeline(
  items: readonly GithubTimelineItem[],
  opened: { at: string; author?: string },
  startCut = false
): PrUpdateDraft[] {
  type Open = { draft: PrUpdateDraft; raws: RawPrCommit[]; lastAt: string }
  const groups: Open[] = []
  const start = (kind: PrUpdateKind, at: string, extra: Partial<PrUpdateDraft> = {}): Open => {
    const g: Open = { draft: { id: '', kind, createdAt: at, added: [], ...extra }, raws: [], lastAt: at }
    groups.push(g)
    return g
  }
  // Read from the newest end and cut short: the first items are some push's, not the opening's.
  let current = startCut ? start('push', '') : start('opened', opened.at, opened.author ? { pusher: opened.author } : {})
  for (const item of items) {
    if (item.type === 'forcePush') {
      current = start('rewrite', item.at, {
        ...(item.actor ? { pusher: item.actor } : {}),
        ...(item.afterSha ? { headSha: item.afterSha } : {}),
        ...(item.beforeSha ? { fromSha: item.beforeSha } : {})
      })
      continue
    }
    const last = current.raws[current.raws.length - 1]
    // Parents unknown: nothing says the chain breaks.
    const chained = !last || !item.commit.parentShas?.length || item.commit.parentShas.includes(last.sha)
    // An opening or a force push holds only what was committed by then.
    const afterStart = current.draft.kind !== 'push' && isLater(item.committedAt, current.draft.createdAt)
    const pause = !!last && isPastWindow(item.committedAt, current.lastAt)
    if (afterStart || !chained || pause) current = start('push', item.committedAt)
    current.raws.push(item.commit)
    current.lastAt = item.committedAt
    // A push happens after its last commit.
    if (current.draft.kind === 'push') current.draft.createdAt = item.committedAt
  }
  // A rebase whose new commits the timeline lists before its force push: they
  // are the force push's, not a push of their own.
  for (let i = groups.length - 2; i >= 0; i--) {
    const g = groups[i]
    const next = groups[i + 1]
    const head = g.raws[g.raws.length - 1]?.sha
    if (g.draft.kind === 'push' && next.draft.kind === 'rewrite' && head && head === next.draft.headSha) {
      next.raws = [...g.raws, ...next.raws]
      groups.splice(i, 1)
    }
  }
  // A cut-short start leaves an empty group before a first force push: nothing to show.
  if (startCut && groups[0] && !groups[0].raws.length && !groups[0].draft.headSha) groups.shift()
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
  /** Oldest first, as the server writes them. */
  commitIds: string[]
}

/**
 * How close to the pull request's creation its first push comment can be and
 * still be the opening's: the server writes it while creating the pull request.
 */
export const FORGEJO_OPENING_PUSH_MS = 10_000

function isWithin(at: string, of: string, ms: number): boolean {
  const a = Date.parse(at)
  const b = Date.parse(of)
  return !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) <= ms
}

/**
 * Forgejo records each push to a pull request as a comment naming the commits
 * it added, oldest first — or, for a force push, the old and the new head.
 * Creating the pull request writes one too, with its first commits: that one
 * is the opening. On a server that did not, the opening is what no later push
 * named — unless a force push since rewrote the branch, when nothing can say
 * what the opening held and it is left empty. A force push lists no commits.
 * `startCut`: the oldest comments were not read, so there is no opening.
 */
export function groupForgejoPushes(
  pushes: readonly ForgejoPush[],
  opened: { at: string; author?: string },
  commits: readonly RawPrCommit[],
  startCut = false
): PrUpdateDraft[] {
  const bySha = new Map(commits.map((c) => [c.sha, c]))
  const commitOf = (sha: string): PrCommit => {
    const raw = bySha.get(sha)
    return raw ? toPrCommit(raw) : shaOnlyCommit(sha)
  }
  let later = pushes
  let initial: PrCommit[] | null = null
  if (!startCut && later[0] && !later[0].force && isWithin(later[0].at, opened.at, FORGEJO_OPENING_PUSH_MS)) {
    initial = later[0].commitIds.map(commitOf)
    later = later.slice(1)
  }
  const drafts: PrUpdateDraft[] = []
  if (!startCut) {
    if (!initial) {
      const pushed = new Set(later.filter((p) => !p.force).flatMap((p) => p.commitIds))
      // The PR's own list is oldest first (the caller ordered it).
      initial = later.some((p) => p.force) ? [] : commits.filter((c) => !pushed.has(c.sha)).map(toPrCommit)
    }
    drafts.push({
      id: 'opened',
      kind: 'opened',
      createdAt: opened.at,
      ...(opened.author ? { pusher: opened.author } : {}),
      ...(initial.length ? { headSha: initial[initial.length - 1].sha } : {}),
      added: initial
    })
  }
  for (const p of later) {
    if (p.force) {
      const [before, after] = p.commitIds
      drafts.push({
        id: p.id,
        kind: 'rewrite',
        createdAt: p.at,
        ...(p.pusher ? { pusher: p.pusher } : {}),
        ...(after ? { headSha: after } : {}),
        ...(before ? { fromSha: before } : {}),
        added: []
      })
      continue
    }
    const added = p.commitIds.map(commitOf)
    drafts.push({
      id: p.id,
      kind: 'push',
      createdAt: p.at,
      ...(p.pusher ? { pusher: p.pusher } : {}),
      ...(added.length ? { headSha: added[added.length - 1].sha } : {}),
      added
    })
  }
  return drafts
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
