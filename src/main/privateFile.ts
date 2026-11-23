import { chmod, copyFile, writeFile } from 'fs/promises'

/**
 * Files in the user-data folder that are not secrets but are nobody else's
 * business either — the settings (server addresses, profile names, repository
 * paths), the operation log, the avatar cache, the encrypted token store.
 * Owner-only, so another account on a shared machine cannot read them.
 *
 * `mode` only applies when the file is created; the chmod after it narrows a
 * file an older build wrote with the default umask. Windows has no POSIX
 * bits — there the user profile folder's ACL is what protects it, and chmod
 * failing is not an error.
 */
const OWNER_ONLY = 0o600

export async function writePrivateFile(path: string, data: string | Uint8Array): Promise<void> {
  await writeFile(path, data, typeof data === 'string' ? { encoding: 'utf-8', mode: OWNER_ONLY } : { mode: OWNER_ONLY })
  await chmod(path, OWNER_ONLY).catch(() => undefined)
}

/** `copyFile`, with the copy owner-only like its source should have been. */
export async function copyPrivateFile(from: string, to: string): Promise<void> {
  await copyFile(from, to)
  await chmod(to, OWNER_ONLY).catch(() => undefined)
}
