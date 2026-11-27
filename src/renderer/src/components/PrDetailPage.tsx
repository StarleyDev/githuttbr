import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GitPullRequest,
  Eye,
  FilePen,
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
  MoreHorizontal,
  ScrollText,
  Target,
  History
} from 'lucide-react'
import type {
  PageContent,
  PrCheck,
  PrCommentHandle,
  PrDetail,
  PrFile,
  PrDiffRevision,
  PrFilesFetchMode,
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
import { PrUpdatesSection, usePrUpdates, usePrUpdatesSeen } from './PrUpdatesSection'
import { PrUpdateDiffBanner, usePrUpdateDiff, type UpdateDiffView } from './PrUpdateDiff'
import { forgetFinished } from '../stores/prList'
import { useUIStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { repoActions, useRepoStore } from '../stores/repo'
import { remoteForPrUrl } from '../lib/prBranchGo'
import { remoteWebUrl, type AutolinkOptions } from '../lib/autolink'
import { getReferenceHost } from '../lib/references'
import type { IconTone } from '../lib/iconTone'
import { getReferenceAutolinkOptions, ReferenceScope } from './ReferenceLink'
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
import { PrFileList } from './PrFileList'
import { PrNoPatchNotice } from './PrNoPatchNotice'
import { getPrFilesUrl, PrImagePreview, type PrImageSource } from './PrImagePreview'
import { createPrImageCache } from '../lib/prImageCache'
import { restoreScrollTop } from '../lib/scrollRestore'
import {
  collectOrphanDrafts,
  getPrViewKey,
  prViewStates,
  type OrphanDraft,
  type PrViewState
} from '../lib/prViewState'
import '../stores/prView'
import { PrOrphanDrafts } from './PrOrphanDrafts'
import { copyPrPath, openPrPathMenu } from './prFileActions'
import { getImageMime, isPreviewableImage, type PrDiffCommits } from '../../../shared/prImage'
import { getThreadCountsByPath } from '../lib/prFileThreads'
import { usePrViewed } from './usePrViewed'
import { guessLanguage } from '../lib/highlight'
import { isSecretFile } from '../lib/secrets'
import { useT, interp, type TranslationKey } from '../i18n'
import { readableError } from '../lib/gitErrorHint'
import { parseDiff } from '../lib/diff'
import { getLineAnchor, getThreadsByLine, isSameAnchor } from '../lib/prLineComment'
import { getAnchorLine } from '../../../shared/prLineAnchor'
import { MarkdownEditor, useRepoReferenceGetter } from './MarkdownEditor'
import { collectMentionNames, type MarkdownReference } from '../lib/markdownEdit'
import { EditableComment } from './EditableComment'
import { RemoteMarkdown, RemotePreviewProvider } from './RemoteMarkdown'
import {
  getCommentKey,
  getCommentKeys,
  getDeleteConfirmKey,
  hasUnsavedEdit,
  isCommentGone,
  isMyComment,
  isThreadRootMissing,
  withCommentBody,
  type CommentEditDraft
} from '../lib/commentEdit'
import { stripOuterNewlines } from '../../../shared/prCommentHandle'

type PrPage = Extract<PageContent, { type: 'pr' }>
type Section = 'conversation' | 'commits' | 'updates' | 'files' | 'checks'
const SECTIONS: readonly Section[] = ['conversation', 'commits', 'updates', 'files', 'checks']
/**
 * The comment boxes' "leave for the guide?" question. Nothing typed on this
 * page is lost by leaving it — every box's text stays with the PR until the PR
 * is closed (lib/prViewState.ts) — so there is nothing to ask.
 */
const NEVER_LOST = (): boolean => false

/** No review threads: an update's own diff takes no line comments. */
const NO_THREADS: PrReviewThread[] = []

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
  // The two commits the files were diffed between — the image preview reads the same ones.
  const [filesCommits, setFilesCommits] = useState<PrDiffCommits | null>(null)
  // The host listed fewer files than the pull request has.
  const [filesTruncated, setFilesTruncated] = useState(false)
  // The list is fetching the PR's commits into this clone (main/prLocalFiles.ts).
  const [fetchingCommits, setFetchingCommits] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Where this PR's page was when it was last left, and its unsent text
  // (lib/prViewState.ts). The boxes below write into it as they change.
  const [view] = useState(() => {
    const state = prViewStates.getOrCreateViewState(getPrViewKey(repoPath, remoteUrl, number))
    // Text from pull requests let go past the cap lands here, on the next page opened.
    state.orphans.push(...prViewStates.takeEvictedDrafts())
    return state
  })
  const [section, setSection] = useState<Section>(() => (SECTIONS.includes(view.section as Section) ? (view.section as Section) : 'conversation'))
  const [comment, setComment] = useState(view.comment)
  const [busy, setBusy] = useState(false)
  const [mergeMethod, setMergeMethod] = useState<PrMergeMethod>('merge')
  // Per-thread reply drafts, keyed by the thread root id (GitHub comment id or
  // GitLab discussion id). Text being typed lives in the box itself; these refs
  // only remember it — for the unsent-draft check, and for the same thread's box
  // in the other tab — so a keystroke re-renders one box, not the whole page
  // (and with it every highlighted line of the diff).
  const replyDrafts = useRef<Record<string, string>>(view.replyDrafts)
  // Edits of your own comments in progress, by comment key — same reasoning.
  const editDrafts = useRef<Record<string, CommentEditDraft>>(view.editDrafts)
  // The comment being written on one line of the Files tab's diff. One at a
  // time, kept while another file is looked at, so nothing typed is lost.
  const [lineDraft, setLineDraft] = useState<{ anchor: PrLineAnchor } | null>(view.lineDraft)
  // The page's remembered state holds this ref, so the composer's keystrokes land there directly.
  const lineDraftText = view.lineText
  // Unsent texts whose place a refresh found gone: shown until copied or discarded.
  const [orphans, setOrphans] = useState<OrphanDraft[]>(view.orphans)
  useEffect(() => {
    view.section = section
    view.comment = comment
    view.lineDraft = lineDraft
  }, [view, section, comment, lineDraft])

  // "Viewed" ticks, per file version: a push that changes a ticked file un-ticks it.
  const { viewed, changed: changedSinceViewed, setFilesViewed } = usePrViewed(remoteUrl, number, files)
  const toggleViewed = (f: string): void => setFilesViewed([f], !viewed.has(f))

  const tokens = useMemo(
    () => ({
      github: profile.githubToken || undefined,
      gitlab: profile.gitlabToken || undefined,
      forgejo: profile.forgejoToken || undefined,
      azure: profile.azureToken || undefined
    }),
    [profile.githubToken, profile.gitlabToken, profile.forgejoToken, profile.azureToken]
  )
  // Images the Files tab has read, for this page's life (one page per pull request).
  const [imageCache] = useState(() => createPrImageCache())
  const prUrl = pr?.url ?? ''
  const prSource = pr?.source ?? ''
  const prSourceRepo = pr?.sourceRepo ?? null
  // Where the Files tab's images come from. Rebuilt when the files are re-read,
  // so a push is picked up. The merge base is asked of the host once per head
  // (a refresh that finds the same head asks nothing), and not at all where the
  // files' revision already names it.
  const commitsByHead = useRef(new Map<string, Promise<PrDiffCommits | null>>())
  const revHead = filesRevision?.headSha ?? null
  const revBase = filesRevision?.baseSha ?? null
  const listCommits = filesCommits
  const imageSource = useMemo<PrImageSource>(() => {
    let unkeyed: Promise<PrDiffCommits | null> | null = null
    const ask = (): Promise<PrDiffCommits | null> => hostingApi.prDiffCommits(repoPath, remoteUrl, tokens, number).catch(() => null)
    return {
      repoPath,
      remoteUrl,
      tokens,
      pr: { number, url: prUrl, source: prSource, sourceRepo: prSourceRepo },
      cache: imageCache,
      getCommits: () => {
        // The file list already resolved them (main's resolvePrMergeBase): no second ask.
        if (listCommits && (!revHead || listCommits.headSha === revHead)) return Promise.resolve(listCommits)
        if (revHead && revBase) return Promise.resolve({ baseSha: revBase, headSha: revHead, baseKind: 'mergeBase' as const })
        if (!revHead) return (unkeyed ??= ask())
        const known = commitsByHead.current.get(revHead)
        if (known) return known
        const asked = ask().then((c) => {
          // A failed ask is not remembered: the next look tries again.
          if (!c) commitsByHead.current.delete(revHead)
          return c
        })
        commitsByHead.current.set(revHead, asked)
        return asked
      }
    }
    // Without a revision, a re-read of the files is the only sign the head may have moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, remoteUrl, tokens, number, prUrl, prSource, prSourceRepo, imageCache, revHead, revBase, listCommits, revHead ? null : files])
  // Forgejo has no API to reply inside an existing line thread.
  const canReplyInThread = provider !== 'forgejo'

  // Bumped by every load, so the Commits tab re-reads with the rest of the page.
  const [reloads, setReloads] = useState(0)
  // Bumped by the Refresh button only: the Updates tab re-reads its pushes then,
  // not after every comment or review the page posts.
  const [refreshes, setRefreshes] = useState(0)
  // `fetchMode`: the first load may fetch the PR's missing commits once, Refresh again; a reload after a write never.
  const load = useCallback(async (fetchMode: PrFilesFetchMode = 'none'): Promise<void> => {
    setError(null)
    setReloads((n) => n + 1)
    try {
      const detail = await hostingApi.prDetail(repoPath, remoteUrl, tokens, number)
      // An edit of a comment that is gone now has nothing left to save.
      // A reply or an edit whose thread or comment is gone keeps its text, as a notice.
      const moved = collectOrphanDrafts(view, {
        threadIds: new Set(detail.reviewThreads.map((th) => String(th.rootId))),
        commentKeys: getCommentKeys(detail),
        filePaths: null
      })
      if (moved) setOrphans([...view.orphans])
      setPr(detail)
      // Checks and files fill in after the conversation: the page is usable first.
      void hostingApi.prChecks(repoPath, remoteUrl, tokens, number).then(setChecks).catch(() => setChecks([]))
      void hostingApi
        .prFiles(repoPath, remoteUrl, tokens, number, fetchMode)
        .then((list) => {
          // A line comment on a file the diff no longer lists keeps its text, as a notice.
          if (collectOrphanDrafts(view, { threadIds: null, commentKeys: null, filePaths: new Set(list.files.map((f) => f.filename)) })) {
            setOrphans([...view.orphans])
            setLineDraft(null)
          }
          setFiles(list.files)
          setFilesRevision(list.revision)
          setFilesCommits(list.commits ?? null)
          setFilesTruncated(!!list.truncated)
        })
        .catch(() => {
          setFiles([])
          setFilesRevision(null)
          setFilesCommits(null)
          setFilesTruncated(false)
        })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [repoPath, remoteUrl, number, tokens, view])

  useEffect(() => {
    setLoading(true)
    void load('once').finally(() => setLoading(false))
  }, [load])

  // The hint while the list fetches this PR's commits, for this page only.
  useEffect(
    () =>
      hostingApi.onPrFilesFetching((p) => {
        if (p.repoPath === repoPath && p.remoteUrl === remoteUrl && p.number === number) setFetchingCommits(p.fetching)
      }),
    [repoPath, remoteUrl, number]
  )

  // A file read on demand joins the list — drawn by the same viewer, line comments and all —
  // when it was read between the same two commits as the entry it replaces, compared against
  // the list as it is now: a refresh that landed while the read ran leaves the new entry alone.
  const takeFileDiff = useCallback((read: PrFile): void => {
    const src = read.diffSource
    if (!read.patch || !src) return
    setFiles(
      (list) =>
        list?.map((f) =>
          f.filename === read.filename && f.diffSource?.headSha === src.headSha && f.diffSource?.baseSha === src.baseSha ? read : f
        ) ?? list
    )
  }, [])
  const reloadFiles = useCallback(() => void load(), [load])


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
  /**
   * Closes without merging — for a pull request opened by mistake or no longer
   * wanted. It asks first and says what stays: the branch, the commits and the
   * conversation, so Reopen undoes it.
   */
  const closePullRequest = (): void => {
    if (!pr) return
    useUIStore.getState().openDialog({
      kind: 'confirm',
      title: interp(t('prDetail.closePrTitle'), { number }),
      message: interp(t('prDetail.closePrMessage'), { branch: pr.source }),
      danger: true,
      confirmLabel: t('prDetail.closePr'),
      onConfirm: () =>
        void act(() => hostingApi.prSetState(repoPath, remoteUrl, tokens, number, 'closed'), t('prDetail.prClosed'))
    })
  }
  const reopenPullRequest = (): void =>
    void act(() => hostingApi.prSetState(repoPath, remoteUrl, tokens, number, 'open'), t('prDetail.prReopened'))
  /** Back to draft (not ready, reviewers not asked yet), or a draft marked ready — each undoes the other. */
  const setPullRequestDraft = (draft: boolean): void =>
    void act(
      () => hostingApi.prSetDraft(repoPath, remoteUrl, tokens, number, draft),
      t(draft ? 'prDetail.movedToDraft' : 'prDetail.markedReady')
    )
  /**
   * Reply in a review thread. True once the host took the reply — even when
   * reading the page again fails after it — so the card never offers the
   * host's page (and a second copy) for a reply that went through.
   */
  const replyToThread = async (thread: PrReviewThread, text: string): Promise<boolean> => {
    const body = text.trim()
    if (!body) return false
    // GitHub: with the first comment gone, REST has nothing to reply to — the
    // reply goes to the thread itself (GraphQL), found through a comment still in it.
    const survivor = isThreadRootMissing(provider, thread) ? thread.comments[0] : undefined
    setBusy(true)
    let pending = false
    try {
      if (survivor) pending = (await hostingApi.prReplyReviewThread(repoPath, remoteUrl, tokens, number, survivor.id, body)).pending
      else await hostingApi.prReplyReviewComment(repoPath, remoteUrl, tokens, number, thread.rootId, body)
    } catch (err) {
      toast('error', readableError(err instanceof Error ? err.message : String(err), t, interp))
      setBusy(false)
      return false
    }
    replyDrafts.current[String(thread.rootId)] = ''
    // A reply filed under the viewer's pending review is not posted: nobody sees it yet.
    if (pending) toast('info', t('prComment.replyPendingReview'))
    else toast('success', t('prDetail.replyPosted'))
    try {
      await load()
      void useRepoStore.getState().refreshPRs(repoPath, { silent: true })
    } catch {
      /* the reply is in; the page shows its own read error */
    } finally {
      setBusy(false)
    }
    return true
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

  // Your own comments: the host still decides, the page only offers. "You" is
  // only ever the viewer this PR's own read named — never the list's, which may
  // be another profile's, or stale. A 404 means the comment is not there (or
  // not visible to this token): its edit is dropped and the page reads the PR again.
  const readAgainIfGone = (handle: PrCommentHandle) => (err: unknown): never => {
    if (isCommentGone(err instanceof Error ? err.message : String(err))) {
      delete editDrafts.current[getCommentKey(handle)]
      void load()
    }
    throw err
  }
  const saveCommentEdit = (handle: PrCommentHandle, text: string): Promise<boolean> =>
    act(async () => {
      const body = stripOuterNewlines(text)
      await hostingApi.prEditComment(repoPath, remoteUrl, tokens, number, handle, body).catch(readAgainIfGone(handle))
      setPr((cur) => (cur ? withCommentBody(cur, handle, body) : cur))
    }, t('prComment.saved'))
  const askDeleteComment = (handle: PrCommentHandle, firstWithReplies: boolean): void => {
    useUIStore.getState().openModal({
      kind: 'confirm',
      title: t('prComment.deleteTitle'),
      message: t(getDeleteConfirmKey(provider, firstWithReplies)),
      danger: true,
      confirmLabel: t('prComment.delete'),
      onConfirm: () =>
        void act(
          () => hostingApi.prDeleteComment(repoPath, remoteUrl, tokens, number, handle).catch(readAgainIfGone(handle)),
          t('prComment.deleted')
        )
    })
  }

  // Who an @ offers and what a # offers: only what this page and the repository's
  // lists already hold — no request of their own.
  const mentions = useMemo(
    () =>
      pr
        ? collectMentionNames(
            participants(pr),
            pr.requestedReviewers?.filter((r) => !r.team).map((r) => r.login),
            pr.assignees?.map((a) => a.login)
          )
        : [],
    [pr]
  )
  const getReferences = useRepoReferenceGetter(repoPath)

  // One review thread — in the conversation, and under its line in the Files
  // tab. Stable while nothing it shows changes, so the Files tab's line blocks
  // (and the diff under them) are not rebuilt for an unrelated re-render.
  const replyRef = useRef(replyToThread)
  replyRef.current = replyToThread
  const changeRef = useRef({ save: saveCommentEdit, remove: askDeleteComment })
  changeRef.current = { save: saveCommentEdit, remove: askDeleteComment }
  const web = remoteWebUrl(remoteUrl)
  // `#12` / `!12` / `AB#12` get a hover card with the title (components/ReferenceLink.tsx).
  const refHost = useMemo(() => getReferenceHost(remoteUrl, provider), [remoteUrl, provider])
  const linkOptions = getReferenceAutolinkOptions(refHost)
  const threadCard = useCallback(
    (th: PrReviewThread, withLocation: boolean): React.JSX.Element | null =>
      pr ? (
        <ReviewThreadCard
          key={th.rootId}
          thread={th}
          pr={pr}
          web={web}
          linkOptions={linkOptions}
          withLocation={withLocation}
          canReply={canReplyInThread}
          rootMissing={isThreadRootMissing(provider, th)}
          drafts={replyDrafts}
          editDrafts={editDrafts}
          onReply={(text) => replyRef.current(th, text)}
          onSaveEdit={(handle, text) => changeRef.current.save(handle, text)}
          onDelete={(handle, firstWithReplies) => changeRef.current.remove(handle, firstWithReplies)}
          busy={busy}
          mentions={mentions}
          getReferences={getReferences}
        />
      ) : null,
    [pr, web, linkOptions, canReplyInThread, provider, busy, mentions, getReferences]
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
  // The Updates tab (PrUpdatesSection.tsx): read with the page, for its "1 new".
  const updates = usePrUpdates(repoPath, remoteUrl, tokens, number, refreshes)
  const updatesSeen = usePrUpdatesSeen(remoteUrl, number, updates.list, section === 'updates')
  // One update's own changes, shown in the Files tab instead of the whole PR's.
  const [updateView, setUpdateView] = useState<UpdateDiffView | null>(() => (view.updateView as UpdateDiffView | null) ?? null)
  useEffect(() => {
    view.updateView = updateView
  }, [view, updateView])

  // The page body's scroll, per tab: written as it scrolls, put back once the
  // tab's content is there (after a remount, or on coming back to the tab).
  const bodyRef = useRef<HTMLDivElement>(null)
  const restoreScroll = useRef<Section | null>(section)
  useEffect(() => {
    restoreScroll.current = section
  }, [section])
  const sectionReady =
    !loading &&
    !!pr &&
    (section === 'conversation' ||
      (section === 'commits' && !!commits.list) ||
      (section === 'updates' && !!updates.list) ||
      (section === 'files' && !!files) ||
      (section === 'checks' && !!checks))
  // A tab whose data failed never becomes ready: stop waiting, so its scroll is recorded again.
  const sectionFailed =
    !loading &&
    (!!error ||
      !pr ||
      (section === 'commits' && !!commits.error && !commits.list) ||
      (section === 'updates' && !!updates.error && !updates.list))
  useEffect(() => {
    if (sectionFailed && restoreScroll.current === section) restoreScroll.current = null
  }, [sectionFailed, section])
  useEffect(() => {
    const el = bodyRef.current
    if (!el || !sectionReady || restoreScroll.current !== section) return
    restoreScroll.current = null
    return restoreScrollTop(el, view.scroll[section] ?? 0)
  }, [sectionReady, section, view])
  const updateDiff = usePrUpdateDiff(repoPath, remoteUrl, tokens, number, updateView)
  // In an update's own diff an image compares the update's two heads, not the merge base.
  const updateImageSource = useMemo<PrImageSource | null>(() => {
    if (!updateView) return null
    const ends: PrDiffCommits = { baseSha: updateView.compare.from.sha, headSha: updateView.compare.to.sha, baseKind: 'mergeBase' }
    return { ...imageSource, getCommits: () => Promise.resolve(ends) }
  }, [updateView, imageSource])

  const content = (
    <div className="prp-frame">
      <div className="prp-page">
        <div className="prp-main">
          {/* One block, so the stacked layout can pin it whole (see .prp-top). */}
          <div className="prp-top">
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
              {/* Each action its own hue (Settings → Themes → Icon colours, lib/iconTone.ts). */}
              <button className="icon-btn" data-tone="refresh" title={t('prPage.refresh')} onClick={() => {
                  setRefreshes((n) => n + 1)
                  void load('refresh')
                }} disabled={busy}>
                <RefreshCw size={14} />
              </button>
              {aiEnabled && pr && (
                <button className="icon-btn" data-tone="ai" title={t('sidebar.aiPrReview')} onClick={reviewWithAi}>
                  <Sparkles size={14} />
                </button>
              )}
              <button className="icon-btn" data-tone="preview" title={t('prPreview.open')} onClick={previewLocally}>
                <GitPullRequestArrow size={14} />
              </button>
              {pr && (
                <>
                  <BranchGoButton
                    title={branchGoTitle(pr.source, !!pr.sourceRepo, 'prPage.goToSource')}
                    usable={!pr.sourceRepo && canGo}
                    onGo={() => void goToBranch(pr.source)}
                    icon={<GitBranch size={14} />}
                    tone="source"
                  />
                  <BranchGoButton
                    title={branchGoTitle(pr.target, false, 'prPage.goToTarget')}
                    usable={canGo}
                    onGo={() => void goToBranch(pr.target)}
                    icon={<Target size={14} />}
                    tone="target"
                  />
                </>
              )}
              {pr && (
                // No tone: leaving the app is not one of the page's own actions, so it stays grey.
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
              <SectionTab
                id="updates"
                active={section}
                onPick={setSection}
                icon={<History size={13} />}
                label={t('prUpdates.tab')}
                count={updates.list?.updates.length}
                newCount={updatesSeen.unseen.size}
              />
              <SectionTab id="files" active={section} onPick={setSection} icon={<FileDiff size={13} />} label={t('prPage.tabFiles')} count={files?.length ?? pr?.changedFiles} />
              <SectionTab id="checks" active={section} onPick={setSection} icon={<CircleDot size={13} />} label={t('prPage.tabChecks')} count={checks?.length} />
            </nav>
          </div>

          <div
            className="prp-body"
            ref={bodyRef}
            onScroll={(e) => {
              // Not while a tab waits to be put back: its first frames are another tab's height.
              if (restoreScroll.current === null) view.scroll[section] = e.currentTarget.scrollTop
            }}
          >
            {orphans.length > 0 && (
              <PrOrphanDrafts
                orphans={orphans}
                onDismiss={(id) => {
                  view.orphans = view.orphans.filter((o) => o.id !== id)
                  setOrphans(view.orphans)
                }}
              />
            )}
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
                    {pr.body.trim() ? (
                      <RemoteMarkdown body={pr.body} bodyHtml={pr.bodyHtml} repoWebUrl={web} linkOptions={linkOptions} />
                    ) : (
                      t('prPage.noDescription')
                    )}
                  </div>
                </article>

                {pr.comments.map((c, i) => (
                  <article key={c.handle ? `${c.handle.threadId ?? ''}:${c.handle.id}` : i} className="prp-card">
                    <EditableComment
                      handle={c.handle}
                      body={c.body}
                      edited={c.edited}
                      mine={isMyComment(c, pr)}
                      headClassName="prp-card-head"
                      bodyClassName="prp-card-body"
                      head={
                        <>
                          <Avatar login={c.author} avatars={pr.avatars} />
                          <strong>{c.author}</strong>
                          <span>{fmtDate(c.createdAt)}</span>
                        </>
                      }
                      rendered={<RemoteMarkdown body={c.body} bodyHtml={c.bodyHtml} repoWebUrl={web} linkOptions={linkOptions} />}
                      drafts={editDrafts}
                      busy={busy}
                      mentions={mentions}
                      getReferences={getReferences}
                      hasUnsentText={NEVER_LOST}
                      onSave={saveCommentEdit}
                      onDelete={(handle) => askDeleteComment(handle, !!c.hasReplies)}
                    />
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
            ) : section === 'updates' ? (
              <PrUpdatesSection
                list={updates.list}
                error={updates.error}
                seen={updatesSeen}
                onViewChanges={(update, compare, numbering) => {
                  setUpdateView({ update, compare, numbering })
                  setSection('files')
                }}
              />
            ) : section === 'files' ? (
              updateView ? (
                <>
                  <PrUpdateDiffBanner
                    repoPath={repoPath}
                    remoteUrl={remoteUrl}
                    pr={pr}
                    view={updateView}
                    state={updateDiff.state}
                    onRetry={updateDiff.retry}
                    onShowAll={() => setUpdateView(null)}
                  />
                  {updateDiff.state.status === 'ready' && updateDiff.state.files.length > 0 && (
                    <FilesSection
                      // A fresh list per update: its selection belongs to one diff.
                      key={updateView.update.id}
                      files={updateDiff.state.files}
                      viewed={viewed}
                      changedSinceViewed={changedSinceViewed}
                      onToggleViewed={toggleViewed}
                      onSetFilesViewed={setFilesViewed}
                      repoPath={repoPath}
                      prUrl={pr.url}
                      threads={NO_THREADS}
                      renderThread={renderFileThread}
                      lineDraft={null}
                      lineDraftText={lineDraftText}
                      onOpenLineDraft={openLineDraft}
                      onCancelLineDraft={cancelLineDraft}
                      onPostLineDraft={postLineDraft}
                      busy={busy}
                      mentions={mentions}
                      getReferences={getReferences}
                      lineCommentsOff
                      imageSource={updateImageSource}
                      view={view}
                      prSource={pr.source}
                    />
                  )}
                </>
              ) : files === null ? (
                <div className="prd-empty">
                  <Loader2 size={15} className="spin" /> {fetchingCommits ? t('prPage.fetchingPrCommits') : t('prDetail.loading')}
                </div>
              ) : files.length === 0 ? (
                <p className="prp-muted prp-pad">{t('prPage.noFiles')}</p>
              ) : (
                <>
                {(fetchingCommits || filesTruncated) && (
                  <p className="prp-side-note prp-files-banner" role="status">
                    {fetchingCommits && <Loader2 size={12} className="spin" aria-hidden="true" />}{' '}
                    {fetchingCommits ? t('prPage.fetchingPrCommits') : interp(t('prPage.filesTruncated'), { n: String(files.length) })}
                  </p>
                )}
                <FilesSection
                  files={files}
                  viewed={viewed}
                  changedSinceViewed={changedSinceViewed}
                  onToggleViewed={toggleViewed}
                  onSetFilesViewed={setFilesViewed}
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
                  mentions={mentions}
                  getReferences={getReferences}
                  imageSource={imageSource}
                  view={view}
                  prSource={pr.source}
                  onFileDiffRead={takeFileDiff}
                  onReloadFiles={reloadFiles}
                />
                </>
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
                <MarkdownEditor
                  placeholder={t('prDetail.commentPlaceholder')}
                  value={comment}
                  onChange={setComment}
                  mentions={mentions}
                  getReferences={getReferences}
                  // Leaving for the guide unmounts the page: every box on it counts.
                  hasUnsentText={NEVER_LOST}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      if (!busy) submitComment()
                    }
                  }}
                />
                <div className="prp-composer-actions">
                  <button className="btn ghost small prd-reject" onClick={() => review('REQUEST_CHANGES')} disabled={busy}>
                    <X size={13} /> {t('prDetail.requestChanges')}
                  </button>
                  <button className="btn ghost small prd-approve" onClick={() => review('APPROVE')} disabled={busy}>
                    <Check size={13} /> {t('prDetail.approve')}
                  </button>
                  <button className="btn ghost small" onClick={submitComment} disabled={busy || !comment.trim()}>
                    <MessageSquare size={13} /> {t('prDetail.comment')}
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
                    <button
                      className="btn ghost small"
                      onClick={() => setPullRequestDraft(!pr.draft)}
                      disabled={busy}
                      title={t(pr.draft ? 'prDetail.markReadyHint' : 'prDetail.moveToDraftHint')}
                    >
                      {pr.draft ? <Eye size={13} /> : <FilePen size={13} />}{' '}
                      {t(pr.draft ? 'prDetail.markReady' : 'prDetail.moveToDraft')}
                    </button>
                    <button
                      className="btn ghost small danger"
                      onClick={closePullRequest}
                      disabled={busy}
                      title={t('prDetail.closePrHint')}
                    >
                      <GitPullRequestClosed size={13} /> {t('prDetail.closePr')}
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
                {!pr.merged && pr.state === 'closed' && (
                  <button className="btn ghost small prp-reopen" onClick={reopenPullRequest} disabled={busy}>
                    <GitPullRequest size={13} /> {t('prDetail.reopenPr')}
                  </button>
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
  return (
    <ReferenceScope repoPath={repoPath} remoteUrl={remoteUrl} host={refHost}>
      <RemotePreviewProvider repoWebUrl={web} linkOptions={linkOptions}>
        {content}
      </RemotePreviewProvider>
    </ReferenceScope>
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
  linkOptions,
  withLocation,
  canReply,
  rootMissing,
  drafts,
  editDrafts,
  onReply,
  onSaveEdit,
  onDelete,
  busy,
  mentions,
  getReferences
}: {
  thread: PrReviewThread
  pr: PrDetail
  web: string | undefined
  linkOptions: AutolinkOptions
  withLocation: boolean
  canReply: boolean
  /** GitHub: the thread's first comment was deleted — the reply goes through GraphQL, and the host's page is the fallback. */
  rootMissing: boolean
  drafts: React.RefObject<Record<string, string>>
  editDrafts: React.RefObject<Record<string, CommentEditDraft>>
  onReply: (text: string) => Promise<boolean>
  onSaveEdit: (handle: PrCommentHandle, text: string) => Promise<boolean>
  /** `firstWithReplies`: the thread's first comment, with others under it — the confirm says what each host does then. */
  onDelete: (handle: PrCommentHandle, firstWithReplies: boolean) => void
  busy: boolean
  mentions: string[]
  getReferences: () => MarkdownReference[]
}): React.JSX.Element {
  const t = useT()
  const key = String(thread.rootId)
  const [reply, setReply] = useState(() => drafts.current[key] ?? '')
  // A thread without its first comment is answered by another route; when that
  // fails, the host's own page is offered next to the box.
  const [replyFailed, setReplyFailed] = useState(false)
  const changeReply = (v: string): void => {
    setReply(v)
    drafts.current[key] = v
  }
  const send = (): void => {
    if (!reply.trim()) return
    void onReply(reply).then((ok) => {
      if (ok) setReply('')
      else if (rootMissing) setReplyFailed(true)
    })
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
      {thread.comments.map((c, i) => (
        <div key={c.id} className="prp-thread-comment">
          <EditableComment
            handle={c.handle}
            body={c.body}
            edited={c.edited}
            mine={isMyComment(c, pr)}
            headClassName="prp-card-head"
            bodyClassName="prp-card-body"
            head={
              <>
                <Avatar login={c.author} avatars={pr.avatars} />
                <strong>{c.author}</strong>
                <span>{fmtDate(c.createdAt)}</span>
              </>
            }
            rendered={<RemoteMarkdown body={c.body} bodyHtml={c.bodyHtml} repoWebUrl={web} linkOptions={linkOptions} />}
            drafts={editDrafts}
            busy={busy}
            mentions={mentions}
            getReferences={getReferences}
            hasUnsentText={NEVER_LOST}
            onSave={onSaveEdit}
            onDelete={(handle) => onDelete(handle, i === 0 && thread.comments.length > 1)}
          />
        </div>
      ))}
      {canReply && rootMissing && replyFailed && (
        <div className="prd-thread-reply prd-thread-orphan">
          <span>{t('prComment.rootDeletedReplyFailed')}</span>
          <button type="button" className="btn ghost tiny" onClick={() => void shellApi.openExternal(pr.url)}>
            <ExternalLink size={12} /> {t('prComment.replyOnGithub')}
          </button>
        </div>
      )}
      {canReply && (
        <div className="prd-thread-reply">
          {/* A textarea now, so Enter is a new line (or the next list item) and
              ⌘/Ctrl+Enter sends — the same keys as every other comment box. */}
          <MarkdownEditor
            compact
            inputClassName="prd-reply-input"
            placeholder={t('prDetail.replyPlaceholder')}
            value={reply}
            onChange={changeReply}
            mentions={mentions}
            getReferences={getReferences}
            // Leaving for the guide unmounts the page: every box on it counts.
            hasUnsentText={NEVER_LOST}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (!busy) send()
              }
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
  onPost,
  mentions,
  getReferences
}: {
  anchor: PrLineAnchor
  draft: React.RefObject<string>
  busy: boolean
  onCancel: () => void
  onPost: (text: string) => void
  mentions: string[]
  getReferences: () => MarkdownReference[]
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
      <MarkdownEditor
        inputRef={ref}
        placeholder={t('prPage.lineCommentPlaceholder')}
        ariaLabel={label}
        value={text}
        onChange={change}
        mentions={mentions}
        getReferences={getReferences}
        // Leaving for the guide unmounts the page: every box on it counts.
        hasUnsentText={NEVER_LOST}
        // Escape reaches this only when no @/# list is open: the list closes first.
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
        <span className="prp-line-composer-hint">{t('prPage.lineCommentHint')}</span>
        <button type="button" className="btn ghost tiny" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn primary tiny" onClick={() => onPost(text)} disabled={busy || !text.trim()}>
          {busy ? <Loader2 size={12} className="spin" /> : <MessageSquare size={12} />} {t('prPage.lineCommentPost')}
        </button>
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
  count,
  newCount
}: {
  id: Section
  active: Section
  onPick: (s: Section) => void
  icon: React.ReactNode
  label: string
  count?: number
  /** Items new since the last visit (the Updates tab). */
  newCount?: number
}): React.JSX.Element {
  const t = useT()
  const fresh = newCount !== undefined && newCount > 0 ? interp(t('prUpdates.tabNew'), { n: String(newCount) }) : null
  return (
    <button role="tab" aria-selected={active === id} className={`prp-tab ${active === id ? 'active' : ''}`} onClick={() => onPick(id)}>
      {icon} {label}
      {count !== undefined && count > 0 && <span className="prp-tab-count">{count}</span>}
      {fresh && (
        <span className="prp-tab-count prp-tab-new" aria-label={interp(t('prUpdates.newCount'), { n: String(newCount) })}>
          {fresh}
        </span>
      )}
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
  icon,
  tone
}: {
  title: string
  usable: boolean
  onGo: () => void
  icon: React.ReactNode
  tone: IconTone
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="icon-btn prp-branch-head-go"
      data-tone={tone}
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
  changedSinceViewed,
  onToggleViewed,
  onSetFilesViewed,
  repoPath,
  prUrl,
  threads,
  renderThread,
  lineDraft,
  lineDraftText,
  onOpenLineDraft,
  onCancelLineDraft,
  onPostLineDraft,
  busy,
  mentions,
  getReferences,
  lineCommentsOff = false,
  imageSource,
  view,
  prSource,
  onFileDiffRead,
  onReloadFiles
}: {
  files: PrFile[]
  viewed: Set<string>
  /** Ticked once, changed by a push since. */
  changedSinceViewed: Set<string>
  onToggleViewed: (f: string) => void
  onSetFilesViewed: (paths: string[], viewed: boolean) => void
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
  mentions: string[]
  getReferences: () => MarkdownReference[]
  /** An update's own diff: its lines are not the PR's, so no "+" to comment on them. */
  lineCommentsOff?: boolean
  /** Where an image file's two versions are read, for the preview in place of a diff. */
  imageSource: PrImageSource | null
  /** The page's remembered place: the file open, and how far the list and the diff were scrolled. */
  view: PrViewState
  /** The PR's source branch — the file actions say when the working copy is on another. */
  prSource: string
  /** A file read on demand, for the page to take into its list (and draw with the normal viewer). */
  onFileDiffRead?: (read: PrFile) => void
  /** Read the list again — after the notice fetched the PR's commits. */
  onReloadFiles?: () => void
}): React.JSX.Element {
  const t = useT()
  // The file list's speech-bubble counts; only recomputed when the threads change.
  const threadCounts = useMemo(() => getThreadCountsByPath(threads), [threads])
  const maskSecrets = useSettingsStore((s) => s.settings.maskSecrets)
  const [selected, setSelected] = useState<string>(() =>
    view.selectedFile && files.some((f) => f.filename === view.selectedFile) ? view.selectedFile : (files[0]?.filename ?? '')
  )
  const file = files.find((f) => f.filename === selected) ?? files[0]
  const diffRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (file) view.selectedFile = file.filename
  }, [view, file])
  // The diff's scroll, for the file it belongs to: put back once its lines are drawn.
  const diffScroller = (): HTMLElement | null => {
    const last = diffRef.current?.lastElementChild
    return last instanceof HTMLElement && !last.classList.contains('prp-file-diff-head') ? last : null
  }
  useEffect(() => {
    const saved = view.diffScroll
    if (!file || !saved || saved.file !== file.filename || saved.top <= 0) return
    let cancel = (): void => undefined
    // The viewer mounts a frame later than this effect: find it then, and follow it as it grows.
    const first = requestAnimationFrame(() => {
      const el = diffScroller()
      if (el) cancel = restoreScrollTop(el, saved.top)
    })
    return () => {
      cancelAnimationFrame(first)
      cancel()
    }
    // Once per file opened; the scroll listener below keeps it current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.filename])
  useEffect(() => {
    const root = diffRef.current
    if (!root || !file) return
    // Captured: the scroller is a child the diff viewer owns, swapped per file.
    const onScroll = (e: Event): void => {
      const el = e.target as HTMLElement
      if (el === diffScroller()) view.diffScroll = { file: file.filename, top: el.scrollTop }
    }
    root.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => root.removeEventListener('scroll', onScroll, { capture: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, file?.filename])
  const imageFile = !!file && isPreviewableImage(file.filename)
  const isSvg = imageFile && getImageMime(file.filename) === 'image/svg+xml'

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
          mentions={mentions}
          getReferences={getReferences}
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
    [lineDraft, lineDraftText, busy, draftIdx, refocusLine, mentions, getReferences]
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
      <PrFileList
        files={files}
        viewed={viewed}
        changedSinceViewed={changedSinceViewed}
        threadCounts={threadCounts}
        selected={file?.filename ?? ''}
        prKey={prUrl}
        onSelectFile={setSelected}
        onSetFilesViewed={onSetFilesViewed}
        onRowContextMenu={(x, y, row) => {
          const f = row.isDir ? undefined : files.find((it) => it.filename === row.path)
          openPrPathMenu(x, y, repoPath, { ...row, oldPath: f?.previousFilename, status: f?.status }, prSource)
        }}
        initialScroll={view.fileListScroll}
        onListScroll={(top) => {
          view.fileListScroll = top
        }}
      />

      <div className="prp-file-diff" ref={diffRef}>
        {file && (
          <>
            <div className="prp-file-diff-head">
              <code title={file.filename}>{file.filename}</code>
              {file.previousFilename && (
                <span className="prp-side-note">{interp(t('prPage.renamedFrom'), { path: file.previousFilename })}</span>
              )}
              <button
                type="button"
                className="icon-btn prp-branch-copy"
                title={t('fileTree.copyPath')}
                aria-label={interp(t('prFiles.copyPathOf'), { path: file.filename })}
                onClick={() => copyPrPath(file.filename)}
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                className="icon-btn"
                title={t('prFiles.moreActions')}
                aria-label={t('prFiles.moreActions')}
                aria-haspopup="menu"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  openPrPathMenu(r.left, r.bottom + 2, repoPath, {
                    path: file.filename,
                    isDir: false,
                    oldPath: file.previousFilename,
                    status: file.status
                  }, prSource)
                }}
              >
                <MoreHorizontal size={13} />
              </button>
              <label className="prp-viewed-toggle">
                <input type="checkbox" checked={viewed.has(file.filename)} onChange={() => onToggleViewed(file.filename)} />
                {t('prPage.markViewed')}
              </label>
            </div>
            {/* A draft whose line is gone from a refreshed diff stays, above it. */}
            {draftHere && draftIdx < 0 && file.patch && <div className="diff-line-extra">{composer}</div>}
            {imageFile && imageSource && (
              // A fresh preview per file, like the viewer below.
              <PrImagePreview key={`image:${file.filename}`} source={imageSource} file={file} />
            )}
            {/* An image's patch is "Binary files differ", or nothing; an SVG's is
                real text, so its diff (and its line comments) stays under the picture. */}
            {imageFile && imageSource && !isSvg ? null : file.patch ? (
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
                onCommentLine={lineCommentsOff ? undefined : commentOnLine}
                lineExtras={lineExtras}
              />
            ) : isSvg && imageSource ? null : (
              <div className="prp-no-patch">
                <PrNoPatchNotice
                  // One notice per file version: another push is another read.
                  key={`${file.filename}:${file.diffSource?.headSha ?? ''}:${file.diffSource?.baseSha ?? ''}`}
                  file={file}
                  repoPath={repoPath}
                  onFileDiffRead={onFileDiffRead}
                  onFetched={onReloadFiles}
                />
                <button className="btn ghost small" onClick={() => void shellApi.openExternal(getPrFilesUrl(prUrl))}>
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
