import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  GitBranch,
  Globe,
  Loader2,
  Lock,
  Search,
  ShieldAlert,
  X
} from 'lucide-react'
import { useUIStore } from '../stores/ui'
import { useRepoStore, repoActions, type PushBranchesOutcome } from '../stores/repo'
import { gitApi } from '../infrastructure/api'
import { isProtectedBranch } from '../lib/repoConfig'
import {
  canBatchPush,
  chosenPushTargets,
  defaultPushRemote,
  filterPushStates,
  pushDestinationClashes,
  pushDestinationOf,
  seedPushSelection,
  upstreamPushDecision,
  type LoadedPushStates
} from '../lib/pushBranches'
import { useT, interp, type TranslationKey } from '../i18n'
import type { BranchPushRejection, BranchPushResult, BranchPushState } from '../../../shared/types'

const STATUS_KEY: Record<BranchPushResult['status'], TranslationKey> = {
  pushed: 'pushBranches.resPushed',
  created: 'pushBranches.resCreated',
  upToDate: 'pushBranches.resUpToDate',
  rejected: 'pushBranches.resRejected',
  notAttempted: 'pushBranches.resNotAttempted'
}

const REJECTION_KEY: Record<BranchPushRejection, TranslationKey> = {
  nonFastForward: 'pushBranches.rejNonFastForward',
  fetchFirst: 'pushBranches.rejFetchFirst',
  atomic: 'pushBranches.rejAtomic',
  remoteRejected: 'pushBranches.rejRemote',
  other: 'pushBranches.rejOther'
}

/**
 * "Push branches…": tick the local branches to publish and send them to one
 * remote in a single `git push`. For the many-branches-in-flight workflow —
 * several agents or people each on a branch — where checking out each one to
 * press Push is the whole cost. Nothing is checked out, nothing is forced.
 */
