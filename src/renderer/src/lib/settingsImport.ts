import type { AppSettings, SettingsBundle } from '../../../shared/types'
import { scrubServerUrls } from '../../../shared/secrets'

export interface ParsedSettingsImport {
  settings: Partial<AppSettings>
  /** The full export when the file is one; null for an older bare-settings file. */
  bundle: SettingsBundle | null
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Read an export file in either shape. Exports are a `SettingsBundle` today and
 *  were a bare `AppSettings` before — spreading a bundle straight into settings
 *  applies nothing but junk keys, which is how onboarding's import silently did
 *  nothing. Returns null for anything that is not a settings object at all.
 *
 *  A server address carrying a `user:password@` or a query is cleaned here
 *  (`scrubServerUrls`): Settings would refuse it typed, and the addresses stay
 *  in the plain settings file. */
export function parseSettingsImport(raw: unknown): ParsedSettingsImport | null {
  if (!isObject(raw)) return null
  if (raw.__gitcito === 'settings-export') {
    if (!isObject(raw.settings)) return null
    const settings = scrubServerUrls(raw.settings as Partial<AppSettings>)
    return { settings, bundle: { ...(raw as unknown as SettingsBundle), settings } as SettingsBundle }
  }
  return { settings: scrubServerUrls(raw as Partial<AppSettings>), bundle: null }
}
