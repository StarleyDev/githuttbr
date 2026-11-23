import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useT, interp } from '../i18n'
import { filterPicker, freeLabelCandidate, pickerKey, typedEntry, type PickerItem } from '../lib/prPicker'

/**
 * A multi-select for the create-PR dialog: picked rows as removable chips,
 * type to filter, ↑/↓/Enter to pick, Backspace on an empty field to drop the
 * last chip, Escape to close the list without closing the dialog. The list is
 * drawn in a portal, as RefPicker's is, because the dialog scrolls and clips.
 * The key rules live in `pickerKey` (lib/prPicker.ts), where they are tested.
 *
 * The typed text is the dialog's (`text` / `onTextChange`), so Create can add
 * what was typed but never confirmed with Enter (`withPendingText`).
 */
export function PrMetaPicker({
  label,
  items,
  value,
  onChange,
  placeholder,
  failed,
  partial,
  allowFree,
  people,
  text,
  onTextChange
}: {
  label: string
  items: PickerItem[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder: string
  failed: boolean
  /** The list was read only in part: someone may be missing from it. */
  partial?: boolean
  /** What was typed can be added as is — a label the host creates, or a login when the list failed. */
  allowFree?: boolean
  /** A people field: a typed `@login` is taken as `login`. */
  people?: boolean
  text: string
  onTextChange: (text: string) => void
}): React.JSX.Element {
  const t = useT()
  const listId = useId()
  const setText = onTextChange
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  // `@ana` finds `ana`: the `@` is how people write a login, not part of it.
  const query = people ? typedEntry(text, 'person') : text
  const shown = useMemo(() => filterPicker(items, query, value), [items, query, value])
  const free = allowFree ? freeLabelCandidate(text, items, value, people ? 'person' : 'label') : null
  // The rows the cursor walks: the matches, then "Add “…”" for a free label.
  const rowCount = shown.length + (free ? 1 : 0)

  const place = (): void => {
    const r = rootRef.current?.getBoundingClientRect()
    if (r) setRect({ left: r.left, top: r.bottom + 4, width: r.width })
  }
  useLayoutEffect(() => {
    if (!open) return
    place()
    const onMove = (): void => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, value.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useLayoutEffect(() => {
    if (open) listRef.current?.querySelector('.prmeta-opt.active')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, open])

  const add = (id: string): void => {
    if (!value.includes(id)) onChange([...value, id])
    setText('')
    setCursor(0)
    inputRef.current?.focus()
  }
  const remove = (id: string): void => {
    onChange(value.filter((v) => v !== id))
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    // keyCode 229 is how some engines still flag a key the IME is handling.
    const composing = e.nativeEvent.isComposing || e.keyCode === 229
    const action = pickerKey({ key: e.key, composing, open, cursor, rowCount, text, picked: value.length })
    // Enter in the field never submits the dialog, whatever it does here — unless the IME has it.
    if (!composing && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) e.preventDefault()
    switch (action.kind) {
      case 'open':
        setOpen(true)
        setCursor(0)
        break
      case 'move':
        setCursor(action.cursor)
        break
      case 'add':
        if (action.row < shown.length) add(shown[action.row].id)
        else if (free) add(free)
        break
      case 'close':
        e.stopPropagation()
        setOpen(false)
        break
      case 'removeLast':
        remove(value[value.length - 1])
        break
    }
  }

  const disabled = failed && !allowFree
  const activeId = open && rowCount ? `${listId}-${cursor}` : undefined

  return (
    <div className="prmeta">
      <div
        className={`bms-control prmeta-control ${disabled ? 'disabled' : ''}`}
        ref={rootRef}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value.map((id) => {
          const item = byId.get(id)
          const name = item?.primary ?? id
          return (
            <span key={id} className="bms-chip prmeta-chip">
              <Swatch item={item} />
              {name}
              <button
                type="button"
                className="bms-chip-x"
                aria-label={interp(t('createPR.pickerRemove'), { name })}
                title={interp(t('createPR.pickerRemove'), { name })}
                onClick={(e) => {
                  e.stopPropagation()
                  remove(id)
                }}
              >
                <X size={11} />
              </button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          className="bms-input"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={text}
          disabled={disabled}
          spellCheck={false}
          placeholder={value.length ? '' : placeholder}
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            // Tab away closes the list; focus moving into the list itself does not.
            if (!listRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
          }}
          onChange={(e) => {
            setText(e.target.value)
            setCursor(0)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {failed && <p className="prmeta-hint">{t(allowFree ? 'createPR.pickerFailedTyped' : 'createPR.pickerFailed')}</p>}
      {!failed && partial && <p className="prmeta-hint">{t('createPR.pickerPartial')}</p>}
      {open &&
        !disabled &&
        rect &&
        createPortal(
          <div
            className="refpick-pop prmeta-pop"
            id={listId}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            ref={listRef}
            style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width }}
          >
            {shown.map((item, i) => (
              <div
                key={item.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={false}
                className={`refpick-opt prmeta-opt ${i === cursor ? 'active' : ''}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => {
                  e.preventDefault() // keep focus in the field
                  add(item.id)
                }}
              >
                <Swatch item={item} />
                <span className="refpick-value">{item.primary}</span>
                {item.secondary && <span className="prmeta-secondary">{item.secondary}</span>}
              </div>
            ))}
            {free && (
              <div
                id={`${listId}-${shown.length}`}
                role="option"
                aria-selected={false}
                className={`refpick-opt prmeta-opt add ${cursor === shown.length ? 'active' : ''}`}
                onMouseEnter={() => setCursor(shown.length)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  add(free)
                }}
              >
                {interp(t('common.addQuoted'), { value: free })}
              </div>
            )}
            {!rowCount && <div className="prmeta-empty">{t('createPR.pickerNoMatch')}</div>}
          </div>,
          document.body
        )}
    </div>
  )
}

/** A person's picture, a label's colour, or nothing. */
function Swatch({ item }: { item?: PickerItem }): React.JSX.Element | null {
  if (item?.avatarUrl) return <img className="prmeta-avatar" src={item.avatarUrl} alt="" />
  if (item?.color) return <span className="prmeta-swatch" style={{ background: item.color }} aria-hidden="true" />
  return null
}
