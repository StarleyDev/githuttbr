import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, Users } from 'lucide-react'
import type { CommitStyle } from '../../../shared/types'
import { gitApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { Avatar } from './Avatar'
import { GitmojiPicker } from './GitmojiPicker'
import {
  lintCommit,
  subjectLength,
  subjectCounterLevel,
  SUBJECT_IDEAL_LEN,
  SUBJECT_MAX_LEN,
  isSubjectLengthHint,
  CC_TYPES,
  parseCcPrefix,
  applyCcType,
  applyCcTypeWithGitmoji,
  applyCcScope,
  currentCcScope,
  parseGitmojiPrefix,
  applyGitmoji,
  parseTicketPrefix,
  ticketFromBranch
} from '../lib/commitLint'
import { useT, interp, type TranslationKey } from '../i18n'

/**
 * Commit-style options exposed in the style dropdown. Styles flagged `ai`
 * only make sense when AI is enabled, so they're hidden otherwise — leaving the
 * manual styles (plain / conventional / gitmoji / gitmoji + conventional / ticket)
 * when AI is off.
 */
const COMMIT_STYLE_OPTIONS: { id: CommitStyle; key: TranslationKey; ai?: boolean }[] = [
  { id: 'plain', key: 'commitStyle.plain' },
  { id: 'conventional', key: 'commitStyle.conventional' },
  { id: 'gitmoji', key: 'commitStyle.gitmoji' },
  { id: 'gitmoji-conventional', key: 'commitStyle.gitmojiConventional' },
  { id: 'ticket', key: 'commitStyle.ticket' },
  { id: 'auto', key: 'commitStyle.auto', ai: true },
  { id: 'caveman', key: 'commitStyle.caveman', ai: true },
  { id: 'haiku', key: 'commitStyle.haiku', ai: true }
]

/** The composer's cap on a new subject: long enough for any sensible one. */
export const SUMMARY_MAX_LENGTH = 100

export interface CommitMessageEditorProps {
  /** Repository the co-author list is read from. */
  repoPath: string
  /**
   * Longest summary the field accepts; SUMMARY_MAX_LENGTH when left out. Editing
   * an old commit raises it to that commit's own subject, so a longer one can
   * still be edited rather than only shortened.
   */
  summaryMaxLength?: number
  /** Current branch: the ticket field's placeholder, and its prefill when asked for. */
  branch: string
  /** Scopes the repository declares in `.githuttbr.json`; empty keeps the scope picker hidden. */
  scopes: readonly string[]
  summary: string
  description: string
  setSummary: (summary: string) => void
  setDescription: (description: string) => void
  /** Fill the ticket key from the branch name into an empty summary (`commit.ticketFromBranch`). */
  fillTicketFromBranch?: boolean
  /** Nothing can be changed — the message is not editable at all. */
  disabled?: boolean
  /** Summary and description are locked for now (an AI answer is about to land in them). */
  readOnly?: boolean
  summaryRef?: React.Ref<HTMLInputElement>
  summaryId?: string
  /** Extra keys on the summary — the composer's ↑/↓ recall of recent subjects. */
  onSummaryKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  /** Rendered between the description and the lint hints (the AI generation row). */
  afterDescription?: React.ReactNode
}

/**
 * The message half of committing: the Conventional type as a "type ▾" button
 * before the summary, the summary with its length counter, the commit-style row
 * behind the chevron (scope, ticket key, style), the gitmoji picker, co-authors,
 * the description and the lint hints.
 * Shared by the composer and the commit editor, so rewording an old commit
 * offers the same tools as writing a new one. It owns no draft: the caller
 * holds the text and decides where it is kept.
 */
export function CommitMessageEditor({
  repoPath,
  summaryMaxLength = SUMMARY_MAX_LENGTH,
  branch,
  scopes,
  summary,
  description,
  setSummary,
  setDescription,
  fillTicketFromBranch = false,
  disabled = false,
  readOnly = false,
  summaryRef,
  summaryId,
  onSummaryKeyDown,
  afterDescription
}: CommitMessageEditorProps): React.JSX.Element {
  const t = useT()
  const openContextMenu = useUIStore((s) => s.openContextMenu)
  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)
  // The Conventional-Commit type dropdown shows only when the commit style of
  // the AI this profile uses is Conventional (Settings → AI → Commit messages).
  const commitStyle = useSettingsStore((s) => s.activeAI().commitStyle)
  const usesConventional = commitStyle === 'conventional' || commitStyle === 'gitmoji-conventional'
  const usesGitmoji = commitStyle === 'gitmoji' || commitStyle === 'gitmoji-conventional'
  // Switch the active commit style straight from here — on the AI the profile
  // reads it from, so on the general AI it changes for every profile that uses
  // it. AI-only styles (auto / caveman / haiku) are filtered out when AI is
  // disabled.
  const styleOptions = useMemo(
    () => (aiEnabled ? COMMIT_STYLE_OPTIONS : COMMIT_STYLE_OPTIONS.filter((o) => !o.ai)),
    [aiEnabled]
  )
  const setCommitStyle = (v: CommitStyle): void => {
    const store = useSettingsStore.getState()
    store.saveAIFor(store.activeProfile().id, { commitStyle: v })
  }
  // Collapsed by default — the commit-style row is "advanced" and toggled by the
  // chevron on the summary row.
  const [showAdvanced, setShowAdvanced] = useState(false)

  const lintHints = useMemo(() => lintCommit(summary, description), [summary, description])
  // The length rule reads from the counter's tooltip; the list keeps the rest.
  const lengthHint = lintHints.find(isSubjectLengthHint)
  const listedHints = lintHints.filter((h) => !isSubjectLengthHint(h))
  const subjLen = subjectLength(summary)
  const subjLevel = subjectCounterLevel(subjLen)
  const cc = parseCcPrefix(summary)
  const currentCcType = cc.type
  // With a Conventional style the prefix lives on the type button, and the
  // field holds the words after it — the stored summary stays whole, so drafts,
  // history recall, amend and the AI all read and write it as before. Typing a
  // prefix by hand, or Backspace at the field's start, shows it as text again
  // until the field loses focus.
  const [prefixAsText, setPrefixAsText] = useState(false)
  const splitPrefix = usesConventional && !!cc.type && !prefixAsText
  const prefix = splitPrefix ? summary.slice(0, summary.length - cc.rest.length) : ''
  const prefixLabel = cc.type ? `${cc.type}${cc.scope}${cc.bang}` : ''
  const inputRef = useRef<HTMLInputElement | null>(null)
  const setInputRefs = (el: HTMLInputElement | null): void => {
    inputRef.current = el
    if (typeof summaryRef === 'function') summaryRef(el)
    else if (summaryRef) (summaryRef as React.RefObject<HTMLInputElement | null>).current = el
  }
  const changeSummaryText = (text: string): void => {
    const next = prefix + text
    if (usesConventional && !prefix && !cc.type && parseCcPrefix(next).type) setPrefixAsText(true)
    setSummary(next)
  }
  const handleSummaryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const el = e.currentTarget
    if (e.key === 'Backspace' && splitPrefix && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault()
      const at = prefix.length
      setPrefixAsText(true)
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(at, at))
      return
    }
    onSummaryKeyDown?.(e)
  }
  const applyCcTypeToSummary = (ty: string): void => {
    // In the combined style the type and its gitmoji move together (feat → ✨).
    setSummary(commitStyle === 'gitmoji-conventional' ? applyCcTypeWithGitmoji(summary, ty) : applyCcType(summary, ty))
  }
  // When the repository lists its scopes, the scope is a pick from the real
  // set — which is the difference between `feat(renderer)` and `feat(rendererr)`.
  const applyCcScopeToSummary = (scope: string): void => setSummary(applyCcScope(summary, scope))
  const openCcTypeMenu = (e: React.MouseEvent): void => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    openContextMenu(r.left, r.bottom + 4, [
      ...CC_TYPES.map((ty) => ({
        label: ty,
        icon: ty === currentCcType ? <Check size={13} /> : undefined,
        onClick: () => applyCcTypeToSummary(ty)
      })),
      { separator: true },
      { label: t('composer.ccTypeNone'), disabled: !currentCcType, onClick: () => applyCcTypeToSummary('') }
    ])
  }
  const currentGitmoji = parseGitmojiPrefix(summary).emoji
  const applyGitmojiToSummary = (emoji: string): void => setSummary(applyGitmoji(summary, emoji))

  // Co-author picker: append `Co-authored-by:` trailers from the repo's
  // contributors to the commit body.
  const coAuthorsRef = useRef<{ name: string; email: string }[]>([])
  const addCoAuthorTrailer = (c: { name: string; email: string }): void => {
    const trailer = `Co-authored-by: ${c.name} <${c.email}>`
    if (description.includes(trailer)) return
    setDescription(description.trim() ? `${description.replace(/\s+$/, '')}\n${trailer}` : trailer)
  }
  const openCoAuthorMenu = async (e: React.MouseEvent): Promise<void> => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (!coAuthorsRef.current.length) {
      coAuthorsRef.current = await gitApi.contributors(repoPath).catch(() => [])
    }
    const list = coAuthorsRef.current
    openContextMenu(
      r.left,
      r.bottom + 4,
      list.length
        ? list.map((c) => ({
            label: `${c.name} · ${c.email}`,
            icon: <Avatar email={c.email} name={c.name} size={16} />,
            onClick: () => addCoAuthorTrailer(c)
          }))
        : [{ label: t('composer.noCoAuthors'), disabled: true, onClick: () => {} }]
    )
  }

  // Ticket field is free-text while typing; it only writes a `KEY-123:` prefix
  // once the key is complete, and strips it when cleared.
  const [ticketField, setTicketField] = useState(() => parseTicketPrefix(summary).ticket)
  const applyTicketToSummary = (v: string): void => {
    setTicketField(v)
    const rest = parseTicketPrefix(summary).rest
    const key = v.trim().toUpperCase()
    setSummary(/^[A-Z][A-Z0-9]+-\d+$/.test(key) ? `${key}: ${rest}` : rest)
  }
  // A repo that asks for `commit.ticketFromBranch` gets the key filled in from
  // the branch name — but only into an empty summary, so it can never rewrite
  // a subject someone is in the middle of typing.
  const branchTicket = ticketFromBranch(branch)
  useEffect(() => {
    if (!fillTicketFromBranch || !branchTicket) return
    if (summary.trim() || ticketField) return
    setTicketField(branchTicket)
    setSummary(`${branchTicket}: `)
    // Keyed on the branch: switching branches offers that branch's key once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillTicketFromBranch, branchTicket])

  return (
    <>
      <div className="commit-summary-row">
        <button
          type="button"
          className={`commit-advanced-toggle ${showAdvanced ? 'open' : ''}`}
          title={showAdvanced ? t('composer.hideStyleOptions') : t('composer.showStyleOptions')}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <ChevronDown size={14} />
        </button>
        {/* Beside the subject, not in the collapsed style row: with a gitmoji
            style the emoji is part of every message, so it must be one click away. */}
        {usesGitmoji && <GitmojiPicker value={currentGitmoji} onPick={applyGitmojiToSummary} disabled={disabled} />}
        {usesConventional && (
          <button
            type="button"
            className={`commit-cc-type ${cc.type ? 'set' : ''}`}
            title={t('composer.ccType')}
            aria-haspopup="menu"
            disabled={disabled || readOnly}
            onClick={openCcTypeMenu}
          >
            {prefixLabel || t('composer.ccTypePlaceholder')}
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        )}
        <input
          ref={setInputRefs}
          id={summaryId}
          className="commit-summary"
          placeholder={t('composer.summaryPlaceholder')}
          title={t('composer.summaryTitle')}
          value={splitPrefix ? cc.rest : summary}
          disabled={disabled}
          // While the AI writes, typing here would be overwritten by its answer.
          readOnly={readOnly}
          maxLength={Math.max(0, summaryMaxLength - prefix.length)}
          onChange={(e) => changeSummaryText(e.target.value)}
          onKeyDown={handleSummaryKeyDown}
          onBlur={() => setPrefixAsText(false)}
        />
        {summary.trim().length > 0 && (
          // Muted against the limit; red only past it. The "aim for 50" rule is the tooltip.
          <span
            className={`commit-counter ${subjLevel === 'error' ? 'error' : ''}`}
            title={
              lengthHint
                ? interp(t(lengthHint.key), lengthHint.vars ?? {})
                : interp(t('composer.subjectLength'), { ideal: SUBJECT_IDEAL_LEN })
            }
          >
            {subjLen}/{SUBJECT_MAX_LEN}
          </span>
        )}
        <button
          className="commit-type commit-coauthor"
          title={t('composer.addCoAuthor')}
          disabled={disabled}
          onClick={(e) => void openCoAuthorMenu(e)}
        >
          <Users size={14} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {showAdvanced && (
          <motion.div
            className="commit-style-row"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {usesConventional && scopes.length > 0 && (
              <select
                className="commit-type"
                title={t('composer.ccScope')}
                value={currentCcScope(summary)}
                disabled={disabled || !currentCcType}
                onChange={(e) => applyCcScopeToSummary(e.target.value)}
              >
                <option value="">{t('composer.ccScopePlaceholder')}</option>
                {scopes.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            )}
            {commitStyle === 'ticket' && (
              <input
                className="commit-type commit-ticket"
                title={t('composer.ticketKey')}
                placeholder={branchTicket || 'ABC-123'}
                value={ticketField}
                spellCheck={false}
                disabled={disabled}
                onChange={(e) => applyTicketToSummary(e.target.value)}
              />
            )}
            <select
              className="commit-style-select"
              title={t('composer.commitStyle')}
              value={commitStyle}
              onChange={(e) => setCommitStyle(e.target.value as CommitStyle)}
            >
              {styleOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.key)}
                </option>
              ))}
            </select>
          </motion.div>
        )}
      </AnimatePresence>
      <textarea
        className="commit-description"
        placeholder={t('composer.descriptionPlaceholder')}
        value={description}
        disabled={disabled}
        readOnly={readOnly}
        rows={3}
        onChange={(e) => setDescription(e.target.value)}
      />
      {afterDescription}
      {listedHints.length > 0 && (
        <ul className="commit-lint">
          {listedHints.map((h, i) => (
            <li key={i} className={`commit-lint-item ${h.level}`}>
              {h.vars ? interp(t(h.key), h.vars) : t(h.key)}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
