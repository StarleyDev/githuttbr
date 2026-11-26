import { clampScrollTop } from './prViewState'

/**
 * Put a scroller back at `saved`, frame after frame, while its content is
 * still arriving: a diff, a list of avatars or an image grows after its data
 * lands, and one early clamp would leave the reader short of where they were.
 * Stops once it reaches the mark, once the height has held still for a few
 * frames (the content is done — clamp is final), or after `maxMs`. The return
 * cancels it, for an unmount or a newer restore.
 */
export function restoreScrollTop(el: HTMLElement, saved: number, maxMs = 1000): () => void {
  if (saved <= 0) return () => undefined
  const start = performance.now()
  let lastHeight = -1
  let still = 0
  let frame = 0
  const step = (): void => {
    el.scrollTop = clampScrollTop(saved, el.scrollHeight, el.clientHeight)
    if (el.scrollHeight === lastHeight) still++
    else {
      still = 0
      lastHeight = el.scrollHeight
    }
    const reached = Math.abs(el.scrollTop - saved) <= 1
    if (reached || still >= 5 || performance.now() - start > maxMs) return
    frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
  return () => cancelAnimationFrame(frame)
}
