import { useMemo, useRef } from 'react'
import { highlightLine } from '../lib/highlight'

/**
 * A plain-text editor with the file viewer's look: a syntax-highlighted
 * backdrop under a transparent textarea, scrolled together. Typing happens in
 * the textarea (native undo, selection, IME); the colours come from the `pre`.
 * Shared by the file viewer's edit mode and the commit editor.
 */
export function CodeEditor({
  value,
  onChange,
  lang,
  lineNumbers = false,
  disabled = false,
  autoFocus = false
}: {
  value: string
  onChange: (next: string) => void
  /** A highlight.js language id, from `guessLanguage(file)`. */
  lang: string
  lineNumbers?: boolean
  disabled?: boolean
  autoFocus?: boolean
}): React.JSX.Element {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLPreElement>(null)

  const lineCount = useMemo(() => value.split('\n').length, [value])
  // A trailing newline keeps the last (possibly empty) line rendered, so the
  // textarea and the backdrop stay aligned to the last row.
  const html = useMemo(
    () => value.split('\n').map((l) => highlightLine(l, lang) || '&nbsp;').join('\n') + '\n',
    [value, lang]
  )
  const gutter = useMemo(
    () => (lineNumbers ? Array.from({ length: lineCount }, (_, i) => i + 1).join('\n') + '\n' : ''),
    [lineNumbers, lineCount]
  )

  const syncScroll = (): void => {
    const area = areaRef.current
    if (!area) return
    if (preRef.current) {
      preRef.current.scrollTop = area.scrollTop
      preRef.current.scrollLeft = area.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = area.scrollTop
  }

  // The gutter grows with the number of digits, so a 9-line file and a
  // 9 000-line one both keep their text column where the eye expects it.
  const style = lineNumbers
    ? ({ '--code-gutter': `calc(${String(lineCount).length}ch + 26px)` } as React.CSSProperties)
    : undefined

  return (
    <div className={`code-editor ${lineNumbers ? 'with-lines' : ''}`} style={style}>
      {lineNumbers && (
        <pre ref={gutterRef} className="code-editor-gutter" aria-hidden="true">
          {gutter}
        </pre>
      )}
      <pre ref={preRef} className="code-editor-pre hljs" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
      <textarea
        ref={areaRef}
        className="code-editor-area"
        value={value}
        disabled={disabled}
        spellCheck={false}
        autoFocus={autoFocus}
        onScroll={syncScroll}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Insert a real indent instead of moving focus.
          if (e.key === 'Tab') {
            e.preventDefault()
            const ta = e.currentTarget
            const { selectionStart: s, selectionEnd: end } = ta
            onChange(value.slice(0, s) + '  ' + value.slice(end))
            requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2))
          }
        }}
      />
    </div>
  )
}