export function PushBranchesModal({
  repoPath,
  preselect
}: {
  repoPath: string
  preselect?: string[]
}): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const openContextMenu = useUIStore((s) => s.openContextMenu)
  const repo = useRepoStore((s) => s.repos[repoPath])
  const remotes = useMemo(() => (repo?.remotes ?? []).map((r) => r.name), [repo?.remotes])
  const currentUpstream = repo?.branches.locals.find((b) => b.isCurrent)?.upstream
  const repoConfig = repo?.config?.config ?? null

  const [remote, setRemote] = useState(() => defaultPushRemote(remotes, currentUpstream))
  // Kept with the remote they were read against, so a remote switch can never
  // seed ticks — or show badges — from the previous remote's states.
  const [loaded, setLoaded] = useState<LoadedPushStates | null>(null)
  const states = loaded?.remote === remote ? loaded.states : null
  const [loadError, setLoadError] = useState<string | null>(null)
  const [protectedNames, setProtectedNames] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Rows the user chose to push to their differently named upstream instead of their own name.
  const [toUpstream, setToUpstream] = useState<Set<string>>(new Set())
  const [clash, setClash] = useState<string | null>(null)
  const [atomic, setAtomic] = useState(false)
  const [setUpstream, setSetUpstream] = useState(true)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<PushBranchesOutcome | null>(null)
  // The ticks are seeded once per remote, then belong to the user. After a
  // push the sidebar's selection has served its purpose.
  const [seededFor, setSeededFor] = useState<string | null>(null)
  const [usePreselect, setUsePreselect] = useState(true)

  useEffect(() => {
    void gitApi.protectedBranches(repoPath).then(setProtectedNames, () => setProtectedNames([]))
  }, [repoPath])

  useEffect(() => {
    if (!remote) return
    let live = true
    setLoadError(null)
    gitApi.branchPushStates(repoPath, remote).then(
      (s) => live && setLoaded({ remote, states: s }),
      (err: unknown) => live && setLoadError(err instanceof Error ? err.message : String(err))
    )
    return () => {
      live = false
    }
  }, [repoPath, remote, outcome])

  useEffect(() => {
    const seed = seedPushSelection(loaded, remote, seededFor, usePreselect ? preselect : undefined)
    if (!seed) return
    setSelected(new Set(seed))
    setToUpstream(new Set())
    setClash(null)
    setSeededFor(remote)
  }, [loaded, remote, seededFor, preselect, usePreselect])

  const shown = useMemo(() => filterPushStates(states ?? [], query), [states, query])
  const pushableShown = shown.filter((s) => canBatchPush(s, toUpstream.has(s.name)))
  const allShownSelected = pushableShown.length > 0 && pushableShown.every((s) => selected.has(s.name))
  // Only branches still listed and still pushable count — a refresh can move one to diverged.
  const targets = chosenPushTargets(states ?? [], selected, toUpstream)
  const chosen = targets.map((tg) => tg.branch)
  const isProtectedDest = (branch: string): boolean => isProtectedBranch(branch, protectedNames, repoConfig)

  const toggle = (name: string): void => {
    setClash(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }
  // Choosing the upstream's name ticks the row too — that is why it was chosen.
  const toggleUpstream = (name: string): void => {
    setClash(null)
    const on = !toUpstream.has(name)
    setToUpstream((prev) => {
      const next = new Set(prev)
      if (on) next.add(name)
      else next.delete(name)
      return next
    })
    if (on) setSelected((prev) => new Set(prev).add(name))
  }
  // Any change to what is chosen can resolve a destination clash, so the old message goes with it.
  const toggleShown = (): void => {
    setClash(null)
    setSelected((prev) => {
      const next = new Set(prev)
      for (const s of pushableShown) {
        if (allShownSelected) next.delete(s.name)
        else next.add(s.name)
      }
      return next
    })
  }

  const submit = (redirectConfirmed = false): void => {
    if (!chosen.length || busy) return
    // Two branches onto one remote branch: git would refuse the whole push.
    const clashes = pushDestinationClashes(targets)
    if (clashes.length) {
      const c = clashes[0]
      setClash(interp(t('pushBranches.clash'), { branches: c.branches.join(', '), target: `${remote}/${c.remoteBranch}` }))
      return
    }
    const decision = upstreamPushDecision(states ?? [], targets, isProtectedDest)
    if (decision.kind !== 'none' && !redirectConfirmed) {
      const list = decision.redirects
        .map((r) => interp(t('pushBranches.redirectLine'), { branch: r.branch, target: `${remote}/${r.remoteBranch}` }))
        .join('\n')
      const sensitive = decision.redirects.filter((r) => r.sensitive).map((r) => `${remote}/${r.remoteBranch}`)
      useUIStore.getState().openModal({
        kind: 'confirm',
        danger: decision.kind === 'confirmSensitive',
        title: t('pushBranches.redirectTitle'),
        message:
          interp(t('pushBranches.redirectMessage'), { list }) +
          (sensitive.length ? `\n\n${interp(t('pushBranches.redirectSensitive'), { targets: sensitive.join(', ') })}` : ''),
        confirmLabel: t('pushBranches.redirectOk'),
        onConfirm: () => submit(true)
      })
      return
    }
    const redirected = targets.filter((tg) => tg.remoteBranch !== tg.branch).map((tg) => tg.branch)
    setBusy(true)
    void repoActions
      .pushBranches(repoPath, remote, chosen, { atomic, setUpstream, toUpstream: redirected }, () => submit(true))
      .then((res) => {
        if (res) setOutcome(res)
      })
      .finally(() => setBusy(false))
  }

  const target = (s: BranchPushState): string =>
    `${remote}/${pushDestinationOf(s, toUpstream.has(s.name)).remoteBranch}`

  const badge = (row: BranchPushState): React.JSX.Element => {
    // Against the destination actually chosen for the row, so the badge tells the truth.
    const s = pushDestinationOf(row, toUpstream.has(row.name))
    const vars = { branch: row.name, target: target(row), count: s.ahead }
    switch (s.state) {
      case 'ahead':
        return (
          <span className="badge ahead" title={interp(t('pushBranches.aheadTitle'), vars)}>
            ↑{s.ahead}
          </span>
        )
      case 'new':
        return (
          <span className="badge push-new" title={interp(t('pushBranches.newTitle'), vars)}>
            {t('pushBranches.stateNew')}
          </span>
        )
      case 'upToDate':
        return (
          <span className="badge push-same" title={interp(t('pushBranches.upToDateTitle'), vars)}>
            {t('pushBranches.stateUpToDate')}
          </span>
        )
      case 'behind':
        return (
          <span className="badge behind" title={interp(t('pushBranches.behindTitle'), vars)}>
            ↓{s.behind}
          </span>
        )
      case 'diverged':
        return (
          <span className="badge behind" title={interp(t('pushBranches.divergedTitle'), vars)}>
            {interp(t('pushBranches.stateDiverged'), { ahead: s.ahead, behind: s.behind })}
          </span>
        )
    }
  }

  const reasonText = (r: BranchPushResult): string => {
    if (r.status === 'notAttempted') return t('pushBranches.notAttemptedHint')
    if (r.status !== 'rejected') return r.upstreamSet ? interp(t('pushBranches.upstreamSet'), { target: `${remote}/${r.remoteBranch}` }) : ''
    return interp(t(REJECTION_KEY[r.rejection ?? 'other']), { reason: r.reason })
  }

  if (!remotes.length) {
    return (
      <div className="push-branches-modal">
        <h3>{t('pushBranches.title')}</h3>
        <p className="settings-hint">{t('pushBranches.noRemote')}</p>
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={closeModal}>
            {t('common.close')}
          </button>
        </div>
      </div>
    )
  }

  if (outcome) {
    const results = outcome.result?.results ?? []
    return (
      <div className="push-branches-modal">
        <h3>
          <ArrowUpFromLine size={17} style={{ verticalAlign: '-3px', marginInlineEnd: 6 }} />
          {interp(t('pushBranches.resultTitle'), { remote })}
        </h3>
        {outcome.error && <p className="push-branches-error">{outcome.error}</p>}
        <div className="repo-list push-branches-results">
          {results.map((r) => {
            const ok = r.status !== 'rejected' && r.status !== 'notAttempted'
            return (
              <div key={r.branch} className={`repo-row push-result ${ok ? 'ok' : 'failed'}`} data-branch={r.branch} data-status={r.status}>
                {ok ? <Check size={13} className="push-result-icon" /> : <X size={13} className="push-result-icon" />}
                <span className="repo-row-name">
                  {r.branch}
                  {r.remoteBranch !== r.branch && (
                    <span className="push-branch-dest">
                      {interp(t('pushBranches.landsOn'), { target: `${remote}/${r.remoteBranch}` })}
                    </span>
                  )}
                </span>
                <span className="push-result-status">{t(STATUS_KEY[r.status])}</span>
                {reasonText(r) && <span className="push-result-reason">{reasonText(r)}</span>}
              </div>
            )
          })}
          {outcome.held.map((h) => (
            <div key={h.branch} className="repo-row push-result held" data-branch={h.branch} data-status="held">
              <ShieldAlert size={13} className="push-result-icon" />
              <span className="repo-row-name">{h.branch}</span>
              <span className="push-result-status">{t('pushBranches.resHeld')}</span>
              <span className="push-result-reason">
                {t('pushBranches.heldHint')}
                <span className="push-held-files">
                  {h.files.slice(0, 10).join('\n')}
                  {h.files.length > 10 ? `\n${interp(t('confirm.pushSecrets.more'), { n: h.files.length - 10 })}` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
        {!!outcome.result?.remoteMessages.length && (
          <div className="push-branches-server">
            <span className="modal-label">{t('pushBranches.serverSaid')}</span>
            <pre>{outcome.result.remoteMessages.join('\n')}</pre>
          </div>
        )}
        <div className="modal-actions">
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setUsePreselect(false)
              // Drop the pre-push states now: seeding from them would beat the reload.
              setLoaded(null)
              setSeededFor(null)
              setOutcome(null)
            }}
          >
            {t('pushBranches.again')}
          </button>
          <button className="btn primary" type="button" onClick={closeModal}>
            {t('common.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="push-branches-modal">
      <h3>
        <ArrowUpFromLine size={17} style={{ verticalAlign: '-3px', marginInlineEnd: 6 }} />
        {t('pushBranches.title')}
      </h3>
      <p className="settings-hint">{t('pushBranches.intro')}</p>

      <div className="export-field">
        <label className="modal-label" htmlFor="push-branches-remote">
          {t('pushBranches.remote')}
        </label>
        {/* The app's own menu, not a native <select>: OS chrome looks foreign in a modal. */}
        <button
          id="push-branches-remote"
          type="button"
          className="modal-input modal-select-btn push-branches-remote"
          aria-haspopup="menu"
          disabled={busy || remotes.length < 2}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            openContextMenu(
              rect.left,
              rect.bottom + 4,
              // The clash named the old remote's branches: it says nothing about this one.
              remotes.map((r) => ({
                label: r,
                onClick: () => {
                  setClash(null)
                  setRemote(r)
                }
              }))
            )
          }}
        >
          <span className="modal-select-label">
            <Globe size={13} aria-hidden="true" />
            {remote}
          </span>
          {remotes.length > 1 && <ChevronDown size={13} aria-hidden="true" />}
        </button>
      </div>

      <div className="repo-search">
        <Search size={13} />
        <input
          className="push-branches-filter"
          value={query}
          placeholder={t('pushBranches.filter')}
          aria-label={t('pushBranches.filter')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="repo-select-bar">
        <button className="link-btn" type="button" disabled={!pushableShown.length} onClick={toggleShown}>
          {allShownSelected ? t('clone.selectNone') : t('clone.selectAll')}
        </button>
        <span className="repo-select-count push-branches-count">
          {interp(t('clone.selectedCount'), { count: chosen.length })}
        </span>
      </div>

      <div className="repo-list push-branches-list">
        {!states && !loadError && (
          <div className="repo-list-state">
            <Loader2 size={16} className="spin" /> {t('pushBranches.loading')}
          </div>
        )}
        {loadError && <div className="repo-list-state danger">{loadError}</div>}
        {states && shown.length === 0 && <div className="repo-list-state">{t('pushBranches.empty')}</div>}
        {shown.map((s) => {
          const redirected = toUpstream.has(s.name)
          const dest = pushDestinationOf(s, redirected)
          const pushable = canBatchPush(s, redirected)
          const isProtected =
            isProtectedDest(s.name) || isProtectedDest(dest.remoteBranch) || (redirected && !!s.upstreamTarget?.isRemoteDefault)
          const up = s.upstreamTarget
          return (
            <label
              key={s.name}
              className={`repo-row push-branch-row ${selected.has(s.name) && pushable ? 'selected' : ''} ${pushable ? '' : 'disabled'}`}
              data-branch={s.name}
              data-state={dest.state}
              data-dest={dest.remoteBranch}
              title={pushable ? undefined : interp(t(dest.state === 'behind' ? 'pushBranches.behindTitle' : 'pushBranches.divergedTitle'), { branch: s.name, target: target(s), count: dest.ahead })}
            >
              <input
                type="checkbox"
                className="repo-row-check"
                checked={pushable && selected.has(s.name)}
                disabled={!pushable || busy}
                aria-label={interp(t('pushBranches.toggle'), { branch: s.name })}
                onChange={() => toggle(s.name)}
              />
              <span className="repo-row-name">
                {s.name}
                {redirected && (
                  <span className="push-branch-dest">{interp(t('pushBranches.landsOn'), { target: target(s) })}</span>
                )}
                {/* A second line that wraps: the warning, then the per-row choice — never crowding the badge. */}
                {up && (
                  <span className="push-branch-tracks-line">
                    <span
                      className="push-branch-tracks"
                      title={interp(t('pushBranches.tracksOtherTitle'), {
                        branch: s.name,
                        upstream: `${remote}/${up.remoteBranch}`,
                        target: `${remote}/${s.name}`
                      })}
                    >
                      {interp(t(redirected ? 'pushBranches.tracksOtherChosen' : 'pushBranches.tracksOther'), {
                        upstream: `${remote}/${up.remoteBranch}`,
                        target: `${remote}/${s.name}`
                      })}
                    </span>
                    <button
                      type="button"
                      className={`link-btn push-branch-upstream-toggle ${redirected ? 'active' : ''}`}
                      disabled={busy}
                      aria-pressed={redirected}
                      title={interp(t(redirected ? 'pushBranches.toOwnTitle' : 'pushBranches.toUpstreamTitle'), {
                        upstream: `${remote}/${up.remoteBranch}`,
                        target: `${remote}/${s.name}`
                      })}
                      onClick={(e) => {
                        // Inside the row's <label>: do not let the click tick the checkbox as well.
                        e.preventDefault()
                        e.stopPropagation()
                        toggleUpstream(s.name)
                      }}
                    >
                      <GitBranch size={11} aria-hidden="true" />
                      {interp(t(redirected ? 'pushBranches.toOwn' : 'pushBranches.toUpstream'), {
                        upstream: up.remoteBranch,
                        branch: s.name
                      })}
                    </button>
                  </span>
                )}
              </span>
              {isProtected && (
                <span className="push-branch-protected" title={t('pushBranches.protectedTitle')}>
                  <Lock size={11} />
                </span>
              )}
              {badge(s)}
            </label>
          )
        })}
      </div>

      <label className="clone-partial">
        <input type="checkbox" checked={setUpstream} disabled={busy} onChange={(e) => setSetUpstream(e.target.checked)} />
        <span>
          {t('pushBranches.setUpstream')}
          <span className="modal-hint">{t('pushBranches.setUpstreamHint')}</span>
        </span>
      </label>
      <label className="clone-partial">
        <input
          type="checkbox"
          className="push-branches-atomic"
          checked={atomic}
          disabled={busy}
          onChange={(e) => setAtomic(e.target.checked)}
        />
        <span>
          {t('pushBranches.atomic')}
          <span className="modal-hint">{t('pushBranches.atomicHint')}</span>
        </span>
      </label>

      {clash && <p className="push-branches-error push-branches-clash">{clash}</p>}

      <p className="modal-hint push-branches-stale">
        <AlertTriangle size={11} style={{ verticalAlign: '-1px', marginInlineEnd: 4 }} />
        {t('pushBranches.staleHint')}
      </p>

      <div className="modal-actions">
        <button className="btn ghost" type="button" onClick={closeModal}>
          {t('common.cancel')}
        </button>
        <button className="btn primary push-branches-submit" type="button" disabled={!chosen.length || busy} onClick={() => submit()}>
          {busy ? <Loader2 size={13} className="spin" /> : <ArrowUpFromLine size={13} />}{' '}
          {chosen.length === 1 ? t('pushBranches.pushOne') : interp(t('pushBranches.pushMany'), { count: chosen.length })}
        </button>
      </div>
    </div>
  )
}
