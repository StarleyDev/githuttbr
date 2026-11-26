import type { HostingProvider, PrCommentHandle, PrDetail } from '../../../shared/types'
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

/**
 * The viewer wrote this comment, and the host gave a way to reach it. Logins
 * compare case-insensitively, as hosts treat them; an unknown viewer owns nothing.
 * The host still decides: this only chooses whether to offer the actions.
 */
export function isMyComment(author: string, viewer: string | null | undefined, handle: PrCommentHandle | undefined): boolean {
  if (!handle || !viewer || !author) return false
  return author.toLowerCase() === viewer.toLowerCase()
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
  return {
    ...pr,
    comments: pr.comments.map((c) => (sameHandle(c.handle, handle) ? { ...c, body, edited: true } : c)),
    reviewThreads: pr.reviewThreads.map((th) =>
      th.comments.some((c) => sameHandle(c.handle, handle))
        ? { ...th, comments: th.comments.map((c) => (sameHandle(c.handle, handle) ? { ...c, body, edited: true } : c)) }
        : th
    )
  }
}

/** The host says the comment is not there any more: the page should read it again. */
export function isCommentGone(message: string): boolean {
  return /Comment change \[gone\]:/.test(message)
}
