import { useEffect, useRef, useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import type { PrCommentHandle } from '../../../shared/types'
import { useT } from '../i18n'
import { useUIStore } from '../stores/ui'
import { getCommentKey, isEditChanged, type CommentEditDraft } from '../lib/commentEdit'
import type { MarkdownReference } from '../lib/markdownEdit'
import { MarkdownEditor } from './MarkdownEditor'

/**
 * One comment's header and text, with Edit and Delete when it is yours. Edit
 * opens the text in place in the shared editor: ⌘/Ctrl+Enter saves, Escape
 * cancels (asking first when something changed). The edit lives in `drafts`,
 * kept by the page, so it survives a tab switch and counts as unsent text.
 * The page owns what a save or a delete does — and the delete's confirm.
 */
export function EditableComment({
  handle,
  body,
  edited,
  mine,
  head,
  headClassName,
  bodyClassName,
  rendered,
  drafts,
  busy,
  mentions,
  getReferences,
  hasUnsentText,
  onSave,
  onDelete
}: {
  handle: PrCommentHandle | undefined
  body: string
  edited?: boolean
  /** The viewer wrote it and the host gave a handle: the actions show. */
  mine: boolean
  /** The header's own content: avatar, author, date. */
  head: React.ReactNode
  headClassName: string
  bodyClassName: string
  /** The text as the page shows it (rendered: components/RemoteMarkdown.tsx). */
  rendered: React.ReactNode
  drafts: React.RefObject<Record<string, CommentEditDraft>>
  busy: boolean
  mentions: string[]
  getReferences: () => MarkdownReference[]
  hasUnsentText?: () => boolean
  onSave: (handle: PrCommentHandle, text: string) => Promise<boolean>
  onDelete: (handle: PrCommentHandle) => void
}): React.JSX.Element {
  const t = useT()
  const key = handle ? getCommentKey(handle) : ''
  const [draft, setDraft] = useState<CommentEditDraft | null>(() => (key ? (drafts.current[key] ?? null) : null))
  const ref = useRef<HTMLTextAreaElement>(null)
  const editing = !!draft && !!handle
  useEffect(() => {
    if (editing) ref.current?.focus()
    // Focus when the box opens, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const keep = (next: CommentEditDraft | null): void => {
    setDraft(next)
    if (next) drafts.current[key] = next
    else delete drafts.current[key]
  }
  const startEdit = (): void => keep({ text: body, original: body })
  const cancel = (): void => keep(null)
  const escape = (): void => {
    if (!isEditChanged(draft ?? undefined)) return cancel()
    useUIStore.getState().openModal({
      kind: 'confirm',
      title: t('prComment.discardTitle'),
      message: t('prComment.discardMessage'),
      danger: true,
      confirmLabel: t('prComment.discard'),
      onConfirm: cancel
    })
  }
  const save = (): void => {
    if (!handle || !draft || !draft.text.trim() || busy) return
    if (!isEditChanged(draft)) return cancel()
    void onSave(handle, draft.text).then((ok) => ok && keep(null))
  }

  return (
    <>
      <div className={headClassName}>
        {head}
        {edited && <em className="comment-edited">{t('prComment.edited')}</em>}
        {mine && handle && !editing && (
          <span className="comment-actions">
            <button
              type="button"
              className="icon-btn"
              data-tone="edit"
              title={t('prComment.edit')}
              aria-label={t('prComment.edit')}
              onClick={startEdit}
              disabled={busy}
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              data-tone="delete"
              title={t('prComment.delete')}
              aria-label={t('prComment.delete')}
              onClick={() => onDelete(handle)}
              disabled={busy}
            >
              <Trash2 size={12} />
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="comment-edit">
          <MarkdownEditor
            inputRef={ref}
            ariaLabel={t('prComment.editLabel')}
            value={draft.text}
            onChange={(text) => keep({ ...draft, text })}
            mentions={mentions}
            getReferences={getReferences}
            hasUnsentText={hasUnsentText}
            // Escape reaches this only when no @/# list is open: the list closes first.
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                escape()
              } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                save()
              }
            }}
          />
          <div className="comment-edit-actions">
            <span className="comment-edit-hint">{t('prComment.editHint')}</span>
            <button type="button" className="btn ghost tiny" onClick={escape}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn primary tiny" onClick={save} disabled={busy || !draft.text.trim()}>
              {busy && <Loader2 size={12} className="spin" />} {t('prComment.save')}
            </button>
          </div>
        </div>
      ) : (
        <div className={bodyClassName}>{rendered}</div>
      )}
    </>
  )
}
