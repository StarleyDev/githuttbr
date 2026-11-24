import { shellApi } from './infrastructure/api'
import { useSettingsStore } from './stores/settings'
import { useReposStore } from './stores/repos'
import { useUIStore } from './stores/ui'
import { hasScanRoot, scanSummaryMessage } from './lib/scanRoots'
import { t, interp } from './i18n'

// The scanned folders' two actions, shared by Settings → Data, the Scanned
// repositories dialog and the Repositories page, so adding a folder means the
// same thing — refused if already there, then walked at once — everywhere.

/** Walk every scanned folder and say what was found. */
export async function scanRepoFolders(): Promise<void> {
  const counts = await useReposStore.getState().scan(useSettingsStore.getState().settings.repoScanRoots)
  const summary = scanSummaryMessage(counts)
  useUIStore.getState().toast('success', interp(t(summary.key), summary.vars))
}

/** Ask for a folder, add it to the scanned folders and walk them. Resolves with
 *  the folder when it was added; null when the pick was cancelled or the folder
 *  was already there (which is said in a toast). */
export async function addScanRoot(): Promise<string | null> {
  const chosen = await shellApi.selectDirectory()
  if (!chosen) return null
  // Read from the store, not a render: a second pick can land before it updates.
  if (hasScanRoot(useSettingsStore.getState().settings.repoScanRoots, chosen)) {
    useUIStore.getState().toast('info', interp(t('repos.scanRootExists'), { path: chosen }))
    return null
  }
  useSettingsStore
    .getState()
    .update((s) => ({ ...s, repoScanRoots: [...s.repoScanRoots, { path: chosen, depth: 3 }] }))
  // A folder added and not yet walked would list nothing — "it found nothing".
  await scanRepoFolders()
  return chosen
}
