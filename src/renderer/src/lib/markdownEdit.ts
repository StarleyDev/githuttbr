// The editing behind the comment boxes' Markdown toolbar, shortcuts, list
// continuation and @/# autocomplete. Pure: every function takes the text and
// the selection and returns the one replacement to make — the component applies
// it through the browser's own editing command, so ⌘Z undoes it like typing.

/** The text of a field and its selection, as `selectionStart`/`selectionEnd` give it. */
export interface TextState {
  value: string
  selStart: number
  selEnd: number
}

/**
 * Replace `value[start, end)` with `text`, then select `[selStart, selEnd)` —
 * offsets in the text *after* the replacement.
 */
export interface TextEdit {
  start: number
  end: number
  text: string
  selStart: number
  selEnd: number
}

export type InlineFormat = 'bold' | 'italic'
export type LineFormat = 'heading1' | 'heading2' | 'heading3' | 'quote' | 'bullet' | 'numbered' | 'task'

const INLINE_MARKER: Record<InlineFormat, string> = { bold: '**', italic: '_' }

/** The new text a field would hold after an edit — what the tests compare. */
export function applyEditToValue(value: string, edit: TextEdit): string {
  return value.slice(0, edit.start) + edit.text + value.slice(edit.end)
}

/**
 * Bold or italic: wraps the selection, or unwraps it when it already carries the
 * marker — inside the selection or just around it. Nothing selected inserts the
 * marker around `placeholder` and selects the placeholder, ready to type over.
 * Spaces at the ends of a selection stay outside the markers: `** word**` is not
 * bold in Markdown.
 */
export function toggleInlineFormat(state: TextState, format: InlineFormat, placeholder: string): TextEdit {
  return toggleWrap(state, INLINE_MARKER[format], placeholder)
}

function toggleWrap({ value, selStart, selEnd }: TextState, marker: string, placeholder: string): TextEdit {
  const m = marker.length
  const sel = value.slice(selStart, selEnd)
  // Already wrapped just outside the selection: drop the markers around it.
  if (value.slice(selStart - m, selStart) === marker && value.slice(selEnd, selEnd + m) === marker && selStart >= m) {
    return { start: selStart - m, end: selEnd + m, text: sel, selStart: selStart - m, selEnd: selEnd - m }
  }
  // The selection includes its own markers.
  if (sel.length >= 2 * m && sel.startsWith(marker) && sel.endsWith(marker)) {
    const inner = sel.slice(m, sel.length - m)
    return { start: selStart, end: selEnd, text: inner, selStart, selEnd: selStart + inner.length }
  }
  if (!sel) {
    const text = marker + placeholder + marker
    return { start: selStart, end: selEnd, text, selStart: selStart + m, selEnd: selStart + m + placeholder.length }
  }
  const lead = sel.length - sel.trimStart().length
  const trail = sel.length - sel.trimEnd().length
  const core = sel.trim()
  if (!core) {
    const text = sel + marker + placeholder + marker
    return { start: selStart, end: selEnd, text, selStart: selEnd + m, selEnd: selEnd + m + placeholder.length }
  }
  const text = sel.slice(0, lead) + marker + core + marker + sel.slice(sel.length - trail)
  const coreStart = selStart + lead + m
  return { start: selStart, end: selEnd, text, selStart: coreStart, selEnd: coreStart + core.length }
}

/** Where the lines touched by `[selStart, selEnd)` begin and end (end excludes the newline). */
function lineSpan(value: string, selStart: number, selEnd: number): { start: number; end: number } {
  const start = value.lastIndexOf('\n', selStart - 1) + 1
  // A selection ending right after a newline does not take in the next line.
  const last = selEnd > selStart && value[selEnd - 1] === '\n' ? selEnd - 1 : selEnd
  const nl = value.indexOf('\n', last)
  return { start, end: nl === -1 ? value.length : nl }
}

/**
 * Code. Within one line it is inline code, toggled like bold. A selection that
 * spans lines becomes a fenced block around those whole lines — and a block
 * already fenced (the fences selected, or just outside) is unfenced.
 */
