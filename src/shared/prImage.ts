/**
 * Image files a pull request's Files tab previews instead of a text diff —
 * shared by the main process (which reads the bytes, locally or from the host)
 * and the renderer (which decides what to show). One list, so the two cannot
 * disagree about what an image is.
 */

/** Extension → the MIME type the data URL is labelled with. */
const IMAGE_MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml'
}

/**
 * Bytes one side of an image may weigh before it is refused — the same cap the
 * commit view's file preview uses (PREVIEW_MAX_BYTES in main/git.ts).
 */
export const PR_IMAGE_MAX_BYTES = 32 * 1024 * 1024

/** The image MIME type of a path by its extension, or null when it is not one we preview. */
export function getImageMime(path: string): string | null {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  if (dot <= 0 && !name.startsWith('.')) return null
  return IMAGE_MIME[name.slice(dot + 1).toLowerCase()] ?? null
}

/** Whether a path is an image the Files tab previews. */
export function isPreviewableImage(path: string): boolean {
  return getImageMime(path) !== null
}

/** A full hex commit id (SHA-1 or SHA-256) — never a ref name, never an option. */
export function isFullCommitSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(value)
}

/**
 * Whether a repository path is safe to put after `<sha>:` and into a host URL:
 * relative, no `.`/`..` segment, no empty segment, no backslash or control
 * character. A pull request's file list comes from the host, so it is checked
 * before it reaches git or a URL.
 */
export function isSafeRepoFilePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 4096) return false
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false
  if (value.startsWith('/')) return false
  return value.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..')
}

/** Encode each segment of a repository path for a URL path, keeping the slashes. */
export function encodePathSegments(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/**
 * Git LFS keeps a small text pointer in the repository instead of the file.
 * Read as an image it is a broken picture; read as this, it is "ask the host".
 */
export const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1'
/** A pointer is ~130 bytes; anything this large is a real file. */
export const LFS_POINTER_MAX_BYTES = 1024

/** Whether these bytes are a Git LFS pointer rather than the file it points to. */
export function isLfsPointer(bytes: Uint8Array): boolean {
  if (bytes.byteLength >= LFS_POINTER_MAX_BYTES || bytes.byteLength < LFS_POINTER_PREFIX.length) return false
  for (let i = 0; i < LFS_POINTER_PREFIX.length; i++) if (bytes[i] !== LFS_POINTER_PREFIX.charCodeAt(i)) return false
  return true
}

/** One side of an image comparison, read at a commit. */
export type PrImageContent =
  | { status: 'ok'; dataUrl: string }
  /** The file is in Git LFS and this reader only got its pointer: open it on the host. */
  | { status: 'lfs' }
  /** Larger than PR_IMAGE_MAX_BYTES; `size` in bytes. */
  | { status: 'tooLarge'; size: number }
  /** Not there: the commit or the blob is not here, or the host has no such file. */
  | { status: 'missing' }

/** The two commits a pull request's diff compares: the merge base and the head. */
export interface PrDiffCommits {
  /** Null when the host would not say — the "before" side is then unavailable. */
  baseSha: string | null
  headSha: string
  /**
   * The host named no merge base and `baseSha` is the target branch's tip: the
   * "before" image is the target's current version, which a change landed on
   * the target since the branch was cut would show too.
   */
  baseApproximate?: boolean
}

/** A file at a commit: what one side of an image comparison reads. */
export interface PrImageSide {
  sha: string
  path: string
}

/**
 * Which file to read on each side of a pull request file's comparison. Added:
 * only the head. Removed: only the base. Renamed: the old path at the base,
 * the new one at the head. Modified: the same path on both.
 */
export function getImageSides(
  file: { filename: string; status: string; previousFilename?: string },
  commits: PrDiffCommits
): { before: PrImageSide | null; after: PrImageSide | null } {
  const added = file.status === 'added'
  const removed = file.status === 'removed' || file.status === 'deleted'
  const oldPath = file.previousFilename || file.filename
  return {
    before: added || !commits.baseSha ? null : { sha: commits.baseSha, path: oldPath },
    after: removed ? null : { sha: commits.headSha, path: file.filename }
  }
}
