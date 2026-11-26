import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleDot,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Tag,
  User,
  Milestone,
  GitPullRequest,
  GitBranchPlus,
  MessageSquare,
  ClipboardList
} from 'lucide-react'
import { useT, interp, type TranslationKey } from '../i18n'
import { readableError } from '../lib/gitErrorHint'
import type { IssueDetail, LinkedPr, PageContent, PrCommentHandle } from '../../../shared/types'
import { isCommentGone, isMyComment, type CommentEditDraft } from '../lib/commentEdit'
import { EditableComment } from './EditableComment'
import { hostingApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { autolink, remoteWebUrl } from '../lib/autolink'
import { useRepoStore } from '../stores/repo'
import { NO_ITEMS } from '../lib/stableEmpty'
import { collectMentionNames } from '../lib/markdownEdit'
import { MarkdownEditor, useRepoReferenceGetter } from './MarkdownEditor'

type IssuePage = Extract<PageContent, { type: 'issue' }>

const PR_STATE_KEY: Record<LinkedPr['state'], TranslationKey> = {
  open: 'issue.linkedPrOpen',
  merged: 'issue.linkedPrMerged',
  closed: 'issue.linkedPrClosed'
}

export function IssueDetailPage({ page }: { page: IssuePage }): React.JSX.Element {
  const { repoPath, remoteUrl, issue } = page
  const toast = useUIStore((s) => s.toast)
  const t = useT()
  const openModal = useUIStore((s) => s.openModal)
  const profile = useSettingsStore((s) => s.activeProfile())
  const openPageTab = useSettingsStore((s) => s.openPageTab)
  const milestones = useRepoStore((s) => s.repos[repoPath]?.milestones ?? NO_ITEMS)
  const tokens = { github: profile.githubToken || undefined }

  const [detail, setDetail] = useState<IssueDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  // An @ offers the people this issue already shows; a # the repository's loaded PRs and issues.
  const mentions = useMemo(
    () => (detail ? collectMentionNames([detail.author], detail.assignees, detail.comments.map((c) => c.author)) : []),
    [detail]
  )
  const getReferences = useRepoReferenceGetter(repoPath)

  const load = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      setDetail(await hostingApi.issueDetail(repoPath, remoteUrl, tokens, issue.number))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, remoteUrl, issue.number])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const act = async (fn: () => Promise<void>, ok: string): Promise<boolean> => {
    setBusy(true)
    try {
      await fn()
      await load()
      void useRepoStore.getState().refreshIssues(repoPath, { silent: true })
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

  // Your own comments, as on the PR page: the same calls, with the issue's number.
  const editDrafts = useRef<Record<string, CommentEditDraft>>({})
  const readAgainIfGone = (err: unknown): never => {
    if (isCommentGone(err instanceof Error ? err.message : String(err))) void load()
    throw err
  }
  const saveCommentEdit = (handle: PrCommentHandle, text: string): Promise<boolean> =>
    act(
      () => hostingApi.prEditComment(repoPath, remoteUrl, tokens, issue.number, handle, text.trim()).catch(readAgainIfGone),
      t('prComment.saved')
    )
  const askDeleteComment = (handle: PrCommentHandle): void =>
    openModal({
      kind: 'confirm',
      title: t('prComment.deleteTitle'),
      message: t('prComment.deleteMessage'),
      danger: true,
      confirmLabel: t('prComment.delete'),
      onConfirm: () =>
        void act(
          () => hostingApi.prDeleteComment(repoPath, remoteUrl, tokens, issue.number, handle).catch(readAgainIfGone),
          t('prComment.deleted')
        )
    })

  const postComment = (): void => {
    if (!comment.trim()) return
    void act(() => hostingApi.prComment(repoPath, remoteUrl, tokens, issue.number, comment.trim()).then(() => setComment('')), t('issue.commentPosted'))
  }
  const toggleState = (): void => {
    const next = detail?.state === 'open' ? 'closed' : 'open'
    void act(() => hostingApi.setIssueState(repoPath, remoteUrl, tokens, issue.number, next), next === 'closed' ? t('issue.closedToast') : t('issue.reopenedToast'))
  }
  const createBranch = (): void => {
    openModal({
      kind: 'create-branch',
      path: repoPath,
      currentBranch: useRepoStore.getState().repos[repoPath]?.branches.current,
      // i18n-ignore model input for the branch-name suggestion; "closes #n" is GitHub's keyword
      description: `${issue.title} (closes #${issue.number})`
    })
  }

  const createPr = (): void => {
    openModal({
      kind: 'create-pr',
      repoPath,
      remoteUrl,
      source: useRepoStore.getState().repos[repoPath]?.branches.current,
      defaultTitle: issue.title,
      // The closing keyword auto-links the PR to this issue on GitHub.
      defaultBody: `Closes #${issue.number}\n\n`
    })
  }

  return (
    <div className="issue-page">
      <div className="issue-main">
        <div className="issue-head">
          <span className={`issue-state issue-${detail?.state ?? issue.state}`}>
            {(detail?.state ?? issue.state) === 'closed' ? <CheckCircle2 size={14} /> : <CircleDot size={14} />}
            {(detail?.state ?? issue.state) === 'closed' ? t('issue.closed') : t('issue.open')}
          </span>
          <h2>
            {detail?.title ?? issue.title} <span className="issue-num">#{issue.number}</span>
          </h2>
          <button className="icon-btn" title={t('common.openInBrowser')} onClick={() => void window.api.openExternal(issue.url)}>
            <ExternalLink size={15} />
          </button>
        </div>

        {loading ? (
          <div className="issue-loading">
            <Loader2 size={16} className="spin" /> {t('common.loading')}
          </div>
        ) : error ? (
          <div className="issue-error">{readableError(error, t, interp)}</div>
        ) : detail ? (
          <>
            <div className="issue-by">
              {interp(t('issue.openedBy'), {
                author: detail.author,
                date: new Date(detail.createdAt).toLocaleString()
              })}
            </div>
            {detail.body.trim() ? (
              <div className="issue-body">{autolink(detail.body, remoteWebUrl(remoteUrl))}</div>
            ) : (
              <div className="issue-body issue-body-empty">{t('issue.noDescription')}</div>
            )}

            <div className="issue-section-title">
              <MessageSquare size={13} /> {t('issue.conversation')}
              {detail.comments.length > 0 && <span className="issue-count">{detail.comments.length}</span>}
            </div>
            {detail.comments.map((c, i) => (
              <div key={c.handle?.id ?? i} className="issue-comment">
                <EditableComment
                  handle={c.handle}
                  body={c.body}
                  edited={c.edited}
                  mine={isMyComment(c.author, detail.viewer, c.handle)}
                  headClassName="issue-comment-head"
                  bodyClassName="issue-comment-body"
                  head={
                    <>
                      <strong>{c.author}</strong>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </>
                  }
                  rendered={autolink(c.body, remoteWebUrl(remoteUrl))}
                  drafts={editDrafts}
                  busy={busy}
                  mentions={mentions}
                  getReferences={getReferences}
                  onSave={saveCommentEdit}
                  onDelete={askDeleteComment}
                />
              </div>
            ))}

            <MarkdownEditor
              className="issue-editor"
              inputClassName="issue-input"
              placeholder={t('issue.commentPlaceholder')}
              value={comment}
              onChange={setComment}
              mentions={mentions}
              getReferences={getReferences}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  if (!busy) postComment()
                }
              }}
            />
            <div className="issue-actions">
              <button className="btn ghost small" onClick={postComment} disabled={busy || !comment.trim()}>
                <MessageSquare size={13} /> {t('issue.comment')}
              </button>
              <button className="btn ghost small" onClick={toggleState} disabled={busy}>
                {detail.state === 'open' ? t('issue.closeIssue') : t('issue.reopenIssue')}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <aside className="issue-side">
        <button className="btn primary small issue-branch-btn" onClick={createBranch}>
          <GitBranchPlus size={13} /> {t('issue.createBranch')}
        </button>
        <button className="btn ghost small issue-branch-btn" onClick={createPr}>
          <GitPullRequest size={13} /> {interp(t('issue.createPr'), { number: issue.number })}
        </button>

        <div className="issue-field">
          <div className="issue-field-label">
            <User size={12} /> {t('issue.assignees')}
          </div>
          <div className="issue-field-val">
            {detail?.assignees.length ? detail.assignees.join(', ') : <span className="issue-none">{t('common.none')}</span>}
          </div>
        </div>
        <div className="issue-field">
          <div className="issue-field-label">
            <Tag size={12} /> {t('issue.labels')}
          </div>
          <div className="issue-field-val">
            {detail?.labels.length ? (
              <span className="issue-labels">
                {detail.labels.map((l) => (
                  <span key={l} className="issue-label">
                    {l}
                  </span>
                ))}
              </span>
            ) : (
              <span className="issue-none">{t('common.none')}</span>
            )}
          </div>
        </div>
        <div className="issue-field">
          <div className="issue-field-label">
            <Milestone size={12} /> {t('issue.milestone')}
          </div>
          <div className="issue-field-val">
            {(() => {
              if (!detail?.milestone) return <span className="issue-none">{t('common.none')}</span>
              const m = milestones.find((x) => x.title === detail.milestone)
              if (!m) return detail.milestone
              return (
                <a
                  href="#"
                  className="issue-linked-pr"
                  onClick={(e) => {
                    e.preventDefault()
                    openPageTab({ type: 'milestone', milestone: m, repoPath, remoteUrl })
                  }}
                >
                  {detail.milestone}
                </a>
              )
            })()}
          </div>
        </div>
        {/* Hidden on hosts with no closing-PR lookup (Forgejo/Gitea): "none" there would be a lie. */}
        {detail && detail.linkedPrsStatus !== 'unsupported' && (
          <div className="issue-field">
            <div className="issue-field-label" title={t('issue.linkedPrsHint')}>
              <GitPullRequest size={12} /> {t('issue.linkedPrs')}
            </div>
            <div className="issue-field-val">
              {detail.linkedPrsStatus === 'unavailable' ? (
                <span className="issue-none">{t('issue.linkedPrsUnavailable')}</span>
              ) : detail.linkedPrs.length ? (
                detail.linkedPrs.map((pr) => (
                  <div key={pr.url} className="issue-linked-pr-row">
                    <a
                      href="#"
                      className="issue-linked-pr"
                      title={pr.otherRepo ? `${pr.repo}#${pr.number} ${pr.title}` : pr.title}
                      onClick={(e) => {
                        e.preventDefault()
                        // Same repo: the in-app PR page, like the sidebar. Another repo has no
                        // tab to open here, so it goes to the browser.
                        if (pr.otherRepo) void window.api.openExternal(pr.url)
                        else openPageTab({ type: 'pr', repoPath, remoteUrl, number: pr.number, title: pr.title })
                      }}
                    >
                      {pr.otherRepo ? `${pr.repo}#${pr.number}` : `#${pr.number}`} {pr.title}
                    </a>
                    <span className={`issue-pr-state pr-${pr.draft && pr.state === 'open' ? 'draft' : pr.state}`}>
                      {t(pr.draft && pr.state === 'open' ? 'issue.linkedPrDraft' : PR_STATE_KEY[pr.state])}
                    </span>
                  </div>
                ))
              ) : (
                <span className="issue-none">{t('common.none')}</span>
              )}
            </div>
          </div>
        )}
        {detail?.projectFields.map((g) => (
          <div key={g.project} className="issue-field">
            <div className="issue-field-label">
              <ClipboardList size={12} /> {g.project}
            </div>
            <div className="issue-project-fields">
              {g.fields.map((f) => (
                <div key={f.name} className="issue-project-field">
                  <span className="issue-pf-name">{f.name}</span>
                  <span className="issue-pf-val">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </aside>
    </div>
  )
}
