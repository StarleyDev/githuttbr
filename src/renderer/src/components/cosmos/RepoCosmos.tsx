import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, Orbit, GitCommitVertical } from 'lucide-react'
import { useUIStore } from '../../stores/ui'
import { gitApi } from '../../infrastructure/api'
import type { CosmosCommit } from '../../../../shared/types'
import { useT, type TranslationKey } from '../../i18n'

export type CosmosMode = 'galaxy' | 'gource'

// three.js only arrives with the scene. This shell stays in the startup chunk
// because it is always mounted (it watches the ui store), and it must not
// import engine.ts or modes/* — any static import would pull three back in.
const loadScene = (): Promise<typeof import('./CosmosScene')> => import('./CosmosScene')
const CosmosScene = lazy(() => loadScene().then((m) => ({ default: m.CosmosScene })))

const MODES: { id: CosmosMode; labelKey: TranslationKey; icon: React.ReactNode }[] = [
  { id: 'galaxy', labelKey: 'cosmos.modeGalaxy', icon: <Orbit size={13} /> },
  { id: 'gource', labelKey: 'cosmos.modeTree', icon: <GitCommitVertical size={13} /> }
]

// One loader for both waits — the commit data and, on first open, the scene
// chunk — so the overlay does not flash two different placeholders.
function CosmosLoading(): React.JSX.Element {
  const t = useT()
  return (
    <div className="cosmos-loading">
      <Loader2 size={24} className="spin" /> {t('common.loading')}
    </div>
  )
}

export function RepoCosmos(): React.JSX.Element | null {
  const t = useT()
  const cosmos = useUIStore((s) => s.cosmos)
  const closeCosmos = useUIStore((s) => s.closeCosmos)
  const [commits, setCommits] = useState<CosmosCommit[] | null>(null)
  const [mode, setMode] = useState<CosmosMode>('galaxy')

  useEffect(() => {
    if (!cosmos) {
      setCommits(null)
      return
    }
    setMode('galaxy')
    // Fetch the scene chunk alongside the commit data rather than after it.
    void loadScene()
    gitApi.cosmosData(cosmos.repoPath).then(setCommits)
  }, [cosmos])

  useEffect(() => {
    if (!cosmos) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeCosmos()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cosmos, closeCosmos])

  if (!cosmos) return null

  return (
    <AnimatePresence>
      <motion.div
        className="cosmos-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={`cosmos-chrome ${window.api.platform === 'darwin' ? 'mac' : ''}`}>
          <div className="cosmos-tabs">
            {MODES.map((m) => (
              <button key={m.id} className={`codesearch-tab ${mode === m.id ? 'active' : ''}`} onClick={() => setMode(m.id)}>
                {m.icon} {t(m.labelKey)}
              </button>
            ))}
          </div>
          <button
            className="btn ghost small cosmos-close"
            title={t('common.close')}
            aria-label={t('common.close')}
            onClick={closeCosmos}
          >
            <X size={16} />
          </button>
        </div>
        {commits ? (
          <Suspense fallback={<CosmosLoading />}>
            <CosmosScene commits={commits} mode={mode} />
          </Suspense>
        ) : (
          <CosmosLoading />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
