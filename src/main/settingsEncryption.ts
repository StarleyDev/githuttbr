import { BundleError, openPayload, sealPayload } from './secureBundle'
import {
  ENCRYPTED_SETTINGS_FORMAT,
  ENCRYPTED_SETTINGS_VERSION,
  isEncryptedSettingsExport,
  type SettingsDecryptResult
} from '../shared/settingsEncryption'

// Seal and open password-protected settings exports. No Electron imports, so it
// stays unit-testable; the file dialogs live in settings.ts.

/** The export file's text: the format marker and the sealed JSON of `data`. */
export function sealSettingsExport(data: unknown, password: string): string {
  const sealed = sealPayload(Buffer.from(JSON.stringify(data), 'utf-8'), password)
  return JSON.stringify(
    { format: ENCRYPTED_SETTINGS_FORMAT, version: ENCRYPTED_SETTINGS_VERSION, createdAt: Date.now(), ...sealed },
    null,
    2
  )
}

/** Decrypt an encrypted export back to the bundle it sealed. Never throws: the
 *  renderer asks again on a wrong password and explains the other failures. */
export function openSettingsExport(raw: unknown, password: string): SettingsDecryptResult {
  if (!isEncryptedSettingsExport(raw)) return { ok: false, reason: 'invalid' }
  const version = (raw as { version?: unknown }).version
  if (typeof version !== 'number') return { ok: false, reason: 'invalid' }
  // A newer build's format: refuse by name rather than misread it.
  if (version > ENCRYPTED_SETTINGS_VERSION) return { ok: false, reason: 'unsupported-version' }
  let plain: Buffer
  try {
    plain = openPayload(raw, password)
  } catch (err) {
    return { ok: false, reason: err instanceof BundleError && err.code === 'bad-password' ? 'bad-password' : 'invalid' }
  }
  try {
    return { ok: true, data: JSON.parse(plain.toString('utf-8')) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}
