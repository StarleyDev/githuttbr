import { app, ipcMain } from 'electron'
import { stat } from 'fs/promises'

// Existence checks for the selective settings import: it translates an export's
// repository paths onto this machine and keeps only the folders that exist.
// The answer is one boolean per path — never a listing, a size or any content —
// so a renderer asking about arbitrary paths learns no more than "is it there".

/** More than any real settings file holds; a bigger list is not an import. */
export const PATHS_EXIST_CAP = 2000

/**
 * Whether `path` may be stat-ed at all. The paths come from an imported file,
 * so they are hostile until proven otherwise: on Windows a UNC path
 * (`\\host\share`, `\\?\`, `\\.\`) passes `isAbsolute`, and touching it opens
 * an SMB connection that hands the user's NTLM hash to whoever named the host.
 * Only a drive-letter path on Windows, and only a single-slash absolute path on
 * POSIX (`//host` is implementation-defined there), are probed.
 */
export function isProbeablePath(path: unknown, platform: NodeJS.Platform): path is string {
  if (typeof path !== 'string' || !path || path.includes('\0')) return false
  // Two leading separators of any kind: UNC, device namespace or a network root.
  if (/^[\\/]{2}/.test(path)) return false
  if (platform === 'win32') return /^[A-Za-z]:[\\/]/.test(path)
  return path.startsWith('/')
}

/** One answer per entry of `paths`: true when it is a probeable path that
 *  exists. Anything refused by `isProbeablePath`, or past the cap, answers
 *  false without the filesystem being touched. */
export async function pathsExist(paths: unknown, platform: NodeJS.Platform = process.platform): Promise<boolean[]> {
  if (!Array.isArray(paths)) return []
  return Promise.all(
    paths.map(async (path, i) => {
      if (i >= PATHS_EXIST_CAP || !isProbeablePath(path, platform)) return false
      return stat(path).then(
        () => true,
        () => false
      )
    })
  )
}

export function registerPathExistenceHandlers(): void {
  ipcMain.handle('fs:pathsExist', (_e, paths: unknown) => pathsExist(paths))
  ipcMain.handle('fs:homeDir', () => app.getPath('home'))
}
