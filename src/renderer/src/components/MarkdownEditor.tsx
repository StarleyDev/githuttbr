import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bold,
  Code,
  GitPullRequest,
  CircleDot,
  Heading,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  TextQuote
} from 'lucide-react'
import { MarkdownHtml } from './MarkdownHtml'
import { RemoteMarkdown, useRemotePreviewScope } from './RemoteMarkdown'
import { MarkdownCheatSheet } from './MarkdownCheatSheet'
import { useT, interp, type TranslationKey } from '../i18n'
import { useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { formatCombo } from '../lib/shortcuts'
import {
  collectReferences,
  completeQuery,
  continueList,
  filterMentions,
  filterReferences,
  getAutocompleteQuery,
  insertLink,
  toggleCode,
  toggleInlineFormat,
  toggleLinePrefix,
  type AutocompleteQuery,
  type LineFormat,
  type MarkdownReference,
  type TextEdit,
  type TextState
} from '../lib/markdownEdit'

type Tool = 'bold' | 'italic' | 'code' | 'link' | 'quote' | 'bullet' | 'numbered' | 'task'

// Keys, not strings: the toolbar is built once, the language can change after.
const TOOLS: { id: Tool; icon: React.ReactNode; labelKey: TranslationKey; combo?: string }[] = [
  { id: 'bold', icon: <Bold size={14} />, labelKey: 'mdEditor.bold', combo: 'mod+b' },
  { id: 'italic', icon: <Italic size={14} />, labelKey: 'mdEditor.italic', combo: 'mod+i' },
  { id: 'code', icon: <Code size={14} />, labelKey: 'mdEditor.code', combo: 'mod+e' },
  { id: 'link', icon: <Link size={14} />, labelKey: 'mdEditor.link', combo: 'mod+k' },
  { id: 'quote', icon: <TextQuote size={14} />, labelKey: 'mdEditor.quote' },
  { id: 'bullet', icon: <List size={14} />, labelKey: 'mdEditor.bulletList', combo: 'mod+shift+8' },
  { id: 'numbered', icon: <ListOrdered size={14} />, labelKey: 'mdEditor.numberedList', combo: 'mod+shift+7' },
  { id: 'task', icon: <ListTodo size={14} />, labelKey: 'mdEditor.taskList' }
]

const HEADINGS: { format: LineFormat; labelKey: TranslationKey }[] = [
  { format: 'heading1', labelKey: 'mdEditor.heading1' },
  { format: 'heading2', labelKey: 'mdEditor.heading2' },
  { format: 'heading3', labelKey: 'mdEditor.heading3' }
]

const isMac = (): boolean => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

/** The edit one toolbar tool makes on the current text — pure, from lib/markdownEdit. */
function editForTool(tool: Tool | LineFormat, state: TextState, t: (k: TranslationKey) => string): TextEdit {
  switch (tool) {
    case 'bold':
      return toggleInlineFormat(state, 'bold', t('mdEditor.placeholderBold'))
    case 'italic':
      return toggleInlineFormat(state, 'italic', t('mdEditor.placeholderItalic'))
    case 'code':
      return toggleCode(state, t('mdEditor.placeholderCode'))
    case 'link':
      return insertLink(state, t('mdEditor.placeholderLinkText'), t('mdEditor.placeholderUrl'))
    default:
      return toggleLinePrefix(state, tool)
  }
}

/**
 * The tool a key combination asks for, or null. The modifier is the platform's
 * own — ⌘ on macOS, Ctrl elsewhere — so the Cocoa Ctrl+B/E/K text bindings
 * keep working on a Mac. Letters fall back to the physical key on a layout
 * whose B is not a Latin "b" (Cyrillic, Greek…); Shift+8 and Shift+7 are read
 * by physical key always, since they type "*" on one layout and "(" on another.
 */
function getToolForKey(e: React.KeyboardEvent): Tool | null {
  const mod = (isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && !e.altKey
  if (!mod) return null
  if (e.shiftKey) {
    if (e.code === 'Digit8') return 'bullet'
    if (e.code === 'Digit7') return 'numbered'
    return null
  }
  const key = e.key.toLowerCase()
  const letter = /^[a-z]$/.test(key) ? key : /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : ''
  if (letter === 'b') return 'bold'
  if (letter === 'i') return 'italic'
  if (letter === 'e') return 'code'
  if (letter === 'k') return 'link'
  return null
}

/**
 * Makes one edit through the browser's own editing command, so the textarea's
 * native undo stack records it and ⌘Z takes it back like anything typed. The
 * `insertText` command fires a real input event, which is what a controlled
 * React field listens to. Where the command is unavailable, `setRangeText`
 * plus a synthetic input event keeps the text right, without the undo step.
 */
function applyEdit(el: HTMLTextAreaElement, edit: TextEdit): void {
  el.focus()
  el.setSelectionRange(edit.start, edit.end)
  const expected = el.value.slice(0, edit.start) + edit.text + el.value.slice(edit.end)
  let done = false
  try {
    done =
      edit.text === ''
        ? edit.start === edit.end || document.execCommand('delete', false)
        : document.execCommand('insertText', false, edit.text)
  } catch {
    done = false
  }
  if (!done) {
    el.setRangeText(edit.text, edit.start, edit.end, 'end')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else if (el.value !== expected) {
    // The command ran but left something else (an autocorrect, a browser
    // quirk): the text is set outright — applying the range again would double it.
    el.value = expected
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  el.setSelectionRange(edit.selStart, edit.selEnd)
}

// The properties a mirror element copies so its text wraps exactly like the textarea's.
const MIRROR_PROPS = [
  'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight',
  'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
  'letterSpacing', 'wordSpacing', 'tabSize', 'whiteSpace', 'wordBreak', 'overflowWrap'
] as const

/** Where character `pos` sits inside the textarea, in px from its top-left (scroll applied). */
function getCaretPoint(el: HTMLTextAreaElement, pos: number): { left: number; top: number; height: number } {
  const style = getComputedStyle(el)
  const mirror = document.createElement('div')
  for (const p of MIRROR_PROPS) mirror.style[p] = style[p]
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.overflow = 'hidden'
  if (style.whiteSpace === 'normal' || !style.whiteSpace) mirror.style.whiteSpace = 'pre-wrap'
  mirror.textContent = el.value.slice(0, pos)
  const marker = document.createElement('span')
  marker.textContent = '​'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4
  const point = { left: marker.offsetLeft - el.scrollLeft, top: marker.offsetTop - el.scrollTop, height: lineHeight }
  mirror.remove()
  return point
}

/** A combo as `aria-keyshortcuts` spells it: "mod+shift+8" → "Control+Shift+8" (Meta on macOS). */
function ariaShortcut(combo: string): string {
  const mac = isMac()
  return combo
    .split('+')
    // i18n-ignore ARIA key names, read by assistive tech, never shown
    .map((p) => (p === 'mod' ? (mac ? 'Meta' : 'Control') : p === 'shift' ? 'Shift' : p.toUpperCase()))
    .join('+')
}

interface Completion {
  query: AutocompleteQuery
  items: { id: string; insert: string; primary: string; secondary?: string; kind?: MarkdownReference['kind'] }[]
}

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  /** The textarea's own class — each box keeps the look it had. */
  inputClassName?: string
  className?: string
  autoFocus?: boolean
  inputRef?: React.Ref<HTMLTextAreaElement>
  /**
   * Keys the editor did not take for itself: ⌘/Ctrl+Enter to send, Escape to
   * cancel — from the field, and from the tabs, toolbar or preview around it.
   */
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void
  /** People an @ offers, from what the page already shows. */
  mentions?: string[]
  /**
   * Pull requests and issues a # offers — read when a # list opens, not held:
   * the repository's lists are refreshed in the background, and a new array
   * each time would re-render whatever holds the editor.
   */
  getReferences?: () => MarkdownReference[]
  /** A box in a list of many (thread replies): the tools appear once it is used. */
  compact?: boolean
  /** The cheat sheet links to the full guide — off inside a dialog, which would hide it. */
  helpLink?: boolean
  /**
   * Whether leaving for the guide would lose text: every unsent box on the
   * page, not only this one. Defaults to this box's own text.
   */
  hasUnsentText?: () => boolean
  spellCheck?: boolean
}

/**
 * The comment box used wherever the app writes Markdown to a host — pull
 * request and issue comments, thread replies, line comments, new PR and issue
 * descriptions. GitHub's tools: Write / Preview, a formatting toolbar and its
 * shortcuts, list continuation on Enter, and @mention / #reference completion
 * from what the page already knows (no extra API call).
 *
 * The text stays with whoever owns it — `value` / `onChange` — so a reply box
 * that keeps its own state keeps re-rendering only itself while typing.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  inputClassName = 'prd-input',
  className = '',
  autoFocus,
  inputRef,
  onKeyDown,
  mentions,
  getReferences,
  compact = false,
  helpLink = true,
  hasUnsentText,
  spellCheck = true
}: MarkdownEditorProps): React.JSX.Element {
  const t = useT()
  const id = useId()
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  // On a pull request or issue page, Preview shows what the posted comment will look like.
  const remotePreview = useRemotePreviewScope()
  const [focused, setFocused] = useState(false)
  const [headingOpen, setHeadingOpen] = useState(false)
  const [cheatAnchor, setCheatAnchor] = useState<HTMLElement | null>(null)
  const [toolIndex, setToolIndex] = useState(0)
  const [completion, setCompletion] = useState<Completion | null>(null)
  const completionRef = useRef<Completion | null>(null)
  completionRef.current = completion
  const [active, setActive] = useState(0)
  const [popupAt, setPopupAt] = useState<React.CSSProperties | null>(null)
  // A list closed with Escape stays closed until the @ or # it belonged to changes.
  const dismissed = useRef<number | null>(null)

  const setRefs = (el: HTMLTextAreaElement | null): void => {
    ref.current = el
    if (typeof inputRef === 'function') inputRef(el)
    else if (inputRef) (inputRef as React.RefObject<HTMLTextAreaElement | null>).current = el
  }

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
    // Only on mount, like the attribute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const listId = `${id}-ac`
  const optionId = (i: number): string => `${id}-ac-${i}`
  const expanded = !compact || focused || !!value || mode === 'preview' || !!cheatAnchor

  /** Recomputes the @/# list from the caret — after typing, clicking or moving it. */
  const refreshCompletion = (): void => {
    const el = ref.current
    if (!el || el.selectionStart !== el.selectionEnd) return setCompletion(null)
    const q = getAutocompleteQuery(el.value, el.selectionStart)
    if (!q || q.start === dismissed.current) {
      if (!q) dismissed.current = null
      return setCompletion(null)
    }
    const items =
      q.trigger === '@'
        ? filterMentions(mentions ?? [], q.query).map((login) => ({ id: login, insert: login, primary: login }))
        : filterReferences(getReferences?.() ?? [], q.query).map((r) => ({
            id: `${r.kind}-${r.number}`,
            insert: String(r.number),
            primary: `#${r.number}`,
            secondary: r.title,
            kind: r.kind
          }))
    if (!items.length) return setCompletion(null)
    // A new @ or # starts at the top of its list; the same one keeps its place.
    const cur = completionRef.current
    if (!cur || cur.query.start !== q.start || cur.query.trigger !== q.trigger) setActive(0)
    else setActive((a) => Math.min(a, items.length - 1))
    setCompletion({ query: q, items })
  }

  // The list sits under the trigger character — above it near the bottom of the
  // window, where the PR page's comment box lives. Fixed, in a portal on <body>:
  // dialogs and the diff's line blocks clip anything positioned inside them.
  // Measured when a list opens on a new @ or #, and when the page scrolls or
  // the window resizes — not on every key typed after the trigger.
  const anchorStart = completion ? completion.query.start : null
  useLayoutEffect(() => {
    const el = ref.current
    if (anchorStart === null || !el) return setPopupAt(null)
    const place = (): void => {
      const caret = getCaretPoint(el, anchorStart)
      const box = el.getBoundingClientRect()
      const left = Math.max(4, Math.min(box.left + caret.left, window.innerWidth - 284))
      const lineTop = box.top + Math.max(0, Math.min(caret.top, box.height - caret.height))
      const above = lineTop + caret.height + 220 > window.innerHeight
      setPopupAt(above ? { left, bottom: window.innerHeight - lineTop + 2 } : { left, top: lineTop + caret.height + 2 })
    }
    place()
    window.addEventListener('resize', place)
    // Capture: the page scrolls inside its own containers, not the window.
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorStart])

  const pick = (i: number): void => {
    const el = ref.current
    const item = completion?.items[i]
    if (!el || !item || !completion) return
    applyEdit(el, completeQuery(el.value, el.selectionStart, completion.query, item.insert))
    setCompletion(null)
  }

  const runTool = (tool: Tool | LineFormat): void => {
    const el = ref.current
    if (!el) return
    applyEdit(el, editForTool(tool, { value: el.value, selStart: el.selectionStart, selEnd: el.selectionEnd }, t))
    setCompletion(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // An input method composing a character owns these keys until it commits.
    const composing = e.nativeEvent.isComposing
    if (completion && !composing) {
      const n = completion.items.length
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        pick(active)
        return
      }
      if (e.key === 'Escape') {
        // Only the list closes — not the line composer, not the dialog around it.
        e.preventDefault()
        e.stopPropagation()
        dismissed.current = completion.query.start
        setCompletion(null)
        return
      }
    }
    const tool = composing ? null : getToolForKey(e)
    if (tool) {
      // Taken here, so ⌘K inside a comment makes a link instead of opening the palette.
      e.preventDefault()
      e.stopPropagation()
      runTool(tool)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !composing) {
      const el = e.currentTarget
      const edit = continueList({ value: el.value, selStart: el.selectionStart, selEnd: el.selectionEnd })
      if (edit) {
        e.preventDefault()
        applyEdit(el, edit)
        return
      }
    }
    onKeyDown?.(e)
  }

  // Esc and ⌘/Ctrl+Enter mean the same from the tabs, toolbar or preview as
  // from the field: the box's owner decides what they do.
  const handleRootKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.target === ref.current || e.defaultPrevented) return
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) onKeyDown?.(e)
  }

  // Roving focus: one tab stop for the whole toolbar, arrows move inside it.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const toolButtons = (): HTMLButtonElement[] =>
    Array.from(toolbarRef.current?.querySelectorAll<HTMLButtonElement>('[data-tool-index]') ?? [])
  const moveTool = (e: React.KeyboardEvent): void => {
    const buttons = toolButtons()
    const n = buttons.length
    // From the button that has the focus: a click may have moved it off the tab stop.
    const focusedAt = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const at = focusedAt >= 0 ? focusedAt : toolIndex
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (at + 1) % n
    else if (e.key === 'ArrowLeft') next = (at + n - 1) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    if (next === null) return
    e.preventDefault()
    setToolIndex(next)
    buttons[next]?.focus()
  }

  // Write / Preview is a tab list: arrows switch and move the focus with them.
  const switchMode = (next: 'write' | 'preview', focusTab = false): void => {
    setMode(next)
    setCompletion(null)
    setHeadingOpen(false)
    if (focusTab) requestAnimationFrame(() => document.getElementById(`${id}-tab-${next}`)?.focus())
    // Back to writing: the caret is where it was — the textarea was only hidden.
    else if (next === 'write') requestAnimationFrame(() => ref.current?.focus())
  }

  const combo = (c?: string): string => (c ? formatCombo(c) : '')
  const label = (key: TranslationKey, c?: string): string => interp(t(key), { shortcut: combo(c) })

  // Closing gives the focus back to the hint that opened the sheet.
  const cheatAnchorRef = useRef<HTMLElement | null>(null)
  cheatAnchorRef.current = cheatAnchor
  const closeCheatSheet = useCallback((): void => {
    cheatAnchorRef.current?.focus()
    setCheatAnchor(null)
  }, [])
  // The guide is another tab: this page unmounts on the way, and with it any
  // text not sent. Asked first, like the PR page's ‹ › do.
  const openGuide = (): void => {
    setCheatAnchor(null)
    const go = (): void => useSettingsStore.getState().openPageTab({ type: 'help', page: 'writing-comments' })
    if (!(hasUnsentText ? hasUnsentText() : !!value.trim())) return go()
    useUIStore.getState().openModal({
      kind: 'confirm',
      title: t('mdEditor.leaveTitle'),
      message: t('mdEditor.leaveMessage'),
      danger: true,
      confirmLabel: t('mdEditor.leaveConfirm'),
      onConfirm: go
    })
  }

  const listShown = !!completion && !!popupAt

  return (
    <div
      className={`mde ${compact ? 'mde-compact' : ''} ${expanded ? 'mde-open' : ''} ${className}`}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false)
          setCompletion(null)
          setHeadingOpen(false)
        }
      }}
      onKeyDown={handleRootKeyDown}
    >
      {expanded && (
        <div className="mde-bar">
          <div className="mde-tabs" role="tablist" aria-label={t('mdEditor.modes')}>
            {(['write', 'preview'] as const).map((m) => (
              <button
                key={m}
                type="button"
                id={`${id}-tab-${m}`}
                role="tab"
                aria-selected={mode === m}
                aria-controls={`${id}-panel-${m}`}
                tabIndex={mode === m ? 0 : -1}
                className={`mde-tab ${mode === m ? 'active' : ''}`}
                onClick={() => switchMode(m)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault()
                    switchMode(m === 'write' ? 'preview' : 'write', true)
                  }
                }}
              >
                {t(m === 'write' ? 'mdEditor.write' : 'mdEditor.preview')}
              </button>
            ))}
          </div>
          {mode === 'write' && (
            <div
              ref={toolbarRef}
              className="mde-toolbar"
              role="toolbar"
              aria-label={t('mdEditor.toolbar')}
              aria-controls={`${id}-input`}
              onKeyDown={moveTool}
            >
              <div className="mde-heading">
                <button
                  type="button"
                  className="icon-btn mde-tool"
                  data-tool-index={0}
                  tabIndex={toolIndex === 0 ? 0 : -1}
                  title={t('mdEditor.heading')}
                  aria-label={t('mdEditor.heading')}
                  aria-haspopup="menu"
                  aria-expanded={headingOpen}
                  // The textarea keeps the focus — and with it the selection the tool acts on.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setHeadingOpen((o) => !o)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setHeadingOpen(true)
                    }
                  }}
                >
                  <Heading size={14} />
                </button>
                {headingOpen && (
                  <HeadingMenu
                    onPick={(f) => {
                      setHeadingOpen(false)
                      runTool(f)
                    }}
                    onClose={() => {
                      setHeadingOpen(false)
                      toolButtons()[0]?.focus()
                    }}
                    labelFor={(k) => t(k)}
                  />
                )}
              </div>
              {TOOLS.map((tool, i) => (
                <button
                  key={tool.id}
                  type="button"
                  className="icon-btn mde-tool"
                  data-tool-index={i + 1}
                  tabIndex={toolIndex === i + 1 ? 0 : -1}
                  title={label(tool.labelKey, tool.combo)}
                  aria-label={label(tool.labelKey, tool.combo)}
                  aria-keyshortcuts={tool.combo && ariaShortcut(tool.combo)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setToolIndex(i + 1)
                    runTool(tool.id)
                  }}
                >
                  {tool.icon}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div id={`${id}-panel-write`} role="tabpanel" aria-labelledby={`${id}-tab-write`} hidden={mode !== 'write'}>
        <textarea
          ref={setRefs}
          id={`${id}-input`}
          className={`${inputClassName} mde-input`}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          // A combobox only while its list is up, and pointing only at a list that exists.
          role={listShown ? 'combobox' : undefined}
          aria-expanded={listShown ? true : undefined}
          aria-autocomplete="list"
          aria-controls={listShown ? listId : undefined}
          aria-activedescendant={listShown ? optionId(active) : undefined}
          value={value}
          spellCheck={spellCheck}
          rows={compact ? (expanded ? 3 : 1) : undefined}
          onChange={(e) => {
            onChange(e.target.value)
            refreshCompletion()
          }}
          onSelect={refreshCompletion}
          onKeyDown={handleKeyDown}
        />
      </div>
      {/* Always in the DOM, so the Preview tab's aria-controls names a real element. */}
      <div
        id={`${id}-panel-preview`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-preview`}
        className={`mde-preview ${inputClassName}`}
        hidden={mode !== 'preview'}
        tabIndex={mode === 'preview' ? 0 : -1}
      >
        {mode === 'preview' &&
          (value.trim() ? (
            remotePreview ? (
              <RemoteMarkdown body={value} repoWebUrl={remotePreview.repoWebUrl} linkOptions={remotePreview.linkOptions} />
            ) : (
              <MarkdownHtml className="md-preview" markdown={value} />
            )
          ) : (
            <span className="mde-preview-empty">{t('mdEditor.previewEmpty')}</span>
          ))}
      </div>

      {listShown &&
        completion &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            className="mde-ac"
            style={popupAt ?? undefined}
            aria-label={t(completion.query.trigger === '@' ? 'mdEditor.mentions' : 'mdEditor.references')}
          >
            {completion.items.map((item, i) => (
              <li
                key={item.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className={`mde-ac-item ${i === active ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(i)
                }}
                onMouseEnter={() => setActive(i)}
              >
                {item.kind === 'pr' ? (
                  <GitPullRequest size={12} aria-label={t('mdEditor.refPr')} />
                ) : item.kind === 'issue' ? (
                  <CircleDot size={12} aria-label={t('mdEditor.refIssue')} />
                ) : null}
                <span className="mde-ac-primary">{item.primary}</span>
                {item.secondary && <span className="mde-ac-secondary">{item.secondary}</span>}
              </li>
            ))}
          </ul>,
          document.body
        )}

      {expanded && (
        <div className="mde-hint">
          <button
            type="button"
            className="prp-link mde-hint-link"
            title={t('mdEditor.cheatSheet')}
            aria-haspopup="dialog"
            aria-expanded={!!cheatAnchor}
            onClick={(e) => {
              const btn = e.currentTarget
              setCheatAnchor((a) => (a ? null : btn))
            }}
          >
            {t('mdEditor.markdownSupported')}
          </button>
        </div>
      )}
      {cheatAnchor && (
        <MarkdownCheatSheet anchor={cheatAnchor} onClose={closeCheatSheet} onOpenGuide={helpLink ? openGuide : undefined} />
      )}
    </div>
  )
}

