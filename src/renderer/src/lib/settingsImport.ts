import type { AppSettings, SettingsBundle } from '../../../shared/types'

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
 *  nothing. Returns null for anything that is not a settings object at all. */
export function parseSettingsImport(raw: unknown): ParsedSettingsImport | null {
  if (!isObject(raw)) return null
  if (raw.__gitcito === 'settings-export') {
    if (!isObject(raw.settings)) return null
    return { settings: raw.settings as Partial<AppSettings>, bundle: raw as unknown as SettingsBundle }
  }
  return { settings: raw as Partial<AppSettings>, bundle: null }
}
