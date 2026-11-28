import { useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, Check, ChevronDown, ChevronUp, ExternalLink, GitMerge, LayoutList, Link2, Lock, Minus, Pencil, Plus, RotateCcw, Sparkles, Loader2, Unlink2, WrapText } from 'lucide-react'
import { gitApi, aiApi, diffToolApi } from '../infrastructure/api'
import { useSettingsStore } from '../stores/settings'
import { useUIStore, type ConflictViewState } from '../stores/ui'
import { repoActions, useRepoStore } from '../stores/repo'
import { interp, useT } from '../i18n'
import { ResizeHandle } from './ResizeHandle'
import {
  assemble,
  baseRegions,
  countChoices,
  hunkChoice,
  lineKey,
  mergePicks,
  parseHunks,
  pickHunk,
  pickSideEverywhere,
  sideFullyPicked,
  sidePartlyPicked,
  toggleSideEverywhere,
  reconcileOutput,
  toggleSideInHunk,
  type Assembled,
  type Hunk,
  type LineKey,
  type LineOrigin,
  type OutputMark,
  type ConflictLineSide as Side,
} from '../lib/conflict'
import type { ConflictCommit, ConflictFileInfo, ConflictRefInfo, ConflictVersions } from '../../../shared/types'
import { conflictKindKey } from '../lib/conflictWorkspace'
import { ConflictResultBlocks } from './ConflictResultBlocks'
import { TimeAgoLabel } from './PrConversationTimeline'
import { isPbxprojPath, mergePbxproj } from '../../../shared/pbxproj'
import { lockfileFor } from '../lib/lockfiles'
import { guessLanguage, highlightCode } from '../lib/highlight'
import { emojifyGitmoji } from '../../../shared/gitmoji'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Live pixel size of an element, so ratio-based splits can drive ResizeHandle. */
function useBoxSize(ref: React.RefObject<HTMLElement | null>): { w: number; h: number } {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

const clampRatio = (r: number): number => Math.min(0.85, Math.max(0.15, r))

// ─── Main Component ────────────────────────────────────────────────────────

export function ConflictResolver({
  view,
  info,
  onResolved
}: {
  view: ConflictViewState
  /** What git says this file's conflict is, for the header; null while unknown. */
  info: ConflictFileInfo | null
  /** Called once the file is staged, so the workspace can move on. */
  onResolved: (path: string) => void
}): React.JSX.Element {
  const setConflictView = useUIStore((s) => s.setConflictView)
  const recordConflictChoices = useUIStore((s) => s.recordConflictChoices)
  const toast = useUIStore((s) => s.toast)
  const layout = useUIStore((s) => s.layout)
  const setLayout = useUIStore((s) => s.setLayout)
  const refresh = useRepoStore((s) => s.refresh)
  const ctx = useRepoStore((s) => s.repos[view.repoPath]?.conflictContext ?? null)
  const t = useT()
  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)
  const [replayed, setReplayed] = useState(false)
  const [mergeTool, setMergeTool] = useState('')
  const [toolRunning, setToolRunning] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [versions, setVersions] = useState<ConflictVersions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hunks, setHunks] = useState<Hunk[]>([])
  const [oursContent, setOursContent] = useState('')
  const [theirsContent, setTheirsContent] = useState('')
  const [selected, setSelected] = useState<Set<LineKey>>(new Set())
  const [touched, setTouched] = useState<Set<number>>(new Set())
  const [editOutput, setEditOutput] = useState('')
  // Last assembled output, kept so the pane can attribute each line to a side.
  // Once the user hand-edits the text the attribution no longer applies.
  const [assembled, setAssembled] = useState<Assembled>({ text: '', starts: [], origins: [], keys: [] })
  const [activeHunk, setActiveHunk] = useState(0)
  const [saving, setSaving] = useState(false)
  const [aiResolving, setAiResolving] = useState(false)
  // What each side did to this file since they parted — `git log --merge`.
  // Loaded with the file: its newest commit per side heads each pane.
  const [history, setHistory] = useState<ConflictCommit[] | null>(null)
  // Which file's strip is open lives in the store, not here: a background
  // refresh remounts this component, and local state would close it again.
  const whyFile = useUIStore((s) => s.conflictWhy)
  const setWhyFile = useUIStore((s) => s.setConflictWhy)
  // View toggles, mirroring the diff viewer's habits. Wrap folds long lines
  // inside the A/B panes (the output keeps one row per line — its gutter and
  // side tints are aligned by line height and would drift under wrapping).
  const [wrapOn, setWrapOn] = useState(() => localStorage.getItem('githuttbr-conflict-wrap') === 'on')
  useEffect(() => localStorage.setItem('githuttbr-conflict-wrap', wrapOn ? 'on' : 'off'), [wrapOn])
  const [syncOn, setSyncOn] = useState(() => localStorage.getItem('githuttbr-conflict-sync') !== 'off')
  useEffect(() => localStorage.setItem('githuttbr-conflict-sync', syncOn ? 'on' : 'off'), [syncOn])
  // The common ancestor between the two sides. On by default: what both sides
  // started from is what makes "who changed what" readable.
  const [baseOn, setBaseOn] = useState(() => localStorage.getItem('githuttbr-conflict-base') !== 'off')
  useEffect(() => localStorage.setItem('githuttbr-conflict-base', baseOn ? 'on' : 'off'), [baseOn])
  // The result reads as cards until the user asks for the raw text — or types
  // into it, after which the cards no longer describe what is there.
  const [textMode, setTextMode] = useState(false)
  // Conflicts opened with Edit, so the summary can count them as hand-made.
  const [editedHunks, setEditedHunks] = useState<Set<number>>(new Set())
  const basePaneRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<HTMLDivElement>(null)
  const oursPaneRef = useRef<HTMLDivElement>(null)
  const theirsPaneRef = useRef<HTMLDivElement>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const filesRef = useRef<HTMLDivElement>(null)
  const splitBox = useBoxSize(splitRef)
  const filesBox = useBoxSize(filesRef)

  const { repoPath, file } = view
  const showHistory = whyFile === file
  const lang = guessLanguage(file)
  const sideRatio = clampRatio(layout.conflictSideRatio)
  const filesRatio = clampRatio(layout.conflictFilesRatio)

  const outputHtml = useMemo(() => {
    // Trailing newline keeps the highlighted layer aligned with the textarea.
    return highlightCode(editOutput, lang) + '\n'
  }, [editOutput, lang])

  const outputLineCount = useMemo(() => editOutput.split('\n').length, [editOutput])

  // Per-output-line badge: the side a line came from, or 'edited' for anything
  // the user typed (or an AI proposal) that no longer matches what we assembled.
  const marks = useMemo<OutputMark[]>(
    () => reconcileOutput(assembled.text, assembled.origins, editOutput),
    [editOutput, assembled]
  )

  // Only offer the external tool when git has one configured — the button is
  // meaningless otherwise, and `git mergetool` would just error.
  // A file with no markers is usually "already resolved"; when rerere is on it
  // may instead be git having answered for you, which is worth saying out loud
  // before the resolution is staged unread.
  useEffect(() => {
    void gitApi
      .rerereStatus(repoPath)
      .then((status) => setReplayed(status.enabled && status.replayed.includes(file)))
      .catch(() => setReplayed(false))
  }, [repoPath, file, content])

  useEffect(() => {
    void diffToolApi
      .config(repoPath)
      .then((cfg) => setMergeTool(cfg.mergeTool))
      .catch(() => setMergeTool(''))
  }, [repoPath])

  /** Hand the conflict to `git mergetool`. On a clean exit git stages the file
   *  itself, so the workspace moves on and the repo view refreshes. */
  const runMergeTool = async (): Promise<void> => {
    setToolRunning(true)
    try {
      const error = await diffToolApi.merge(repoPath, file)
      if (error) {
        toast('error', error)
      } else {
        toast('success', interp(t('difftool.merged'), { file }))
        onResolved(file)
        await refresh(repoPath)
      }
    } finally {
      setToolRunning(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setHistory(null)
    setVersions(null)
    setError(null)
    setHunks([])
    setSelected(new Set())
    setTouched(new Set())
    setEditedHunks(new Set())
    setTextMode(false)
    setActiveHunk(0)
    void gitApi
      .conflictCommits(repoPath, file)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setHistory([]))
    void gitApi
      .conflictVersions(repoPath, file)
      .then((v) => {
        if (cancelled) return
        setVersions(v)
        setContent(v.content)
        const { hunks: parsed, oursContent: oc, theirsContent: tc } = parseHunks(v.content)
        setHunks(parsed)
        setOursContent(oc)
        setTheirsContent(tc)
        const fresh = assemble(parsed, oc, new Set())
        setEditOutput(fresh.text)
        setAssembled(fresh)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [repoPath, file])

  const resolvedCount = touched.size
  const allResolved = hunks.length > 0 && resolvedCount === hunks.length
  const textEdited = editOutput !== assembled.text
  const showCards = !textMode && !textEdited
  const hasBase = versions?.base != null
  const showBase = baseOn && hasBase
  const regions = useMemo(
    () => (versions?.base != null ? baseRegions(versions.base, oursContent, hunks) : []),
    [versions, oursContent, hunks]
  )

  // Keep the highlighted layer and the line-number gutter glued to the textarea.
  const syncOutputScroll = (top: number, left: number): void => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = top
      highlightRef.current.scrollLeft = left
    }
    if (gutterRef.current) gutterRef.current.scrollTop = top
    if (rowsRef.current) rowsRef.current.scrollTop = top
  }

  // Keep A, B and the output moving together. Their line counts differ, so the
  // vertical position is matched by proportion rather than pixel; horizontal is
  // pixel-for-pixel. The guard stops a mirrored write from echoing back as a
  // second sync, and goToHunk raises it too so its precise per-hunk positioning
  // is not immediately overwritten by a proportional mirror.
  const syncGuard = useRef(false)
  const syncPanes = (src: HTMLElement): void => {
    if (syncGuard.current || !syncOn) return
    syncGuard.current = true
    const output = showCards ? cardsRef.current : editRef.current
    for (const el of [oursPaneRef.current, basePaneRef.current, theirsPaneRef.current, output]) {
      if (!el || el === src) continue
      const max = src.scrollHeight - src.clientHeight
      el.scrollTop = max > 0 ? (src.scrollTop / max) * (el.scrollHeight - el.clientHeight) : 0
      el.scrollLeft = src.scrollLeft
    }
    // The textarea may have been scrolled programmatically above, which fires
    // its scroll event too late for this frame — realign its layers now.
    if (editRef.current && src !== editRef.current)
      syncOutputScroll(editRef.current.scrollTop, editRef.current.scrollLeft)
    requestAnimationFrame(() => (syncGuard.current = false))
  }

  // Scroll both side panes and the output to a given conflict. Wraps around, so
  // ⌃ on the first conflict lands on the last and ⌄ on the last on the first.
  const goToHunk = (idx: number): void => {
    if (hunks.length === 0) return
    const next = ((idx % hunks.length) + hunks.length) % hunks.length
    setActiveHunk(next)
    syncGuard.current = true
    const panes = [oursPaneRef.current, basePaneRef.current, theirsPaneRef.current, showCards ? cardsRef.current : null]
    for (const pane of panes) {
      const el = pane?.querySelector<HTMLElement>(`[data-hunk="${next}"]`)
      if (!pane || !el) continue
      const top = el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop
      pane.scrollTop = Math.max(0, top - pane.clientHeight / 3)
    }
    const ta = showCards ? null : editRef.current
    const start = assembled.starts[next]
    if (ta && start != null && outputLineCount > 0) {
      const lineHeight = ta.scrollHeight / outputLineCount
      ta.scrollTop = Math.max(0, start * lineHeight - ta.clientHeight / 3)
      syncOutputScroll(ta.scrollTop, ta.scrollLeft)
    }
    requestAnimationFrame(() => (syncGuard.current = false))
  }

  // Land on the first conflict when a file opens, instead of at the top of the
  // file — the first decision to make is the first thing on screen.
  useEffect(() => {
    if (hunks.length === 0) return
    const id = requestAnimationFrame(() => goToHunk(0))
    return () => cancelAnimationFrame(id)
    // Only when a new set of hunks is loaded — goToHunk is stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunks])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !useUIStore.getState().modal) {
        setConflictView(null)
        return
      }
      // Alt+↑/↓ jumps between conflicts, except while editing the output.
      if (!e.altKey || document.activeElement === editRef.current) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        goToHunk(activeHunk + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        goToHunk(activeHunk - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Re-bound every render on purpose: the handler reads the current
    // activeHunk / hunk list, and (re)binding one listener is free.
  })

  const commit = (nextSelected: Set<LineKey>, nextTouched: Set<number>): void => {
    setSelected(nextSelected)
    setTouched(nextTouched)
    const next = assemble(hunks, oursContent, nextSelected)
    // Fold the pick change into whatever is in the pane, so hand edits survive.
    setEditOutput(mergePicks(assembled, editOutput, next))
    setAssembled(next)
  }

  const toggleLine = (hunkIdx: number, side: Side, lineIdx: number): void => {
    const key = lineKey(hunkIdx, side, lineIdx)
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    commit(next, new Set(touched).add(hunkIdx))
    setActiveHunk(hunkIdx)
  }

  /** Remove a line straight from the output: unpick it on its own side. */
  const dropOutputLine = (origin: NonNullable<LineOrigin>): void => {
    const next = new Set(selected)
    next.delete(lineKey(origin.hunk, origin.side, origin.line))
    commit(next, new Set(touched).add(origin.hunk))
    setActiveHunk(origin.hunk)
  }

  /** Per-chunk checkbox: add or drop every line of one side of one chunk. The
   *  other side is left alone, so both sides (or neither) can be taken. */
  const toggleChunkSide = (hunk: Hunk, side: Side): void => {
    commit(toggleSideInHunk(hunk, side, selected), new Set(touched).add(hunk.index))
    setActiveHunk(hunk.index)
  }

  /** Pane checkbox: take (or drop) that whole side across every chunk. Either
   *  way the user has now made a call on every chunk. */
  const toggleWholeSide = (side: Side): void => {
    const on = !sideFullyPicked(hunks, side, selected)
    commit(toggleSideEverywhere(hunks, side, selected, on), new Set(hunks.map((h) => h.index)))
  }

  /** A card's answer: keep yours, theirs or both for that one conflict. */
  const pickBlock = (hunk: Hunk, pick: 'ours' | 'theirs' | 'both'): void => {
    commit(pickHunk(hunk, pick, selected), new Set(touched).add(hunk.index))
    setActiveHunk(hunk.index)
  }

  /** "Whole file: yours | theirs" — one side for every conflict, into the result for review. */
  const pickWholeFile = (side: Side): void => {
    commit(pickSideEverywhere(hunks, side, selected), new Set(hunks.map((h) => h.index)))
  }
  const wholeFileIs = (side: Side): boolean =>
    hunks.length > 0 && hunks.every((h) => hunkChoice(h, selected, touched.has(h.index)) === side)

  /**
   * A card's Edit: open the raw result on that conflict. An unanswered one
   * starts from both sides, since editing is usually "both, but adjusted".
   */
  const editBlock = (hunk: Hunk): void => {
    const nextSelected = touched.has(hunk.index) ? selected : pickHunk(hunk, 'both', selected)
    commit(nextSelected, new Set(touched).add(hunk.index))
    setEditedHunks(new Set(editedHunks).add(hunk.index))
    setActiveHunk(hunk.index)
    setTextMode(true)
    const next = assemble(hunks, oursContent, nextSelected)
    requestAnimationFrame(() => {
      const ta = editRef.current
      if (!ta) return
      const lines = next.text.split('\n')
      const startLine = next.starts[hunk.index] ?? 0
      const kept = next.origins.filter((o) => o?.hunk === hunk.index).length
      const offset = (n: number): number => lines.slice(0, n).reduce((acc, l) => acc + l.length + 1, 0)
      ta.focus()
      ta.setSelectionRange(offset(startLine), Math.max(offset(startLine), offset(startLine + kept) - 1))
      const lineHeight = ta.scrollHeight / Math.max(1, lines.length)
      ta.scrollTop = Math.max(0, startLine * lineHeight - ta.clientHeight / 3)
      syncOutputScroll(ta.scrollTop, ta.scrollLeft)
    })
  }

  /** Back to square one: no picks, no hand edits. */
  const reset = (): void => {
    const fresh = assemble(hunks, oursContent, new Set())
    setSelected(new Set())
    setTouched(new Set())
    setEditedHunks(new Set())
    setTextMode(false)
    setEditOutput(fresh.text)
    setAssembled(fresh)
    setActiveHunk(0)
  }

  const handleEditChange = (val: string): void => {
    setEditOutput(val)
  }

  // A `project.pbxproj` collision is almost never a disagreement: two people
  // added a file each, and git collided on the lines those additions happen to
  // sit on. Merging by object identity settles that, and leaves only what
  // genuinely diverged — a build setting both sides edited, usually.
  const pbx = useMemo(() => {
    if (!isPbxprojPath(file) || !versions) return null
    const { base, ours, theirs } = versions
    if (base === null || ours === null || theirs === null) return null
    return { result: mergePbxproj(base, ours, theirs) }
  }, [file, versions])

  // A lockfile records a solved dependency graph. Half of one solution stitched
  // to half of another is a graph nobody solved, so the three panes below are
  // the wrong tool and saying so is worth more than any merge we could offer.
  const lockfile = useMemo(() => lockfileFor(file), [file])

  // Lands in the output pane for review, like every other proposal here.
  const applyPbx = (): void => {
    const merged = pbx?.result
    if (!merged) return
    setEditOutput(merged.text)
    setTouched(new Set(hunks.map((h) => h.index))) // enable Save; the user still reviews
    toast('info', t('conflict.pbxApplied'))
  }

  // Ask the AI for a merged proposal. It lands in the editable output pane for review —
  // it is never saved automatically.
  const aiResolve = async (): Promise<void> => {
    if (content === null) return
    setAiResolving(true)
    try {
      const merged = await aiApi.resolveConflict(file, content, { ...useSettingsStore.getState().aiFor('conflict'), cliCwd: repoPath })
      setEditOutput(merged)
      setTouched(new Set(hunks.map((h) => h.index))) // enable Save; user still reviews
      toast('info', t('conflict.aiProposed'))
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setAiResolving(false)
    }
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const counts = countChoices(hunks, selected, touched, editedHunks, textEdited)
      if (await repoActions.conflictSaveResolution(repoPath, file, editOutput)) {
        recordConflictChoices(repoPath, file, counts)
        onResolved(file)
      }
    } finally {
      setSaving(false)
    }
  }

  const takeSide = async (side: 'ours' | 'theirs' | 'delete'): Promise<void> => {
    setSaving(true)
    try {
      if (await repoActions.conflictTakeSide(repoPath, file, side)) {
        const n = Math.max(1, hunks.length)
        recordConflictChoices(repoPath, file, {
          ours: side === 'ours' ? n : 0,
          theirs: side === 'theirs' ? n : 0,
          both: 0,
          edited: side === 'delete' ? n : 0
        })
        onResolved(file)
      }
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <span className="fv-path" title={file}>
      <GitMerge size={14} style={{ marginRight: 6, flexShrink: 0 }} />
      {file.includes('/') ? <span className="fv-dir">{file.slice(0, file.lastIndexOf('/') + 1)}</span> : null}
      <strong>{file.split('/').pop()}</strong>
    </span>
  )

  if (content === null) {
    return (
      <div className="file-viewer conflict-resolver">
        <div className="fv-header">
          {header}
        </div>
        <div className="fv-body">
          {error && <div className="fv-error">{error}</div>}
          {!error && <div className="graph-empty"><div className="spinner" /></div>}
        </div>
      </div>
    )
  }

  if (hunks.length === 0) {
    return (
      <div className="file-viewer conflict-resolver">
        <div className="fv-header">
          {header}
        </div>
        <div className="fv-body">
          <div className="graph-empty">
            <GitMerge size={36} strokeWidth={1.2} />
            <span>{replayed ? t('rerere.replayed') : t('conflict.noMarkers')}</span>
            <div className="conflict-empty-actions">
              {replayed && (
                <button
                  className="btn ghost small"
                  disabled={saving}
                  onClick={() => {
                    void gitApi.rerereForget(repoPath, file).then(async () => {
                      toast('success', t('rerere.forgotten'))
                      await refresh(repoPath)
                      setConflictView({ repoPath, file })
                    })
                  }}
                >
                  {t('rerere.forget')}
                </button>
              )}
              <button className="btn ghost small" disabled={saving || !versions?.ours} onClick={() => void takeSide('ours')}>
                {t('conflict.keepOurs')}
              </button>
              <button className="btn ghost small" disabled={saving || !versions?.theirs} onClick={() => void takeSide('theirs')}>
                {t('conflict.keepTheirs')}
              </button>
              <button className="btn danger small" disabled={saving} onClick={() => void takeSide('delete')}>
                {t('conflict.deleteFile')}
              </button>
              <button className="btn primary small" disabled={saving} onClick={() => void save()}>
                {t('conflict.stageAsIs')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // `ours` is always the side you are on (rebase included: HEAD sits on the
  // target there), `theirs` the incoming branch/commit.
  const oursName = ctx?.target || hunks[0].oursLabel
  const theirsName = ctx?.source || hunks[0].theirsLabel
  // Each pane says where it comes from: the newest commit on that side that
  // touched this file, or failing that the commit the side points at.
  const originOf = (side: Side): SideOrigin | null =>
    history?.find((c) => c.side === side) ?? (side === 'ours' ? ctx?.ours : ctx?.theirs) ?? null
  const left = hunks.length - resolvedCount
  const fileName = file.split('/').pop() ?? file

  // With the base shown it takes a fixed third; the handle still trades space
  // between yours and theirs.
  const filesW = filesBox.w || 900
  const sideShare = showBase ? 2 / 3 : 1

  return (
    <div className={`file-viewer conflict-resolver conflict-editor ${wrapOn ? 'is-wrap' : ''}`}>
      <div className="fv-header cw-filehead">
        <span className="fv-path" title={file}>
          {file.includes('/') ? <span className="fv-dir">{file.slice(0, file.lastIndexOf('/') + 1)}</span> : null}
          <strong>{fileName}</strong>
        </span>
        <span className="cw-filehead-sub">
          {interp(t('conflictWs.conflictOf'), { n: activeHunk + 1, total: hunks.length })}
          {info && <span className="cw-sep">{t(conflictKindKey(info.kind))}</span>}
        </span>
        <div className="conflict-global-actions">
          <button
            className={`btn ghost tiny ${showHistory ? 'active' : ''}`}
            title={t('conflict.whyHint')}
            aria-expanded={showHistory}
            onClick={() => setWhyFile(showHistory ? null : file)}
          >
            {t('conflict.why')}
          </button>
          {mergeTool && (
            <button
              className="btn ghost tiny"
              disabled={toolRunning || saving}
              title={interp(t('difftool.mergeHint'), { tool: mergeTool })}
              onClick={() => void runMergeTool()}
            >
              {toolRunning ? <Loader2 size={12} className="spin" /> : <ExternalLink size={12} />}{' '}
              {interp(t('difftool.openMerge'), { tool: mergeTool })}
            </button>
          )}
          {aiEnabled && (
            <button
              className="btn tiny cw-ai"
              disabled={aiResolving || saving}
              title={t('conflict.aiResolveHint')}
              onClick={() => void aiResolve()}
            >
              {aiResolving ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />} {t('conflictWs.aiResolve')}
            </button>
          )}
          <span className="cw-seg" role="group" title={t('conflictWs.wholeFileHint')}>
            <button aria-pressed={wholeFileIs('ours')} className={wholeFileIs('ours') ? 'on' : ''} onClick={() => pickWholeFile('ours')}>
              {t('conflictWs.wholeFileYours')}
            </button>
            <button
              aria-pressed={wholeFileIs('theirs')}
              className={wholeFileIs('theirs') ? 'on' : ''}
              onClick={() => pickWholeFile('theirs')}
            >
              {t('conflictWs.wholeFileTheirs')}
            </button>
          </span>
        </div>
      </div>

      {lockfile && (
        <div className="conflict-pbx">
          <div className="cp-head">
            <Lock size={13} />
            <strong>{interp(t('conflict.lockTitle'), { manager: lockfile.manager })}</strong>
          </div>
          <p className="cp-line">{t('conflict.lockWhy')}</p>
          <div className="cp-actions">
            <button className="btn small" disabled={saving} onClick={() => void takeSide('ours')}>
              {t('conflict.keepOurs')}
            </button>
            <button className="btn small" disabled={saving} onClick={() => void takeSide('theirs')}>
              {t('conflict.keepTheirs')}
            </button>
            <span className="settings-hint">
              {t('conflict.lockThen')} <code>{lockfile.command}</code>
            </span>
          </div>
        </div>
      )}

      {pbx && (
        <div className="conflict-pbx">
          <div className="cp-head">
            <Boxes size={13} />
            <strong>{t('conflict.pbxTitle')}</strong>
          </div>
          {pbx.result === null ? (
            <span className="settings-hint">{t('conflict.pbxUnreadable')}</span>
          ) : (
            <>
              <p className="cp-line">
                {interp(t('conflict.pbxAdds'), {
                  ours: String(pbx.result.summary.addedFiles.ours),
                  theirs: String(pbx.result.summary.addedFiles.theirs)
                })}{' '}
                {pbx.result.conflicts.length === 0
                  ? t('conflict.pbxCanMerge')
                  : interp(t('conflict.pbxLeft'), { n: String(pbx.result.conflicts.length) })}
              </p>
              {pbx.result.conflicts.length > 0 && (
                <ul className="cp-list">
                  {pbx.result.conflicts.map((c) => (
                    <li key={`${c.uuid}-${c.key ?? ''}`}>
                      {c.reason === 'setting'
                        ? interp(t('conflict.pbxSettingClash'), {
                            key: c.key ?? '',
                            ours: c.ours ?? '',
                            theirs: c.theirs ?? ''
                          })
                        : interp(t('conflict.pbxObjectClash'), { label: c.label })}
                    </li>
                  ))}
                </ul>
              )}
              <div className="cp-actions">
                <button className="btn small" disabled={saving} onClick={applyPbx}>
                  <Boxes size={12} /> {t('conflict.pbxApply')}
                </button>
                <span className="settings-hint">{t('conflict.pbxReview')}</span>
              </div>
            </>
          )}
        </div>
      )}

      {showHistory && (
        <div className="conflict-why">
          {history === null ? (
            <span className="settings-hint">{t('common.loading')}</span>
          ) : history.length === 0 ? (
            <span className="settings-hint">{t('conflict.whyNone')}</span>
          ) : (
            (['ours', 'theirs'] as const).map((side) => (
              <div key={side} className="conflict-why-side">
                <div className="conflict-why-head">
                  {side === 'ours' ? oursName : theirsName}
                  <span>{history.filter((c) => c.side === side).length}</span>
                </div>
                {history
                  .filter((c) => c.side === side)
                  .slice(0, 12)
                  .map((c) => (
                    <div key={c.sha} className="conflict-why-row" title={`${c.author} · ${c.date.slice(0, 10)}`}>
                      <code>{c.sha.slice(0, 7)}</code>
                      <span className="conflict-why-subject">{emojifyGitmoji(c.subject)}</span>
                      <span className="conflict-why-author">{c.author}</span>
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>
      )}

      <div className="conflict-split" ref={splitRef}>
        <div className="conflict-files" ref={filesRef} style={{ flex: `${filesRatio} 1 0` }}>
          <SideFile
            label={t('conflictWs.yours')}
            name={oursName}
            origin={originOf('ours')}
            side="ours"
            content={oursContent}
            hunks={hunks}
            lang={lang}
            selected={selected}
            activeHunk={activeHunk}
            allPicked={sideFullyPicked(hunks, 'ours', selected)}
            somePicked={sidePartlyPicked(hunks, 'ours', selected)}
            bodyRef={oursPaneRef}
            onBodyScroll={syncPanes}
            style={{ flex: `${sideRatio * sideShare} 1 0` }}
            onToggleLine={toggleLine}
            onToggleSide={toggleChunkSide}
            onToggleWholeSide={toggleWholeSide}
            chunkLabel={t('conflict.takeWholeSide')}
            sideLabel={t('conflict.takeAllOfSide')}
          />
          <ResizeHandle
            axis="x"
            value={Math.round(filesW * sideRatio * sideShare)}
            min={140}
            max={Math.max(200, filesW * sideShare - 140)}
            onChange={(px) => setLayout({ conflictSideRatio: clampRatio(px / (filesW * sideShare)) })}
          />
          {showBase && (
            <BaseFile
              content={versions?.base ?? ''}
              baseSha={ctx?.baseSha ?? ''}
              regions={regions}
              activeHunk={activeHunk}
              lang={lang}
              bodyRef={basePaneRef}
              onBodyScroll={syncPanes}
              style={{ flex: `${1 / 3} 1 0` }}
            />
          )}
          <SideFile
            label={t('conflictWs.incoming')}
            name={theirsName}
            origin={originOf('theirs')}
            side="theirs"
            content={theirsContent}
            hunks={hunks}
            lang={lang}
            selected={selected}
            activeHunk={activeHunk}
            allPicked={sideFullyPicked(hunks, 'theirs', selected)}
            somePicked={sidePartlyPicked(hunks, 'theirs', selected)}
            bodyRef={theirsPaneRef}
            onBodyScroll={syncPanes}
            style={{ flex: `${(1 - sideRatio) * sideShare} 1 0` }}
            onToggleLine={toggleLine}
            onToggleSide={toggleChunkSide}
            onToggleWholeSide={toggleWholeSide}
            chunkLabel={t('conflict.takeWholeSide')}
            sideLabel={t('conflict.takeAllOfSide')}
          />
        </div>

        <ResizeHandle
          axis="y"
          value={Math.round((splitBox.h || 600) * filesRatio)}
          min={120}
          max={Math.max(200, (splitBox.h || 600) - 120)}
          onChange={(px) => setLayout({ conflictFilesRatio: clampRatio(px / (splitBox.h || 600)) })}
        />

        <div className="conflict-output-pane" style={{ flex: `${1 - filesRatio} 1 0` }}>
          <div className="conflict-output-header">
            <span className="cw-result-label">{t('conflictWs.result')}</span>
            <div className="conflict-nav">
              <button
                className="icon-btn tiny"
                title={t('conflict.prevConflict')}
                disabled={hunks.length < 2}
                onClick={() => goToHunk(activeHunk - 1)}
              >
                <ChevronUp size={13} />
              </button>
              <span className="conflict-nav-label">
                {interp(t('conflictWs.conflictOf'), { n: activeHunk + 1, total: hunks.length })}
              </span>
              <button
                className="icon-btn tiny"
                title={t('conflict.nextConflict')}
                disabled={hunks.length < 2}
                onClick={() => goToHunk(activeHunk + 1)}
              >
                <ChevronDown size={13} />
              </button>
            </div>
            <div className="conflict-toggles">
              <button
                className={`diff-word-toggle ${wrapOn ? 'on' : ''}`}
                title={t('conflict.wrapTitle')}
                onClick={() => setWrapOn((v) => !v)}
              >
                <WrapText size={12} /> {t('conflictWs.wrap')}
              </button>
              <button
                className={`diff-word-toggle ${syncOn ? 'on' : ''}`}
                title={t('conflict.syncTitle')}
                onClick={() => setSyncOn((v) => !v)}
              >
                {syncOn ? <Link2 size={12} /> : <Unlink2 size={12} />} {t('conflictWs.linkScroll')}
              </button>
              <button
                className={`diff-word-toggle ${!showCards ? 'on' : ''}`}
                title={textEdited ? t('conflictWs.handEdited') : t('conflictWs.editTextHint')}
                disabled={textEdited}
                onClick={() => setTextMode((v) => !v)}
              >
                {showCards ? <Pencil size={12} /> : <LayoutList size={12} />} {t('conflictWs.editText')}
              </button>
            </div>
            <label className="cw-base-toggle" title={hasBase ? undefined : t('conflictWs.baseNone')}>
              <input type="checkbox" checked={showBase} disabled={!hasBase} onChange={(e) => setBaseOn(e.target.checked)} />
              {t('conflictWs.showBase')}
            </label>
            {/* The count only helps while typing the text; the cards already show every line. */}
            {!showCards && (
              <span className="text-2 conflict-output-count">
                {outputLineCount} {t('conflict.lines')}
              </span>
            )}
            <button className="btn ghost tiny" title={t('conflict.resetHint')} onClick={reset}>
              <RotateCcw size={12} /> {t('conflictWs.resetChoices')}
            </button>
          </div>
          {showCards ? (
            <ConflictResultBlocks
              hunks={hunks}
              oursContent={oursContent}
              selected={selected}
              touched={touched}
              activeHunk={activeHunk}
              lang={lang}
              bodyRef={cardsRef}
              onBodyScroll={syncPanes}
              onPick={pickBlock}
              onEdit={editBlock}
            />
          ) : (
            <div className="conflict-output-code">
              <div ref={rowsRef} className="conflict-output-rows" aria-hidden="true">
                {Array.from({ length: outputLineCount }, (_, i) => {
                  const m = marks[i]
                  return <div key={i} className={m ? `cor ${m === 'edited' ? 'edited' : m.side}` : 'cor'} />
                })}
              </div>
              <div ref={gutterRef} className="conflict-output-gutter">
                {Array.from({ length: outputLineCount }, (_, i) => {
                  const m = marks[i]
                  const o = m === 'edited' ? null : m
                  return (
                    <div key={i} className={m ? `cog ${m === 'edited' ? 'edited' : m.side}` : 'cog'}>
                      {m === 'edited' ? (
                        <span className="cog-side" title={t('conflict.editedLine')}>
                          <Pencil size={9} />
                        </span>
                      ) : o ? (
                        // The side mark doubles as "drop this line from the output".
                        <button
                          className="cog-side cog-drop"
                          title={t('conflict.dropLine')}
                          aria-label={t('conflict.dropLine')}
                          onClick={() => dropOutputLine(o)}
                        >
                          <span className="cog-letter cog-dot" />
                          <Minus className="cog-x" size={11} />
                        </button>
                      ) : (
                        <span className="cog-side" />
                      )}
                      <span className="cog-no" aria-hidden="true">
                        {i + 1}
                      </span>
                    </div>
                  )
                })}
              </div>
              <pre ref={highlightRef} className="conflict-output-highlight hljs" aria-hidden="true">
                <code dangerouslySetInnerHTML={{ __html: outputHtml }} />
              </pre>
              <textarea
                ref={editRef}
                className="conflict-output-editor"
                value={editOutput}
                onChange={(e) => handleEditChange(e.target.value)}
                onScroll={(e) => {
                  syncOutputScroll(e.currentTarget.scrollTop, e.currentTarget.scrollLeft)
                  syncPanes(e.currentTarget)
                }}
                spellCheck={false}
                placeholder={t('conflict.outputPlaceholder')}
              />
            </div>
          )}
          <div className="cw-result-foot">
            <span>
              {left === 0
                ? t('conflictWs.noneLeftInFile')
                : left === 1
                  ? t('conflictWs.leftInFileOne')
                  : interp(t('conflictWs.leftInFile'), { n: left })}
            </span>
            {textEdited && <span className="settings-hint">{t('conflictWs.handEdited')}</span>}
            <span className="cw-spacer" />
            <button className="btn primary small" disabled={!allResolved || saving} onClick={() => void save()}>
              <Check size={13} /> {interp(t('conflictWs.markResolved'), { file: fileName })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Where a pane's side comes from: a commit that touched the file, or the side's tip. */
type SideOrigin = Pick<ConflictRefInfo, 'sha' | 'subject' | 'author' | 'date'>

/** "b21c865 · "subject" · author · 2d ago" under a pane's name. */
function OriginLine({ origin }: { origin: SideOrigin | null }): React.JSX.Element | null {
  if (!origin?.sha) return null
  return (
    <span className="cfh-meta" title={origin.subject}>
      <code>{origin.sha.slice(0, 7)}</code>
      {origin.subject && (
        <span className="cw-sep">
          <q>{emojifyGitmoji(origin.subject)}</q>
        </span>
      )}
      {origin.author && <span className="cw-sep">{origin.author}</span>}
      {origin.date && (
        <span className="cw-sep">
          <TimeAgoLabel iso={origin.date} />
        </span>
      )}
    </span>
  )
}

// ─── Base: the version both sides started from ───────────────────────────────

function BaseFile({
  content,
  baseSha,
  regions,
  activeHunk,
  lang,
  bodyRef,
  onBodyScroll,
  style
}: {
  content: string
  baseSha: string
  regions: ({ start: number; end: number } | null)[]
  activeHunk: number
  lang: string
  bodyRef: React.RefObject<HTMLDivElement | null>
  onBodyScroll: (el: HTMLElement) => void
  style?: React.CSSProperties
}): React.JSX.Element {
  const t = useT()
  const lines = useMemo(() => content.split('\n'), [content])
  // Which conflict each base line sits under, and where each conflict's anchor
  // goes — an empty region (both sides inserted) still needs a spot to scroll to.
  const { owner, anchors } = useMemo(() => {
    const owner = new Map<number, number>()
    const anchors = new Map<number, number[]>()
    regions.forEach((r, h) => {
      if (!r) return
      for (let i = r.start; i < r.end; i++) owner.set(i, h)
      const list = anchors.get(r.start) ?? []
      list.push(h)
      anchors.set(r.start, list)
    })
    return { owner, anchors }
  }, [regions])

  return (
    <div className="conflict-file base" style={style}>
      <div className="conflict-file-head">
        <span className="cfh-text">
          <span className="cfh-title">
            <b className="cfh-side base">{t('conflictWs.base')}</b>
            <span className="cw-sep">{t('conflictWs.baseBefore')}</span>
          </span>
          {baseSha && <span className="cfh-meta">{interp(t('conflictWs.baseAncestor'), { sha: baseSha })}</span>}
        </span>
      </div>
      <div className="conflict-file-body" ref={bodyRef} onScroll={(e) => onBodyScroll(e.currentTarget)}>
        <pre className="conflict-code hljs">
          {lines.map((line, i) => {
            const h = owner.get(i)
            return (
              <div key={i}>
                {(anchors.get(i) ?? []).map((a) => (
                  <div key={`a${a}`} data-hunk={a} className={`conflict-base-anchor ${a === activeHunk ? 'active' : ''}`} />
                ))}
                <div className={`conflict-code-line ${h !== undefined ? 'in-hunk' : ''} ${h === activeHunk ? 'active' : ''}`}>
                  <span className="conflict-code-gutter" />
                  <span className="conflict-code-no">{i + 1}</span>
                  <span className="conflict-code-text" dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) || '&nbsp;' }} />
                </div>
              </div>
            )
          })}
          {(anchors.get(lines.length) ?? []).map((a) => (
            <div key={`a${a}`} data-hunk={a} className="conflict-base-anchor" />
          ))}
        </pre>
      </div>
    </div>
  )
}

// ─── Side file viewer with per-line and per-chunk selection ──────────────────

function SideFile({
  label,
  name,
  origin,
  side,
  content,
  hunks,
  lang,
  selected,
  activeHunk,
  allPicked,
  somePicked,
  bodyRef,
  onBodyScroll,
  style,
  onToggleLine,
  onToggleSide,
  onToggleWholeSide,
  chunkLabel,
  sideLabel,
}: {
  label: string
  name: string
  origin: SideOrigin | null
  side: Side
  content: string
  hunks: Hunk[]
  lang: string
  selected: Set<LineKey>
  activeHunk: number
  allPicked: boolean
  somePicked: boolean
  bodyRef: React.RefObject<HTMLDivElement | null>
  onBodyScroll: (el: HTMLElement) => void
  style?: React.CSSProperties
  onToggleLine: (hunkIdx: number, side: Side, lineIdx: number) => void
  onToggleSide: (hunk: Hunk, side: Side) => void
  onToggleWholeSide: (side: Side) => void
  chunkLabel: string
  sideLabel: string
}): React.JSX.Element {
  const lines = content.split('\n')

  // Map each global line index → { hunk, lineIdx within the hunk side }.
  const lineMeta = useMemo(() => {
    const map = new Map<number, { hunk: Hunk; lineIdx: number }>()
    for (const h of hunks) {
      const start = side === 'ours' ? h.oursStart : h.theirsStart
      const arr = side === 'ours' ? h.ours : h.theirs
      for (let k = 0; k < arr.length; k++) map.set(start + k, { hunk: h, lineIdx: k })
    }
    return map
  }, [hunks, side])

  const highlight = (text: string): string => highlightCode(text, lang)

  const chunkAllOn = (h: Hunk): boolean => {
    const arr = side === 'ours' ? h.ours : h.theirs
    return arr.length > 0 && arr.every((_, i) => selected.has(lineKey(h.index, side, i)))
  }

  return (
    <div className={`conflict-file ${side}`} style={style}>
      <div className="conflict-file-head">
        <input
          type="checkbox"
          className="conflict-side-check"
          checked={allPicked}
          title={sideLabel}
          aria-label={sideLabel}
          ref={(el) => {
            if (el) el.indeterminate = somePicked && !allPicked
          }}
          onChange={() => onToggleWholeSide(side)}
        />
        <span className="cfh-text">
          <span className="cfh-title">
            <b className={`cfh-side ${side}`}>{label}</b>
            <span className="cw-sep conflict-side-name" title={name}>
              {name}
            </span>
          </span>
          <OriginLine origin={origin} />
        </span>
      </div>
      <div className="conflict-file-body" ref={bodyRef} onScroll={(e) => onBodyScroll(e.currentTarget)}>
        <pre className="conflict-code hljs">
          {lines.map((line, i) => {
            const meta = lineMeta.get(i)
            if (!meta) {
              return (
                <div key={i} className="conflict-code-line">
                  <span className="conflict-code-gutter" />
                  <span className="conflict-code-no">{i + 1}</span>
                  <span
                    className="conflict-code-text"
                    dangerouslySetInnerHTML={{ __html: highlight(line) || '&nbsp;' }}
                  />
                </div>
              )
            }
            const { hunk, lineIdx } = meta
            const isFirst = lineIdx === 0
            const picked = selected.has(lineKey(hunk.index, side, lineIdx))
            const active = hunk.index === activeHunk
            return (
              <div key={i} className={active ? 'conflict-chunk active' : 'conflict-chunk'}>
                {isFirst && (
                  <div className="conflict-chunk-head" data-hunk={hunk.index}>
                    <input
                      type="checkbox"
                      checked={chunkAllOn(hunk)}
                      title={chunkLabel}
                      aria-label={chunkLabel}
                      onChange={() => onToggleSide(hunk, side)}
                    />
                  </div>
                )}
                <div className={`conflict-code-line conflict ${picked ? 'picked' : ''}`}>
                  <button
                    className={`conflict-code-add ${picked ? 'on' : ''}`}
                    title={picked ? '✓' : '+'}
                    onClick={() => onToggleLine(hunk.index, side, lineIdx)}
                  >
                    {picked ? <Check size={11} /> : <Plus size={11} />}
                  </button>
                  <span className="conflict-code-no">{i + 1}</span>
                  <span
                    className="conflict-code-text"
                    dangerouslySetInnerHTML={{ __html: highlight(line) || '&nbsp;' }}
                  />
                </div>
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}

