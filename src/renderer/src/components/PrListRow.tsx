import type { PullRequest } from '../../../shared/types'
import { interp, useT } from '../i18n'
import { highlightParts, isMine, type PrListItem } from '../lib/prList'
import { getCommitSubjectParts, getCommitTypeTone } from '../lib/prCommitSummary'
import { getPrCommentLabel, getPrReviewLines, getPrSize, hasPrNewActivity, type PrReviewTone } from '../lib/prListRow'
import { getPrVisitKey, getVisitFrom } from '../lib/prVisits'
import { timeAgo } from '../lib/timeAgo'
import { ciTitle } from './CiIcon'

/** The mark in front of each review line: what the colour says, for a reader who cannot see it. */
const REVIEW_GLYPH: Record<PrReviewTone, string> = { green: '✓', red: '✕', yellow: '●', muted: '●' }

/**
 * One pull request on the list page: the new-activity dot, the number, the
 * title with its Conventional type, who and where, the size, where each
 * reviewer stands, the checks and the last activity. What the host did not
 * say is left blank — never a zero that would read as a fact.
 */
export function PrListRow({
  item,
  query,
  me,
  now,
  visits,
  onOpen
}: {
  item: PrListItem
  query: string
  me: string | null
  now: number
  visits: Record<string, number> | undefined
  onOpen: () => void
}): React.JSX.Element {
  const t = useT()
  const { pr } = item
  const state = pr.state ?? 'open'
  const draft = pr.isDraft && state === 'open'
  const lastVisit = getVisitFrom(visits, getPrVisitKey(item.remoteUrl, pr.id))
  const fresh = hasPrNewActivity(pr, lastVisit)
  const ago = pr.updatedAt ? timeAgo(Date.parse(pr.updatedAt), now) : null
  const parts = getCommitSubjectParts(pr.title)
  const comments = getPrCommentLabel(pr, lastVisit, me)
  const size = getPrSize(pr)
  const review = getPrReviewLines(pr, me)
  return (
    <button className={`prl-row ${draft ? 'prl-row-draft' : ''}`} onClick={onOpen} title={`#${pr.id} ${pr.title}`}>
      <span className="prl-dot-cell">
        {fresh && <span className="prl-dot" title={t('prList.newActivity')} aria-label={t('prList.newActivity')} />}
      </span>
      <span className={`prl-num prl-num-${draft ? 'draft' : state}`}>#{pr.id}</span>
      <span className="prl-title">
        <span className="prl-title-text">
          {parts.type && (
            <span className={`prc-type prc-tone-${getCommitTypeTone(parts.type)}`}>
              {/* i18n-ignore a Conventional Commit type, the same in every language */}
              {parts.scope ? `${parts.type}(${parts.scope})` : parts.type}
            </span>
          )}
          {parts.type && ' '}
          {highlightParts(parts.rest, query).map((part, i) => (part.hit ? <mark key={i} className="search-hit">{part.text}</mark> : part.text))}
          {draft && <span className="prl-badge">{t('prList.draft')}</span>}
          {item.upstream && <span className="prl-badge">{interp(t('prList.onUpstream'), { repo: item.upstream })}</span>}
        </span>
        <span className="prl-sub">
          {/* Your own PRs do not repeat your name. */}
          {!isMine(pr, me) && <>{pr.author} · </>}
          <span className="prl-branches">
            {/* i18n-ignore branch names around an arrow */}
            {`${pr.sourceBranch} → ${pr.targetBranch}`}
          </span>
          {comments && (
            <>
              {' · '}
              {interp(t(comments.key), { n: comments.n })}
            </>
          )}
        </span>
      </span>
      <span
        className="prl-size"
        title={
          size?.lines
            ? interp(t('prList.sizeTitle'), { additions: size.lines.additions, deletions: size.lines.deletions, files: size.files })
            : size
              ? interp(t(size.files === 1 ? 'prList.sizeTitleFilesOne' : 'prList.sizeTitleFiles'), { files: size.files })
              : undefined
        }
      >
        {size && (
          <>
            {size.lines && (
              <>
                <span className="prl-add">+{size.lines.additions}</span> <span className="prl-del">−{size.lines.deletions}</span>
                {' · '}
              </>
            )}
            {interp(t(size.files === 1 ? 'prList.filesOne' : 'prList.files'), { n: size.files })}
          </>
        )}
      </span>
      <span className="prl-review">
        {review.lines.map((line, i) =>
          // A reviewer's name on its own line, the verdict under it in its colour:
          // a long display name and "requested changes" on one line did not fit.
          line.vars.name ? (
            <span key={i} className="prl-review-item">
              <span className="prl-review-name" title={line.vars.name}>
                {line.vars.name}
              </span>
              <span className={`prl-review-verdict prl-tone-${line.tone}`}>
                <span aria-hidden="true">{REVIEW_GLYPH[line.tone]} </span>
                {interp(t(line.key), line.vars)}
              </span>
            </span>
          ) : (
            <span key={i} className={`prl-tone-${line.tone}`}>
              {/* "No reviewers" is a plain remark, not a verdict: no mark in front. */}
              {line.key !== 'prList.reviewNone' && <span aria-hidden="true">{REVIEW_GLYPH[line.tone]} </span>}
              {interp(t(line.key), line.vars)}
            </span>
          )
        )}
        {review.more > 0 && <span className="prl-tone-muted">{interp(t('prList.reviewMore'), { n: review.more })}</span>}
      </span>
      <span className="prl-ci" title={pr.ci ? ciTitle(pr.ci, pr.ciCounts, t) : undefined}>
        <CiShort pr={pr} />
      </span>
      <span className="prl-updated" title={pr.updatedAt ? new Date(pr.updatedAt).toLocaleString() : undefined}>
        {ago ? interp(t(ago.key), { n: ago.n }) : ''}
      </span>
    </button>
  )
}

/** "✓ 6/6", "✕ 1 failing", "● 2 running" — the head's checks in a column's width. */
function CiShort({ pr }: { pr: PullRequest }): React.JSX.Element | null {
  const t = useT()
  const c = pr.ciCounts
  if (!pr.ci || !c) return null
  // Skipped and cancelled checks are not owed: 4 of 6 with 2 skipped is all green.
  const total = c.passed + c.failed + c.pending + c.unknown
  // Every check skipped or cancelled: nothing was owed, so nothing to count.
  if (!total) return null
  if (pr.ci === 'failure') {
    return (
      <span className="prl-tone-red">
        <span aria-hidden="true">✕ </span>
        {interp(t('ci.countFailed'), { n: c.failed })}
      </span>
    )
  }
  if (pr.ci === 'pending') {
    return (
      <span className="prl-tone-yellow">
        <span aria-hidden="true">● </span>
        {interp(t('ci.countPending'), { n: c.pending })}
      </span>
    )
  }
  return (
    <span className={pr.ci === 'success' ? 'prl-tone-green' : 'prl-tone-muted'}>
      {pr.ci === 'success' && <span aria-hidden="true">✓ </span>}
      {interp(t('prList.ciPassed'), { n: c.passed, total })}
    </span>
  )
}
