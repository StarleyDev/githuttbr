import { Copy, TriangleAlert, X } from 'lucide-react'
import type { OrphanDraft } from '../lib/prViewState'
import { useUIStore } from '../stores/ui'
import { useT, interp } from '../i18n'

/**
 * Text written on this page whose place is gone — a reply to a thread that
 * was resolved away, an edit of a comment someone deleted, a line comment on
 * a file the diff no longer lists. Never dropped silently: it waits here to be
 * copied, and goes only when the reader says so.
 */
export function PrOrphanDrafts({
  orphans,
  onDismiss
}: {
  orphans: OrphanDraft[]
  onDismiss: (id: string) => void
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const what = (o: OrphanDraft): string =>
    o.kind === 'comment'
      ? t('prView.orphanComment')
      : o.kind === 'reply'
        ? t('prView.orphanReply')
        : o.kind === 'edit'
          ? t('prView.orphanEdit')
          : interp(t('prView.orphanLine'), { path: o.path ?? '', line: String(o.line ?? '') })
  const where = (o: OrphanDraft): string =>
    o.pr === undefined ? what(o) : interp(t('prView.orphanFromPr'), { n: o.pr, what: what(o) })
  return (
    <section className="prp-card prp-orphans" role="status">
      <h3 className="prp-orphans-title">
        <TriangleAlert size={13} aria-hidden="true" /> {t('prView.orphanTitle')}
      </h3>
      {orphans.map((o) => (
        <div key={o.id} className="prp-orphan">
          <p className="prp-side-note">{where(o)}</p>
          <pre className="prp-orphan-text">{o.text}</pre>
          <div className="prp-orphan-actions">
            <button
              type="button"
              className="btn ghost tiny"
              onClick={() => {
                void navigator.clipboard.writeText(o.text)
                toast('success', t('prView.textCopied'))
              }}
            >
              <Copy size={12} aria-hidden="true" /> {t('prView.copyText')}
            </button>
            <button type="button" className="btn ghost tiny" onClick={() => onDismiss(o.id)}>
              <X size={12} aria-hidden="true" /> {t('prView.discard')}
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
