import type { PrCheck } from '../../../shared/types'
import type { TranslationKey } from '../i18n'
import { ansiToSpans, type AnsiSpan } from './ansi'
import { checkCounts, checkState, type CheckState } from './prSummary'
import { getPlainLogLines, isFailureLine } from './testFailures'

// The Checks tab's wording and arithmetic, kept out of the component: what the
// banner says, how long each check took, the log split into numbered lines.
// Text comes back as `{ key, vars }` so it follows a language switch.

export interface Phrase {
  key: TranslationKey
  vars: Record<string, string>
}

/** How long a finished check ran, or null when the host gave no times. */
export function getCheckDurationMs(c: Pick<PrCheck, 'status' | 'startedAt' | 'finishedAt'>): number | null {
  if (c.status !== 'completed' || !c.startedAt || !c.finishedAt) return null
  return Math.max(0, c.finishedAt - c.startedAt)
}

/** `36 s`, `1 min 12 s`, `2 h 5 min` — the mockup's words, not the CI page's `1:12`. */
export function formatCheckDuration(ms: number): Phrase {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return { key: 'prChecks.durationHours', vars: { h: String(h), m: String(m) } }
  if (m > 0) return { key: 'prChecks.durationMinutes', vars: { m: String(m), s: String(s) } }
  return { key: 'prChecks.durationSeconds', vars: { s: String(s) } }
}

export interface ChecksSummary {
  state: CheckState
  /** The headline: "1 of 2 checks failed" and its variants. */
  headline: Phrase
  /** The commit, shortened; null when the host did not say. */
  shortSha: string | null
  /** When the last check finished — only once none is still running. */
  finishedAt: number | null
  /** The checks' run times added up; null when none has times. */
  totalMs: number | null
  failed: number
}

export function getChecksSummary(checks: readonly PrCheck[]): ChecksSummary {
  const counts = checkCounts([...checks])
  const total = String(checks.length)
  const state: CheckState = counts.fail > 0 ? 'fail' : counts.pending > 0 ? 'pending' : counts.pass > 0 ? 'pass' : 'neutral'
  const headline: Phrase =
    state === 'fail'
      ? { key: 'prChecks.summaryFailed', vars: { failed: String(counts.fail), total } }
      : state === 'pending'
        ? { key: 'prChecks.summaryRunning', vars: { running: String(counts.pending), total } }
        : { key: 'prChecks.summaryPassed', vars: { passed: String(counts.pass), total } }
  const sha = checks.find((c) => c.sha)?.sha ?? null
  const finished = checks.map((c) => c.finishedAt ?? 0)
  const durations = checks.map(getCheckDurationMs).filter((d): d is number => d !== null)
  return {
    state,
    headline,
    shortSha: sha ? sha.slice(0, 7) : null,
    finishedAt: counts.pending === 0 && finished.some((f) => f > 0) ? Math.max(...finished) : null,
    totalMs: durations.length ? durations.reduce((a, b) => a + b, 0) : null,
    failed: counts.fail
  }
}

/** The words after a check's name: "failed in 1 min 12 s", or its state alone without times. */
export function getCheckStatePhrase(c: PrCheck): { key: TranslationKey; duration: Phrase | null } {
  const state = checkState(c)
  const ms = getCheckDurationMs(c)
  const duration = ms === null ? null : formatCheckDuration(ms)
  if (state === 'pending') return { key: c.status === 'queued' ? 'ciRuns.stateQueued' : 'ciRuns.stateRunning', duration: null }
  if (state === 'pass') return { key: duration ? 'prChecks.passedIn' : 'ciRuns.stateSuccess', duration }
  if (state === 'fail') return { key: duration ? 'prChecks.failedIn' : 'ciRuns.stateFailure', duration }
  if (c.conclusion === 'cancelled') return { key: 'ciRuns.stateCancelled', duration: null }
  if (c.conclusion === 'skipped') return { key: 'ciRuns.stateSkipped', duration: null }
  return { key: 'prChecks.neutral', duration: null }
}

const STATE_ORDER: Record<CheckState, number> = { fail: 0, pending: 1, neutral: 2, pass: 3 }

/** Failures first — what the tab is opened for — then running, then the rest; the host's order within each. */
export function sortChecksByState(checks: readonly PrCheck[]): PrCheck[] {
  return checks
    .map((c, i) => ({ c, i }))
    .sort((a, b) => STATE_ORDER[checkState(a.c)] - STATE_ORDER[checkState(b.c)] || a.i - b.i)
    .map((x) => x.c)
}

/** The runs whose failed jobs "Re-run failed" starts again: one per run, however many of its jobs failed. */
export function getRerunnableRuns(checks: readonly PrCheck[]): string[] {
  const ids = checks.filter((c) => checkState(c) === 'fail' && c.runId).map((c) => c.runId as string)
  return [...new Set(ids)]
}

/** How a log line reads apart from its own colours: a passed test, an error, the step's command. */
export type LogLineTone = 'ok' | 'err' | 'cmd' | null

export interface LogLine {
  /** 1-based, counted from the log's real start: lines cut off the top still count. */
  n: number
  spans: AnsiSpan[]
  failure: boolean
  tone: LogLineTone
}

/**
 * The tone of one plain log line. A runner colours only the tick of a passed test and prints the
 * job's closing error in a dark red; whole-line tones make the log scan the way the summary does.
 */
export function getLogLineTone(plain: string): LogLineTone {
  if (/^\s*[✓✔√]\s/.test(plain)) return 'ok'
  if (/^\s*(?:Error:|##\[error\])/.test(plain)) return 'err'
  // GitHub Actions opens a step with `Run <command>`; Azure Pipelines marks it `##[command]`.
  if (/^(?:Run\s|##\[command\])/.test(plain)) return 'cmd'
  return null
}

/**
 * The log as numbered lines with their colours. The colour state carries
 * across lines, so the text is parsed whole and then cut at each newline.
 * `firstLine` is the number of the first line given (after a trimmed top).
 */
export function getLogLines(text: string, firstLine = 1): LogLine[] {
  const plain = getPlainLogLines(text)
  const lines: AnsiSpan[][] = [[]]
  for (const span of ansiToSpans(text)) {
    const parts = span.text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ text: part, style: span.style })
    })
  }
  // A log ends with a newline: no empty last line for it.
  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()
  return lines.map((spans, i) => {
    const line = plain[i] ?? ''
    return { n: firstLine + i, spans, failure: isFailureLine(line), tone: getLogLineTone(line) }
  })
}

/** The log as text to paste: no colour codes. */
export function getPlainLog(text: string): string {
  return getPlainLogLines(text).join('\n')
}
