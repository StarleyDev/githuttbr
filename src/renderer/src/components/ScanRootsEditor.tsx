import { Plus, Trash2 } from 'lucide-react'
import { useSettingsStore } from '../stores/settings'
import { useReposStore } from '../stores/repos'
import { useT } from '../i18n'
import { addScanRoot, scanRepoFolders } from '../scanRootActions'
import { NumberField } from './NumberField'

/** The scanned folders: add, remove, set the depth, scan. Shared by Settings →
 *  Data and the Scanned repositories dialog, so the two cannot drift. Nothing
 *  scans in the background: a folder is walked when it is added, on "Scan
 *  now", and when the dialog opens — all cheap, since the walk reads folder
 *  names only and never runs git. */
export function ScanRootsEditor(): React.JSX.Element {
  const t = useT()
  const roots = useSettingsStore((s) => s.settings.repoScanRoots)
  const update = useSettingsStore((s) => s.update)
  const scanning = useReposStore((s) => s.scanning)

  const setDepth = (path: string, depth: number): void => {
    update((s) => ({
      ...s,
      repoScanRoots: s.repoScanRoots.map((r) => (r.path === path ? { ...r, depth } : r))
    }))
  }

  const removeRoot = (path: string): void => {
    update((s) => ({ ...s, repoScanRoots: s.repoScanRoots.filter((r) => r.path !== path) }))
  }

  return (
    <div className="scan-roots">
      {roots.map((root) => (
        <div key={root.path} className="scan-roots-row">
          <span className="scan-roots-path" title={root.path}>
            {root.path}
          </span>
          <label className="scan-roots-depth">
            {t('repos.scanDepth')}
            <NumberField min={1} max={10} value={root.depth} onChange={(n) => setDepth(root.path, n)} style={{ maxWidth: 50 }} />
          </label>
          <button className="btn ghost small" title={t('repos.removeScanRoot')} onClick={() => removeRoot(root.path)}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="scan-roots-actions">
        <button className="btn ghost small" onClick={() => void addScanRoot()} disabled={scanning}>
          <Plus size={13} />
          {t('repos.addScanRoot')}
        </button>
        <button className="btn ghost small" onClick={() => void scanRepoFolders()} disabled={scanning || roots.length === 0}>
          {scanning ? t('repos.scanning') : t('repos.scanNow')}
        </button>
      </div>
    </div>
  )
}
