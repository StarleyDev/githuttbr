import type { BranchPushRejection, BranchPushResult, BranchPushStateKind, BranchPushStatus } from './types'

/** One local branch and the remote branch it is pushed to. */
export interface PushTarget {
  branch: string
  remoteBranch: string
}

/**
 * The refspecs for a multi-branch push: `refs/heads/<b>:refs/heads/<dest>`.
 * Full ref names on both sides, so a branch called like a tag cannot resolve to
 * the tag, and never a leading `+` — this push is not allowed to force.
 */
export function pushRefspecs(targets: PushTarget[]): string[] {
  return targets.map((t) => `refs/heads/${t.branch}:refs/heads/${t.remoteBranch}`)
}

export interface PorcelainRef {
  flag: string
  from: string
  to: string
  /** The bracketed summary or the `old..new` range, without the reason. */
  summary: string
  /** The parenthesised reason git appends to a rejection, if any. */
  reason: string
}

/**
 * Decoder for `git push --porcelain`, which prints, after a `To <url>` line,
 * one tab-separated line per ref:
 *
 *     <flag> \t <from>:<to> \t <summary> [(<reason>)]
 *
 * The flag is a space for a fast-forward, `*` for a new ref, `=` for up to
 * date, `!` for a rejection, `+` forced and `-` deleted. Anything else on
 * stdout (`To …`, `Done`) is ignored, so it is safe to feed the whole stream.
 */
export function parsePushPorcelain(out: string): PorcelainRef[] {
  const refs: PorcelainRef[] = []
  for (const line of out.split('\n')) {
    const parts = line.replace(/\r$/, '').split('\t')
    if (parts.length < 3 || parts[0].length !== 1 || !' *=!+-'.includes(parts[0])) continue
    const colon = parts[1].indexOf(':')
    if (colon < 0) continue
    const rest = parts.slice(2).join('\t').trim()
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(rest)
    refs.push({
      flag: parts[0],
      from: parts[1].slice(0, colon),
      to: parts[1].slice(colon + 1),
      summary: m ? m[1] : rest,
      reason: m ? m[2] : ''
    })
  }
  return refs
}

const STATUS_BY_FLAG: Record<string, BranchPushStatus> = {
  ' ': 'pushed',
  '+': 'pushed',
  '*': 'created',
  '=': 'upToDate',
  '!': 'rejected'
}

function rejectionOf(ref: PorcelainRef): BranchPushRejection {
  if (/atomic/i.test(ref.reason)) return 'atomic'
  if (/remote rejected/i.test(ref.summary)) return 'remoteRejected'
  if (/non-fast-forward/i.test(ref.reason)) return 'nonFastForward'
  if (/fetch first/i.test(ref.reason)) return 'fetchFirst'
  return 'other'
}

/**
 * Line the porcelain refs up with what was asked for. A target git said
 * nothing about — it stopped early, or a hook refused the push wholesale — is
 * `notAttempted`, never assumed to have gone through.
 */
export function pushResultsFrom(targets: PushTarget[], refs: PorcelainRef[]): BranchPushResult[] {
  return targets.map((target) => {
    const ref = refs.find((r) => r.from === `refs/heads/${target.branch}` || r.from === target.branch)
    if (!ref) {
      return { ...target, status: 'notAttempted', reason: '', upstreamSet: false }
    }
    const status = STATUS_BY_FLAG[ref.flag] ?? 'rejected'
    const reason = ref.reason || ref.summary.replace(/^\[|\]$/g, '')
    return status === 'rejected'
      ? { ...target, status, rejection: rejectionOf(ref), reason, upstreamSet: false }
      : { ...target, status, reason, upstreamSet: false }
  })
}

/** The `remote:` lines out of push stderr — where a server explains itself. */
export function remoteMessages(stderr: string): string[] {
  return stderr
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.startsWith('remote:'))
    .map((l) => l.slice('remote:'.length).trim())
    .filter(Boolean)
}

/** Ahead/behind out of `%(upstream:track)` — `[ahead 2, behind 1]`, `[gone]`, or ''. */
export function parseUpstreamTrack(track: string): { ahead: number; behind: number; gone: boolean } {
  const ahead = /ahead (\d+)/.exec(track)
  const behind = /behind (\d+)/.exec(track)
  return { ahead: ahead ? +ahead[1] : 0, behind: behind ? +behind[1] : 0, gone: /\bgone\b/.test(track) }
}

/**
 * What a non-forced push would do with a branch. Behind and diverged are the
 * two the remote will refuse: either way it holds commits this branch lacks.
 */
export function classifyPushState(ahead: number, behind: number, remoteExists: boolean): BranchPushStateKind {
  if (!remoteExists) return 'new'
  if (behind > 0) return ahead > 0 ? 'diverged' : 'behind'
  return ahead > 0 ? 'ahead' : 'upToDate'
}
