/**
 * Folder names a clone may create. The name often comes from a hosting
 * server's API (a repository's `name`), not from the user, so it is untrusted:
 * `..\..\x` splits as one segment on `/` and walks out of the chosen folder on
 * Windows, `CON` opens a device there, and a leading `-` is an option to git.
 * Main refuses a bad name outright; the batch clone UI sanitises one first so
 * the name it shows is the name main will accept.
 */

/** Windows device names, reserved with or without an extension (`nul.txt`). */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** Why `name` cannot be a clone folder, or null when it can. */
export function cloneFolderProblem(name: string): string | null {
  if (!name) return 'is empty'
  if (/[/\\]/.test(name)) return 'contains a path separator'
  if (name.includes('..')) return 'contains ".."'
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(name)) return 'contains a control character'
  if (/^[A-Za-z]:/.test(name)) return 'starts with a drive letter'
  if (/[<>:"|?*]/.test(name)) return 'contains a character Windows does not allow in a file name'
  if (RESERVED.test(name)) return 'is a reserved device name on Windows'
  if (name.startsWith('-')) return 'starts with "-"'
  if (name.startsWith('.')) return 'starts with "."'
  if (/[. ]$/.test(name)) return 'ends with a dot or a space'
  return null
}

/**
 * The nearest safe folder name to `name`: separators and forbidden characters
 * become `-`, leading `-`/`.` and trailing dots/spaces are trimmed, a reserved
 * device name gets a `_` suffix. Empty when nothing usable is left.
 */
export function sanitizeCloneFolder(name: string): string {
  let out = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, '')
    .replace(/[/\\<>:"|?*]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-. ]+/, '')
    .replace(/[. ]+$/, '')
  if (RESERVED.test(out)) out = out.replace(/^([^.]+)/, '$1_')
  return cloneFolderProblem(out) ? '' : out
}
