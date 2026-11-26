import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  GitPullRequestDraft,
  GitMerge,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  ExternalLink,
  RefreshCw,
  Check,
  X,
  MessageSquare,
  Clock,
  User,
  Users,
  UserCheck,
  Tag,
  Milestone,
  FileDiff,
  CircleDot,
  CalendarDays,
  Sparkles,
  ClipboardList,
  Copy,
  ScrollText,
  Target
} from 'lucide-react'
import type {
  PageContent,
  PrCheck,
  PrDetail,
  PrFile,
  PrDiffRevision,
  PrLineAnchor,
  PrMergeMethod,
  PrReviewEvent,
  PrReviewThread
} from '../../../shared/types'
import { hostingApi, shellApi } from '../infrastructure/api'
import { CheckLogPanel } from './CheckLogPanel'
import { HostUserAvatar as Avatar } from './HostUserAvatar'
import { PrNavBar } from './PrNavBar'
import { PrCommitsSection, usePrCommits } from './PrCommitsSection'
import { forgetFinished, registerPrDraft } from '../stores/prList'
import { useUIStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { repoActions, useRepoStore } from '../stores/repo'
import { remoteForPrUrl } from '../lib/prBranchGo'
import { autolink, remoteWebUrl } from '../lib/autolink'
import {
  checkCounts,
  checkState,
  labelColor,
  labelTextColor,
  participants,
  prStatus,
  reviewerStates,
  type ReviewerState
} from '../lib/prSummary'
import { DiffViewer } from './DiffViewer'
import { guessLanguage } from '../lib/highlight'
import { isSecretFile } from '../lib/secrets'
import { useT, interp, type TranslationKey } from '../i18n'
import { readableError } from '../lib/gitErrorHint'
import { parseDiff } from '../lib/diff'
import { getLineAnchor, getThreadsByLine, isSameAnchor } from '../lib/prLineComment'
import { getAnchorLine } from '../../../shared/prLineAnchor'

type PrPage = Extract<PageContent, { type: 'pr' }>
type Section = 'conversation' | 'commits' | 'files' | 'checks'

const REVIEW_KEY: Record<ReviewerState, TranslationKey> = {
  APPROVED: 'prPage.reviewApproved',
  CHANGES_REQUESTED: 'prPage.reviewChanges',
  COMMENTED: 'prPage.reviewCommented',
  PENDING: 'prPage.reviewPending'
}

const STATUS_KEY = {
  open: 'prPage.stateOpen',
  draft: 'prDetail.draft',
  merged: 'prDetail.merged',
  closed: 'prPage.stateClosed'
} as const satisfies Record<ReturnType<typeof prStatus>, TranslationKey>

const fmtDate = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleString() : '')

/**
 * A pull request as a page of its own: the conversation, files and checks in
 * the main column, and everything *about* the PR — who, when, where it goes,
 * how big it is, who still has to review it — in a sidebar. Replaces the modal,
 * which crammed all of it into one scrolling column.
 */
