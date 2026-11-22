import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadTerminalRegistry, loadedTerminalRegistry } from './terminalState'

// POSIX single-quote a path so spaces / special chars survive when pasted.
function shellQuote(p: string): string {
  return `'${p.replace(/'/g, `'\\''`)}'`
}

// Renders one persisted terminal by attaching its registry-owned DOM container.
// The xterm instance + PTY outlive this component (repo/group/tab switches).
export function TerminalPanel({
  panelId,
  cwd,
  active,
  launchId
}: {
  panelId: string
  cwd: string
  active: boolean
  launchId?: number
}): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  // xterm loads with the first terminal of the session. Until it lands the host
  // stays empty and the effects below wait; every later mount finds the module
  // already loaded and runs them on the first commit, as before the split.
  const [reg, setReg] = useState(loadedTerminalRegistry)
  useEffect(() => {
    if (reg) return
    let live = true
    loadTerminalRegistry().then(
      (m) => {
        if (live) setReg(m)
      },
      (err: unknown) => console.error('terminal: failed to load xterm', err)
    )
    return () => {
      live = false
    }
  }, [reg])

  // Create → attach → fit, in that order, once the module is available. The
  // active-panel effect below runs after this one in the same commit, so the
  // refit + focus still follows the first fit.
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !reg) return
    const handle = reg.getOrCreateTerm(panelId, cwd, launchId)
    host.appendChild(handle.container)
    handle.fitSafely()

    const observer = new ResizeObserver(() => handle.fitSafely())
    observer.observe(host)

    return () => {
      observer.disconnect()
      // Snapshot the scroll position before the DOM offset collapses on
      // detach — fitSafely() only does it when it can still see a zero size.
      handle.suspend()
      // Detach (keep instance alive); container re-attaches on next mount.
      if (handle.container.parentElement === host) host.removeChild(handle.container)
    }
  }, [reg, panelId, cwd, launchId])

  // Refit + focus when this panel becomes the visible one.
  useEffect(() => {
    if (!active || !reg) return
    const handle = reg.getOrCreateTerm(panelId, cwd, launchId)
    handle.fitSafely()
    handle.term.focus()
  }, [reg, active, panelId, cwd, launchId])

  const onDrop = (e: React.DragEvent): void => {
    if (!reg) return
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    const paths = files
      .map((f) => window.api.getPathForFile(f))
      .filter(Boolean)
      .map(shellQuote)
    if (paths.length === 0) return
    const handle = reg.getOrCreateTerm(panelId, cwd, launchId)
    handle.pasteText(paths.join(' '))
    handle.term.focus()
  }

  return (
    <div
      className="terminal-host"
      ref={hostRef}
      onClick={() => reg?.getOrCreateTerm(panelId, cwd, launchId).term.focus()}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={onDrop}
    />
  )
}
