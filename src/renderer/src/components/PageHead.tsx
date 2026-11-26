import { useEffect, useRef, useState } from 'react'

/** The top of a full-page tab (`.changelog-page`): the header plus the controls
 *  right under it, stuck to the top of the scroll container. It publishes its
 *  height as `--page-head-h` on that container, so focus scrolling
 *  (`scroll-padding-top`) and nested sticky columns land below it, not under it. */
export function PageHead({ children }: { children: React.ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const head = ref.current
    const page = head?.closest<HTMLElement>('.changelog-page')
    if (!head || !page) return
    const measure = (): void => page.style.setProperty('--page-head-h', `${head.offsetHeight}px`)
    const ro = new ResizeObserver(measure)
    ro.observe(head)
    measure()
    let frame = 0
    // Stuck = scrolled and pinned to the container's top edge; the shadow only
    // makes sense once content is actually passing underneath.
    const onScroll = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const gap = head.getBoundingClientRect().top - page.getBoundingClientRect().top
        setStuck(page.scrollTop > 0 && gap < 1)
      })
    }
    page.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
      page.removeEventListener('scroll', onScroll)
      page.style.removeProperty('--page-head-h')
    }
  }, [])

  return (
    <div ref={ref} className={`page-head${stuck ? ' stuck' : ''}`}>
      {children}
    </div>
  )
}
