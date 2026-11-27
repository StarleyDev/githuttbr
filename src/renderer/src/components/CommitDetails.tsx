import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Laptop, Tag, Cloud, Copy, StickyNote, Pencil, Trash2, FilePenLine, ChevronDown, ChevronUp } from 'lucide-react'
import type { CodeSearchHit, CommitBranchInfo, FileEntry, GraphCommit, RemoteInfo } from '../../../shared/types'
import { autolink, remoteWebUrl } from '../lib/autolink'
import { gitApi, shellApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { openCommitEdit } from './CommitEditView'
import { useSettingsStore } from '../stores/settings'
import { repoActions } from '../stores/repo'
import { FileListView } from './FileListView'
import {
  FileSearchBar,
  EMPTY_FILTER,
  isFilterActive,
  buildQueryRegExp,
  matchesGlobList,
  type FileFilter
} from './FileSearchBar'
import { MatchSummary, matchesByFile } from './SearchMatches'
import { ViewToggle } from './CommitComposer'
import { Avatar } from './Avatar'
import { RemoteIcon } from './RemoteIcon'
import { SignatureBadge } from './SignatureBadge'
import type { RepoData } from '../stores/repo'
import { useT, interp } from '../i18n'
import { openWithMenuItems } from '../lib/openWith'
import { stepRange, claimRangeKeys, ownsRangeKeys, rangeKeysBlocked, domOrder } from '../lib/rangeSelect'
import { ChangeSummary } from './ChangeSummary'
import { emojifyGitmoji } from '../../../shared/gitmoji'
import { isCoAuthorTrailer, previewCommitBody, reflowCommitBody, splitCommitBody, trailerPersonName } from '../lib/commitBody'
import { getReferenceHost } from '../lib/references'
import { getReferenceAutolinkOptions, ReferenceScope } from './ReferenceLink'

function profileUrl(name: string, email: string, remotes: RemoteInfo[]): string | undefined {
  const origin = remotes.find((r) => r.name === 'origin')?.url ?? remotes[0]?.url
  if (!origin) return undefined
  const ghNoreply = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/.exec(email)
  if (ghNoreply) return `https://github.com/${ghNoreply[1]}`
  if (origin.includes('github.com'))
    return `https://github.com/search?q=${encodeURIComponent(email)}&type=users`
  if (origin.includes('gitlab.com'))
    return `https://gitlab.com/search?search=${encodeURIComponent(name)}&nav_source=navbar&scope=users`
  if (origin.includes('bitbucket.org'))
    return `https://bitbucket.org/repo/all?search=${encodeURIComponent(name)}`
  return undefined
}

export function CommitDetails({ repo, hash }: { repo: RepoData; hash: string }): React.JSX.Element {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [branches, setBranches] = useState<CommitBranchInfo[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [filter, setFilter] = useState<FileFilter>(EMPTY_FILTER)
  const [hits, setHits] = useState<CodeSearchHit[] | null>(null)
  const fileView = useUIStore((s) => s.fileView)
  const setFileView = useUIStore((s) => s.setFileView)
  const toast = useUIStore((s) => s.toast)
  const openModal = useUIStore((s) => s.openModal)
  const activeProfile = useSettingsStore((s) => s.activeProfile)
  const defaultOpenApp = useSettingsStore((s) => s.settings.defaultOpenApp)
  const editor = useSettingsStore((s) => s.settings.editor)
  const commit: GraphCommit | undefined = repo.commits.find((c) => c.hash === hash)
  const t = useT()

  // The message below the subject. The graph log carries subjects only (a body
  // for every commit would slow a big repository's load), so the selected
  // commit's whole message is read here, one commit at a time.
  const [message, setMessage] = useState<{ hash: string; text: string } | null>(null)
  const [bodyExpanded, setBodyExpanded] = useState(false)
  useEffect(() => {
    setBodyExpanded(false)
    let live = true
    void gitApi
      .getCommitMessage(repo.path, hash)
      .then((text) => {
        if (live) setMessage({ hash, text })
      })
      .catch(() => {
        if (live) setMessage({ hash, text: '' })
      })
    return () => {
      live = false
    }
  }, [repo.path, hash])
  const body = useMemo(
    () => {
      if (!message || message.hash !== hash) return { text: '', trailers: [] }
      const split = splitCommitBody(message.text)
      return { ...split, text: reflowCommitBody(split.text) }
    },
    [message, hash]
  )
  const bodyPreview = useMemo(() => previewCommitBody(body.text), [body.text])

  // Multi-select over the commit's file list (⌘/Ctrl-click, Shift-click,
  // Shift+↑/↓), so "restore from this commit" can take several files at once.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClicked = useRef<string | null>(null)
  const keyToken = useRef(Symbol('commit-files')).current

  useEffect(() => {
    setFiles([])
    setSelected(new Set())
    lastClicked.current = null
    let cancelled = false
    void gitApi.commitFiles(repo.path, hash).then((f) => {
      if (!cancelled) setFiles(f)
    })
    return () => {
      cancelled = true
    }
  }, [repo.path, hash])

  // Notes are attached beside the commit, so they are read separately — and
  // re-read whenever the noted set changes (saving one, or fetching them).
  useEffect(() => {
    setEditingNote(false)
    let cancelled = false
    void gitApi.note(repo.path, hash).then((text) => {
      if (cancelled) return
      setNote(text)
      setNoteDraft(text)
    })
    return () => {
      cancelled = true
    }
  }, [repo.path, hash, repo.notedShas])

  useEffect(() => {
    setBranches([])
    let cancelled = false
    void gitApi.commitBranches(repo.path, hash).then((b) => {
      if (!cancelled) setBranches(b)
    })
    return () => {
      cancelled = true
    }
  }, [repo.path, hash])

  useEffect(() => {
    setTags([])
    let cancelled = false
    void gitApi.commitTags(repo.path, hash).then((tg) => {
      if (!cancelled) setTags(tg)
    })
    return () => {
      cancelled = true
    }
  }, [repo.path, hash])

  // ─── File search / filter inside this commit ──────────────────────────────
  // Content search greps the commit's own tree, so hits are the file as it
  // looked at this commit — not the working-tree copy.
  const query = filter.query.trim()
  useEffect(() => {
    if (!query || filter.mode !== 'content' || files.length === 0) {
      setHits(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void gitApi
        .searchCommitMatches(repo.path, hash, query, {
          paths: files.map((f) => f.path),
          caseSensitive: filter.caseSensitive,
          wholeWord: filter.wholeWord,
          regex: filter.regex
        })
        .then((found) => {
          if (!cancelled) setHits(found)
        })
        .catch(() => {
          if (!cancelled) setHits([])
        })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, filter.mode, filter.caseSensitive, filter.wholeWord, filter.regex, repo.path, hash, files])

  // Mirror the query into the UI store so the center file/diff view highlights
  // the same term, and drop it when the panel goes away.
  useEffect(() => {
    const setFileSearch = useUIStore.getState().setFileSearch
    if (query && filter.mode === 'content') {
      setFileSearch({
        query,
        caseSensitive: filter.caseSensitive,
        wholeWord: filter.wholeWord,
        regex: filter.regex
      })
    } else setFileSearch(null)
  }, [query, filter.mode, filter.caseSensitive, filter.wholeWord, filter.regex])
  useEffect(() => () => useUIStore.getState().setFileSearch(null), [])

  const hitsByFile = useMemo(() => (hits ? matchesByFile(hits) : null), [hits])
  const contentRe = useMemo(
    () => (filter.mode === 'content' && query ? buildQueryRegExp(filter, true) : null),
    [filter.mode, filter.query, filter.caseSensitive, filter.wholeWord, filter.regex, query]
  )
  const nameRe = useMemo(
    () => (filter.mode === 'name' ? buildQueryRegExp(filter) : null),
    [filter.mode, filter.query, filter.caseSensitive, filter.wholeWord, filter.regex]
  )
  const filteredFiles = useMemo(() => {
    if (!isFilterActive(filter)) return files
    return files.filter((f) => {
      if (filter.include.trim() && !matchesGlobList(f.path, filter.include)) return false
      if (filter.exclude.trim() && matchesGlobList(f.path, filter.exclude)) return false
      if (!query) return true
      if (filter.mode === 'name') return !nameRe || nameRe.test(f.path)
      return !hitsByFile || hitsByFile.has(f.path)
    })
  }, [files, filter, query, nameRe, hitsByFile])

  // Shift+↑/↓ extends the file selection while this panel owns the keys. Row
  // order comes from the DOM so ranges follow the tree view's visual order.
  const listWrapRef = useRef<HTMLDivElement>(null)
  const visibleOrder = (): string[] => domOrder(listWrapRef.current, '[data-file-path]', 'data-file-path')
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const rangeEnd = useRef<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.shiftKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
      if (!ownsRangeKeys(keyToken) || rangeKeysBlocked(e.target)) return
      const anchor = lastClicked.current
      if (!anchor) return
      const live = rangeEnd.current !== null && selectedRef.current.has(rangeEnd.current)
      const step = stepRange(visibleOrder(), anchor, live ? rangeEnd.current : null, e.key === 'ArrowDown' ? 1 : -1)
      if (!step) return
      e.preventDefault()
      rangeEnd.current = step.end
      setSelected(new Set(step.ids))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyToken])

  const refRemote = repo.remotes.find((r) => r.name === 'origin')?.url ?? repo.remotes[0]?.url
  const refHost = getReferenceHost(refRemote, repo.prProvider)

  if (!commit) return <div className="panel-empty">{t('commitPanel.notFound')}</div>

  const currentFile =
    fileView && fileView.repoPath === repo.path && fileView.source.type === 'commit' && fileView.source.hash === hash
      ? fileView.file
      : null

  const REFS_VISIBLE = 3
  const refItems: { key: string; node: React.JSX.Element }[] = [
    ...branches.map((b) => {
      const key = `b:${b.name}`
      return {
        key,
        node: (
          <span
            key={key}
            className={`ref-badge ${b.isLocal ? 'ref-local' : 'ref-remote'}`}
            title={`${b.name}${b.isLocal ? ' · local' : ''}${b.remotes.length ? ` · ${b.remotes.join(', ')}` : ''}`}
          >
            {b.isLocal && <Laptop size={10} className="ref-ic" />}
            {b.remotes.map((remote) => (
              <span key={remote} className="ref-ic">
                <RemoteIcon url={repo.remotes.find((r) => r.name === remote)?.url} size={10} />
              </span>
            ))}
            <span className="ref-text">{b.name}</span>
          </span>
        )
      }
    }),
    ...tags.map((tg) => {
      const key = `t:${tg}`
      const isPushed = repo.remoteTagNames.includes(tg)
      return {
        key,
        node: (
          <span key={key} className="ref-badge ref-tag" title={`${tg}${isPushed ? ` · ${t('ref.pushed')}` : ` · ${t('ref.localOnly')}`}`}>
            <Tag size={10} className="ref-ic" />
            {isPushed && <Cloud size={10} className="ref-ic" />}
            <span className="ref-text">{tg}</span>
          </span>
        )
      }
    })
  ]
  const visibleRefs = refItems.slice(0, REFS_VISIBLE)
  const hiddenRefs = refItems.slice(REFS_VISIBLE)

  const COAUTHORS_VISIBLE = 4
  const coAuthors = commit.coAuthors ?? []
  const visibleCoAuthors = coAuthors.slice(0, COAUTHORS_VISIBLE)
  const hiddenCoAuthors = coAuthors.slice(COAUTHORS_VISIBLE)

  const renderCoauthorRow = (a: (typeof coAuthors)[number]): React.JSX.Element => {
    const url = profileUrl(a.name, a.email, repo.remotes)
    return (
      <div key={a.email} className="commit-coauthor-row">
        <Avatar email={a.email} name={a.name} size={16} repo={repo.path} />
        <span>{a.name}</span>
        {url && (
          <a
            className="commit-profile-link"
            href="#"
            title={interp(t('commitPanel.openProfileTitle'), { author: a.name })}
            onClick={(e) => { e.preventDefault(); void shellApi.openExternal(url) }}
          >
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="details">
      {/* Who, when and what stay put; only the file list scrolls. The head scrolls
          on its own past 60% of the panel, so a long description never hides the files. */}
      <div className="details-info details-info-split">
        <div className="details-head">
          <div className="commit-header">
            <Avatar
              email={commit.email}
              name={commit.author}
              size={38}
              className="avatar"
              title={commit.email}
              repo={repo.path}
              sha={commit.hash}
            />
            <div className="commit-meta">
              <span className="commit-author-row">
                <strong>{commit.author}</strong>
                {profileUrl(commit.author, commit.email, repo.remotes) && (
                  <a
                    className="commit-profile-link"
                    href="#"
                    title={interp(t('commitPanel.openProfileTitle'), { author: commit.author })}
                    onClick={(e) => { e.preventDefault(); void shellApi.openExternal(profileUrl(commit.author, commit.email, repo.remotes)!) }}
                  >
                    <ExternalLink size={11} />
                  </a>
                )}
              </span>
              <span>{new Date(commit.date * 1000).toLocaleString()}</span>
              {commit.signature && commit.signature !== 'none' && (
                <span className="commit-sig-row">
                  <SignatureBadge signature={commit.signature} signer={commit.signer} withText />
                </span>
              )}
              <div className="commit-meta-row">
                <code>{commit.hash.slice(0, 10)}</code>
                <button
                  className="icon-btn commit-edit-btn"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(commit.hash)
                    toast('success', t('reflog.shaCopied'))
                  }}
                  title={t('commit.copySha')}
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </div>
          {refItems.length > 0 && (
            <div className="commit-section commit-refs-section">
              <span className="commit-section-label">{t('commitPanel.refsLabel')}</span>
              <div className="commit-refs-row">
                {visibleRefs.map((r) => r.node)}
                {hiddenRefs.length > 0 && (
                  <span className="ref-collapsed">
                    <span className="ref-more-chip">+{hiddenRefs.length}</span>
                    <div className="commit-refs-pop">{hiddenRefs.map((r) => r.node)}</div>
                  </span>
                )}
              </div>
            </div>
          )}
          {coAuthors.length > 0 && (
            <div className="commit-section commit-coauthors-section">
              <span className="commit-section-label">{t('commitPanel.coauthorsLabel')}</span>
              <div className="commit-coauthor-avatars">
                {visibleCoAuthors.map((a) => (
                  <span key={a.email} className="coauthor-avatar-wrap">
                    <Avatar email={a.email} name={a.name} size={20} repo={repo.path} />
                    <div className="commit-coauthor-pop">{renderCoauthorRow(a)}</div>
                  </span>
                ))}
                {hiddenCoAuthors.length > 0 && (
                  <span className="coauthor-collapsed">
                    <span className="ref-more-chip coauthor-more-chip">+{hiddenCoAuthors.length}</span>
                    <div className="commit-coauthor-pop">{hiddenCoAuthors.map(renderCoauthorRow)}</div>
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="commit-message-toolbar">
            <span className="commit-message-label">{t('commitPanel.messageLabel')}</span>
            {/* One entry point: the commit-edit modal covers renaming (any commit,
                not just HEAD), AI generation, and file edits — three buttons
                collapsed into one. */}
            <button
              className="icon-btn commit-edit-btn"
              type="button"
              onClick={() =>
                openCommitEdit({ repoPath: repo.path, sha: commit.hash, subject: commit.subject })
              }
              title={t('commit.editCommit')}
            >
              <FilePenLine size={13} />
            </button>
          </div>
          {/* `#12` / `!12` / `AB#12` in the subject get a hover card with the title. */}
          <ReferenceScope repoPath={repo.path} remoteUrl={refRemote} host={refHost}>
            <p className="commit-subject">
              {autolink(
                emojifyGitmoji(commit.subject),
                remoteWebUrl(refRemote),
                repo.config?.config?.links?.tickets,
                getReferenceAutolinkOptions(refHost)
              )}
            </p>
            {/* The description, absent when the commit has none; a long one shows its
                first lines and "Show all". The trailers git keeps at the end are chips. */}
            {(body.text || body.trailers.length > 0) && (
              <div className="commit-body-block">
                {body.text && (
                  <div className="commit-body">
                    <div className="commit-body-text">
                      {autolink(
                        emojifyGitmoji(bodyExpanded || !bodyPreview.hidden ? body.text : bodyPreview.shown),
                        remoteWebUrl(refRemote),
                        repo.config?.config?.links?.tickets,
                        getReferenceAutolinkOptions(refHost)
                      )}
                    </div>
                    {bodyPreview.hidden > 0 && !bodyExpanded && <div className="commit-body-fade" aria-hidden="true" />}
                  </div>
                )}
                {body.trailers.length > 0 && (
                  <ul className="commit-trailers" aria-label={t('commitPanel.trailers')}>
                    {body.trailers.map((trailer, i) => (
                      <li key={i} className="commit-trailer" title={`${trailer.key}: ${trailer.value}`}>
                        {isCoAuthorTrailer(trailer)
                          ? interp(t('commitPanel.coAuthorTrailer'), { name: trailerPersonName(trailer.value) })
                          : `${trailer.key}: ${trailer.value}` /* i18n-ignore git trailer, shown as written */}
                      </li>
                    ))}
                  </ul>
                )}
                {bodyPreview.hidden > 0 && (
                  <button
                    type="button"
                    className="btn ghost small commit-body-toggle"
                    aria-expanded={bodyExpanded}
                    onClick={() => setBodyExpanded((open) => !open)}
                  >
                    {bodyExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{' '}
                    {bodyExpanded
                      ? t('commitPanel.showLessBody')
                      : interp(t('commitPanel.showAllBody'), { n: bodyPreview.hidden })}
                  </button>
                )}
              </div>
            )}
          </ReferenceScope>

          {/* Full-bleed like the subject above it, and absent entirely when there
              is nothing to show — an empty box on every commit is noise. */}
          {editingNote ? (
            <div className="commit-note editing">
              <textarea
                className="commit-note-input"
                autoFocus
                rows={3}
                value={noteDraft}
                placeholder={t('notes.placeholder')}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setNoteDraft(note)
                    setEditingNote(false)
                  }
                }}
              />
              <div className="commit-note-actions">
                <button
                  className="link-btn"
                  onClick={() => {
                    setNoteDraft(note)
                    setEditingNote(false)
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn primary tiny"
                  disabled={noteDraft === note}
                  onClick={() => {
                    setEditingNote(false)
                    void repoActions.setNote(repo.path, hash, noteDraft, note)
                  }}
                >
                  {t('notes.save')}
                </button>
              </div>
            </div>
          ) : note ? (
            <div className="commit-note">
              <StickyNote size={12} className="commit-note-icon" />
              <p className="commit-note-body">{note}</p>
              <div className="commit-note-tools">
                <button className="icon-btn tiny" title={t('notes.edit')} onClick={() => setEditingNote(true)}>
                  <Pencil size={12} />
                </button>
                <button
                  className="icon-btn tiny"
                  title={t('notes.remove')}
                  onClick={() => void repoActions.setNote(repo.path, hash, '', note)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ) : (
            <button className="commit-note-add" title={t('notes.hint')} onClick={() => setEditingNote(true)}>
              <StickyNote size={11} /> {t('notes.add')}
            </button>
          )}
        </div>

        <div className="panel-toolbar">
          <ChangeSummary
            files={files}
            title={interp(files.length === 1 ? t('commitPanel.changedFile') : t('commitPanel.changedFiles'), {
              n: files.length
            })}
          />
          <ViewToggle />
        </div>
        <FileSearchBar value={filter} onChange={setFilter} />
        {hits && <MatchSummary hits={hits} label={(n, f) => interp(t('search.summary'), { n, files: f })} />}
        <div ref={listWrapRef} className="details-files">
          <FileListView
            files={filteredFiles}
            current={currentFile}
            matches={hitsByFile ?? undefined}
            matchRe={contentRe}
            activeLine={fileView?.line ?? null}
            // Line numbers come from the commit's own blob, so open the File view
            // at that revision — a diff would hide matches outside the hunks.
            onMatchClick={(file, line) =>
              setFileView({ repoPath: repo.path, file, source: { type: 'commit', hash }, mode: 'file', line })
            }
            selected={selected}
            onFileClick={(f, e) => {
              claimRangeKeys(keyToken)
              const order = visibleOrder()
              let next: Set<string>
              if (e.shiftKey && lastClicked.current) {
                const a = order.indexOf(lastClicked.current)
                const b = order.indexOf(f.path)
                next =
                  a !== -1 && b !== -1
                    ? new Set([...selected, ...order.slice(Math.min(a, b), Math.max(a, b) + 1)])
                    : new Set([f.path])
              } else if (e.metaKey || e.ctrlKey) {
                next = new Set(selected)
                if (next.has(f.path)) next.delete(f.path)
                else next.add(f.path)
                lastClicked.current = f.path
              } else {
                next = new Set([f.path])
                lastClicked.current = f.path
              }
              setSelected(next)
              setFileView({
                repoPath: repo.path,
                file: f.path,
                source: { type: 'commit', hash, deleted: f.status === 'D' },
                mode: useUIStore.getState().fileView?.mode === 'file' ? 'file' : 'diff'
              })
            }}
            onFileContext={(f, e) => {
              e.preventDefault()
              const targets = selected.has(f.path) && selected.size > 1 ? [...selected] : [f.path]
              useUIStore.getState().openContextMenu(e.clientX, e.clientY, [
                // "Take these changes": overwrite the working copies with this
                // commit's version of the selected files.
                {
                  label:
                    targets.length > 1
                      ? interp(t('commitPanel.restoreFiles'), { n: targets.length })
                      : t('commitPanel.restoreFile'),
                  onClick: () =>
                    openModal({
                      kind: 'confirm',
                      title: t('commitPanel.restoreTitle'),
                      message: `${interp(t('commitPanel.restoreMsg'), { n: targets.length, hash: hash.slice(0, 7) })}\n\n${targets.join('\n')}`,
                      danger: true,
                      confirmLabel: t('commitPanel.restoreConfirm'),
                      onConfirm: () => void repoActions.restoreFromCommit(repo.path, hash, targets)
                    })
                },
                { separator: true },
                { label: t(shellApi.revealLabelKey), onClick: () => void shellApi.revealInFolder(`${repo.path}/${f.path}`) },
                { label: t('commitPanel.openDefaultApp'), onClick: () => void shellApi.openPath(`${repo.path}/${f.path}`) },
                ...openWithMenuItems(
                  `${repo.path}/${f.path}`,
                  defaultOpenApp,
                  {
                    openWithDefault: (name) => interp(t('fileTree.openWithApp'), { name }),
                    openWith: t('fileTree.openWith')
                  },
                  editor
                ),
                { label: t('common.copyFilePath'), onClick: () => void navigator.clipboard.writeText(`${repo.path}/${f.path}`) },
                // The commit that deleted a file is exactly where someone realises
                // it is still in history, so the way out belongs in this menu.
                {
                  label: t('cmd.historyPurge'),
                  danger: true,
                  onClick: () =>
                    openModal({ kind: 'history-purge', repoPath: repo.path, initialPath: f.path })
                }
              ])
            }}
            onFolderContext={(folderPath, e) => {
              e.preventDefault()
              useUIStore.getState().openContextMenu(e.clientX, e.clientY, [
                { label: t(shellApi.revealLabelKey), onClick: () => void shellApi.revealInFolder(`${repo.path}/${folderPath}`) },
                { label: t('commitPanel.openDefaultApp'), onClick: () => void shellApi.openPath(`${repo.path}/${folderPath}`) },
                ...openWithMenuItems(
                  `${repo.path}/${folderPath}`,
                  defaultOpenApp,
                  {
                    openWithDefault: (name) => interp(t('fileTree.openWithApp'), { name }),
                    openWith: t('fileTree.openWith')
                  },
                  editor,
                  { isDir: true }
                ),
                { label: t('common.copyFolderPath'), onClick: () => void navigator.clipboard.writeText(`${repo.path}/${folderPath}`) }
              ])
            }}
          />
          {files.length > 0 && filteredFiles.length === 0 && (
            <div className="sb-empty">{t('composer.noFilesMatch')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