export function PrDetailPage({ page }: { page: PrPage }): React.JSX.Element {
  const { repoPath, remoteUrl, number } = page
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const profile = useSettingsStore((s) => s.activeProfile())
  const provider = useRepoStore((s) => s.repos[repoPath]?.prProvider)

  const [pr, setPr] = useState<PrDetail | null>(null)
  const [checks, setChecks] = useState<PrCheck[] | null>(null)
  // The check whose log is open under its row.
  // The check whose log is open, by its link: a refresh may reorder the list.
  const [openLog, setOpenLog] = useState<string | null>(null)
  const [files, setFiles] = useState<PrFile[] | null>(null)
  // The revision those files' diff was read at: a line comment carries it.
  const [filesRevision, setFilesRevision] = useState<PrDiffRevision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('conversation')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [mergeMethod, setMergeMethod] = useState<PrMergeMethod>('merge')
  // Per-thread reply drafts, keyed by the thread root id (GitHub comment id or
  // GitLab discussion id). Text being typed lives in the box itself; these refs
  // only remember it — for the unsent-draft check, and for the same thread's box
  // in the other tab — so a keystroke re-renders one box, not the whole page
  // (and with it every highlighted line of the diff).
  const replyDrafts = useRef<Record<string, string>>({})
  // The comment being written on one line of the Files tab's diff. One at a
  // time, kept while another file is looked at, so nothing typed is lost.
  const [lineDraft, setLineDraft] = useState<{ anchor: PrLineAnchor } | null>(null)
  const lineDraftText = useRef('')

  // "Viewed" ticks are local and kept per repo + PR: GitHub's own viewed state
  // has no simple REST call. Same key as the modal used, so ticks carry over.
  const viewedKey = `githuttbr-pr-viewed:${remoteUrl}#${number}`
  const [viewed, setViewed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(viewedKey) || '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const toggleViewed = (f: string): void =>
    setViewed((cur) => {
      const next = new Set(cur)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      try {
        localStorage.setItem(viewedKey, JSON.stringify([...next]))
      } catch {
        // Storage full or blocked: the tick still shows for this session.
      }
      return next
    })

  const tokens = useMemo(
    () => ({
      github: profile.githubToken || undefined,
      gitlab: profile.gitlabToken || undefined,
      forgejo: profile.forgejoToken || undefined,
      azure: profile.azureToken || undefined
    }),
    [profile.githubToken, profile.gitlabToken, profile.forgejoToken, profile.azureToken]
  )
  // Forgejo has no API to reply inside an existing line thread.
  const canReplyInThread = provider !== 'forgejo'

  // Bumped by every load, so the Commits tab re-reads with the rest of the page.
  const [reloads, setReloads] = useState(0)
  const load = useCallback(async (): Promise<void> => {
    setError(null)
    setReloads((n) => n + 1)
    try {
      setPr(await hostingApi.prDetail(repoPath, remoteUrl, tokens, number))
      // Checks and files fill in after the conversation: the page is usable first.
      void hostingApi.prChecks(repoPath, remoteUrl, tokens, number).then(setChecks).catch(() => setChecks([]))
      void hostingApi
        .prFiles(repoPath, remoteUrl, tokens, number)
        .then((list) => {
          setFiles(list.files)
          setFilesRevision(list.revision)
        })
        .catch(() => {
          setFiles([])
          setFilesRevision(null)
        })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [repoPath, remoteUrl, number, tokens])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  // ‹ › and Alt+arrows ask before leaving text nobody sent.
  useEffect(() => {
    const check = (): boolean =>
      !!comment.trim() || Object.values(replyDrafts.current).some((r) => r.trim()) || !!lineDraftText.current.trim()
    registerPrDraft(check)
    return () => registerPrDraft(null)
  }, [comment])

  /** Run a write, refresh, toast. True when it went through. */
  const act = async (fn: () => Promise<void>, ok: string): Promise<boolean> => {
    setBusy(true)
    try {
      await fn()
      await load()
      void useRepoStore.getState().refreshPRs(repoPath, { silent: true })
      // A merge (or close) moves it between the list page's tabs.
      forgetFinished(repoPath)
      toast('success', ok)
      return true
    } catch (err) {
      // The explanation in the user's language when there is one, else the host's own words.
      toast('error', readableError(err instanceof Error ? err.message : String(err), t, interp))
      return false
    } finally {
      setBusy(false)
    }
  }

  const submitComment = (): void => {
    if (!comment.trim()) return
    void act(
      () => hostingApi.prComment(repoPath, remoteUrl, tokens, number, comment.trim()).then(() => setComment('')),
      t('prDetail.commentPosted')
    )
  }
  const review = (event: PrReviewEvent): void =>
    void act(
      () => hostingApi.prReview(repoPath, remoteUrl, tokens, number, event, comment.trim()).then(() => setComment('')),
      t('prDetail.reviewSubmitted')
    )
  const merge = (): void =>
    void act(() => hostingApi.prMerge(repoPath, remoteUrl, tokens, number, mergeMethod), t('prDetail.prMerged'))
  const replyToThread = async (rootId: number | string, text: string): Promise<boolean> => {
    const body = text.trim()
    if (!body) return false
    const ok = await act(
      () => hostingApi.prReplyReviewComment(repoPath, remoteUrl, tokens, number, rootId, body),
      t('prDetail.replyPosted')
    )
    if (ok) replyDrafts.current[String(rootId)] = ''
    return ok
  }

  // A click on a line opens its composer — unless a comment already typed on
  // another line would be dropped by it: that one has to be posted or
  // cancelled first, and the toast says where it is.
  const openLineDraft = (anchor: PrLineAnchor): void => {
    if (lineDraft && isSameAnchor(lineDraft.anchor, anchor)) return
    if (lineDraft && lineDraftText.current.trim()) {
      toast('info', interp(t('prPage.lineCommentPending'), { path: lineDraft.anchor.path, line: String(getAnchorLine(lineDraft.anchor)) }))
      return
    }
    lineDraftText.current = ''
    setLineDraft({ anchor })
  }
  const cancelLineDraft = (): void => {
    lineDraftText.current = ''
    setLineDraft(null)
  }
  const postLineDraft = async (text: string): Promise<boolean> => {
    if (!lineDraft || !text.trim()) return false
    const { anchor } = lineDraft
    const ok = await act(
      () => hostingApi.prCommentOnLine(repoPath, remoteUrl, tokens, number, anchor, text.trim(), filesRevision),
      t('prPage.lineCommentPosted')
    )
    if (ok) {
      lineDraftText.current = ''
      setLineDraft((d) => (d && isSameAnchor(d.anchor, anchor) ? null : d))
    }
    return ok
  }

  // One review thread — in the conversation, and under its line in the Files
  // tab. Stable while nothing it shows changes, so the Files tab's line blocks
  // (and the diff under them) are not rebuilt for an unrelated re-render.
  const replyRef = useRef(replyToThread)
  replyRef.current = replyToThread
  const web = remoteWebUrl(remoteUrl)
  const threadCard = useCallback(
    (th: PrReviewThread, withLocation: boolean): React.JSX.Element | null =>
      pr ? (
        <ReviewThreadCard
          key={th.rootId}
          thread={th}
          pr={pr}
          web={web}
          withLocation={withLocation}
          canReply={canReplyInThread}
          drafts={replyDrafts}
          onReply={(text) => replyRef.current(th.rootId, text)}
          busy={busy}
        />
      ) : null,
    [pr, web, canReplyInThread, busy]
  )
  const renderFileThread = useCallback((th: PrReviewThread) => threadCard(th, false), [threadCard])

  // Hand the preview modal the remote this PR's repository is actually behind —
  // matching on URL, since a repo may have several remotes configured.
  const previewLocally = (): void => {
    const remote = remoteForPrUrl(useRepoStore.getState().repos[repoPath]?.remotes ?? [], remoteUrl)
    useUIStore.getState().openModal({ kind: 'pr-preview', repoPath, number, remote })
  }
  // The same match, live, for the branch links: a remote added while the page
  // is open makes them usable without a reload.
  const repoRemotes = useRepoStore((s) => s.repos[repoPath]?.remotes)
  const branchRemote = useMemo(() => remoteForPrUrl(repoRemotes ?? [], remoteUrl), [repoRemotes, remoteUrl])
  const currentBranch = useRepoStore((s) => s.repos[repoPath]?.branches.current)
  // A PR page restored before its repository was read has no remotes to match
  // yet: that is "not loaded", not "no remote", and a click loads it first.
  const repoLoaded = useRepoStore((s) => !!s.repos[repoPath])
  const canGo = !!branchRemote || !repoLoaded
  // Why a "go to branch" control does nothing, or what it does. Shared by the
  // header buttons and the Branches field so the two never disagree.
  const branchGoTitle = (name: string, inFork: boolean, key: TranslationKey): string =>
    inFork
      ? t('prPage.forkBranchHint')
      : branchRemote
        ? interp(t(key), { branch: name })
        : !repoLoaded
          ? interp(t('prPage.checkoutAfterLoad'), { branch: name })
          : interp(t('prPage.noRemoteForBranch'), { url: remoteUrl })
  const goToBranch = async (name: string): Promise<void> => {
    if (!useRepoStore.getState().repos[repoPath]) await useRepoStore.getState().ensure(repoPath)
    const remote = remoteForPrUrl(useRepoStore.getState().repos[repoPath]?.remotes ?? [], remoteUrl)
    if (!remote) {
      toast('info', interp(t('prPage.noRemoteForBranch'), { url: remoteUrl }))
      return
    }
    await repoActions.checkoutPrBranch(repoPath, name, remote)
  }

  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)
  // The AI review reads the PR's diff as the host gave it, once the files are
  // in; until then it falls back to comparing the branches locally.
  const reviewWithAi = (): void => {
    if (!pr) return
    const diff = files?.length
      ? files
          .filter((f) => f.patch)
          .map((f) => `diff --git a/${f.previousFilename ?? f.filename} b/${f.filename}\n--- a/${f.previousFilename ?? f.filename}\n+++ b/${f.filename}\n${f.patch}`)
          .join('\n')
      : undefined
    useUIStore.getState().openModal({
      kind: 'ai-pr-review',
      repoPath,
      prTitle: pr.title,
      sourceBranch: pr.source,
      targetBranch: pr.target,
      ...(diff ? { diff } : {})
    })
  }

  const status = pr ? prStatus(pr) : null
  const canMerge = !!pr && pr.state === 'open' && !pr.merged
  // A merge-check veto blocks the merge without being a conflict (Bitbucket Data Center).
  const blockers = pr?.mergeBlockers ?? []
  const refused = !!pr?.mergeRefused
  const mergeBlocked = pr?.mergeable === false || blockers.length > 0 || refused
  const counts = checks ? checkCounts(checks) : null
  const reviewers = pr ? reviewerStates(pr) : []
  const people = pr ? participants(pr) : []
  const conversationCount = pr ? pr.comments.length + pr.reviewThreads.length : 0
  const commits = usePrCommits(repoPath, remoteUrl, tokens, number, section === 'commits', reloads)
  // A truncated list is not the whole count: the detail's own number, when it says more.
  const commitCount = commits.list?.truncated
    ? Math.max(commits.list.commits.length, pr?.commits ?? 0)
    : (commits.list?.commits.length ?? pr?.commits)

  return (
    <div className="prp-frame">
      <div className="prp-page">
        <div className="prp-main">
          <PrNavBar page={page} />
          <header className="prp-head">
            {status && (
              <span className={`prp-state prp-${status}`}>
                <StatusIcon status={status} /> {t(STATUS_KEY[status])}
              </span>
            )}
            <h2>
              {pr?.title ?? page.title} <span className="prp-num">#{number}</span>
            </h2>
            <button className="icon-btn" title={t('prPage.refresh')} onClick={() => void load()} disabled={busy}>
              <RefreshCw size={14} />
            </button>
            {aiEnabled && pr && (
              <button className="icon-btn" title={t('sidebar.aiPrReview')} onClick={reviewWithAi}>
                <Sparkles size={14} />
              </button>
            )}
            <button className="icon-btn" title={t('prPreview.open')} onClick={previewLocally}>
              <GitPullRequestArrow size={14} />
            </button>
            {pr && (
              <>
                <BranchGoButton
                  title={branchGoTitle(pr.source, !!pr.sourceRepo, 'prPage.goToSource')}
                  usable={!pr.sourceRepo && canGo}
                  onGo={() => void goToBranch(pr.source)}
                  icon={<GitBranch size={14} />}
                />
                <BranchGoButton
                  title={branchGoTitle(pr.target, false, 'prPage.goToTarget')}
                  usable={canGo}
                  onGo={() => void goToBranch(pr.target)}
                  icon={<Target size={14} />}
                />
              </>
            )}
            {pr && (
              <button className="icon-btn" title={t('common.openInBrowser')} onClick={() => void shellApi.openExternal(pr.url)}>
                <ExternalLink size={14} />
              </button>
            )}
          </header>
          {pr && (
            <div className="prp-sub">
              {interp(t(status === 'merged' ? 'prPage.headMerged' : status === 'closed' ? 'prPage.headClosed' : 'prPage.wantsToMerge'), {
                author: pr.author,
                source: pr.source,
                target: pr.target
              })}
            </div>
          )}

          <nav className="prp-tabs" role="tablist">
            <SectionTab id="conversation" active={section} onPick={setSection} icon={<MessageSquare size={13} />} label={t('prPage.tabConversation')} count={conversationCount} />
            <SectionTab id="commits" active={section} onPick={setSection} icon={<GitCommitHorizontal size={13} />} label={t('prPage.tabCommits')} count={commitCount} />
            <SectionTab id="files" active={section} onPick={setSection} icon={<FileDiff size={13} />} label={t('prPage.tabFiles')} count={files?.length ?? pr?.changedFiles} />
            <SectionTab id="checks" active={section} onPick={setSection} icon={<CircleDot size={13} />} label={t('prPage.tabChecks')} count={checks?.length} />
          </nav>

          <div className="prp-body">
            {loading ? (
              <div className="prd-empty">
                <Loader2 size={15} className="spin" /> {t('prDetail.loading')}
              </div>
            ) : error ? (
              <div className="prd-error">{readableError(error, t, interp)}</div>
            ) : !pr ? null : section === 'conversation' ? (
              <>
                <article className="prp-card">
                  <div className="prp-card-head">
                    <Avatar login={pr.author} avatars={pr.avatars} />
                    <strong>{pr.author}</strong>
                    <span>{fmtDate(pr.createdAt)}</span>
                  </div>
                  <div className={`prp-card-body ${pr.body.trim() ? '' : 'prp-muted'}`}>
                    {pr.body.trim() ? autolink(pr.body, web) : t('prPage.noDescription')}
                  </div>
                </article>

                {pr.comments.map((c, i) => (
                  <article key={i} className="prp-card">
                    <div className="prp-card-head">
                      <Avatar login={c.author} avatars={pr.avatars} />
                      <strong>{c.author}</strong>
                      <span>{fmtDate(c.createdAt)}</span>
                    </div>
                    <div className="prp-card-body">{autolink(c.body, web)}</div>
                  </article>
                ))}

                {pr.reviewThreads.length > 0 && (
                  <div className="prd-section-title">
                    {t('prDetail.reviewThreads')} <span className="prd-count">{pr.reviewThreads.length}</span>
                  </div>
                )}
                {pr.reviewThreads.map((th) => threadCard(th, true))}
                {conversationCount === 0 && <p className="prp-muted prp-pad">{t('prDetail.noComments')}</p>}
              </>
            ) : section === 'commits' ? (
              <PrCommitsSection repoPath={repoPath} remoteUrl={remoteUrl} pr={pr} list={commits.list} error={commits.error} />
            ) : section === 'files' ? (
              files === null ? (
                <div className="prd-empty">
                  <Loader2 size={15} className="spin" /> {t('prDetail.loading')}
                </div>
              ) : files.length === 0 ? (
                <p className="prp-muted prp-pad">{t('prPage.noFiles')}</p>
              ) : (
                <FilesSection
                  files={files}
                  viewed={viewed}
                  onToggleViewed={toggleViewed}
                  repoPath={repoPath}
                  prUrl={pr.url}
                  threads={pr.reviewThreads}
                  renderThread={renderFileThread}
                  lineDraft={lineDraft}
                  lineDraftText={lineDraftText}
                  onOpenLineDraft={openLineDraft}
                  onCancelLineDraft={cancelLineDraft}
                  onPostLineDraft={postLineDraft}
                  busy={busy}
                />
              )
            ) : checks === null ? (
              <div className="prd-empty">
                <Loader2 size={15} className="spin" /> {t('prDetail.loading')}
              </div>
            ) : checks.length === 0 ? (
              <p className="prp-muted prp-pad">{t('prPage.noChecks')}</p>
            ) : (
              <div className="prd-checks prp-checks">
                {checks.map((c, i) => (
                  <div key={i} className="prp-check-item">
                    <div className="prd-check">
                      <span className={`prd-check-dot ${checkState(c)}`} />
                      <span className="prd-check-name">{c.name}</span>
                      <span className="prd-check-state">{c.status === 'completed' ? c.conclusion : c.status}</span>
                      {c.hasLog && (
                        <button
                          className="prd-check-logs"
                          title={openLog === c.url ? t('prPage.hideLog') : t('prPage.showLog')}
                          aria-expanded={openLog === c.url}
                          onClick={() => setOpenLog(openLog === c.url ? null : c.url)}
                        >
                          <ScrollText size={12} />
                        </button>
                      )}
                      {c.url && (
                        <button className="prd-check-logs" title={t('prDetail.viewLogs')} onClick={() => void shellApi.openExternal(c.url)}>
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                    {openLog === c.url && <CheckLogPanel repoPath={repoPath} remoteUrl={remoteUrl} tokens={tokens} url={c.url} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fixed under the scrolling conversation, like the title above it: a long
              PR must not hide the review and merge actions at the bottom. */}
          {!loading && !error && pr && section === 'conversation' && (
            <footer className="prp-footer">
              <section className="prp-composer">
                <textarea
                  className="prd-input"
                  placeholder={t('prDetail.commentPlaceholder')}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="prp-composer-actions">
                  <button className="btn ghost small" onClick={submitComment} disabled={busy || !comment.trim()}>
                    <MessageSquare size={13} /> {t('prDetail.comment')}
                  </button>
                  <button className="btn ghost small prd-approve" onClick={() => review('APPROVE')} disabled={busy}>
                    <Check size={13} /> {t('prDetail.approve')}
                  </button>
                  <button className="btn ghost small prd-reject" onClick={() => review('REQUEST_CHANGES')} disabled={busy}>
                    <X size={13} /> {t('prDetail.requestChanges')}
                  </button>
                </div>
              </section>

              {canMerge && (
                <section className={`prp-merge ${mergeBlocked ? 'is-blocked' : ''}`}>
                  <div className="prp-merge-text">
                    <GitMerge size={16} />
                    <span>
                      {pr.mergeable === false
                        ? t('prDetail.notMergeable')
                        : blockers.length
                          ? t('prPage.mergeBlocked')
                          : refused
                          ? t('prPage.mergeRefusedShort')
                          : pr.mergeable === true
                          ? t('prPage.mergeable')
                          : t('prPage.mergeUnknown')}
                    </span>
                  </div>
                  <div className="prd-merge">
                    <select value={mergeMethod} onChange={(e) => setMergeMethod(e.target.value as PrMergeMethod)}>
                      <option value="merge">{t('prDetail.mergeCommit')}</option>
                      <option value="squash">{t('prDetail.squash')}</option>
                      {/* GitLab's merge API has no per-request rebase; the project setting decides. */}
                      {provider !== 'gitlab' && <option value="rebase">{t('prDetail.rebase')}</option>}
                    </select>
                    <button className="btn primary small" onClick={merge} disabled={busy || mergeBlocked}>
                      {busy ? <Loader2 size={13} className="spin" /> : <GitMerge size={13} />} {t('prDetail.merge')}
                    </button>
                  </div>
                </section>
              )}
            </footer>
          )}
        </div>

        <aside className="prp-side">
          {pr && (
            <>
              <Field icon={<User size={12} />} label={t('prPage.author')}>
                <span className="prp-person">
                  <Avatar login={pr.author} avatars={pr.avatars} />
                  {pr.author}
                </span>
                {pr.createdAt && <div className="prp-side-note">{interp(t('prPage.openedOn'), { date: fmtDate(pr.createdAt) })}</div>}
              </Field>

              <Field icon={<GitPullRequest size={12} />} label={t('prPage.status')}>
                <div>{status && t(STATUS_KEY[status])}</div>
                {pr.merged && pr.mergedAt && (
                  <div className="prp-side-note">
                    {pr.mergedBy
                      ? interp(t('prPage.mergedByOn'), { who: pr.mergedBy, date: fmtDate(pr.mergedAt) })
                      : interp(t('prPage.mergedOn'), { date: fmtDate(pr.mergedAt) })}
                  </div>
                )}
                {!pr.merged && pr.state === 'closed' && pr.closedAt && (
                  <div className="prp-side-note">{interp(t('prPage.closedOn'), { date: fmtDate(pr.closedAt) })}</div>
                )}
                {canMerge && pr.mergeable === false && <div className="prp-side-note prp-warn">{t('prPage.conflicts')}</div>}
                {/* The vetoes are the server's own copy (its merge checks), shown as it words them. */}
                {canMerge &&
                  blockers.map((b, i) => (
                    <div key={i} className="prp-side-note prp-warn">
                      {b}
                    </div>
                  ))}
                {canMerge && refused && <div className="prp-side-note prp-warn">{t('prPage.mergeRefused')}</div>}
              </Field>

              <Field icon={<UserCheck size={12} />} label={t('prPage.reviewers')}>
                {reviewers.length === 0 ? (
                  <span className="issue-none">{t('prPage.noReviewers')}</span>
                ) : (
                  <ul className="prp-list">
                    {reviewers.map((r) => (
                      <li key={r.login} className="prp-person" title={t(REVIEW_KEY[r.state])}>
                        {r.team ? <Users size={14} className="prp-team" /> : <Avatar login={r.login} avatars={pr.avatars} />}
                        <span className="prp-person-name">{r.login}</span>
                        <ReviewIcon state={r.state} />
                      </li>
                    ))}
                  </ul>
                )}
              </Field>

              {pr.assignees !== undefined && (
                <Field icon={<User size={12} />} label={t('prPage.assignees')}>
                  {pr.assignees.length === 0 ? (
                    <span className="issue-none">{t('common.none')}</span>
                  ) : (
                    <ul className="prp-list">
                      {pr.assignees.map((a) => (
                        <li key={a.login} className="prp-person">
                          <Avatar login={a.login} avatars={pr.avatars} />
                          <span className="prp-person-name">{a.login}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Field>
              )}

              {pr.labels !== undefined && (
                <Field icon={<Tag size={12} />} label={t('prPage.labels')}>
                  {pr.labels.length === 0 ? (
                    <span className="issue-none">{t('common.none')}</span>
                  ) : (
                    <span className="issue-labels">
                      {pr.labels.map((l) => {
                        const bg = labelColor(l.color)
                        return (
                          <span
                            key={l.name}
                            className="issue-label"
                            style={bg ? { background: bg, color: labelTextColor(bg) } : undefined}
                          >
                            {l.name}
                          </span>
                        )
                      })}
                    </span>
                  )}
                </Field>
              )}

              {pr.milestone !== undefined && (
                <Field icon={<Milestone size={12} />} label={t('prPage.milestone')}>
                  {pr.milestone ?? <span className="issue-none">{t('common.none')}</span>}
                </Field>
              )}

              <Field icon={<GitBranch size={12} />} label={t('prPage.branches')}>
                <div className="prp-branches">
                  <PrBranchName
                    name={pr.source}
                    title={branchGoTitle(pr.source, !!pr.sourceRepo, 'prPage.checkoutBranch')}
                    usable={canGo}
                    onGo={() => void goToBranch(pr.source)}
                    // A fork's branch shares only its name with anything here.
                    isCurrent={!pr.sourceRepo && currentBranch === pr.source}
                    inFork={!!pr.sourceRepo}
                  />
                  <span className="prp-arrow">→</span>
                  <PrBranchName
                    name={pr.target}
                    title={branchGoTitle(pr.target, false, 'prPage.checkoutBranch')}
                    usable={canGo}
                    onGo={() => void goToBranch(pr.target)}
                    isCurrent={currentBranch === pr.target}
                    inFork={false}
                  />
                </div>
                {pr.sourceRepo && (
                  <>
                    <div className="prp-side-note">{interp(t('prPage.fromFork'), { repo: pr.sourceRepo })}</div>
                    <div className="prp-side-note">
                      {t('prPage.forkBranchHint')}{' '}
                      <button type="button" className="prp-link" onClick={previewLocally}>
                        {t('prPreview.open')}
                      </button>
                    </div>
                  </>
                )}
              </Field>

              {pr.workItems && pr.workItems.length > 0 && (
                <Field icon={<ClipboardList size={12} />} label={t('prPage.workItems')}>
                  <ul className="prp-work-items">
                    {pr.workItems.map((w) => (
                      <li key={w.id}>
                        <button className="prp-link prp-work-item" title={w.url} onClick={() => void shellApi.openExternal(w.url)}>
                          <span className="prp-work-item-id">{`AB#${w.id}` /* i18n-ignore work item reference */}</span>
                          <span className="prp-work-item-title">{w.title}</span>
                        </button>
                        {(w.type || w.state) && (
                          <div className="prp-side-note">{[w.type, w.state].filter(Boolean).join(' · ')}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Field>
              )}

              <Field icon={<FileDiff size={12} />} label={t('prPage.changes')}>
                <ChangeSummary pr={pr} files={files} />
              </Field>

              {counts && checks && checks.length > 0 && (
                <Field icon={<CircleDot size={12} />} label={t('prDetail.checks')}>
                  <button className="prp-link" onClick={() => setSection('checks')}>
                    {interp(t('prPage.checksSummary'), {
                      pass: String(counts.pass),
                      fail: String(counts.fail),
                      pending: String(counts.pending)
                    })}
                  </button>
                </Field>
              )}

              <Field icon={<Users size={12} />} label={t('prPage.participants')}>
                <div className="prp-faces">
                  {people.map((p) => (
                    <Avatar key={p} login={p} avatars={pr.avatars} size={22} title={p} />
                  ))}
                </div>
              </Field>

              {pr.updatedAt && (
                <Field icon={<CalendarDays size={12} />} label={t('prPage.activity')}>
                  <div className="prp-side-note">{interp(t('prPage.openedOn'), { date: fmtDate(pr.createdAt) })}</div>
                  <div className="prp-side-note">{interp(t('prPage.updatedOn'), { date: fmtDate(pr.updatedAt) })}</div>
                </Field>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

/**
 * One inline review thread: where it is (in the conversation; under its line
 * in the Files tab that is plain to see), its comments, and the reply box —
 * absent where the host has no API to reply inside a thread. The reply being
 * typed is this box's own state; `drafts` only remembers it for the page.
 */
function ReviewThreadCard({
  thread,
  pr,
  web,
  withLocation,
  canReply,
  drafts,
  onReply,
  busy
}: {
  thread: PrReviewThread
  pr: PrDetail
  web: string | undefined
  withLocation: boolean
  canReply: boolean
  drafts: React.RefObject<Record<string, string>>
  onReply: (text: string) => Promise<boolean>
  busy: boolean
}): React.JSX.Element {
  const t = useT()
  const key = String(thread.rootId)
  const [reply, setReply] = useState(() => drafts.current[key] ?? '')
  const changeReply = (v: string): void => {
    setReply(v)
    drafts.current[key] = v
  }
  const send = (): void => {
    if (!reply.trim()) return
    void onReply(reply).then((ok) => ok && setReply(''))
  }
  return (
    <article className="prp-card prp-thread">
      {withLocation && (
        <div className="prd-thread-loc" title={thread.path}>
          {thread.path}
          {thread.line != null ? `:${thread.line}` : ''}
        </div>
      )}
      {withLocation && thread.diffHunk && <pre className="prd-thread-hunk">{thread.diffHunk.split('\n').slice(-6).join('\n')}</pre>}
      {thread.comments.map((c) => (
        <div key={c.id} className="prp-thread-comment">
          <div className="prp-card-head">
            <Avatar login={c.author} avatars={pr.avatars} />
            <strong>{c.author}</strong>
            <span>{fmtDate(c.createdAt)}</span>
          </div>
          <div className="prp-card-body">{autolink(c.body, web)}</div>
        </div>
      ))}
      {canReply && (
        <div className="prd-thread-reply">
          <input
            className="prd-reply-input"
            placeholder={t('prDetail.replyPlaceholder')}
            aria-label={t('prDetail.replyPlaceholder')}
            value={reply}
            onChange={(e) => changeReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <button className="btn ghost tiny" onClick={send} disabled={busy || !reply.trim()}>
            {t('prDetail.reply')}
          </button>
        </div>
      )}
    </article>
  )
}

/**
 * The box under a diff line for a new review comment. It takes the focus when
 * it opens; Escape cancels (asking first when something was typed) and
 * ⌘/Ctrl+Enter posts. The text is this box's own state — a keystroke
 * re-renders the box, not the diff around it — and `draft` remembers it for
 * the page (the unsent-draft check, and coming back from another file).
 */
function LineCommentComposer({
  anchor,
  draft,
  busy,
  onCancel,
  onPost
}: {
  anchor: PrLineAnchor
  draft: React.RefObject<string>
  busy: boolean
  onCancel: () => void
  onPost: (text: string) => void
}): React.JSX.Element {
  const t = useT()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(() => draft.current)
  useEffect(() => ref.current?.focus(), [])
  const change = (v: string): void => {
    setText(v)
    draft.current = v
  }
  const escape = (): void => {
    if (!text.trim()) return onCancel()
    useUIStore.getState().openModal({
      kind: 'confirm',
      title: t('prPage.lineCommentDiscardTitle'),
      message: t('prPage.lineCommentDiscardMessage'),
      danger: true,
      confirmLabel: t('prPage.lineCommentDiscard'),
      onConfirm: onCancel
    })
  }
  const line = String(getAnchorLine(anchor))
  const where = interp(t(anchor.kind === 'del' ? 'prPage.lineCommentOld' : 'prPage.lineCommentNew'), { line })
  const label = interp(t('prPage.lineCommentLabel'), { path: anchor.path, line })
  return (
    <div
      className="prp-line-composer"
      role="group"
      aria-label={label}
      // A click inside must not reach the diff row, which would reopen the box.
      onClick={(e) => e.stopPropagation()}
    >
      <div className="prp-line-composer-loc">
        <code>{anchor.path}</code> · {where}
      </div>
      <textarea
        ref={ref}
        className="prd-input"
        placeholder={t('prPage.lineCommentPlaceholder')}
        aria-label={label}
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            escape()
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            if (text.trim() && !busy) onPost(text)
          }
        }}
      />
      <div className="prp-line-composer-actions">
        <button type="button" className="btn primary tiny" onClick={() => onPost(text)} disabled={busy || !text.trim()}>
          {busy ? <Loader2 size={12} className="spin" /> : <MessageSquare size={12} />} {t('prPage.lineCommentPost')}
        </button>
        <button type="button" className="btn ghost tiny" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <span className="prp-line-composer-hint">{t('prPage.lineCommentHint')}</span>
      </div>
    </div>
  )
}

function SectionTab({
  id,
  active,
  onPick,
  icon,
  label,
  count
}: {
  id: Section
  active: Section
  onPick: (s: Section) => void
  icon: React.ReactNode
  label: string
  count?: number
}): React.JSX.Element {
  return (
    <button role="tab" aria-selected={active === id} className={`prp-tab ${active === id ? 'active' : ''}`} onClick={() => onPick(id)}>
      {icon} {label}
      {count !== undefined && count > 0 && <span className="prp-tab-count">{count}</span>}
    </button>
  )
}

/**
 * One end of a pull request: the branch name as a link that checks it out —
 * fetching it first when it exists only on the server — and a copy button.
 * The branch already checked out is marked instead of linked, and a fork's
 * source branch is not linked at all: it lives in another repository.
 */
function PrBranchName({
  name,
  title,
  usable,
  onGo,
  isCurrent,
  inFork
}: {
  name: string
  title: string
  usable: boolean
  onGo: () => void
  isCurrent: boolean
  inFork: boolean
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const copyName = (): void => {
    void navigator.clipboard.writeText(name)
    toast('success', t('prPage.branchCopied'))
  }
  let label: React.ReactNode
  if (isCurrent) {
    label = (
      <>
        <code title={name}>{name}</code>
        <span className="prp-branch-current">{t('prPage.currentBranch')}</span>
      </>
    )
  } else if (inFork) {
    label = <code title={name}>{name}</code>
  } else {
    // aria-disabled rather than disabled: a disabled button shows no tooltip,
    // and the tooltip is the only place that says why it does nothing.
    label = (
      <button
        type="button"
        className="prp-branch-go"
        aria-disabled={!usable}
        title={title}
        aria-label={title}
        onClick={() => usable && onGo()}
      >
        <code>{name}</code>
      </button>
    )
  }
  return (
    <span className="prp-branch">
      {label}
      <button
        type="button"
        className="icon-btn prp-branch-copy"
        title={t('sidebar.copyBranchName')}
        aria-label={t('sidebar.copyBranchName')}
        onClick={copyName}
      >
        <Copy size={11} />
      </button>
    </span>
  )
}

/** A header shortcut to one of the PR's branches; same rules as the field's links. */
function BranchGoButton({
  title,
  usable,
  onGo,
  icon
}: {
  title: string
  usable: boolean
  onGo: () => void
  icon: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="icon-btn prp-branch-head-go"
      aria-disabled={!usable}
      title={title}
      aria-label={title}
      onClick={() => usable && onGo()}
    >
      {icon}
    </button>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="issue-field prp-field">
      <div className="issue-field-label">
        {icon} {label}
      </div>
      <div className="issue-field-val">{children}</div>
    </div>
  )
}

function StatusIcon({ status }: { status: ReturnType<typeof prStatus> }): React.JSX.Element {
  if (status === 'merged') return <GitMerge size={13} />
  if (status === 'closed') return <GitPullRequestClosed size={13} />
  if (status === 'draft') return <GitPullRequestDraft size={13} />
  return <GitPullRequest size={13} />
}

function ReviewIcon({ state }: { state: ReviewerState }): React.JSX.Element {
  if (state === 'APPROVED') return <Check size={13} className="prp-rv prp-rv-ok" />
  if (state === 'CHANGES_REQUESTED') return <X size={13} className="prp-rv prp-rv-bad" />
  if (state === 'COMMENTED') return <MessageSquare size={12} className="prp-rv" />
  return <Clock size={12} className="prp-rv prp-rv-wait" />
}

/**
 * Files, lines and commits. GitHub reports the totals with the PR; GitLab gives
 * only a file count, so lines are summed from the file list once it arrives.
 */
function ChangeSummary({ pr, files }: { pr: PrDetail; files: PrFile[] | null }): React.JSX.Element {
  const t = useT()
  const add = pr.additions ?? files?.reduce((n, f) => n + f.additions, 0)
  const del = pr.deletions ?? files?.reduce((n, f) => n + f.deletions, 0)
  const fileCount = pr.changedFiles ?? files?.length
  const total = (add ?? 0) + (del ?? 0)
  return (
    <div className="prp-changes">
      {fileCount !== undefined && (
        <div>{interp(t(fileCount === 1 ? 'prPage.filesOne' : 'prPage.filesMany'), { n: String(fileCount) })}</div>
      )}
      {pr.commits !== undefined && (
        <div className="prp-commits">
          <GitCommitHorizontal size={12} />
          {interp(t(pr.commits === 1 ? 'prPage.commitsOne' : 'prPage.commitsMany'), {
            n: pr.commitsCapped ? `${pr.commits}+` : String(pr.commits)
          })}
        </div>
      )}
      {add !== undefined && del !== undefined && (
        <>
          <div className="prd-file-stat">
            <span className="ins-add">+{add}</span> <span className="ins-del">−{del}</span>
          </div>
          {total > 0 && (
            <div className="prp-bar" aria-hidden>
              <span className="prp-bar-add" style={{ width: `${(add / total) * 100}%` }} />
              <span className="prp-bar-del" style={{ width: `${(del / total) * 100}%` }} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The changed files with their diffs: a list to pick from and tick off as
 * viewed, and the selected file's changes beside it, drawn by the same viewer
 * as the rest of the app (read-only — no hunk actions on someone else's PR).
 */
function FilesSection({
  files,
  viewed,
  onToggleViewed,
  repoPath,
  prUrl,
  threads,
  renderThread,
  lineDraft,
  lineDraftText,
  onOpenLineDraft,
  onCancelLineDraft,
  onPostLineDraft,
  busy
}: {
  files: PrFile[]
  viewed: Set<string>
  onToggleViewed: (f: string) => void
  repoPath: string
  prUrl: string
  threads: PrReviewThread[]
  renderThread: (th: PrReviewThread) => React.ReactNode
  lineDraft: { anchor: PrLineAnchor } | null
  lineDraftText: React.RefObject<string>
  onOpenLineDraft: (anchor: PrLineAnchor) => void
  onCancelLineDraft: () => void
  onPostLineDraft: (text: string) => Promise<boolean>
  busy: boolean
}): React.JSX.Element {
  const t = useT()
  const maskSecrets = useSettingsStore((s) => s.settings.maskSecrets)
  const [selected, setSelected] = useState<string>(files[0]?.filename ?? '')
  const file = files.find((f) => f.filename === selected) ?? files[0]
  const diffRef = useRef<HTMLDivElement>(null)

  // The same parse the viewer draws, so an index here is a line there.
  const lines = useMemo(() => (file?.patch ? parseDiff(file.patch) : []), [file?.patch])
  const threadsByLine = useMemo(
    () => (file ? getThreadsByLine(threads, file, lines) : new Map<number, PrReviewThread[]>()),
    [threads, file, lines]
  )
  const draftHere = !!file && !!lineDraft && lineDraft.anchor.path === file.filename
  const draftIdx = useMemo(
    () =>
      file && lineDraft && lineDraft.anchor.path === file.filename
        ? lines.findIndex((l) => {
            const a = getLineAnchor(l, file)
            return !!a && isSameAnchor(a, lineDraft.anchor)
          })
        : -1,
    [file, lineDraft, lines]
  )

  // The page's handlers change every render; the blocks under the lines must
  // not, or the diff would be rebuilt for nothing. The latest ones ride a ref.
  const handlers = useRef({ onCancelLineDraft, onPostLineDraft, onOpenLineDraft })
  handlers.current = { onCancelLineDraft, onPostLineDraft, onOpenLineDraft }
  // Closing the box puts the focus back on its line's "+" (or the diff), so a
  // keyboard user is where they were — not at the top of the page.
  const refocusLine = useCallback((idx: number): void => {
    requestAnimationFrame(() => {
      const root = diffRef.current
      const target =
        root?.querySelector<HTMLElement>(`.diff-comment-btn[data-line-idx="${idx}"]`) ??
        root?.querySelector<HTMLElement>('.diff-viewer')
      target?.focus()
    })
  }, [])
  const composer = useMemo(
    () =>
      lineDraft ? (
        <LineCommentComposer
          key={`${lineDraft.anchor.path}:${lineDraft.anchor.kind}:${lineDraft.anchor.oldLine}:${lineDraft.anchor.newLine}`}
          anchor={lineDraft.anchor}
          draft={lineDraftText}
          busy={busy}
          onCancel={() => {
            handlers.current.onCancelLineDraft()
            if (draftIdx >= 0) refocusLine(draftIdx)
          }}
          onPost={(text) =>
            void handlers.current.onPostLineDraft(text).then((ok) => {
              if (ok && draftIdx >= 0) refocusLine(draftIdx)
            })
          }
        />
      ) : null,
    [lineDraft, lineDraftText, busy, draftIdx, refocusLine]
  )
  const lineExtras = useMemo(() => {
    const map = new Map<number, React.ReactNode>()
    for (const [idx, ths] of threadsByLine) {
      map.set(idx, <div className="prp-line-threads">{ths.map((th) => renderThread(th))}</div>)
    }
    if (draftIdx >= 0) {
      map.set(
        draftIdx,
        <>
          {map.get(draftIdx)}
          {composer}
        </>
      )
    }
    return map
  }, [threadsByLine, renderThread, draftIdx, composer])
  const commentOnLine = useCallback(
    (idx: number): void => {
      const anchor = file && lines[idx] ? getLineAnchor(lines[idx], file) : null
      if (anchor) handlers.current.onOpenLineDraft(anchor)
    },
    [file, lines]
  )

  return (
    <div className="prp-files-split">
      <div className="prp-file-list">
        <div className="prd-section-title">
          {interp(t('prDetail.filesViewed'), { n: `${viewed.size}/${files.length}` })}
        </div>
        {files.map((f) => (
          <div
            key={f.filename}
            className={`prd-file prp-file-row ${f.filename === file?.filename ? 'selected' : ''} ${viewed.has(f.filename) ? 'viewed' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(f.filename)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSelected(f.filename)
              }
            }}
          >
            <input
              type="checkbox"
              checked={viewed.has(f.filename)}
              title={t('prPage.markViewed')}
              aria-label={t('prPage.markViewed')}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleViewed(f.filename)}
            />
            <span className={`prd-file-status st-${f.status}`} title={f.status}>
              {f.status === 'added' ? 'A' : f.status === 'removed' ? 'D' : f.status === 'renamed' ? 'R' : 'M'}
            </span>
            <span className="prd-file-name" title={f.filename}>
              {f.filename}
            </span>
            <span className="prd-file-stat">
              <span className="ins-add">+{f.additions}</span> <span className="ins-del">−{f.deletions}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="prp-file-diff" ref={diffRef}>
        {file && (
          <>
            <div className="prp-file-diff-head">
              <code title={file.filename}>{file.filename}</code>
              {file.previousFilename && (
                <span className="prp-side-note">{interp(t('prPage.renamedFrom'), { path: file.previousFilename })}</span>
              )}
              <label className="prp-viewed-toggle">
                <input type="checkbox" checked={viewed.has(file.filename)} onChange={() => onToggleViewed(file.filename)} />
                {t('prPage.markViewed')}
              </label>
            </div>
            {/* A draft whose line is gone from a refreshed diff stays, above it. */}
            {draftHere && draftIdx < 0 && file.patch && <div className="diff-line-extra">{composer}</div>}
            {file.patch ? (
              <DiffViewer
                // A fresh viewer per file: its scroll and selection belong to one diff.
                key={file.filename}
                diff={file.patch}
                file={file.filename}
                lang={guessLanguage(file.filename)}
                // Same rule as every other diff in the app: secret-looking files
                // show KEY=•••• while the setting is on.
                maskValues={maskSecrets && isSecretFile(file.filename)}
                repoPath={repoPath}
                onCommentLine={commentOnLine}
                lineExtras={lineExtras}
              />
            ) : (
              <div className="prp-no-patch">
                <p>{t('prPage.noPatch')}</p>
                <button className="btn ghost small" // GitHub lists a PR's files at /files, GitLab an MR's at /diffs.
                  onClick={() => void shellApi.openExternal(`${prUrl}${prUrl.includes('/-/merge_requests/') ? '/diffs' : '/files'}`)}>
                  <ExternalLink size={13} /> {t('common.openInBrowser')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
