import { useEffect, useState } from 'react'
import { AlertTriangle, ExternalLink, FolderOpen, History, Info, Loader2, RefreshCw, RotateCcw, Undo2 } from 'lucide-react'
import { useT, interp, type TranslationKey } from '../i18n'
import { useRollbackStore } from '../stores/rollback'
import { useUpdatesStore, hasPendingUpdate } from '../stores/updates'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { settingsBackupsApi, shellApi } from '../infrastructure/api'
import { timeAgo } from '../lib/timeAgo'
import { BACKUPS_KEPT, LAST_UNSAFE_ROLLBACK_VERSION, isRollbackSafe } from '../../../shared/rollback'
import { APP_REPO_URL } from '../../../shared/appRepo'
import type { SettingsBackup } from '../../../shared/types'

const RELEASES_URL = `${APP_REPO_URL}/releases`

const BACKUP_REASON: Record<SettingsBackup['reason'], TranslationKey> = {
  rollback: 'backups.itemRollback',
  update: 'backups.itemUpdate',
  restore: 'backups.itemRestore'
}

const RELEASES_ERROR: Record<'offline' | 'rate-limited' | 'failed', TranslationKey> = {
  offline: 'rollback.offline',
  'rate-limited': 'rollback.rateLimited',
  failed: 'rollback.failed'
}

/** "3 days ago", in the current language. */
function useAgo(): (iso: string) => string {
  const t = useT()
  return (iso) => {
    const at = Date.parse(iso)
    const ago = timeAgo(Number.isNaN(at) ? null : at, Date.now())
    return ago ? interp(t(ago.key), { n: ago.n }) : ''
  }
}

/**
 * Settings → About: the version running, the earlier versions to go back to,
 * and the settings copies taken before every switch. See docs/help/rollback.md.
 */