/** H1–H3, as a menu under the heading button: arrows move, Enter picks, Escape closes. */
function HeadingMenu({
  onPick,
  onClose,
  labelFor
}: {
  onPick: (format: LineFormat) => void
  onClose: () => void
  labelFor: (key: TranslationKey) => string
}): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const items = (): HTMLButtonElement[] => Array.from(menuRef.current?.querySelectorAll('button') ?? [])
  useEffect(() => {
    // Opened from the keyboard or the mouse, the first level takes the focus.
    items()[0]?.focus({ preventScroll: true })
  }, [])
  return (
    <div
      ref={menuRef}
      className="mde-menu"
      role="menu"
      onKeyDown={(e) => {
        const list = items()
        const at = list.indexOf(document.activeElement as HTMLButtonElement)
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          list[(at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        } else if (e.key === 'Tab') {
          onClose()
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
          // Not the toolbar's roving focus: a menu is open.
          e.stopPropagation()
        }
      }}
    >
      {HEADINGS.map((h, i) => (
        <button
          key={h.format}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={`mde-menu-item mde-h${i + 1}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(h.format)}
        >
          {labelFor(h.labelKey)}
        </button>
      ))}
    </div>
  )
}

/**
 * The pull requests and issues this repository's lists hold, as `#`
 * references — a getter, read when a # list opens. It subscribes to nothing,
 * so a background refresh of the lists re-renders nothing.
 */
export function useRepoReferenceGetter(repoPath: string): () => MarkdownReference[] {
  return useCallback(() => {
    const repo = useRepoStore.getState().repos[repoPath]
    return collectReferences(repo?.prs, repo?.issues)
  }, [repoPath])
}
