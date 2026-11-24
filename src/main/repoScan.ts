import { join } from 'path'
import { readdir, realpath, stat } from 'fs/promises'
import { gitDirOf } from './repoMeta'

// Walking a developer's home directory naively means a million files. Three
// rules keep a scan to a fraction of a second: stop at a repository (its own
// contents are never interesting), never enter a dot-directory, and skip the
// dependency folders that dwarf everything else.

const SKIP = new Set(['node_modules', 'vendor', 'Pods', 'target', 'dist', 'build', 'out'])

// The renderer's depth input clamps to this range too, but a renderer is not
// a trustworthy source of limits — an unbounded depth here is an unbounded
// recursive filesystem walk, so the ceiling is enforced again at the source.
const MAX_SCAN_DEPTH = 10

/** Absolute paths of every repository under `root`, to `depth` levels. A
 *  repository reached through a symlink is reported by its real path: the app
 *  keys a repository — its tab, its git instance, its lock — by the path text,
 *  so a link path would make the same repository a second one, with its own
 *  lock, next to the copy opened by its real path. */
export async function scanForRepos(root: string, depth: number): Promise<string[]> {
  const found: string[] = []
  await walk(root, Math.min(MAX_SCAN_DEPTH, Math.max(0, depth)), found, new Set())
  return found
}

async function walk(dir: string, depth: number, found: string[], seen: Set<string>): Promise<void> {
  // A symlinked folder is followed — people link project folders together —
  // but each real folder is walked once. That is what keeps a link back up
  // the tree from looping, and two links to one repo from listing it twice.
  let real: string
  try {
    real = await realpath(dir)
  } catch {
    return
  }
  if (seen.has(real)) return
  seen.add(real)

  if (await gitDirOf(dir)) {
    found.push(dir)
    return
  }
  if (depth === 0) return

  // The folders to enter, by the path to walk them under. A link is entered
  // by its target's real path, so everything found through it is reported
  // by real path; a plain folder keeps the spelling it was reached by (on
  // macOS even /tmp is a link, and a user's root must not be rewritten).
  let entries: string[]
  try {
    const dirents = await readdir(dir, { withFileTypes: true })
    const dirs = await Promise.all(
      dirents.map(async (d) => {
        if (d.name.startsWith('.') || SKIP.has(d.name)) return null
        const path = join(dir, d.name)
        if (d.isDirectory()) return path
        if (!d.isSymbolicLink()) return null
        // A dangling link, or one to a file, is not a folder to enter.
        const target = await stat(path).catch(() => null)
        return target?.isDirectory() ? await realpath(path).catch(() => null) : null
      })
    )
    entries = dirs.filter((p): p is string => p !== null)
  } catch {
    return
  }

  for (const path of entries) await walk(path, depth - 1, found, seen)
}