export function toggleCode(state: TextState, placeholder: string): TextEdit {
  const { value, selStart, selEnd } = state
  if (!value.slice(selStart, selEnd).includes('\n')) return toggleWrap(state, '`', placeholder)
  const span = lineSpan(value, selStart, selEnd)
  const block = value.slice(span.start, span.end)
  const lines = block.split('\n')
  const isFence = (l: string | undefined): boolean => l !== undefined && /^\s*```/.test(l)
  if (lines.length >= 2 && isFence(lines[0]) && isFence(lines[lines.length - 1])) {
    const inner = lines.slice(1, -1).join('\n')
    return { start: span.start, end: span.end, text: inner, selStart: span.start, selEnd: span.start + inner.length }
  }
  const before = value.slice(0, span.start).replace(/\n$/, '').split('\n').pop()
  const after = value.slice(span.end + 1).split('\n')[0]
  if (span.start > 0 && span.end < value.length && isFence(before) && isFence(after)) {
    const start = span.start - (before ?? '').length - 1
    const end = span.end + 1 + after.length
    return { start, end, text: block, selStart: start, selEnd: start + block.length }
  }
  const text = '```\n' + block + '\n```'
  return { start: span.start, end: span.end, text, selStart: span.start + 4, selEnd: span.start + 4 + block.length }
}

const LINK_RE = /^\[([^\]\n]*)\]\(([^)\s]*)\)$/
const URL_RE = /^https?:\/\/\S+$/

/**
 * A link. A selected link is unlinked back to its text; a selected URL becomes
 * the target with `textPlaceholder` selected for its text; any other selection
 * becomes the text with `urlPlaceholder` selected for the address.
 */
export function insertLink(state: TextState, textPlaceholder: string, urlPlaceholder: string): TextEdit {
  const { value, selStart, selEnd } = state
  const sel = value.slice(selStart, selEnd)
  const linked = LINK_RE.exec(sel)
  if (linked) {
    return { start: selStart, end: selEnd, text: linked[1], selStart, selEnd: selStart + linked[1].length }
  }
  if (URL_RE.test(sel.trim()) && !sel.includes('\n')) {
    const text = `[${textPlaceholder}](${sel.trim()})`
    return { start: selStart, end: selEnd, text, selStart: selStart + 1, selEnd: selStart + 1 + textPlaceholder.length }
  }
  const label = sel || textPlaceholder
  const text = `[${label}](${urlPlaceholder})`
  if (!sel) return { start: selStart, end: selEnd, text, selStart: selStart + 1, selEnd: selStart + 1 + label.length }
  const urlStart = selStart + label.length + 3
  return { start: selStart, end: selEnd, text, selStart: urlStart, selEnd: urlStart + urlPlaceholder.length }
}

// Every prefix a line tool understands, so switching a bulleted line to a
// numbered one replaces the bullet instead of stacking both.
const HEADING_RE = /^#{1,6}\s+/
const QUOTE_RE = /^>\s?/
const TASK_RE = /^[-*+]\s\[[ xX]\]\s/
const BULLET_RE = /^[-*+]\s/
const NUMBER_RE = /^\d+[.)]\s/

function prefixOf(line: string, format: LineFormat): RegExp {
  switch (format) {
    case 'heading1':
    case 'heading2':
    case 'heading3':
      return HEADING_RE
    case 'quote':
      return QUOTE_RE
    case 'task':
      return TASK_RE
    case 'bullet':
      return BULLET_RE
    case 'numbered':
      return NUMBER_RE
  }
}

function hasFormat(line: string, format: LineFormat): boolean {
  if (format === 'heading1') return /^#\s/.test(line)
  if (format === 'heading2') return /^##\s/.test(line)
  if (format === 'heading3') return /^###\s/.test(line)
  // A task line also starts with a bullet; it is not a plain bulleted line.
  if (format === 'bullet') return BULLET_RE.test(line) && !TASK_RE.test(line)
  return prefixOf(line, format).test(line)
}

/** The prefix of the same family already on a line — the part a new one replaces. */
function existingPrefix(line: string, format: LineFormat): string {
  const family =
    format === 'quote'
      ? [QUOTE_RE]
      : format.startsWith('heading')
        ? [HEADING_RE]
        : [TASK_RE, BULLET_RE, NUMBER_RE]
  for (const re of family) {
    const m = re.exec(line)
    if (m) return m[0]
  }
  return ''
}

function newPrefix(format: LineFormat, n: number): string {
  switch (format) {
    case 'heading1':
      return '# '
    case 'heading2':
      return '## '
    case 'heading3':
      return '### '
    case 'quote':
      return '> '
    case 'bullet':
      return '- '
    case 'numbered':
      return `${n}. `
    case 'task':
      return '- [ ] '
  }
}

/**
 * Heading, quote and the three lists act on every line the selection touches.
 * When every non-blank line already has the format it is removed; otherwise it
 * is added (numbered lines counting from 1), replacing a heading of another
 * level or a list marker of another kind. Blank lines are left alone, except in
 * a quote, which a bare `>` keeps in one piece.
 */
export function toggleLinePrefix(state: TextState, format: LineFormat): TextEdit {
  const { value, selStart, selEnd } = state
  const span = lineSpan(value, selStart, selEnd)
  const lines = value.slice(span.start, span.end).split('\n')
  const filled = lines.filter((l) => l.trim())
  const remove = filled.length > 0 && filled.every((l) => hasFormat(l, format))
  // Only blank lines (a caret on an empty line): they are what gets the prefix.
  const onlyBlank = filled.length === 0
  let n = 0
  const out = lines.map((line) => {
    if (!line.trim() && !onlyBlank) return format === 'quote' && !remove && lines.length > 1 ? '>' : line
    if (remove) return line.slice(existingPrefix(line, format).length)
    n++
    return newPrefix(format, n) + line.slice(existingPrefix(line, format).length)
  })
  const text = out.join('\n')
  if (selStart === selEnd && lines.length === 1) {
    // A caret stays where it was in the line's own text, after the new prefix.
    const oldPrefix = existingPrefix(lines[0], format).length
    const prefixNow = text.length - (lines[0].length - oldPrefix)
    const inText = Math.max(0, selStart - span.start - oldPrefix)
    const caret = span.start + prefixNow + inText
    return { start: span.start, end: span.end, text, selStart: caret, selEnd: caret }
  }
  return { start: span.start, end: span.end, text, selStart: span.start, selEnd: span.start + text.length }
}

const LIST_ITEM_RE = /^(\s*)(?:([-*+])\s\[[ xX]\]|([-*+])|(\d+)([.)]))\s/

/**
 * Enter in a list item: a new item below (the next number, an unticked box for
 * a task). Enter on an item with nothing after its marker ends the list
 * instead, removing that marker. Null means Enter should do what it normally does.
 */
export function continueList(state: TextState): TextEdit | null {
  const { value, selStart, selEnd } = state
  if (selStart !== selEnd) return null
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1
  const nl = value.indexOf('\n', selStart)
  const lineEnd = nl === -1 ? value.length : nl
  const line = value.slice(lineStart, lineEnd)
  const m = LIST_ITEM_RE.exec(line)
  if (!m) return null
  const prefixLen = m[0].length
  // A caret inside the marker itself is not "at the end of an item".
  if (selStart - lineStart < prefixLen) return null
  if (!line.slice(prefixLen).trim()) {
    return { start: lineStart, end: lineEnd, text: '', selStart: lineStart, selEnd: lineStart }
  }
  const indent = m[1]
  const next = m[2] ? `${m[2]} [ ] ` : m[3] ? `${m[3]} ` : `${Number(m[4]) + 1}${m[5]} `
  const text = '\n' + indent + next
  const caret = selStart + text.length
  return { start: selStart, end: selStart, text, selStart: caret, selEnd: caret }
}

export type AutocompleteTrigger = '@' | '#'

/** An @mention or #reference being typed: the trigger, what follows it, and where the trigger sits. */
export interface AutocompleteQuery {
  trigger: AutocompleteTrigger
  query: string
  start: number
}

const QUERY_CHAR = /[\p{L}\p{N}_.-]/u

/** Inside a fenced block (an odd number of fences above the caret) or inline code on its line. */
function isInCode(value: string, pos: number): boolean {
  const before = value.slice(0, pos)
  const fences = before.split('\n').filter((l) => /^\s*```/.test(l)).length
  if (fences % 2 === 1) return true
  const line = before.slice(before.lastIndexOf('\n') + 1)
  return (line.match(/`/g)?.length ?? 0) % 2 === 1
}

/**
 * The @ or # being typed at the caret, if any: the trigger must start a word
 * (start of text, after a space or an opening bracket) and be followed only by
 * name characters up to the caret. Nothing inside code — `@decorator` and
 * `#include` there are code, not people or issues.
 */
export function getAutocompleteQuery(value: string, caret: number): AutocompleteQuery | null {
  let i = caret
  while (i > 0 && QUERY_CHAR.test(value[i - 1])) i--
  const trigger = value[i - 1]
  if (trigger !== '@' && trigger !== '#') return null
  const start = i - 1
  const prev = value[start - 1]
  if (start > 0 && !/[\s([{]/.test(prev)) return null
  const query = value.slice(i, caret)
  // `#` followed by a space is a heading being typed, and `#.` is nothing.
  if (query.length > 39 || (trigger === '#' && /[^\p{L}\p{N}_-]/u.test(query))) return null
  if (isInCode(value, start)) return null
  return { trigger, query, start }
}

/**
 * Names that match a mention query: those starting with it first, then those
 * containing it, case-insensitive, in the order given within each group.
 */
export function filterMentions(names: string[], query: string, limit = 8): string[] {
  const q = query.toLowerCase()
  const starts: string[] = []
  const contains: string[] = []
  for (const name of names) {
    const n = name.toLowerCase()
    if (n.startsWith(q)) starts.push(name)
    else if (q && n.includes(q)) contains.push(name)
  }
  return [...starts, ...contains].slice(0, limit)
}

/** A pull request or issue a `#` can point at. */
export interface MarkdownReference {
  number: number
  title: string
  kind: 'pr' | 'issue'
}

/**
 * References that match a `#` query. Digits match the number's start; anything
 * else matches a word of the title (its start first, then anywhere). Newest —
 * the highest number — first within each group.
 */
export function filterReferences(refs: MarkdownReference[], query: string, limit = 8): MarkdownReference[] {
  const sorted = [...refs].sort((a, b) => b.number - a.number)
  if (!query) return sorted.slice(0, limit)
  if (/^\d+$/.test(query)) return sorted.filter((r) => String(r.number).startsWith(query)).slice(0, limit)
  const q = query.toLowerCase()
  const wordStart: MarkdownReference[] = []
  const inside: MarkdownReference[] = []
  for (const r of sorted) {
    const title = r.title.toLowerCase()
    if (title.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(q))) wordStart.push(r)
    else if (title.includes(q)) inside.push(r)
  }
  return [...wordStart, ...inside].slice(0, limit)
}

/** Replaces the query being typed (from its trigger to the caret) with the picked item and a space. */
export function completeQuery(value: string, caret: number, query: AutocompleteQuery, insert: string): TextEdit {
  // A space already right after the caret is reused, not doubled.
  const spaceAfter = value[caret] === ' '
  const text = `${query.trigger}${insert}${spaceAfter ? '' : ' '}`
  const pos = query.start + text.length + (spaceAfter ? 1 : 0)
  return { start: query.start, end: caret, text, selStart: pos, selEnd: pos }
}

/**
 * The people a comment can mention, from every list the page already holds —
 * author, reviewers, commenters. Each once, in first-seen order; blanks and the
 * hosts' "unknown" placeholder dropped.
 */
export function collectMentionNames(...groups: (readonly (string | null | undefined)[] | undefined)[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    for (const name of group ?? []) {
      const login = name?.trim()
      if (!login || login === 'unknown' || seen.has(login.toLowerCase())) continue
      seen.add(login.toLowerCase())
      out.push(login)
    }
  }
  return out
}

/** Pull requests and issues as `#` references, each number once (a PR listed as an issue too stays a PR). */
export function collectReferences(
  prs: readonly { id: number; title: string }[] | undefined,
  issues: readonly { number: number; title: string }[] | undefined
): MarkdownReference[] {
  const out = new Map<number, MarkdownReference>()
  for (const p of prs ?? []) out.set(p.id, { number: p.id, title: p.title, kind: 'pr' })
  for (const i of issues ?? []) if (!out.has(i.number)) out.set(i.number, { number: i.number, title: i.title, kind: 'issue' })
  return [...out.values()]
}
