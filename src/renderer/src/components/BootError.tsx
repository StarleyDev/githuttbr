import { useState } from 'react'
import { interp, useT } from '../i18n'
import { SettingsLoadError, settingsApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import type { MoveAsideReply, SettingsErrorKind } from '../../../shared/types'

/** What the boot screen should say for a failed settings load. */
export function bootErrorKind(err: unknown): SettingsErrorKind {
  return err instanceof SettingsLoadError ? err.kind : 'other'
}

/**
 * The data folder to name when main refused to move the file because the
 * tokens could not be backed up first, or null: then a retry tells what happened.
 */
export function moveAsideRefusedDir(reply: MoveAsideReply | undefined): string | null {
  return reply && typeof reply === 'object' && reply.refused === 'secrets-copy' ? reply.dir : null
}

/** Where the damaged file went (beside a symlink's target, not the link), or null when it was not moved. */
export function movedAsidePath(reply: MoveAsideReply | undefined): string | null {
  return typeof reply === 'string' ? reply : null
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
  const [refusedDir, setRefusedDir] = useState<string | null>(null)

  const moveAside = async (): Promise<void> => {
    setMoving(true)
    let reply: MoveAsideReply | undefined
    try {
      // Renamed, never deleted; null means it parses now (or cannot be read),
      // and the retry below tells which.
      reply = await settingsApi.moveAside()
    } catch (err) {
      console.warn('[settings] could not move the settings file aside:', err)
    }
    setMoving(false)
    const dir = moveAsideRefusedDir(reply)
    // Nothing moved and the file is still damaged: a silent retry would only
    // bring this same screen back. Say why, and leave Try again to the user.
    if (dir !== null) return setRefusedDir(dir)
    // Toasted, not shown here: the retry below replaces this screen with the app.
    const moved = movedAsidePath(reply)
    if (moved !== null) useUIStore.getState().toast('info', interp(t('app.settingsMovedAside'), { path: moved }))
    onRetry()
  }

  return (
    <div className="boot-error">
      <p>{kind === 'parse' ? t('app.settingsUnreadable') : t('app.settingsLoadFailed')}</p>
      {refusedDir !== null && <p role="alert">{interp(t('app.settingsMoveAsideRefused'), { dir: refusedDir })}</p>}
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
