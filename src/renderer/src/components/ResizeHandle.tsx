import { useCallback, useRef } from 'react'

interface ResizeHandleProps {
  /** 'x' resizes widths (vertical bar), 'y' resizes heights (horizontal bar). */
  axis: 'x' | 'y'
  /** Current size in px. */
  value: number
  min: number
  max: number
  /** Set to true when dragging in the positive axis direction should shrink the panel. */
  invert?: boolean
  onChange: (value: number) => void
  onDragging?: (dragging: boolean) => void
  /** Double-click: back to the default size. Without it, a double-click only clamps. */
  onReset?: () => void
  /** What the handle resizes, for screen readers. */
  label?: string
  className?: string
}

export function ResizeHandle({
  axis,
  value,
  min,
  max,
  invert,
  onChange,
  onDragging,
  onReset,
  label,
  className
}: ResizeHandleProps): React.JSX.Element {
  const start = useRef({ pos: 0, value: 0 })

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      start.current = { pos: axis === 'x' ? e.clientX : e.clientY, value }
      onDragging?.(true)
      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)

      const move = (ev: PointerEvent): void => {
        const delta = (axis === 'x' ? ev.clientX : ev.clientY) - start.current.pos
        const next = Math.round(start.current.value + (invert ? -delta : delta))
        onChange(Math.min(max, Math.max(min, next)))
      }
      const up = (): void => {
        onDragging?.(false)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [axis, value, min, max, invert, onChange, onDragging]
  )

  return (
    <div
      className={`resize-handle ${axis === 'x' ? 'rh-x' : 'rh-y'}${className ? ` ${className}` : ''}`}
      onPointerDown={onPointerDown}
      onDoubleClick={() => (onReset ? onReset() : onChange(Math.min(max, Math.max(min, value))))}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
    />
  )
}
