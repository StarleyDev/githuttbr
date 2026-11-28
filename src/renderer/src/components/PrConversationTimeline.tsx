import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronRight, MessageSquare, X } from 'lucide-react'
import type { PrComment, PrCommit, PrDetail, PrReview, PrReviewThread } from '../../../shared/types'
import { HostUserAvatar as Avatar } from './HostUserAvatar'
import { useT, interp, type TranslationKey } from '../i18n'
import { timeAgo } from '../lib/timeAgo'
import { splitByLastVisit } from '../lib/prVisits'
import type { ReviewerState } from '../lib/prSummary'
import {
  buildPrTimeline,
  countOpenThreads,
  filterPrTimeline,
  getHunkLines,
  getPrPersonRoles,
  type PrTimelineFilter,
  type PrTimelineItem
} from '../lib/prTimeline'

// Comments first, and the one shown on opening: the conversation is what you
// come here to read. "All" adds the pushes and reviews back, at the end.
const FILTERS: { id: PrTimelineFilter; labelKey: TranslationKey }[] = [
  { id: 'comments', labelKey: 'prTimeline.filterComments' },
  { id: 'reviews', labelKey: 'prTimeline.filterReviews' },
  { id: 'commits', labelKey: 'prTimeline.filterCommits' },
  { id: 'all', labelKey: 'prTimeline.filterAll' }
]

const REVIEW_SENTENCE: Partial<Record<PrReview['state'], TranslationKey>> = {
  APPROVED: 'prTimeline.reviewApproved',
  CHANGES_REQUESTED: 'prTimeline.reviewChanges',
  COMMENTED: 'prTimeline.reviewCommented'
}

/**
 * A translated sentence with React nodes in its placeholders — a name in bold,
 * a path as a button — so each locale keeps its own word order.
 */
function interpNodes(template: string, vars: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1]
    return <Fragment key={i}>{name && name in vars ? vars[name] : part}</Fragment>
  })
}

/** "2d ago", with the full date on hover. Nothing for a date the host did not give. */
export function TimeAgoLabel({ iso, at }: { iso?: string | null; at?: number }): React.JSX.Element | null {
  const t = useT()
  const ms = at ?? (iso ? Date.parse(iso) : NaN)
  if (!Number.isFinite(ms) || ms <= 0) return null
  const ago = timeAgo(ms, Date.now())
  if (!ago) return null
  return (
    <time className="prt-time" dateTime={new Date(ms).toISOString()} title={new Date(ms).toLocaleString()}>
      {interp(t(ago.key), { n: ago.n })}
    </time>
  )
}

/** The sidebar's verdict for a reviewer who decided: "✓ approved" or "requested changes". */
export function PrReviewerVerdict({ state }: { state: ReviewerState }): React.JSX.Element | null {
  const t = useT()
  if (state === 'APPROVED') return <span className="prt-verdict prt-verdict-ok">{t('prTimeline.verdictApproved')}</span>
  if (state === 'CHANGES_REQUESTED')
    return <span className="prt-verdict prt-verdict-bad">{t('prTimeline.verdictChanges')}</span>
  return null
}

/**
 * The Conversation tab as one timeline down a rail: the description, comments,
 * line threads where they were started, review verdicts and pushes, in the
 * order they happened. A filter narrows it; "N open threads" shows only what is
 * still to answer; a line marks what came after the last visit.
 *
 * The page keeps everything that writes: a comment's edit box (`renderComment`),
 * a thread's comments and reply box (`renderThread`), the Markdown
 * (`renderMarkdown`). This draws where each goes and what is said around it.
 */
