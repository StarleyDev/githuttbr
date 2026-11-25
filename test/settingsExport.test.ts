import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  defaultAIConfig,
  defaultProfile,
  defaultSettings,
  type AIConfig,
  type AppSettings,
  type RepoTab
} from '../src/shared/types'

// The selective settings export: presets over the four parts, the settings a
// partial file carries, the dialog's manifest, and a partial file going back
// through the import.

let onDisk: AppSettings = defaultSettings()
let generation = 0
vi.mock('electron', () => ({ app: {}, ipcMain: {} }))
vi.mock('../src/renderer/src/infrastructure/api', () => ({
  settingsApi: {
    set: vi.fn(async (settings: AppSettings) => {
      onDisk = settings
    }),
    get: vi.fn(async () => ({ settings: onDisk, generation: ++generation })),
    unlock: vi.fn(async () => ({ settings: onDisk, generation: ++generation }))
  },
  reposApi: {},
  SettingsSaveRefused: class SettingsSaveRefused extends Error {}
}))

import { IMPORT_PARTS, parseSettingsImport, partOfKey, pickParts, summarizeImport } from '../src/renderer/src/lib/settingsImport'
import {
  EXPORT_PRESETS,
  canExportCredentials,
  exportHoldsMachinePaths,
  exportSettingsFor,
  partsOfPreset,
  presetOfParts,
  summarizeExport
} from '../src/renderer/src/lib/settingsExport'
import { stripSettingsSecrets, hasSettingsSecrets } from '../src/shared/secrets'
import { withoutAISecretsSeed } from '../src/shared/aiScope'
import { useSettingsStore } from '../src/renderer/src/stores/settings'

const W = '/home/dev/Workspace'

function aiWith(cliPath: string, extra: Partial<AIConfig> = {}): AIConfig {
  const base = defaultAIConfig()
  return {
    ...base,
    accounts: [{ ...base.accounts[0], id: 'acc', provider: 'cli', cliPath }],
    defaultAccountId: 'acc',
    ...extra
  }
}

/** This machine's settings, as the export dialog reads them from the store. */
function mine(): AppSettings {
  const tab: RepoTab = {
    id: 't1',
    name: 'api',
    kind: 'repo',
    repos: [{ path: `${W}/api`, name: 'api' }],
    activeRepoPath: `${W}/api`
  }
  return {
    ...defaultSettings(),
    onboardingCompleted: true,
    language: 'pt-BR',
    appThemeId: 'midnight',
    profiles: [
      { ...defaultProfile(), id: 'work', name: 'Work', githubToken: 'ghp_secret', ai: aiWith('/usr/bin/claude') },
      { ...defaultProfile(), id: 'home', name: 'Home' }
    ],
    activeProfileId: 'work',
    ai: aiWith('/usr/bin/claude', { cliCwd: `${W}/api`, apiKey: 'sk-secret' }),
    aiSecretsFrom: 'work',
    tabs: [tab],
    activeTabId: 't1',
    recentRepos: [{ path: `${W}/api`, name: 'api' }, { path: `${W}/web`, name: 'web' }],
    favouriteRepos: [`${W}/api`],
    repoAliases: { [`${W}/api`]: 'API' },
    terminalShell: '/usr/bin/zsh',
    editor: { ...defaultSettings().editor, command: '/usr/bin/code' }
  }
}

/** What Export writes, minus the IPC: the same steps the dialog takes. */
function exportFile(settings: AppSettings, parts: readonly (typeof IMPORT_PARTS)[number][], secrets = false): unknown {
  const base = withoutAISecretsSeed(secrets ? settings : stripSettingsSecrets(settings))
  // Through JSON, as the file is: undefined keys vanish exactly as on disk.
  return JSON.parse(JSON.stringify({ __githuttbr: 'settings-export', version: 1, settings: exportSettingsFor(base, parts) }))
}