export function AboutSettingsPage(): React.JSX.Element {
  const t = useT()
  const ago = useAgo()
  const init = useRollbackStore((s) => s.init)
  const appVersion = useRollbackStore((s) => s.appVersion)
  const support = useRollbackStore((s) => s.support)
  const releases = useRollbackStore((s) => s.releases)
  const backups = useRollbackStore((s) => s.backups)
  const progress = useRollbackStore((s) => s.progress)
  const loadReleases = useRollbackStore((s) => s.loadReleases)
  const loadBackups = useRollbackStore((s) => s.loadBackups)
  const restoreBackup = useRollbackStore((s) => s.restoreBackup)
  const cancelSwitch = useRollbackStore((s) => s.cancel)
  const updateStatus = useUpdatesStore((s) => s.status)
  const updateInfo = useUpdatesStore((s) => s.info)
  const checkUpdates = useUpdatesStore((s) => s.check)
  const skipped = useSettingsStore((s) => s.settings.skippedUpdateVersion)
  const versionRollback = useSettingsStore((s) => s.settings.versionRollback)
  const openDialog = useUIStore((s) => s.openDialog)
  const [checkAsked, setCheckAsked] = useState(false)

  useEffect(() => {
    init()
    void loadReleases()
    void loadBackups()
  }, [init, loadReleases, loadBackups])

  const pending = hasPendingUpdate({ status: updateStatus, info: updateInfo } as never, skipped, versionRollback)
  const switching = progress.status === 'checking' || progress.status === 'downloading' || progress.status === 'downloaded'
  const blocked = support && !support.supported
  const openReleases = (): void => void shellApi.openExternal(RELEASES_URL)
  const listed = releases.status === 'ok' ? releases.releases : []

  const confirmRestore = (b: SettingsBackup): void =>
    openDialog({
      kind: 'confirm',
      title: t('backups.confirmTitle'),
      message: interp(t('backups.confirmMessage'), { date: new Date(b.createdAt).toLocaleString() }),
      confirmLabel: t('backups.restore'),
      onConfirm: () => void restoreBackup(b.name)
    })

  const progressText = (): string => {
    const version = progress.target ?? ''
    if (progress.status === 'checking') return interp(t('rollback.preparing'), { version })
    if (progress.status === 'downloading') {
      return interp(t('rollback.downloading'), { version, pct: String(Math.round(progress.percent)) })
    }
    if (progress.status === 'downloaded') return interp(t('rollback.restarting'), { version })
    const error =
      progress.error === 'missing-platform'
        ? t('rollback.errorMissingPlatform')
        : progress.error === 'backup-failed'
          ? t('rollback.errorBackup')
          : (progress.error ?? '')
    return interp(t('rollback.error'), { version, error })
  }

  return (
    <div className="settings-general">
      <div className="settings-general-header">
        <h4>
          <Info size={14} /> {t('settings.about')}
        </h4>
        <p className="settings-hint">{t('about.intro')}</p>
      </div>

      <div className="about-version-card" data-setting="about.installed">
        <div>
          <div className="about-version-label">{t('about.installed')}</div>
          <div className="about-version-number">{appVersion && `v${appVersion}`}</div>
        </div>
        <span className={`about-version-state ${pending ? 'pending' : ''}`}>
          {pending && updateInfo
            ? interp(t('about.updateAvailable'), { version: updateInfo.version })
            : checkAsked && updateStatus === 'checking'
              ? t('about.checking')
              : t('about.upToDate')}
        </span>
        <button
          className="btn ghost small"
          type="button"
          disabled={updateStatus === 'checking'}
          onClick={() => {
            setCheckAsked(true)
            checkUpdates()
          }}
        >
          <RefreshCw size={13} className={updateStatus === 'checking' && checkAsked ? 'spin' : ''} /> {t('about.checkUpdates')}
        </button>
      </div>

      <h4 className="settings-section-title" data-setting="rollback.title">
        <History size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
        {t('rollback.title')}
      </h4>
      <p className="settings-hint">{t('rollback.intro')}</p>

      {blocked && (
        <p className="settings-hint warn rollback-blocked">
          <AlertTriangle size={12} />
          {t(support.reason === 'dev' ? 'rollback.devDisabled' : 'rollback.platformDisabled')}
        </p>
      )}

      {progress.status !== 'idle' && (
        <div className={`rollback-progress ${progress.status === 'error' ? 'error' : ''}`} role="status">
          {switching && <Loader2 size={13} className="spin" />}
          {progress.status === 'error' && <AlertTriangle size={13} />}
          <span>{progressText()}</span>
          {progress.status === 'downloading' && (
            <span className="rollback-progress-bar">
              <span style={{ width: `${Math.round(progress.percent)}%` }} />
            </span>
          )}
          {(progress.status === 'checking' || progress.status === 'downloading') && (
            <button className="btn ghost small" type="button" onClick={() => void cancelSwitch()}>
              {t('common.cancel')}
            </button>
          )}
          {progress.status === 'error' && progress.error === 'missing-platform' && (
            <button className="btn ghost small" type="button" onClick={openReleases}>
              <ExternalLink size={12} /> {t('rollback.openReleases')}
            </button>
          )}
        </div>
      )}

      <div className="rollback-list">
        {releases.status === 'loading' || releases.status === 'idle' ? (
          <p className="settings-hint">
            <Loader2 size={12} className="spin" /> {t('rollback.loading')}
          </p>
        ) : releases.status === 'error' ? (
          <div className="rollback-empty">
            <span>{t(RELEASES_ERROR[releases.reason])}</span>
            <button className="btn ghost small" type="button" onClick={() => void loadReleases()}>
              <RefreshCw size={12} /> {t('rollback.retry')}
            </button>
            <button className="btn ghost small" type="button" onClick={openReleases}>
              <ExternalLink size={12} /> {t('rollback.openReleases')}
            </button>
          </div>
        ) : listed.length === 0 ? (
          <p className="settings-hint">{t('rollback.none')}</p>
        ) : (
          <>
            {listed
              .filter((r) => isRollbackSafe(r.version))
              .map((r) => (
                <div className="rollback-row" key={r.version}>
                  <span className="rollback-version">v{r.version}</span>
                  <span className="rollback-when">{ago(r.publishedAt)}</span>
                  <span className="rollback-summary" title={r.summary}>
                    {r.summary}
                  </span>
                  <button
                    className="btn ghost small"
                    type="button"
                    onClick={() => void shellApi.openExternal(r.url || RELEASES_URL)}
                  >
                    {t('rollback.notes')}
                  </button>
                  <button
                    className="btn small"
                    type="button"
                    disabled={!!blocked || switching || !appVersion}
                    title={blocked ? t(support?.reason === 'dev' ? 'rollback.devDisabled' : 'rollback.platformDisabled') : undefined}
                    onClick={() =>
                      openDialog({ kind: 'version-rollback', target: r.version, current: appVersion, kindOfInstall: support?.kind ?? 'other' })
                    }
                  >
                    <Undo2 size={12} /> {t('rollback.goBack')}
                  </button>
                </div>
              ))}
            {listed.some((r) => !isRollbackSafe(r.version)) && (
              <div className="rollback-unsafe">
                <AlertTriangle size={13} />
                <span>{interp(t('rollback.unsafe'), { version: LAST_UNSAFE_ROLLBACK_VERSION })}</span>
                <button className="btn ghost small" type="button" onClick={openReleases}>
                  <ExternalLink size={12} /> {t('rollback.openReleases')}
                </button>
              </div>
            )}
          </>
        )}
        {blocked && (
          <button className="btn ghost small rollback-releases-btn" type="button" onClick={openReleases}>
            <ExternalLink size={12} /> {t('rollback.openReleases')}
          </button>
        )}
      </div>

      <h4 className="settings-section-title" data-setting="backups.title">
        <RotateCcw size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
        {t('backups.title')}
      </h4>
      <div className="rollback-list">
        {backups.length === 0 ? (
          <p className="settings-hint">{t('backups.empty')}</p>
        ) : (
          backups.map((b) => (
            <div className="backup-row" key={b.name}>
              <span className="backup-text">
                {interp(t(BACKUP_REASON[b.reason]), { version: b.version, target: b.target })}
                <span className="rollback-when"> · {ago(b.createdAt)}</span>
              </span>
              <button className="btn ghost small" type="button" onClick={() => confirmRestore(b)}>
                {t('backups.restore')}
              </button>
              <button className="btn ghost small" type="button" onClick={() => void settingsBackupsApi.reveal(b.name)}>
                <FolderOpen size={12} /> {t('backups.reveal')}
              </button>
            </div>
          ))
        )}
      </div>
      <p className="settings-hint">{interp(t('backups.hint'), { count: String(BACKUPS_KEPT) })}</p>
    </div>
  )
}