export function PrConversationTimeline({
  pr,
  commits,
  lastVisit,
  renderMarkdown,
  renderComment,
  renderThread,
  onViewInFiles,
  onOpenCommits
}: {
  pr: PrDetail
  /** The PR's commits, oldest first — null until read (the pushes then fill in). */
  commits: readonly PrCommit[] | null
  /** When this PR's page was last left (lib/prVisits.ts); null on a first visit. */
  lastVisit: number | null
  renderMarkdown: (body: string, bodyHtml?: string) => ReactNode
  /** One conversation comment: its header (built here) over its body, editable when it is yours. */
  renderComment: (comment: PrComment, head: ReactNode) => ReactNode
  /** One line thread's comments and reply box, without its location (drawn here). */
  renderThread: (thread: PrReviewThread) => ReactNode
  onViewInFiles: (path: string) => void
  onOpenCommits: () => void
}): React.JSX.Element {
  const t = useT()
  const [filter, setFilter] = useState<PrTimelineFilter>('comments')
  const [openOnly, setOpenOnly] = useState(false)
  // Resolved threads opened from their one-line summary.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const items = useMemo(() => buildPrTimeline(pr, commits), [pr, commits])
  const freshCount = useMemo(() => splitByLastVisit(items, lastVisit).fresh.length, [items, lastVisit])
  const shown = useMemo(() => filterPrTimeline(items, filter, openOnly), [items, filter, openOnly])
  const { seen, fresh } = useMemo(() => splitByLastVisit(shown, lastVisit), [shown, lastVisit])
  const openThreads = countOpenThreads(pr.reviewThreads)

  const name = (login: string): ReactNode => {
    const roles = getPrPersonRoles(pr, login)
    return (
      <>
        <strong>{login}</strong>
        {roles.author && <span className="prt-role author">{t('prTimeline.roleAuthor')}</span>}
        {roles.reviewer && <span className="prt-role reviewer">{t('prTimeline.roleReviewer')}</span>}
      </>
    )
  }
  const dot = (login: string): ReactNode => (
    <span className="prt-dot prt-dot-face" aria-hidden="true">
      <Avatar login={login} avatars={pr.avatars} size={18} />
    </span>
  )
  const place = (th: PrReviewThread): string => `${th.path}${th.line != null ? `:${th.line}` : ''}`

  const renderItem = (it: PrTimelineItem): ReactNode => {
    switch (it.kind) {
      case 'description':
        return (
          <div key={it.id} className="prt-entry">
            {dot(pr.author)}
            <article className="prp-card prt-item">
              <div className="prp-card-head prt-head">
                {interpNodes(t('prTimeline.opened'), { author: name(pr.author) })}
                {pr.createdAt && <span className="prt-sep">·</span>}
                <TimeAgoLabel iso={pr.createdAt} />
              </div>
              <div className={`prp-card-body ${pr.body.trim() ? '' : 'prp-muted'}`}>
                {pr.body.trim() ? renderMarkdown(pr.body, pr.bodyHtml) : t('prPage.noDescription')}
              </div>
            </article>
          </div>
        )
      case 'comment': {
        const c = it.comment
        return (
          <div key={it.id} className="prt-entry">
            {dot(c.author)}
            <article className="prp-card prt-item">
              {renderComment(
                c,
                <>
                  {name(c.author)}
                  <span className="prt-sep">·</span>
                  <TimeAgoLabel iso={c.createdAt} />
                </>
              )}
            </article>
          </div>
        )
      }
      case 'thread': {
        const th = it.thread
        const first = th.comments[0]
        const where = place(th)
        if (th.resolved && !expanded.has(it.id)) {
          return (
            <div key={it.id} className="prt-entry">
              <button
                type="button"
                className="prt-item prt-resolved"
                aria-expanded={false}
                onClick={() => setExpanded((s) => new Set(s).add(it.id))}
              >
                <ChevronRight size={12} aria-hidden="true" />
                <span>
                  {interpNodes(t(th.comments.length === 1 ? 'prTimeline.resolvedOne' : 'prTimeline.resolvedMany'), {
                    place: <code className="prt-path">{where}</code>,
                    n: th.comments.length
                  })}
                </span>
              </button>
            </div>
          )
        }
        const hunk = getHunkLines(th.diffHunk)
        return (
          <div key={it.id} className="prt-entry">
            {dot(first?.author ?? '?')}
            <article className={`prt-item prt-thread${th.resolved === false ? ' is-open' : ''}`}>
              <header className="prt-head prt-thread-head">
                {th.resolved && (
                  <button
                    type="button"
                    className="prt-collapse"
                    aria-expanded={true}
                    title={t('prTimeline.collapseResolved')}
                    aria-label={t('prTimeline.collapseResolved')}
                    onClick={() =>
                      setExpanded((s) => {
                        const next = new Set(s)
                        next.delete(it.id)
                        return next
                      })
                    }
                  >
                    <ChevronRight size={12} className="prt-collapse-open" />
                  </button>
                )}
                {interpNodes(t('prTimeline.commentedOn'), {
                  // The card headers carry the roles; a thread names its author plainly.
                  author: <strong>{first?.author ?? '?'}</strong>,
                  place: (
                    <button
                      type="button"
                      className="prt-path prt-path-link"
                      title={interp(t('prTimeline.viewInFilesHint'), { path: th.path })}
                      onClick={() => onViewInFiles(th.path)}
                    >
                      {where}
                    </button>
                  )
                })}
                {first && <span className="prt-sep">·</span>}
                <TimeAgoLabel iso={first?.createdAt} />
                <span className="prt-grow" />
                {th.resolved === false && <span className="prt-pill prt-pill-open">{t('prTimeline.threadOpen')}</span>}
                {th.resolved === true && (
                  <span className="prt-pill prt-pill-resolved">{t('prTimeline.threadResolved')}</span>
                )}
                <button
                  type="button"
                  className="prp-link prt-files-link"
                  title={interp(t('prTimeline.viewInFilesHint'), { path: th.path })}
                  onClick={() => onViewInFiles(th.path)}
                >
                  {t('prTimeline.viewInFiles')}
                </button>
              </header>
              {hunk.length > 0 && (
                <pre className="prt-hunk">
                  {hunk.map((l, i) => (
                    <span key={i} className={`prt-hunk-line prt-hunk-${l.kind}`}>
                      <span className="prt-hunk-sign">{l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}</span>
                      <span className="prt-hunk-no">{l.line ?? ''}</span>
                      <span className="prt-hunk-text">{l.text}</span>
                    </span>
                  ))}
                </pre>
              )}
              <div className="prt-thread-body">{renderThread(th)}</div>
            </article>
          </div>
        )
      }
      case 'review': {
        const r = it.review
        const tone = r.state === 'APPROVED' ? 'ok' : r.state === 'CHANGES_REQUESTED' ? 'bad' : 'note'
        const key = REVIEW_SENTENCE[r.state] ?? 'prTimeline.reviewCommented'
        return (
          <div key={it.id} className={`prt-item prt-review prt-review-${tone}`}>
            <span className={`prt-dot prt-dot-icon prt-dot-${tone}`} aria-hidden="true">
              {tone === 'ok' ? (
                <Check size={10} strokeWidth={3} />
              ) : tone === 'bad' ? (
                <X size={10} strokeWidth={3} />
              ) : (
                <MessageSquare size={10} />
              )}
            </span>
            <div className="prt-review-line">
              <span className="prt-verb">{interpNodes(t(key), { author: <strong>{r.author}</strong> })}</span>
              <span className="prt-sep">·</span>
              <TimeAgoLabel iso={r.submittedAt} />
            </div>
            {r.body?.trim() && <div className="prt-review-body">{renderMarkdown(r.body)}</div>}
          </div>
        )
      }
      case 'push':
        return (
          <div key={it.id} className="prt-item prt-push">
            <span className="prt-dot prt-dot-ring" aria-hidden="true" />
            <div className="prt-push-line">
              {interpNodes(t(it.commits.length === 1 ? 'prTimeline.pushedOne' : 'prTimeline.pushedMany'), {
                author: <strong>{it.author}</strong>,
                n: it.commits.length
              })}
              <span className="prt-sep">·</span>
              <TimeAgoLabel at={it.at} />
            </div>
            {it.commits.map((c) => (
              <div key={c.sha} className="prt-push-commit">
                <button
                  type="button"
                  className="prt-sha"
                  title={t('prTimeline.openCommitsHint')}
                  onClick={onOpenCommits}
                >
                  {c.shortSha}
                </button>
                <span className="prt-subject">{c.subject}</span>
              </div>
            ))}
          </div>
        )
    }
  }

  return (
    <div className="prt">
      <div className="prt-bar">
        <span className="prt-seg" role="group" aria-label={t('prTimeline.filterLabel')}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id && !openOnly ? 'active' : ''}
              aria-pressed={filter === f.id && !openOnly}
              onClick={() => {
                setFilter(f.id)
                setOpenOnly(false)
              }}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </span>
        {openThreads > 0 && (
          <button
            type="button"
            className={`prt-open-chip${openOnly ? ' active' : ''}`}
            aria-pressed={openOnly}
            title={t('prTimeline.openThreadsHint')}
            onClick={() => setOpenOnly((v) => !v)}
          >
            {interp(t(openThreads === 1 ? 'prTimeline.openThreadsOne' : 'prTimeline.openThreadsMany'), {
              n: openThreads
            })}
          </button>
        )}
        <span className="prt-grow" />
        {freshCount > 0 && (
          <span className="prt-new-summary">
            {interp(t(freshCount === 1 ? 'prTimeline.newSinceOne' : 'prTimeline.newSinceMany'), { n: freshCount })}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="prp-muted prp-pad">{t('prTimeline.empty')}</p>
      ) : (
        <div className="prt-rail">
          {seen.map(renderItem)}
          {fresh.length > 0 && (
            <div className="prt-new-divider" role="separator">
              <span>{t('prTimeline.newDivider')}</span>
            </div>
          )}
          {fresh.map(renderItem)}
        </div>
      )}
    </div>
  )
}