describe('presets', () => {
  it('map to their parts in the dialog order', () => {
    expect(partsOfPreset('full')).toEqual(['profiles', 'prefs', 'repos', 'machine'])
    expect(partsOfPreset('otherComputer')).toEqual(['profiles', 'prefs'])
    expect(partsOfPreset('team')).toEqual(['prefs'])
  })

  it('are recognised from the parts, in any order, and none otherwise', () => {
    expect(presetOfParts(['machine', 'repos', 'prefs', 'profiles'])).toBe('full')
    expect(presetOfParts(['prefs', 'profiles'])).toBe('otherComputer')
    expect(presetOfParts(['prefs'])).toBe('team')
    expect(presetOfParts(['prefs', 'repos'])).toBeNull()
    expect(presetOfParts(['profiles'])).toBeNull()
    expect(presetOfParts([])).toBeNull()
  })

  it('round-trip: every preset is recognised from its own parts', () => {
    for (const p of EXPORT_PRESETS) expect(presetOfParts(partsOfPreset(p.id))).toBe(p.id)
  })

  it('only Repositories and Programs carry this machine’s paths', () => {
    expect(exportHoldsMachinePaths(partsOfPreset('otherComputer'))).toBe(false)
    expect(exportHoldsMachinePaths(partsOfPreset('team'))).toBe(false)
    expect(exportHoldsMachinePaths(['repos'])).toBe(true)
    expect(exportHoldsMachinePaths(['prefs', 'machine'])).toBe(true)
  })

  it('credentials need the profiles part', () => {
    expect(canExportCredentials(['profiles'])).toBe(true)
    expect(canExportCredentials(['prefs', 'repos', 'machine'])).toBe(false)
  })
})

describe('exportSettingsFor', () => {
  it('a full backup carries everything, as Export did before parts', () => {
    const s = mine()
    expect(exportSettingsFor(s, IMPORT_PARTS)).toEqual(s)
  })

  it('carries only the chosen parts’ keys', () => {
    const out = exportSettingsFor(mine(), ['prefs'])
    for (const key of Object.keys(out)) expect(partOfKey(key as keyof AppSettings)).toBe('prefs')
    expect(out.language).toBe('pt-BR')
    expect(out.profiles).toBeUndefined()
    expect(out.tabs).toBeUndefined()
    expect(out.terminalShell).toBeUndefined()
  })

  it('profiles without programs leave out the AI CLI paths', () => {
    const out = exportSettingsFor(mine(), ['profiles', 'prefs'])
    expect(out.ai?.cliPath).toBeUndefined()
    expect(out.ai?.cliCwd).toBeUndefined()
    expect(out.ai?.accounts.every((a) => a.cliPath === undefined)).toBe(true)
    expect(out.profiles?.[0].ai.accounts.every((a) => a.cliPath === undefined)).toBe(true)
    // The rest of the AI setup travels.
    expect(out.ai?.defaultAccountId).toBe('acc')
    expect(summarizeImport(out).machinePaths).toEqual([])
  })

  it('profiles with programs keep the AI CLI paths', () => {
    const out = exportSettingsFor(mine(), ['profiles', 'machine'])
    expect(out.ai?.accounts[0].cliPath).toBe('/usr/bin/claude')
  })

  it('does not touch the settings it is given', () => {
    const s = mine()
    exportSettingsFor(s, ['profiles'])
    expect(s.ai.accounts[0].cliPath).toBe('/usr/bin/claude')
  })
})

describe('summarizeExport', () => {
  const opts = { credentials: false, encrypted: false, avatarCount: 2 }

  it('counts what the file carries, per part', () => {
    const m = summarizeExport(mine(), IMPORT_PARTS, opts)
    expect(m.parts).toEqual(IMPORT_PARTS)
    expect(m.leftOut).toEqual([])
    expect(m.profileCount).toBe(2)
    expect(m.avatarCount).toBe(2)
    expect(m.repoCount).toBe(2)
    expect(m.machineCount).toBe(4) // zsh, code, the claude binary and its working folder
    expect(m.prefCount).toBeGreaterThan(10)
    expect(m.info).toBe(true)
    expect(m.machinePaths).toBe(true)
  })

  it('a part left out counts zero and is listed as left out', () => {
    const m = summarizeExport(mine(), ['prefs'], opts)
    expect(m.leftOut).toEqual(['profiles', 'repos', 'machine'])
    expect(m.profileCount).toBe(0)
    expect(m.avatarCount).toBe(0)
    expect(m.repoCount).toBe(0)
    expect(m.info).toBe(false)
    expect(m.machinePaths).toBe(false)
  })

  it('credentials and the vault only with Profiles and the opt-in', () => {
    expect(summarizeExport(mine(), ['profiles'], { ...opts, credentials: true })).toMatchObject({ credentials: true, vault: true })
    expect(summarizeExport(mine(), ['profiles'], opts)).toMatchObject({ credentials: false, vault: false })
    expect(summarizeExport(mine(), ['prefs', 'repos'], { ...opts, credentials: true })).toMatchObject({
      credentials: false,
      vault: false
    })
  })

  it('programs without profiles count only the paths the file carries', () => {
    expect(summarizeExport(mine(), ['machine'], opts).machineCount).toBe(2)
  })
})

