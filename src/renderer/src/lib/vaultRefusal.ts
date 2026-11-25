import type { TranslationKey } from '../i18n'

/** Why the vault took no part in a write, an import or an export. */
export type VaultRefusal = 'unreadable' | 'unavailable'

/**
 * The refusal an export or import reply carries, if any: `unreadable` is the
 * file, `unavailable` the keychain (off, dismissed, or not answering in time).
 */
export function vaultRefusalOf(reply: { unreadable?: boolean; unavailable?: boolean }): VaultRefusal | null {
  return reply.unreadable ? 'unreadable' : reply.unavailable ? 'unavailable' : null
}

/**
 * The refusal a write (`vault:upsert` / `vault:remove`) answered with, if any.
 * A write answers the vault as it now is: `unreadable` when the file could not
 * be read, `available: false` when the keychain would not open it — a timeout
 * or a keychain turned off as much as a machine without one. Either way
 * nothing was saved.
 */
export function vaultWriteRefusal(
  result: { available: boolean; unreadable?: boolean } | null | undefined
): VaultRefusal | null {
  if (!result) return null
  if (result.unreadable) return 'unreadable'
  return result.available ? null : 'unavailable'
}

/** The message for a refusal, as a key: the caller renders it. */
export function vaultRefusalKey(reason: VaultRefusal): TranslationKey {
  return reason === 'unreadable' ? 'vault.unreadable' : 'vault.keychainUnavailable'
}
