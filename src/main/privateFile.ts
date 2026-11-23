import { chmod, open, readFile, readlink, realpath, rename, rm, type FileHandle } from 'fs/promises'
import { randomBytes } from 'crypto'
import { basename, dirname, join, resolve } from 'path'

/**
 * Files in the user-data folder that are not secrets but are nobody else's
 * business either — the settings (server addresses, profile names, repository
 * paths), the operation log, the avatar cache, the encrypted token store.
 * Owner-only, so another account on a shared machine cannot read them.
 *
 * Windows has no POSIX bits — there the user profile folder's ACL is what
 * protects it, and chmod failing is not an error.
 *
 * Every write is atomic: the data goes to a fresh owner-only file beside the
 * target, is flushed to disk, and is renamed over it. Writing in place
 * truncated the file first, so a reader in between saw half a JSON document —
 * and the settings reader used to take that for "no settings at all". The new
 * inode also means a reader holding the old file open keeps reading the old,
 * whole contents. Writes to one path run one at a time, in call order: two
 * concurrent in-place writes used to interleave into a file neither wrote.
 */
const OWNER_ONLY = 0o600

const queues = new Map<string, Promise<unknown>>()

/** Runs `fn` after every earlier queued operation on `path` has settled. */
function queued<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const key = resolve(path)
  const prev = queues.get(key) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  const settled = run.then(
    () => undefined,
    () => undefined
  )
  queues.set(key, settled)
  // Drop the entry once nothing newer is queued, so the map does not grow.
  void settled.then(() => {
    if (queues.get(key) === settled) queues.delete(key)
  })
  return run
}

// Windows refuses to rename over a file another process has open for a moment
// (an antivirus scan, the indexer): retry briefly instead of failing the save.
const RENAME_RETRIES = 5

async function renameOver(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      const busy = code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
      if (!busy || attempt >= RENAME_RETRIES) throw err
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)))
    }
  }
}

/**
 * Where a write to `path` really lands. A user who symlinked the settings into
 * a dotfiles repo means the link's target: renaming over the link itself would
 * replace it with a plain file and silently cut the dotfiles off.
 */
async function resolveTarget(path: string, hops = 0): Promise<string> {
  try {
    return await realpath(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  // A link whose target is not there (yet): a damaged settings file moved
  // aside leaves one. The write creates the target, and the link stays.
  if (hops >= 8) return path
  const link = await readlink(path).catch(() => null)
  return link === null ? path : resolveTarget(resolve(dirname(path), link), hops + 1)
}

/** Makes the rename itself durable: without it a crash can bring back the old file, or none. */
async function syncDir(dir: string): Promise<void> {
  if (process.platform === 'win32') return
  let fh: FileHandle | undefined
  try {
    fh = await open(dir, 'r')
    await fh.sync()
  } catch (err) {
    // Some filesystems cannot fsync a directory; the data itself is already synced.
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'EISDIR' && code !== 'EINVAL' && code !== 'EPERM' && code !== 'ENOTSUP') throw err
  } finally {
    await fh?.close().catch(() => undefined)
  }
}

async function writeAtomic(linkPath: string, data: string | Uint8Array): Promise<void> {
  const path = await resolveTarget(linkPath)
  // Same directory, so the rename never crosses a filesystem. `wx` refuses an
  // existing file: the name is random, and a planted one is never written through.
  const tmp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString('hex')}.tmp`)
  const fh = await open(tmp, 'wx', OWNER_ONLY)
  try {
    try {
      await fh.writeFile(data, typeof data === 'string' ? 'utf-8' : undefined)
      await fh.sync()
    } finally {
      await fh.close()
    }
    // A umask can only take bits away from 0600, but say it anyway.
    await chmod(tmp, OWNER_ONLY).catch(() => undefined)
    await renameOver(tmp, path)
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => undefined)
    throw err
  }
  // The rename has happened: the new contents are what every reader now sees.
  // Failing the write here would tell the caller the old file is still in
  // place, and the secrets cache would disagree with the disk.
  await syncDir(dirname(path)).catch((err: Error) => console.warn('[privateFile] directory fsync failed:', err.message))
}

export async function writePrivateFile(path: string, data: string | Uint8Array): Promise<void> {
  return queued(path, () => writeAtomic(path, data))
}

/**
 * Read-modify-write under the same per-path queue as `writePrivateFile`: `fn`
 * sees the file as it is now (null when it does not exist) and returns what to
 * write, or null to leave it alone. For a rewrite derived from an earlier read
 * — it must not land over a newer save that happened in between.
 */
export async function updatePrivateFile(
  path: string,
  fn: (current: string | null) => string | null
): Promise<boolean> {
  return queued(path, async () => {
    let current: string | null = null
    try {
      current = await readFile(path, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
    const next = fn(current)
    if (next === null) return false
    await writeAtomic(path, next)
    return true
  })
}

/** `copyFile`, with the copy owner-only like its source should have been — and as atomic as a write. */
export async function copyPrivateFile(from: string, to: string): Promise<void> {
  // Queued behind writes to the source, so the copy is of a whole file.
  // Read and rewritten rather than `copyFile`, which would give the copy the
  // source's mode for a moment.
  const data = await queued(from, () => readFile(from))
  await queued(to, () => writeAtomic(to, data))
}