describe('a partial export through the import', () => {
  it('“Another computer” has no paths, no repositories and no credentials', () => {
    const parsed = parseSettingsImport(exportFile(mine(), partsOfPreset('otherComputer')))
    expect(parsed).not.toBeNull()
    const summary = summarizeImport(parsed!.settings)
    expect(summary.profileCount).toBe(2)
    expect(summary.repoPaths).toEqual([])
    expect(summary.machinePaths).toEqual([])
    expect(hasSettingsSecrets(parsed!.settings as AppSettings)).toBe(false)
    expect('aiSecretsFrom' in parsed!.settings).toBe(false)
  })

  it('“For the team” has nothing personal: no profiles, no AI', () => {
    const parsed = parseSettingsImport(exportFile(mine(), partsOfPreset('team'), true))
    const s = parsed!.settings
    expect(s.profiles).toBeUndefined()
    expect(s.ai).toBeUndefined()
    expect(s.activeProfileId).toBeUndefined()
    expect(summarizeImport(s).profileCount).toBe(0)
    expect(JSON.stringify(s)).not.toContain('secret')
  })

  it('credentials go in only with the opt-in', () => {
    const withSecrets = parseSettingsImport(exportFile(mine(), ['profiles'], true))!.settings
    expect(withSecrets.profiles?.[0].githubToken).toBe('ghp_secret')
    const without = parseSettingsImport(exportFile(mine(), ['profiles'], false))!.settings
    expect(without.profiles?.[0].githubToken).toBe('')
  })

  it('the import offers only the parts the file carries', () => {
    const team = summarizeImport(parseSettingsImport(exportFile(mine(), partsOfPreset('team')))!.settings)
    expect(team.present).toEqual({ profiles: false, prefs: true, repos: false, machine: false })
    const other = summarizeImport(parseSettingsImport(exportFile(mine(), partsOfPreset('otherComputer')))!.settings)
    expect(other.present.profiles && other.present.prefs).toBe(true)
    expect(other.present.repos || other.present.machine).toBe(false)
    const full = summarizeImport(parseSettingsImport(exportFile(mine(), partsOfPreset('full')))!.settings)
    expect(full.present.profiles && full.present.prefs && full.present.repos).toBe(true)
  })

  it('stripping secrets from a file without profiles adds no empty list', () => {
    const team = parseSettingsImport(exportFile(mine(), partsOfPreset('team')))!.settings
    expect('profiles' in stripSettingsSecrets(team as AppSettings)).toBe(false)
  })

  it('pickParts on import of a partial file keeps only what is there', () => {
    const file = parseSettingsImport(exportFile(mine(), ['prefs']))!.settings
    expect(pickParts(file, ['profiles', 'repos'])).toEqual({})
  })

  describe('into the store', () => {
    beforeEach(async () => {
      onDisk = {
        ...defaultSettings(),
        onboardingCompleted: true,
        language: 'en',
        terminalShell: '/bin/bash',
        repoAliases: { '/Users/dev/mine': 'Mine' },
        profiles: [{ ...defaultProfile(), id: 'local', name: 'Local' }],
        activeProfileId: 'local'
      }
      await useSettingsStore.getState().load()
    })

    it('every part ticked, a prefs-only file changes the prefs and nothing else', async () => {
      const file = parseSettingsImport(exportFile(mine(), ['prefs']))!.settings
      await useSettingsStore.getState().importSettings(file, { parts: IMPORT_PARTS, profiles: 'merge' })
      const s = useSettingsStore.getState().settings
      expect(s.language).toBe('pt-BR')
      expect(s.appThemeId).toBe('midnight')
      expect(s.terminalShell).toBe('/bin/bash')
      expect(s.repoAliases).toEqual({ '/Users/dev/mine': 'Mine' })
      expect(s.profiles.map((p) => p.id)).toEqual(['local'])
      expect(s.activeProfileId).toBe('local')
    })

    it('“Another computer” adds the profiles and keeps this machine’s programs', async () => {
      const file = parseSettingsImport(exportFile(mine(), partsOfPreset('otherComputer')))!.settings
      await useSettingsStore.getState().importSettings(file, { parts: IMPORT_PARTS, profiles: 'merge' })
      const s = useSettingsStore.getState().settings
      expect(s.profiles.map((p) => p.id).sort()).toEqual(['home', 'local', 'work'])
      expect(s.terminalShell).toBe('/bin/bash')
      expect(s.repoAliases).toEqual({ '/Users/dev/mine': 'Mine' })
    })
  })
})
