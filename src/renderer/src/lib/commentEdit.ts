import type { HostingProvider, PrCommentHandle, PrDetail, PrReviewThread } from '../../../shared/types'
import type { TranslationKey } from '../i18n'

/**
 * Editing and deleting your own comments on the PR and issue pages: who "you"
 * are, which confirm a delete asks, and the edit drafts the unsent-text check
 * counts. Pure, so it is tested without a page.
 */

/** An edit in progress: what the box holds, and the text it started from. */
export interface CommentEditDraft {
  text: string
  original: string
}

/** Who the page's viewer is, as the PR or issue detail carries it. */
export interface CommentViewer {
  viewer?: string | null
  viewerId?: string | null
  /** The viewer's unique account name (Azure DevOps), matched like an id. */
  viewerUniqueName?: string | null
  /** Authors are display names two people can share: only ids may match. */
  viewerById?: boolean
}

const sameText = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/**
 * The viewer wrote this comment, and the host gave a way to reach it. Ids
 * decide when both sides have one; on Azure DevOps the unique account name
 * decides too, since the identity id in a comment is not guaranteed to be the
 * one the connection reports — either match is enough, both being unique per
 * user. On a host that names authors by display name, a missing id offers
 * nothing rather than guess. Logins compare case-insensitively, as hosts treat
 * them; an unknown viewer owns nothing. The host still decides: this only
 * chooses whether to offer actions.
 */
export function isMyComment(
  comment: { author: string; authorId?: string; authorUniqueName?: string; handle?: PrCommentHandle },
  who: CommentViewer | null | undefined
): boolean {
  return !!comment.handle && isWrittenByViewer(comment, who)
}

/**
 * The viewer wrote this entry — isMyComment's matching without the handle it
 * needs to offer actions: what "N new since your last visit" leaves out.
 */
export function isWrittenByViewer(
  comment: { author: string; authorId?: string; authorUniqueName?: string },
  who: CommentViewer | null | undefined
): boolean {
  if (!who) return false
  // A blank name names nobody: only a real one on both sides may match.
  const author = comment.authorUniqueName?.trim()
  const viewer = who.viewerUniqueName?.trim()
  if (author && viewer && sameText(author, viewer)) return true
  if (comment.authorId && who.viewerId) return sameText(comment.authorId, who.viewerId)
  if (who.viewerById) return false
  return !!who.viewer && !!comment.author && sameText(comment.author, who.viewer)
}

/**
 * GitHub: the thread's first comment is gone (deleted), so its replies point
 * at a comment that no longer exists, and the REST reply endpoint takes no
 * reply to a reply. Such a thread is answered through GraphQL, by the thread's
 * own id (`hostingApi.prReplyReviewThread`).
 */
export function isThreadRootMissing(provider: HostingProvider | undefined, thread: PrReviewThread): boolean {
  return provider === 'github' && !thread.comments.some((c) => c.id === thread.rootId)
}

/** Every comment key a PR page shows — what the open edits are kept against. */
export function getCommentKeys(pr: Pick<PrDetail, 'comments' | 'reviewThreads'>): Set<string> {
  const keys = new Set<string>()
  for (const c of pr.comments) if (c.handle) keys.add(getCommentKey(c.handle))
  for (const th of pr.reviewThreads) for (const c of th.comments) if (c.handle) keys.add(getCommentKey(c.handle))
  return keys
}

/**
 * Drop the edits of comments the page no longer shows — deleted meanwhile —
 * so an orphaned draft does not make the page ask "leave unsent text?" forever.
 */
export function pruneEditDrafts(drafts: Record<string, CommentEditDraft>, keys: Set<string>): void {
  for (const k of Object.keys(drafts)) if (!keys.has(k)) delete drafts[k]
}

/** One key per comment, stable across reloads: two hosts' ids never meet on one page. */
export function getCommentKey(handle: PrCommentHandle): string {
  return `${handle.kind}:${handle.threadId ?? ''}:${handle.id}`
}

/** The edit would change something: whitespace at the ends is not a change (the host trims it). */
export function isEditChanged(draft: CommentEditDraft | undefined): boolean {
  return !!draft && draft.text.trim() !== draft.original.trim()
}

/** Any open edit holds a change nobody saved — for the page's "leave unsent text?" check. */
export function hasUnsavedEdit(drafts: Record<string, CommentEditDraft>): boolean {
  return Object.values(drafts).some(isEditChanged)
}

/**
 * The delete confirm's message. Deleting the first comment of a thread that
 * has replies does different things per host, and the confirm says which.
 */
export function getDeleteConfirmKey(provider: HostingProvider | undefined, firstWithReplies: boolean): TranslationKey {
  if (!firstWithReplies) return 'prComment.deleteMessage'
  switch (provider) {
    case 'azure':
      return 'prComment.deleteFirstAzure'
    case 'gitlab':
      return 'prComment.deleteFirstGitlab'
    case 'bitbucket':
      return 'prComment.deleteFirstBitbucket'
    case 'github':
      return 'prComment.deleteFirstGithub'
    default:
      return 'prComment.deleteMessage'
  }
}

const sameHandle = (a: PrCommentHandle | undefined, b: PrCommentHandle): boolean =>
  !!a && getCommentKey(a) === getCommentKey(b)

/** The page's PR with one comment's text replaced — shown at once, before the refetch answers. */
export function withCommentBody(pr: PrDetail, handle: PrCommentHandle, body: string): PrDetail {
  // The host's rendering is of the old text: drop it, so the new text renders
  // locally until the page reads the pull request again.
  const edit = <C extends { body: string; bodyHtml?: string; edited?: boolean }>(c: C): C => {
    const { bodyHtml: _stale, ...rest } = c
    return { ...rest, body, edited: true } as C
  }
  return {
    ...pr,
    comments: pr.comments.map((c) => (sameHandle(c.handle, handle) ? edit(c) : c)),
    reviewThreads: pr.reviewThreads.map((th) =>
      th.comments.some((c) => sameHandle(c.handle, handle))
        ? { ...th, comments: th.comments.map((c) => (sameHandle(c.handle, handle) ? edit(c) : c)) }
        : th
    )
  }
}

/** The host did not find the comment (deleted, or out of this token's sight): the page should read it again. */
export function isCommentGone(message: string): boolean {
  return /Comment change \[gone\]:/.test(message)
}
