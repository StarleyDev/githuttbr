import { useEffect, useRef, useState } from 'react'
import { Play, Pause, TriangleAlert } from 'lucide-react'
import type { CosmosCommit } from '../../../../shared/types'
import { createEngine, pickNodeAt, type CosmosEngine } from './engine'
import { buildCommitGalaxy } from './modes/commitGalaxy'
import { buildGourceTree, GOURCE_MAX_FILES, type GourceController } from './modes/gourceTree'
import type { CosmosMode } from './RepoCosmos'

// The three.js half of the cosmos view. RepoCosmos loads this module through
// React.lazy so three.js stays out of the startup chunk: most sessions never
// open the 3D view, and three is over a megabyte of parse work at launch.
// Nothing outside this file and RepoCosmos may import engine.ts or modes/*.

export function CosmosScene({ commits, mode }: { commits: CosmosCommit[]; mode: CosmosMode }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [gource, setGource] = useState<GourceController | null>(null)
  const [caption, setCaption] = useState('')
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let gourceCtrl: GourceController | null = null
    let engine: CosmosEngine | null = null
    setError(null)
    setEmpty(false)
    setTooltip(null)
    setSelected(null)

    try {
      if (mode === 'gource') {
        gourceCtrl = buildGourceTree(commits)
        setGource(gourceCtrl)
        setEmpty(gourceCtrl.totalFiles === 0)
        setCaption(gourceCtrl.capped ? `Showing ${GOURCE_MAX_FILES} most-touched files of ${gourceCtrl.totalFiles}` : `${gourceCtrl.totalFiles} files`)
        engine = createEngine(container, (dt) => gourceCtrl?.tick(dt))
        engine.scene.add(gourceCtrl.group)
        engine.camera.position.set(0, 160, 420)
      } else {
        setGource(null)
        const galaxyCtrl = buildCommitGalaxy(commits)
        setEmpty(galaxyCtrl.nodeCount === 0)
        setCaption(galaxyCtrl.capped ? `Showing most recent 800 of ${commits.length} commits` : `${galaxyCtrl.nodeCount} commits`)
        let elapsed = 0
        engine = createEngine(container, (dt) => {
          elapsed += dt
          galaxyCtrl.tick(elapsed)
        })
        engine.scene.add(galaxyCtrl.group)
        const { center, radius } = galaxyCtrl
        const dist = Math.max(20, radius / Math.tan((engine.camera.fov * Math.PI) / 360)) * 1.05
        engine.camera.position.set(center.x, center.y + radius * 0.85, center.z + dist * 0.75)
        engine.controls.target.copy(center)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      engine?.dispose()
      return
    }

    const activeEngine = engine
    const onMove = (e: PointerEvent): void => {
      const rect = container.getBoundingClientRect()
      const hit = pickNodeAt(e.clientX, e.clientY, rect, activeEngine.camera, activeEngine.scene)
      container.style.cursor = hit ? 'pointer' : 'default'
      setTooltip(hit ? { x: e.clientX, y: e.clientY, label: hit.label } : null)
    }
    const onClick = (e: PointerEvent): void => {
      const rect = container.getBoundingClientRect()
      const hit = pickNodeAt(e.clientX, e.clientY, rect, activeEngine.camera, activeEngine.scene)
      setSelected(hit?.label ?? null)
    }
    container.addEventListener('pointermove', onMove)
    container.addEventListener('click', onClick)

    return () => {
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('click', onClick)
      gourceCtrl?.dispose()
      engine?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commits, mode])

  return (
    <div className="cosmos-canvas-wrap">
      <div ref={containerRef} className="cosmos-canvas" />
      {!error && !empty && <div className="cosmos-caption">{caption}</div>}
      {mode === 'gource' && gource && !error && <GourcePlayback controller={gource} />}
      {tooltip && (
        <div className="cosmos-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          {tooltip.label}
        </div>
      )}
      {selected && <div className="cosmos-selected">Selected: {selected}</div>}
      {empty && !error && (
        <div className="cosmos-empty">
          <TriangleAlert size={18} /> Not enough data for this view.
        </div>
      )}
      {error && (
        <div className="cosmos-empty cosmos-error">
          <TriangleAlert size={18} /> Failed to build scene: {error}
        </div>
      )}
    </div>
  )
}

function GourcePlayback({ controller }: { controller: GourceController }): React.JSX.Element {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    controller.play()
    setPlaying(true)
    const id = setInterval(() => setProgress(controller.progress), 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller])

  const toggle = (): void => {
    if (controller.isPlaying) controller.pause()
    else controller.play()
    setPlaying(controller.isPlaying)
  }

  const cycleSpeed = (): void => {
    const next = speed >= 4 ? 0.5 : speed * 2
    setSpeed(next)
    controller.setSpeedMultiplier(next)
  }

  return (
    <div className="cosmos-playback">
      <button className="btn ghost small" onClick={toggle}>
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(progress * 1000)}
        onChange={(e) => {
          const fraction = Number(e.target.value) / 1000
          controller.seek(fraction)
          setProgress(fraction)
        }}
      />
      <button className="btn ghost small" onClick={cycleSpeed}>
        {speed}x
      </button>
      {controller.currentDate > 0 && <span className="cosmos-date">{new Date(controller.currentDate * 1000).toLocaleDateString()}</span>}
    </div>
  )
}
