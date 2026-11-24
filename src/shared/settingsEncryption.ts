// A settings export protected by a password the user chose (Settings → Data →
// Export). The plain export is a `SettingsBundle` in JSON; this wraps that same
// JSON, encrypted with the Secure share cipher (scrypt + AES-256-GCM). Nothing
// about the contents is readable before the password — not even whether it
// carries credentials. There is no recovery: the password is the only key.

/** The marker an encrypted settings export carries in place of `__githuttbr`. */
export const ENCRYPTED_SETTINGS_FORMAT = 'githuttbr-settings-encrypted'
export const ENCRYPTED_SETTINGS_VERSION = 1

/** Why an encrypted export could not be opened. A wrong password and a damaged
 *  file look the same to GCM, so both are `bad-password`. */
export type SettingsDecryptFailure = 'bad-password' | 'invalid' | 'unsupported-version'

export type SettingsDecryptResult = { ok: true; data: unknown } | { ok: false; reason: SettingsDecryptFailure }

/** True for a file in the encrypted export format, whatever its version. */
export function isEncryptedSettingsExport(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && (raw as { format?: unknown }).format === ENCRYPTED_SETTINGS_FORMAT
}
