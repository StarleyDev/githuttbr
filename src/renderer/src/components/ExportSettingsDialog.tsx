import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Download, Loader2 } from 'lucide-react'
import { useUIStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { useT, t as tNow, interp, type TranslationKey } from '../i18n'
import { IMPORT_PARTS, type ImportPart } from '../lib/settingsImport'
import {
  EXPORT_PRESETS,
  canExportCredentials,
  exportSettingsFor,
  partsOfPreset,
  presetOfParts,
  summarizeExport,
  type ExportPreset
} from '../lib/settingsExport'
import { settingsApi, infoApi, vaultApi, profileAvatarApi } from '../infrastructure/api'
import { toastVaultRefused, vaultRefusalOf } from './VaultUnreadableNotice'
import { withoutAISecretsSeed } from '../../../shared/aiScope'
import { hasStoredImage } from '../../../shared/profileAvatar'
import { stripSettingsSecrets } from '../../../shared/secrets'
import type { SettingsBundle } from '../../../shared/types'

type Chosen = Record<ImportPart, boolean>

// The part copy is the import dialog's: the same four parts, worded once.
const PART_COPY: Record<ImportPart, { title: TranslationKey; hint: TranslationKey }> = {
  profiles: { title: 'settingsImport.partProfiles', hint: 'settingsImport.partProfilesHint' },
  prefs: { title: 'settingsImport.partPrefs', hint: 'settingsImport.partPrefsHint' },
  repos: { title: 'settingsImport.partRepos', hint: 'settingsImport.partReposHint' },
  machine: { title: 'settingsImport.partMachine', hint: 'settingsImport.partMachineHint' }
}

const PRESET_LABEL: Record<ExportPreset, TranslationKey> = {
  full: 'settingsExport.presetFull',
  otherComputer: 'settingsExport.presetOtherComputer',
  team: 'settingsExport.presetTeam'
}

const PRESET_HINT: Record<ExportPreset, TranslationKey> = {
  full: 'settingsExport.presetFullHint',
  otherComputer: 'settingsExport.presetOtherComputerHint',
  team: 'settingsExport.presetTeamHint'
}

/** A count with its noun; see `counted` in ImportSettingsDialog. */
function counted(t: (k: TranslationKey) => string, n: number, one: TranslationKey, many: TranslationKey): string {
  return n === 1 ? t(one) : interp(t(many), { count: n })
}

/**
 * Settings → Data → Export: which parts of this machine's settings the file
 * carries, whether credentials go in, and whether a password seals it. Stacked
 * over Settings (a dialog, see `isDialogSpec`), like the import dialog.
 */
export function ExportSettingsDialog({ onClose }: { onClose?: () => void }): React.JSX.Element {
  const t = useT()
  const storeClose = useUIStore((s) => s.closeModal)
  const close = onClose ?? storeClose
  const toast = useUIStore((s) => s.toast)
  const settings = useSettingsStore((s) => s.settings)

  // A backup is the default, as Export was before it had parts.
  const [chosen, setChosen] = useState<Chosen>({ profiles: true, prefs: true, repos: true, machine: true })
  const [includeSecrets, setIncludeSecrets] = useState(false)
  const [showWarn, setShowWarn] = useState(false)
  const [busy, setBusy] = useState(false)
  // Optional password protection. Held only here, sent once with the export,
  // and dropped with the dialog — never saved anywhere.
  const [protect, setProtect] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [noRecoveryAck, setNoRecoveryAck] = useState(false)
  const passwordsDiffer = passwordAgain.length > 0 && password !== passwordAgain
  const protectReady = !protect || (password.length > 0 && password === passwordAgain && noRecoveryAck)

  const parts = useMemo(() => IMPORT_PARTS.filter((p) => chosen[p]), [chosen])
  const preset = presetOfParts(parts)
  const secretsAllowed = canExportCredentials(parts)
  const secrets = includeSecrets && secretsAllowed
  const sealed = protect && password.length > 0

  const avatarIds = useMemo(
    () => settings.profiles.filter((p) => hasStoredImage(p.avatar)).map((p) => p.id),
    [settings.profiles]
  )
  const manifest = useMemo(
    () => summarizeExport(settings, parts, { credentials: secrets, encrypted: sealed, avatarCount: avatarIds.length }),
    [settings, parts, secrets, sealed, avatarIds.length]
  )
  // Each part's size on this computer, ticked or not.
  const whole = useMemo(
    () => summarizeExport(settings, IMPORT_PARTS, { credentials: false, encrypted: false, avatarCount: 0 }),
    [settings]
  )

  const setParts = (next: readonly ImportPart[]): void => {
    setChosen({
      profiles: next.includes('profiles'),
      prefs: next.includes('prefs'),
      repos: next.includes('repos'),
      machine: next.includes('machine')
    })
    // Credentials ride with the profiles: dropping the part drops the opt-in,
    // so ticking Profiles again never brings them back unasked.
    if (!next.includes('profiles')) {
      setIncludeSecrets(false)
      setShowWarn(false)
    }
  }
  const toggle = (part: ImportPart): void => setParts(IMPORT_PARTS.filter((p) => (p === part ? !chosen[p] : chosen[p])))

  const clearPassword = (): void => {
    setPassword('')
    setPasswordAgain('')
    setNoRecoveryAck(false)
  }

  const runExport = async (): Promise<void> => {
    setBusy(true)
    try {
      // The keychain seed names this machine's profiles: never exported.
      // Secrets — profile tokens, AI keys and the vault — only with the opt-in.
      const base = withoutAISecretsSeed(secrets ? settings : stripSettingsSecrets(settings))
      const bundle: SettingsBundle = {
        __githuttbr: 'settings-export',
        version: 1,
        // Only the chosen parts' keys: a part left out is absent from the file,
        // and the import reads a missing key as "leave mine as it is".
        settings: exportSettingsFor(base, parts)
      }
      if (manifest.info) bundle.info = await infoApi.exportAll()
      if (manifest.vault) {
        // A vault that cannot be read or opened answers empty: a backup must not carry that as the vault.
        const reply = await vaultApi.exportAll()
        const refused = vaultRefusalOf(reply)
        if (refused) {
          toastVaultRefused(refused)
          return
        }
        bundle.vault = { repos: reply.repos, global: reply.global }
      }
      // Pictures live outside settings (one PNG per profile); they go with Profiles.
      if (manifest.avatarCount > 0) {
        const avatars = await profileAvatarApi.exportAll(avatarIds)
        if (Object.keys(avatars).length) bundle.avatars = avatars
      }
      const ok = await settingsApi.exportFile(bundle, sealed ? password : undefined)
      if (ok) {
        clearPassword()
        close()
        toast('success', tNow(sealed ? 'settings.exportedEncrypted' : 'settings.exported'))
      }
    } catch {
      toast('error', tNow('settings.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  const canExport = parts.length > 0 && protectReady && !busy && !showWarn
  const onExport = (): void => {
    if (!canExport) return
    // Unencrypted with credentials: say what the file is, and ask once.
    if (secrets && !sealed) {
      setShowWarn(true)
      return
    }
    void runExport()
  }

  const counts: Record<ImportPart, string> = {
    profiles: counted(t, whole.profileCount, 'settingsImport.profilesCountOne', 'settingsImport.profilesCount'),
    prefs: counted(t, whole.prefCount, 'settingsImport.prefsCountOne', 'settingsImport.prefsCount'),
    repos: counted(t, whole.repoCount, 'settingsImport.pathsCountOne', 'settingsImport.pathsCount'),
    machine: counted(t, whole.machineCount, 'settingsImport.pathsCountOne', 'settingsImport.pathsCount')
  }

  const manifestLines: string[] = []
  if (manifest.parts.includes('profiles')) {
    manifestLines.push(
      interp(t('settingsExport.lineProfiles'), {
        count: manifest.profileCount,
        credentials: t(manifest.credentials ? 'settingsImport.withCredentials' : 'settingsImport.withoutCredentials')
      })
    )
    if (manifest.avatarCount > 0) manifestLines.push(interp(t('settingsExport.lineAvatars'), { count: manifest.avatarCount }))
    if (manifest.vault) manifestLines.push(t('settingsExport.lineVault'))
  }
  if (manifest.parts.includes('prefs')) manifestLines.push(interp(t('settingsExport.linePrefs'), { count: manifest.prefCount }))
  if (manifest.parts.includes('repos')) {
    manifestLines.push(interp(t('settingsExport.lineRepos'), { count: manifest.repoCount }))
    if (manifest.info) manifestLines.push(t('settingsExport.lineInfo'))
  }
  if (manifest.parts.includes('machine')) manifestLines.push(interp(t('settingsExport.linePrograms'), { count: manifest.machineCount }))
  if (manifest.leftOut.length > 0 && manifest.parts.length > 0) {
    // Part titles hold their own "and" ("Repositories and workspaces"): a
    // conjunction list would read "… and workspaces and Programs…".
    manifestLines.push(interp(t('settingsExport.lineLeftOut'), { parts: manifest.leftOut.map((p) => t(PART_COPY[p].title)).join(' · ') }))
  }
  if (manifest.parts.length > 0) manifestLines.push(t(manifest.encrypted ? 'settingsExport.lineEncrypted' : 'settingsExport.lineNotEncrypted'))

  return (
    <div className="import-dialog export-dialog">
      <h3>{t('settingsExport.title')}</h3>
      <p className="import-from">{t('settingsExport.subtitle')}</p>

      <div className="import-body">
        <div className="export-presets" role="group" aria-label={t('settingsExport.presetsLabel')}>
          {EXPORT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="export-preset"
              aria-pressed={preset === p.id}
              title={t(PRESET_HINT[p.id])}
              disabled={busy}
              onClick={() => setParts(partsOfPreset(p.id))}
            >
              {t(PRESET_LABEL[p.id])}
            </button>
          ))}
        </div>

        {IMPORT_PARTS.map((id) => (
          <div className={`import-part ${chosen[id] ? 'on' : ''}`} key={id}>
            <label className="import-part-head">
              <input type="checkbox" checked={chosen[id]} disabled={busy} onChange={() => toggle(id)} />
              <b>{t(PART_COPY[id].title)}</b>
              <span className="import-count">{counts[id]}</span>
              <span className="import-what">{t(PART_COPY[id].hint)}</span>
            </label>
          </div>
        ))}

        {parts.length > 0 &&
          (manifest.machinePaths ? (
            <div className="import-why export-note">
              <AlertTriangle size={13} aria-hidden="true" />
              <span>{t('settingsExport.notePaths')}</span>
            </div>
          ) : (
            <div className="import-why good export-note">
              <Check size={13} aria-hidden="true" />
              <span>{t('settingsExport.noteNoPaths')}</span>
            </div>
          ))}

        <label className={`export-opt ${secretsAllowed ? '' : 'off'}`}>
          <input
            type="checkbox"
            checked={secrets}
            disabled={!secretsAllowed || busy}
            onChange={(e) => {
              setIncludeSecrets(e.target.checked)
              if (!e.target.checked) setShowWarn(false)
            }}
          />
          <span>
            <b>{t('settings.includeSecrets')}</b>
            <small>{t(secretsAllowed ? 'settings.includeSecretsHint' : 'settingsExport.credentialsNeedProfiles')}</small>
          </span>
        </label>

        <label className="export-opt">
          <input
            type="checkbox"
            checked={protect}
            disabled={busy}
            onChange={(e) => {
              setProtect(e.target.checked)
              if (e.target.checked) setShowWarn(false)
              else clearPassword()
            }}
          />
          <span>
            <b>{t('settings.exportProtect')}</b>
            <small>{t(secrets ? 'settingsExport.protectRecommended' : 'settings.exportProtectHint')}</small>
          </span>
        </label>

        {protect && (
          <div className="settings-export-password export-password">
            <label className="settings-field">
              <span className="settings-field-label">{t('settings.exportPassword')}</span>
              <input
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">{t('settings.exportPasswordConfirm')}</span>
              <input
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={passwordAgain}
                aria-invalid={passwordsDiffer}
                disabled={busy}
                onChange={(e) => setPasswordAgain(e.target.value)}
              />
            </label>
            {passwordsDiffer && (
              <p className="settings-export-password-error" role="alert">
                {t('settings.exportPasswordMismatch')}
              </p>
            )}
            <div className="settings-export-norecovery">
              <AlertTriangle size={14} aria-hidden="true" />
              <div>
                <strong>{t('settings.exportNoRecovery')}</strong>
                <label className="settings-export-ack">
                  <input type="checkbox" checked={noRecoveryAck} onChange={(e) => setNoRecoveryAck(e.target.checked)} />
                  {t('settings.exportNoRecoveryAck')}
                </label>
              </div>
            </div>
          </div>
        )}

        {manifestLines.length > 0 && (
          <div className="export-manifest" aria-label={t('settingsExport.manifestTitle')}>
            <span className="export-manifest-title">{t('settingsExport.manifestTitle')}</span>
            <ul>
              {manifestLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showWarn && (
        <div className="import-confirm" role="alertdialog" aria-labelledby="export-warn-title">
          <b id="export-warn-title">{t('settings.exportWarnTitle')}</b>
          <span>{t('settings.exportWarnBody')}</span>
          <div className="import-confirm-actions">
            <button className="btn ghost small" onClick={() => setShowWarn(false)} autoFocus>
              {t('common.cancel')}
            </button>
            <button
              className="btn danger small"
              onClick={() => {
                setShowWarn(false)
                void runExport()
              }}
            >
              {t('settings.exportAnyway')}
            </button>
          </div>
        </div>
      )}

      <div className="modal-actions import-foot">
        <span className="import-summary">
          {parts.length === 0
            ? t('settingsImport.summaryNone')
            : interp(t('settingsExport.summary'), { count: parts.length, total: IMPORT_PARTS.length })}
        </span>
        <button className="btn ghost" onClick={close} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" onClick={onExport} disabled={!canExport}>
          {busy ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
          {t('settingsExport.export')}
        </button>
      </div>
    </div>
  )
}
