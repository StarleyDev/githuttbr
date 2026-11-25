import type { AIConfig, AppSettings } from '../../../shared/types'
import { IMPORT_PARTS, bundleExtrasFor, pickParts, summarizeImport, type ImportPart } from './settingsImport'

// ─── Selective export ──────────────────────────────────────────────────────────
//
// The counterpart of the selective import: the same four parts, picked before
// the file is written instead of after it is read. A file for another computer
// or for the team should not carry this machine's folders, programs or
// accounts just because a backup does. Everything here is pure; the dialog
// gathers the extras (info, vault, pictures) and main writes the file.

/** The shortcuts the export dialog offers over the four checkboxes. */
export type ExportPreset = 'full' | 'otherComputer' | 'team'

export const EXPORT_PRESETS: readonly { id: ExportPreset; parts: readonly ImportPart[] }[] = [
  // Everything, to restore on this computer or a copy of it.
  { id: 'full', parts: IMPORT_PARTS },
  // Who you are and how you like it, without the paths that only exist here.
  { id: 'otherComputer', parts: ['profiles', 'prefs'] },
  // Taste only: nothing personal, nothing machine-bound.
  { id: 'team', parts: ['prefs'] }
]

/** The parts a preset ticks, in the dialog's order. */
export function partsOfPreset(id: ExportPreset): ImportPart[] {
  const preset = EXPORT_PRESETS.find((p) => p.id === id)
  return IMPORT_PARTS.filter((p) => !!preset?.parts.includes(p))
}

/** The preset whose parts are exactly these, or null when the user's pick
 *  matches none — the dialog then shows no preset pressed. */
export function presetOfParts(parts: readonly ImportPart[]): ExportPreset | null {
  const same = (a: readonly ImportPart[]): boolean =>
    a.length === new Set(parts).size && a.every((p) => parts.includes(p))
  return EXPORT_PRESETS.find((p) => same(p.parts))?.id ?? null
}

/** Whether a file with these parts names folders or programs of this computer. */
export function exportHoldsMachinePaths(parts: readonly ImportPart[]): boolean {
  return parts.includes('repos') || parts.includes('machine')
}

/** Credentials live in the profiles (tokens, AI keys): without that part there
 *  is nothing to opt in to. */
export function canExportCredentials(parts: readonly ImportPart[]): boolean {
  return parts.includes('profiles')
}

/** An AI config without the program paths of this computer. */
function withoutCliPaths(ai: AIConfig): AIConfig {
  const out: AIConfig = { ...ai }
  delete out.cliPath
  delete out.cliCwd
  if (Array.isArray(ai.accounts)) {
    out.accounts = ai.accounts.map((account) => {
      const next = { ...account }
      delete next.cliPath
      return next
    })
  }
  return out
}

/**
 * The settings object a file with these parts carries: only the chosen parts'
 * keys (`pickParts`, the import's own key→part table). The caller strips the
 * credentials first when the user did not opt in.
 *
 * The AI CLI paths are 'machine' values stored inside 'profiles' (the import
 * treats them the same way, `keepMachineAIPaths`): Profiles without Programs
 * leaves them out, so a file for another computer names no binary of this one.
 */
export function exportSettingsFor(settings: Partial<AppSettings>, parts: readonly ImportPart[]): Partial<AppSettings> {
  const out = pickParts(settings, parts)
  if (parts.includes('profiles') && !parts.includes('machine')) {
    if (out.ai) out.ai = withoutCliPaths(out.ai)
    if (out.profiles) out.profiles = out.profiles.map((p) => (p.ai ? { ...p, ai: withoutCliPaths(p.ai) } : p))
  }
  return out
}

/** What the export file will hold, for the dialog's manifest. */
export interface ExportManifest {
  parts: ImportPart[]
  /** The parts left out, in the dialog's order. */
  leftOut: ImportPart[]
  profileCount: number
  /** Profile pictures chosen as an image, shipped alongside the profiles. */
  avatarCount: number
  prefCount: number
  repoCount: number
  machineCount: number
  credentials: boolean
  encrypted: boolean
  /** Per-repository notes and wikis (the info store) — with Repositories. */
  info: boolean
  /** The secrets vault — with Profiles, and only with the credentials opt-in. */
  vault: boolean
  /** Whether the file names folders or programs of this computer. */
  machinePaths: boolean
}

/**
 * The manifest of an export. Counts come from the same summary the import
 * dialog shows (`summarizeImport`), taken from what the file will actually
 * carry, so the two dialogs agree on the numbers. Credentials only count with
 * Profiles: the opt-in is meaningless without them.
 */
export function summarizeExport(
  settings: Partial<AppSettings>,
  parts: readonly ImportPart[],
  opts: { credentials: boolean; encrypted: boolean; avatarCount: number }
): ExportManifest {
  const chosen = IMPORT_PARTS.filter((p) => parts.includes(p))
  const summary = summarizeImport(exportSettingsFor(settings, chosen))
  const extras = bundleExtrasFor(chosen)
  const credentials = opts.credentials && canExportCredentials(chosen)
  return {
    parts: chosen,
    leftOut: IMPORT_PARTS.filter((p) => !parts.includes(p)),
    profileCount: chosen.includes('profiles') ? summary.profileCount : 0,
    avatarCount: extras.avatars ? opts.avatarCount : 0,
    prefCount: chosen.includes('prefs') ? summary.prefCount : 0,
    repoCount: chosen.includes('repos') ? summary.repoPaths.length : 0,
    machineCount: chosen.includes('machine') ? summary.machinePaths.length : 0,
    credentials,
    encrypted: opts.encrypted,
    info: extras.info,
    vault: extras.vault && credentials,
    machinePaths: exportHoldsMachinePaths(chosen)
  }
}
