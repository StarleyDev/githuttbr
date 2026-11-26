import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen } from 'lucide-react'
import { useT, type TranslationKey } from '../i18n'
import { formatCombo } from '../lib/shortcuts'

type Translate = (key: TranslationKey) => string

// What to type for each format. The samples are built from translated words at
// render time; only the Markdown punctuation around them is fixed.
const ROWS: { nameKey: TranslationKey; syntax: (t: Translate) => string; combo?: string }[] = [
  { nameKey: 'mdEditor.nameHeading', syntax: (t) => `## ${t('mdEditor.sampleText')}` },
  { nameKey: 'mdEditor.nameBold', syntax: (t) => `**${t('mdEditor.placeholderBold')}**`, combo: 'mod+b' },
  { nameKey: 'mdEditor.nameItalic', syntax: (t) => `_${t('mdEditor.placeholderItalic')}_`, combo: 'mod+i' },
  { nameKey: 'mdEditor.nameCode', syntax: (t) => `\`${t('mdEditor.placeholderCode')}\``, combo: 'mod+e' },
  // i18n-ignore Markdown fence, the same in every language
  { nameKey: 'mdEditor.nameCodeBlock', syntax: () => '```' },
  { nameKey: 'mdEditor.nameLink', syntax: (t) => `[${t('mdEditor.placeholderLinkText')}](https://…)`, combo: 'mod+k' },
  { nameKey: 'mdEditor.nameQuote', syntax: (t) => `> ${t('mdEditor.sampleText')}` },
  { nameKey: 'mdEditor.nameBulletList', syntax: (t) => `- ${t('mdEditor.sampleText')}`, combo: 'mod+shift+8' },
  { nameKey: 'mdEditor.nameNumberedList', syntax: (t) => `1. ${t('mdEditor.sampleText')}`, combo: 'mod+shift+7' },
  { nameKey: 'mdEditor.nameTaskList', syntax: (t) => `- [ ] ${t('mdEditor.sampleText')}` },
  { nameKey: 'mdEditor.nameNextItem', syntax: () => '', combo: 'Enter' },
  { nameKey: 'mdEditor.nameMention', syntax: (t) => `@${t('mdEditor.sampleName')}` },
  // i18n-ignore an issue number, the same in every language
  { nameKey: 'mdEditor.nameReference', syntax: () => '#123' }
]

/** Above the hint when there is room, below it otherwise; right edges aligned. */
function getSheetPosition(anchor: HTMLElement): React.CSSProperties {
  const r = anchor.getBoundingClientRect()
  const right = Math.max(8, window.innerWidth - r.right)
  return r.top > 380 ? { right, bottom: window.innerHeight - r.top + 6 } : { right, top: r.bottom + 6 }
}

/**
 * The Markdown cheat sheet a comment box's "Markdown supported" opens in
 * place: what to type, and the shortcut that types it. In place because the
 * handbook is another tab, and leaving for it would drop what is being written —
 * the full guide is one link further, and asks first when there is text.
 */
export function MarkdownCheatSheet({
  anchor,
  onClose,
  onOpenGuide
}: {
  anchor: HTMLElement
  onClose: () => void
  /** Absent inside a dialog, where the handbook would open behind it. */
  onOpenGuide?: () => void
}): React.JSX.Element {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  // Placed from the first render — a hidden first frame could not take the focus.
  const [style, setStyle] = useState<React.CSSProperties>(() => getSheetPosition(anchor))
  useLayoutEffect(() => {
    const place = (): void => setStyle(getSheetPosition(anchor))
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor])

  useEffect(() => {
    ref.current?.focus()
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={ref}
      className="mde-cheat"
      role="dialog"
      aria-label={t('mdEditor.cheatSheet')}
      tabIndex={-1}
      style={style}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        // Only the sheet closes — not the line composer, not the dialog around it.
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="mde-cheat-title">{t('mdEditor.cheatSheet')}</div>
      <table className="mde-cheat-table">
        <thead>
          <tr>
            <th scope="col">{t('mdEditor.cheatFormat')}</th>
            <th scope="col">{t('mdEditor.cheatSyntax')}</th>
            <th scope="col">{t('mdEditor.cheatShortcut')}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.nameKey}>
              <th scope="row">{t(row.nameKey)}</th>
              <td>{row.syntax(t) && <code>{row.syntax(t)}</code>}</td>
              <td>{row.combo && <kbd>{formatCombo(row.combo)}</kbd>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {onOpenGuide && (
        <button type="button" className="prp-link mde-cheat-guide" onClick={onOpenGuide}>
          <BookOpen size={12} /> {t('mdEditor.openGuide')}
        </button>
      )}
    </div>,
    document.body
  )
}
