import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, CircleCheck, CircleX, Loader2, Minus, X } from 'lucide-react'
import type { PrCheck } from '../../../shared/types'
import { hostingApi, shellApi } from '../infrastructure/api'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { interp, useT } from '../i18n'
import { checkState, type CheckState } from '../lib/prSummary'
import { logTail } from '../lib/ciLog'
import { timeAgo } from '../lib/timeAgo'
import { openInEditor } from '../lib/editorOpen'
import { getFailedTests, getRepoRelativePath, type FailedTest } from '../lib/testFailures'
import {
  formatCheckDuration,
  getCheckStatePhrase,
  getChecksSummary,
  getLogLines,
  getPlainLog,
  getRerunnableRuns,
  sortChecksByState,
  type Phrase
} from '../lib/prChecksView'

type Tokens = { github?: string; gitlab?: string; forgejo?: string; azure?: string }

/** A log as read: undefined while it loads, null when the host would not hand it over. */
type LogState = string | null | undefined

/**
 * The pull request's Checks tab: a banner that says how the head commit's CI
 * went, then one card per check. A failed check opens with the tests its log
 * names and the log itself; a passed one stays a single line until asked.
 */
export function PrChecksSection({
  checks,
  repoPath,
  remoteUrl,
  tokens,
  prFiles,
  onShowFile,
  onReloadChecks
}: {
  checks: PrCheck[]
  repoPath: string
  remoteUrl: string
  tokens: Tokens
  /** The PR's changed files, for "View in the PR diff"; null while they load. */
  prFiles: readonly string[] | null
  onShowFile: (file: string) => void
  onReloadChecks: () => Promise<void>
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const summary = useMemo(() => getChecksSummary(checks), [checks])
  const reruns = useMemo(() => getRerunnableRuns(checks), [checks])
  const ordered = useMemo(() => sortChecksByState(checks), [checks])
  const [rerunning, setRerunning] = useState(false)
  // Logs by check link, kept while the tab is open: folding a card does not read it again.
  const [logs, setLogs] = useState<Record<string, LogState>>({})
  const [now] = useState(() => Date.now())

  const readLog = (url: string): void => {
    if (url in logs) return
    setLogs((m) => ({ ...m, [url]: undefined }))
    hostingApi
      .prCheckLog(repoPath, remoteUrl, tokens, url)
      .then((text) => setLogs((m) => ({ ...m, [url]: text })))
      .catch(() => setLogs((m) => ({ ...m, [url]: null })))
  }

  const rerunFailed = async (): Promise<void> => {
    setRerunning(true)
    try {
      for (const runId of reruns) await hostingApi.ciRunAction(repoPath, remoteUrl, tokens, runId, 'rerun-failed')
      toast('success', t('ciRuns.rerunStarted'))
      await onReloadChecks()
    } catch (err) {
      toast('error', interp(t('ciRuns.actionFailed'), { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setRerunning(false)
    }
  }

  const say = (p: Phrase): string => interp(t(p.key), p.vars)
  const ago = timeAgo(summary.finishedAt, now)
  const meta = [
    summary.shortSha ? interp(t('prChecks.onCommit'), { sha: summary.shortSha }) : null,
    ago ? interp(t('prChecks.finished'), { ago: interp(t(ago.key), { n: String(ago.n) }) }) : null,
    summary.totalMs !== null ? interp(t('prChecks.totalTime'), { duration: say(formatCheckDuration(summary.totalMs)) }) : null
  ].filter(Boolean)

  return (
    <div className="prc">
      <div className={`prc-banner ${summary.state}`} role="status">
        <StateIcon state={summary.state} size={20} circle />
        <span className="prc-banner-text">
          <b>{say(summary.headline)}</b>
          {meta.length > 0 && <span className="prc-banner-meta">{meta.join(' · ')}</span>}
        </span>
        <span className="prc-spacer" />
        {reruns.length > 0 && (
          <button className="prc-btn" title={t('ciRuns.rerunFailed')} disabled={rerunning} onClick={() => void rerunFailed()}>
            {rerunning && <Loader2 size={12} className="spin" />} {t('prChecks.rerunFailed')}
          </button>
        )}
        <button
          className="prc-btn"
          onClick={() => useSettingsStore.getState().openPageTab({ type: 'ci-runs', repoPath })}
        >
          {t('prChecks.openCiRuns')}
        </button>
      </div>

      {ordered.map((c, i) => (
        <CheckCard
          key={`${c.url}\u0000${c.name}\u0000${i}`}
          check={c}
          log={c.url in logs ? logs[c.url] : undefined}
          logRead={c.url in logs}
          onReadLog={() => readLog(c.url)}
          repoPath={repoPath}
          prFiles={prFiles}
          onShowFile={onShowFile}
        />
      ))}
    </div>
  )
}

function StateIcon({ state, size, circle }: { state: CheckState; size: number; circle?: boolean }): React.JSX.Element {
  const cls = `prc-icon ${state}`
  if (state === 'pending') return <Loader2 size={size} className={`${cls} spin`} aria-hidden="true" />
  if (circle) {
    if (state === 'fail') return <CircleX size={size} className={cls} aria-hidden="true" />
    if (state === 'pass') return <CircleCheck size={size} className={cls} aria-hidden="true" />
  }
  if (state === 'fail') return <X size={size} strokeWidth={2.4} className={cls} aria-hidden="true" />
  if (state === 'pass') return <Check size={size} strokeWidth={2.4} className={cls} aria-hidden="true" />
  return <Minus size={size} className={cls} aria-hidden="true" />
}

function CheckCard({
  check,
  log,
  logRead,
  onReadLog,
  repoPath,
  prFiles,
  onShowFile
}: {
  check: PrCheck
  log: LogState
  logRead: boolean
  onReadLog: () => void
  repoPath: string
  prFiles: readonly string[] | null
  onShowFile: (file: string) => void
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const state = checkState(check)
  // A failure is what someone opens this tab for: it starts open, the rest folded.
  const [open, setOpen] = useState(state === 'fail')
  const canLog = !!check.hasLog
  useEffect(() => {
    if (open && canLog && !logRead) onReadLog()
  }, [open, canLog, logRead, onReadLog])

  const phrase = getCheckStatePhrase(check)
  const stateText = phrase.duration
    ? interp(t(phrase.key), { duration: interp(t(phrase.duration.key), phrase.duration.vars) })
    : t(phrase.key)
  const failures = useMemo(() => (log && state === 'fail' ? getFailedTests(log) : []), [log, state])
  const expanded = open && canLog

  const copyLog = (): void => {
    if (!log) return
    void navigator.clipboard.writeText(getPlainLog(log)).then(() => toast('success', t('prChecks.logCopied')))
  }

  return (
    <section className={`prc-card ${state} ${expanded ? 'open' : ''}`}>
      <header className="prc-card-head">
        <StateIcon state={state} size={14} />
        <b className="prc-card-name">{check.name}</b>
        <span className="prc-card-state">{stateText}</span>
        <span className="prc-spacer" />
        {state === 'fail' && canLog && (
          <button className="prc-link" disabled={!log} onClick={copyLog}>
            {t('prChecks.copyLog')}
          </button>
        )}
        {state !== 'fail' && canLog && (
          <button className="prc-link" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? t('prPage.hideLog') : t('prChecks.viewLog')}
          </button>
        )}
        {check.url && (state === 'fail' || !canLog) && (
          <button className="prc-link" onClick={() => void shellApi.openExternal(check.url)}>
            {t('prChecks.viewOnHost')} <ArrowRight size={11} />
          </button>
        )}
      </header>

      {expanded && log === undefined && (
        <div className="prc-pad prp-muted">
          <Loader2 size={13} className="spin" /> {t('prDetail.loading')}
        </div>
      )}
      {expanded && log === null && (
        <div className="prc-pad prp-muted">
          {t('prPage.logUnavailable')}{' '}
          {check.url && (
            <button className="prp-link" onClick={() => void shellApi.openExternal(check.url)}>
              {t('common.openInBrowser')}
            </button>
          )}
        </div>
      )}
      {expanded && log && (
        <>
          {failures.length > 0 && (
            <FailedTests failures={failures} repoPath={repoPath} prFiles={prFiles} onShowFile={onShowFile} />
          )}
          <CheckLog text={log} defaultOpen />
        </>
      )}
    </section>
  )
}

function FailedTests({
  failures,
  repoPath,
  prFiles,
  onShowFile
}: {
  failures: FailedTest[]
  repoPath: string
  prFiles: readonly string[] | null
  onShowFile: (file: string) => void
}): React.JSX.Element {
  const t = useT()
  const editor = useSettingsStore((s) => s.settings.editor)

  const openFile = (file: string, line: number | null): void => {
    const path = `${repoPath.replace(/\/+$/, '')}/${file}`
    if (editor?.command) void openInEditor(editor, { path, line: line ?? undefined, repo: repoPath })
    else
      void shellApi.openPath(path).then((err: string) => {
        if (err) useUIStore.getState().toast('error', err)
      })
  }

  return (
    <div className="prc-failures">
      <span className="prc-failures-count">
        {failures.length === 1 ? t('prChecks.testFailedOne') : interp(t('prChecks.testsFailed'), { count: String(failures.length) })}
      </span>
      {failures.map((f, i) => {
        // Only a path that lands inside this repository can be opened or found in the diff.
        const file = f.file ? getRepoRelativePath(f.file, prFiles ?? []) : null
        const where = f.file ? (f.line ? `${file ?? f.file}:${f.line}` : (file ?? f.file)) : null
        return (
          <div key={i} className="prc-failure">
            <b className="prc-failure-name">{f.name}</b>
            {f.error && <code className="prc-failure-error">{f.error}</code>}
            {where && (
              <span className="prc-failure-actions">
                {file ? (
                  <button
                    className="prc-chip"
                    title={interp(t('prChecks.openAtLine'), { path: file, line: String(f.line ?? 1) })}
                    onClick={() => openFile(file, f.line)}
                  >
                    {where}
                  </button>
                ) : (
                  <code className="prc-chip">{where}</code>
                )}
                {file && (
                  <button className="prc-link" onClick={() => openFile(file, f.line)}>
                    {t('prChecks.openInEditor')}
                  </button>
                )}
                {file && prFiles?.includes(file) && (
                  <button className="prc-link" onClick={() => onShowFile(file)}>
                    {t('prChecks.viewInDiff')}
                  </button>
                )}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The whole log, folded under a summary line: numbered, coloured, failures marked. */
function CheckLog({ text, defaultOpen }: { text: string; defaultOpen: boolean }): React.JSX.Element {
  const t = useT()
  const lines = useMemo(() => {
    const tail = logTail(text)
    return { list: getLogLines(tail.text, tail.dropped + 1), dropped: tail.dropped }
  }, [text])
  const total = lines.dropped + lines.list.length
  const width = String(total).length
  return (
    <details className="prc-log" open={defaultOpen}>
      <summary>{interp(t('prChecks.fullLog'), { count: String(total) })}</summary>
      {lines.dropped > 0 && (
        <div className="prp-muted prc-log-note">{interp(t('prPage.logTrimmed'), { count: String(lines.dropped) })}</div>
      )}
      <pre>
        {lines.list.map((l) => (
          <span key={l.n} className={`prc-log-line ${l.failure ? 'fail' : ''}`}>
            <span className="prc-log-n" style={{ minWidth: `${width}ch` }}>
              {l.n}
            </span>
            <span className="prc-log-text">
              {l.spans.map((s, i) => (
                <span key={i} style={s.style}>
                  {s.text}
                </span>
              ))}
            </span>
          </span>
        ))}
      </pre>
    </details>
  )
}
