import { create } from 'zustand'
import type {
  RollbackRelease,
  RollbackState,
  RollbackSupport,
  SettingsBackup,
  VersionRollback
} from '../../../shared/types'
import { isPastRollback, rollbackOnArrival, versionChange } from '../../../shared/rollback'
import { rollbackApi, settingsBackupsApi } from '../infrastructure/api'
import { useSettingsStore, reportLoadFailure } from './settings'
import { useUIStore } from './ui'
import { t } from '../i18n'

export type ReleasesLoad =
  | { status: 'idle' | 'loading' }
  | { status: 'ok'; releases: RollbackRelease[] }
  | { status: 'error'; reason: 'offline' | 'rate-limited' | 'failed' }

/** The question asked after updating past a rollback, when the settings changed on the older version. */
export interface RestorePrompt {
  backup: string
  /** How many settings differ from the copy. */
  changed: number
  /** The version gone back to, where they were changed. */
  on: string
}

interface RollbackStoreState {
  started: boolean
  appVersion: string
  support: RollbackSupport | null
  releases: ReleasesLoad
  backups: SettingsBackup[]
  /** The switch in progress, as main reports it. */
  progress: RollbackState
  /** What the confirmation chose, applied once the download lands. */
  pending: { target: string; showNotes: boolean } | null
  restorePrompt: RestorePrompt | null

  init(): void
  loadReleases(): Promise<void>
  loadBackups(): Promise<void>
  /** Confirmed: copy the settings, download `target`, then record and restart. */
  start(target: string, showNotes: boolean): Promise<void>
  /** Stops a switch still checking or downloading. Nothing is installed. */
  cancel(): Promise<void>
  /** Writes a copy back over the settings, then reloads them. */
  restoreBackup(name: string): Promise<boolean>
  /** Start-up: what a version change since the last run means (see `versionChange`). */
  onStartup(current: string): Promise<void>
  dismissNotice(): void
  answerRestore(restore: boolean): Promise<void>
}

const IDLE: RollbackState = { status: 'idle', target: null, percent: 0, error: null, backup: null }

function setRecord(record: VersionRollback | undefined): void {
  useSettingsStore.getState().update((s) => {
    const { versionRollback: _old, ...rest } = s
    void _old
    return record ? { ...rest, versionRollback: record } : rest
  })
}

export const useRollbackStore = create<RollbackStoreState>((set, get) => ({
  started: false,
  appVersion: '',
  support: null,
  releases: { status: 'idle' },
  backups: [],
  progress: IDLE,
  pending: null,
  restorePrompt: null,

  init: () => {
    if (get().started) return
    set({ started: true })
    rollbackApi.onEvent((progress) => {
      set({ progress: { ...progress } })
      if (progress.status === 'downloaded') void finish()
      if (progress.status === 'error') set({ pending: null })
    })
    void rollbackApi.getState().then((progress) => set({ progress }))
    void rollbackApi.support().then((support) => set({ support }))
    void rollbackApi.appVersion().then((appVersion) => set({ appVersion }))
  },

  loadReleases: async () => {
    set({ releases: { status: 'loading' } })
    const reply = await rollbackApi.releases().catch(() => ({ ok: false as const, reason: 'failed' as const }))
    set({ releases: reply.ok ? { status: 'ok', releases: reply.releases } : { status: 'error', reason: reply.reason } })
  },

  loadBackups: async () => {
    set({ backups: await settingsBackupsApi.list().catch(() => []) })
  },

  start: async (target, showNotes) => {
    // What is on screen is what the copy should hold.
    await useSettingsStore.getState().flush()
    set({ pending: { target, showNotes } })
    await rollbackApi.start(target)
  },

  cancel: async () => {
    set({ pending: null })
    await rollbackApi.cancel()
  },

  restoreBackup: async (name) => {
    const settings = useSettingsStore.getState()
    await settings.flush()
    const result = await settingsBackupsApi.restore(name).catch(() => 'missing' as const)
    if (result !== 'ok') {
      useUIStore.getState().toast('error', t('rollback.restoreFailed'))
      return false
    }
    await settings.load({ unlock: settings.unlocked }).catch(reportLoadFailure)
    await get().loadBackups()
    useUIStore.getState().toast('success', t('rollback.restored'))
    return true
  },

  onStartup: async (current) => {
    const settings = useSettingsStore.getState().settings
    const change = versionChange(settings.lastSeenVersion, current)
    if (change?.kind === 'back') {
      const record = rollbackOnArrival(settings.versionRollback, change, new Date().toISOString())
      setRecord(record)
      return
    }
    const record = settings.versionRollback
    if (!record || !isPastRollback(record, current)) return
    // Updated past the version gone back to. Ask only when something changed meanwhile.
    const changed = record.backup ? await settingsBackupsApi.changedSince(record.backup).catch(() => null) : null
    if (!record.backup || !changed || changed.length === 0) {
      setRecord(undefined)
      return
    }
    set({ restorePrompt: { backup: record.backup, changed: changed.length, on: record.to } })
  },

  dismissNotice: () => {
    const record = useSettingsStore.getState().settings.versionRollback
    if (record) setRecord({ ...record, noticeDismissed: true })
  },

  answerRestore: async (restore) => {
    const prompt = get().restorePrompt
    set({ restorePrompt: null })
    if (restore && prompt) await get().restoreBackup(prompt.backup)
    setRecord(undefined)
  }
}))

/**
 * The download landed: record the switch — the version left (never offered
 * again), the copy taken, whether to show notes — write it to disk, then let
 * main quit and install. If the record cannot be written, nothing is installed.
 */
async function finish(): Promise<void> {
  const { pending, progress, appVersion } = useRollbackStore.getState()
  if (!pending || progress.target !== pending.target || !appVersion) return
  useRollbackStore.setState({ pending: null })
  const previous = useSettingsStore.getState().settings.versionRollback
  setRecord({
    from: appVersion,
    to: pending.target,
    at: new Date().toISOString(),
    ...(progress.backup ? { backup: progress.backup } : {}),
    ...(pending.showNotes ? { showNotes: true } : {})
  })
  try {
    await useSettingsStore.getState().flush()
  } catch {
    // Nothing installs without the record: the version left would be offered again at once.
    setRecord(previous)
    await rollbackApi.cancel()
    useUIStore.getState().toast('error', t('rollback.recordFailed'))
    return
  }
  rollbackApi.install()
}
