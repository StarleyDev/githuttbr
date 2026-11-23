import { sanitizeCloneFolder } from '../../../shared/cloneFolder'

const stripGit = (s: string): string => s.replace(/\.git$/, '')

/** Path segments of a server-supplied name, `.` and `..` dropped. Both
 *  separators: `..\..\x` is one segment to a `/` split and two parent hops
 *  to Windows. */
const segments = (s: string): string[] => s.split(/[/\\]/).filter((p) => p && p !== '.' && p !== '..')

/** The short folder for one repository — the last segment, made safe (see
 *  shared/cloneFolder.ts); `repository` when nothing usable is left. */
export function cloneFolderName(repoName: string): string {
  return sanitizeCloneFolder(stripGit(segments(repoName).pop() ?? repoName)) || 'repository'
}

/**
 * Folder names for a batch cloned into one parent folder, in input order.
 *
 * Each repository gets its own short name (`owner/app` → `app`), except where
 * two in the batch would collide — `org-a/app` and `org-b/app` — and then both
 * get the full path with `/` turned into `-`. Clones in a batch run in
 * parallel, so a collision is not a clean "folder exists" error but a race.
 * Every name is sanitised: the input is a hosting server's data.
 */
export function cloneFolderNames(repoNames: string[]): string[] {
  const short = repoNames.map(cloneFolderName)
  const count = new Map<string, number>()
  for (const s of short) count.set(s.toLowerCase(), (count.get(s.toLowerCase()) ?? 0) + 1)
  const named = repoNames.map((n, i) =>
    (count.get(short[i].toLowerCase()) ?? 0) > 1
      ? sanitizeCloneFolder(segments(stripGit(n)).join('-')) || short[i]
      : short[i]
  )
  // Still equal after that (the same repo picked twice from two lists): number them.
  const seen = new Map<string, number>()
  return named.map((n) => {
    const key = n.toLowerCase()
    const k = (seen.get(key) ?? 0) + 1
    seen.set(key, k)
    return k === 1 ? n : `${n}-${k}`
  })
}
