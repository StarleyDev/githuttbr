import { useState } from 'react'
import { useT } from '../i18n'
import { SettingsLoadError, settingsApi } from '../infrastructure/api'
import type { SettingsErrorKind } from '../../../shared/types'

/** What the boot screen should say for a failed settings load. */
export function bootErrorKind(err: unknown): SettingsErrorKind {
  return err instanceof SettingsLoadError ? err.kind : 'other'
}

/**
 * Shown instead of the app when the settings could not be loaded. Only a file
 * that really does not parse is called damaged — a locked file or a failed IPC
 * call is usually gone on a retry, and telling that user their settings are
 * broken invites them to delete a healthy file.
 */
export function BootError({ kind, onRetry }: { kind: SettingsErrorKind; onRetry: () => void }): React.JSX.Element {
  const t = useT()
  const [moving, setMoving] = useState(false)

  const moveAside = async (): Promise<void> => {
    setMoving(true)
    try {
      // Renamed, never deleted; null means it parses now (or cannot be read),
      // and the retry below tells which.
      await settingsApi.moveAside()
    } catch (err) {
      console.warn('[settings] could not move the settings file aside:', err)
    } finally {
      setMoving(false)
      onRetry()
    }
  }

  return (
    <div className="boot-error">
      <p>{kind === 'parse' ? t('app.settingsUnreadable') : t('app.settingsLoadFailed')}</p>
      <div className="boot-error-actions">
        <button className="btn primary" onClick={onRetry} disabled={moving}>
          {t('app.settingsRetry')}
        </button>
        {kind === 'parse' && (
          <button className="btn ghost" onClick={() => void moveAside()} disabled={moving}>
            {t('app.settingsMoveAside')}
          </button>
        )}
      </div>
    </div>
  )
}
