import type { BranchPushResult, BranchPushState, BranchPushStateKind } from '../../../shared/types'
import { duplicateDestinations, type PushTarget } from '../../../shared/pushPorcelain'

/** Where a row would land and how it stands there. */
export interface PushDestination {
  remoteBranch: string
  remoteExists: boolean
  ahead: number
  behind: number
  state: BranchPushStateKind
}

/**
 * The destination a row is pushed to: its own name, or — only when the user
 * chose it for that row — its differently named upstream.
 */
export function pushDestinationOf(state: BranchPushState, toUpstream = false): PushDestination {
  const up = toUpstream ? state.upstreamTarget : null
  return up ?? state
}

/**
 * Behind and diverged branches cannot go out without a force, and a force push
 * stays a one-branch-at-a-time decision — so they are shown, but never ticked.
 * Judged against the destination actually chosen for the row.
 */
export function canBatchPush(state: BranchPushState, toUpstream = false): boolean {
  const kind = pushDestinationOf(state, toUpstream).state
  return kind === 'ahead' || kind === 'new' || kind === 'upToDate'
}

/**
 * The ticks the dialog opens with. With `preselect` (the sidebar's selection),
 * exactly those that can be pushed; otherwise everything with something to
 * publish — ahead, or not on the remote yet. Never a branch that tracks a
 * branch of another name: that is usually `checkout -b x origin/main`, and
 * whether it should go out at all is the user's call.
 */
export function initialPushSelection(states: BranchPushState[], preselect?: string[]): string[] {
  const candidates = states.filter((s) => !s.upstreamTarget)
  if (preselect?.length) {
    const wanted = new Set(preselect)
    return candidates.filter((s) => wanted.has(s.name) && canBatchPush(s)).map((s) => s.name)
  }
  return candidates.filter((s) => s.state === 'ahead' || s.state === 'new').map((s) => s.name)
}

/** Branch states as loaded, tagged with the remote they were read against. */
export interface LoadedPushStates {
  remote: string
  states: BranchPushState[]
}

/**
 * The ticks to seed, or null to leave the selection alone. Seeds once per
 * remote, and only from states read against *that* remote: right after a
 * switch, the previous remote's states are still in hand for a render, and
 * seeding from them would mark the new remote as done with the wrong ticks.
 */
export function seedPushSelection(
  loaded: LoadedPushStates | null,
  remote: string,
  seededFor: string | null,
  preselect?: string[]
): string[] | null {
  if (!loaded || loaded.remote !== remote || seededFor === remote) return null
  return initialPushSelection(loaded.states, preselect)
}

/** The ticked, pushable rows as push targets, each at the destination chosen for it. */
export function chosenPushTargets(
  states: BranchPushState[],
  selected: ReadonlySet<string>,
  toUpstream: ReadonlySet<string>
): PushTarget[] {
  return states
    .filter((s) => selected.has(s.name) && canBatchPush(s, toUpstream.has(s.name)))
    .map((s) => ({ branch: s.name, remoteBranch: pushDestinationOf(s, toUpstream.has(s.name)).remoteBranch }))
}

/** Two or more ticked branches that would update the same remote branch. */
export function pushDestinationClashes(targets: PushTarget[]): { remoteBranch: string; branches: string[] }[] {
  return duplicateDestinations(targets)
}

export interface UpstreamRedirect {
  branch: string
  remoteBranch: string
  /** A protected branch, or the remote's default branch. */
  sensitive: boolean
}

/**
 * What a push to differently named branches needs before it runs: nothing,
 * a confirmation listing each remote branch it updates, or that confirmation
 * with the stronger warning when one of them is protected or the default.
 */
export function upstreamPushDecision(
  states: BranchPushState[],
  targets: PushTarget[],
  isProtected: (remoteBranch: string) => boolean
): { kind: 'none' | 'confirm' | 'confirmSensitive'; redirects: UpstreamRedirect[] } {
  const by = new Map(states.map((s) => [s.name, s]))
  const redirects = targets
    .filter((t) => t.remoteBranch !== t.branch)
    .map((t) => ({
      branch: t.branch,
      remoteBranch: t.remoteBranch,
      sensitive: isProtected(t.remoteBranch) || !!by.get(t.branch)?.upstreamTarget?.isRemoteDefault
    }))
  if (!redirects.length) return { kind: 'none', redirects }
  return { kind: redirects.some((r) => r.sensitive) ? 'confirmSensitive' : 'confirm', redirects }
}

/** Case-insensitive substring filter over branch names; the current branch first. */
export function filterPushStates(states: BranchPushState[], query: string): BranchPushState[] {
  const q = query.trim().toLowerCase()
  const shown = q ? states.filter((s) => s.name.toLowerCase().includes(q)) : states
  return [...shown].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
}

export interface SecretFlag {
  branch: string
  files: string[]
}

/**
 * The pre-push secret guard, applied to each branch on its own. A branch whose
 * outgoing commits touch a credential-looking file is held back from the batch
 * — the rest go. A flagged branch can still be pushed alone, where the single
 * push's confirmation asks about exactly those files.
 */
export function partitionBySecrets(
  branches: string[],
  filesByBranch: Record<string, string[]>,
  isSecret: (path: string) => boolean
): { clean: string[]; flagged: SecretFlag[] } {
  const clean: string[] = []
  const flagged: SecretFlag[] = []
  for (const branch of branches) {
    const files = (filesByBranch[branch] ?? []).filter(isSecret)
    if (files.length) flagged.push({ branch, files })
    else clean.push(branch)
  }
  return { clean, flagged }
}

/** The remote the dialog starts on: the current branch's upstream remote, else origin, else the first. */
export function defaultPushRemote(remotes: string[], currentUpstream: string | null | undefined): string {
  const up = currentUpstream?.split('/')[0]
  if (up && remotes.includes(up)) return up
  if (remotes.includes('origin')) return 'origin'
  return remotes[0] ?? ''
}

/** Counts for the summary toast: what went out, what git refused, what never left. */
export function tallyPushResults(results: BranchPushResult[]): { ok: number; rejected: number; notAttempted: number } {
  let ok = 0
  let rejected = 0
  let notAttempted = 0
  for (const r of results) {
    if (r.status === 'rejected') rejected++
    else if (r.status === 'notAttempted') notAttempted++
    else ok++
  }
  return { ok, rejected, notAttempted }
}
