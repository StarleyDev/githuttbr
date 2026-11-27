import { Fragment } from 'react'
import { interp, useT } from '../i18n'
import { highlightCode } from '../lib/highlight'
import { hunkChoice, lineKey, type Hunk, type LineKey, type ConflictLineSide as Side } from '../lib/conflict'

type Pick = 'ours' | 'theirs' | 'both'

/**
 * The result as it will be written, with every conflict shown as a card in
 * place: the lines it keeps so far, each tagged with the side it came from, and
 * the four answers right on the card. An unanswered card previews both sides,
 * so the decision can be made without looking up at the panes.
 */
export function ConflictResultBlocks({
  hunks,
  oursContent,
  selected,
  touched,
  activeHunk,
  lang,
  bodyRef,
  onBodyScroll,
  onPick,
  onEdit
}: {
  hunks: Hunk[]
  oursContent: string
  selected: Set<LineKey>
  touched: Set<number>
  activeHunk: number
  lang: string
  bodyRef: React.RefObject<HTMLDivElement | null>
  onBodyScroll: (el: HTMLElement) => void
  onPick: (hunk: Hunk, pick: Pick) => void
  onEdit: (hunk: Hunk) => void
}): React.JSX.Element {
  const t = useT()
  const ourLines = oursContent.split('\n')
  let outNo = 0

  const line = (text: string, key: string, side?: Side, no?: number): React.JSX.Element => (
    <div key={key} className={`crb-line ${side ?? ''}`}>
      <span className="crb-no">{no ?? ''}</span>
      <span className="crb-text" dangerouslySetInnerHTML={{ __html: highlightCode(text, lang) || '&nbsp;' }} />
      {side && <span className="crb-tag">{side === 'ours' ? t('conflictWs.tagYours') : t('conflictWs.tagTheirs')}</span>}
    </div>
  )

  const parts: React.JSX.Element[] = []
  let cursor = 0
  const context = (until: number): void => {
    while (cursor < until && cursor < ourLines.length) {
      outNo++
      parts.push(line(ourLines[cursor], `c${cursor}`, undefined, outNo))
      cursor++
    }
  }

  for (const h of hunks) {
    context(h.oursStart)
    const isTouched = touched.has(h.index)
    const choice = hunkChoice(h, selected, isTouched)
    const body: React.JSX.Element[] = []
    for (const side of ['ours', 'theirs'] as const) {
      const arr = side === 'ours' ? h.ours : h.theirs
      arr.forEach((text, i) => {
        // Answered: only what is kept, numbered as it lands. Open: both sides.
        if (isTouched && !selected.has(lineKey(h.index, side, i))) return
        if (isTouched) outNo++
        body.push(line(text, `${side}${i}`, side, isTouched ? outNo : undefined))
      })
    }
    const pressed = (p: Pick): boolean => choice === p
    parts.push(
      <div
        key={`h${h.index}`}
        data-hunk={h.index}
        className={`crb-card ${isTouched ? 'answered' : 'open'} ${h.index === activeHunk ? 'active' : ''}`}
      >
        <div className="crb-head">
          <b>{interp(t('conflictWs.blockTitle'), { n: h.index + 1 })}</b>
          <span className="cw-spacer" />
          <button className={`crb-act ours ${pressed('ours') ? 'on' : ''}`} aria-pressed={pressed('ours')} onClick={() => onPick(h, 'ours')}>
            {t('conflictWs.useYours')}
          </button>
          <button
            className={`crb-act theirs ${pressed('theirs') ? 'on' : ''}`}
            aria-pressed={pressed('theirs')}
            onClick={() => onPick(h, 'theirs')}
          >
            {t('conflictWs.useTheirs')}
          </button>
          <button className={`crb-act ${pressed('both') ? 'on' : ''}`} aria-pressed={pressed('both')} onClick={() => onPick(h, 'both')}>
            {t('conflictWs.useBoth')}
          </button>
          <button className="crb-act" onClick={() => onEdit(h)}>
            {t('conflictWs.edit')}
          </button>
        </div>
        <div className="crb-body">
          {body.length > 0 ? body : <div className="crb-empty">{t('conflictWs.blockEmpty')}</div>}
        </div>
      </div>
    )
    cursor += h.ours.length
  }
  context(ourLines.length)

  return (
    <div className="crb" ref={bodyRef} onScroll={(e) => onBodyScroll(e.currentTarget)}>
      <div className="crb-code hljs">
        <Fragment>{parts}</Fragment>
      </div>
    </div>
  )
}
