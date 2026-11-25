import { useState } from 'react'
import { AlertTriangle, Bug, KeyRound, Undo2 } from 'lucide-react'
import { useT, interp } from '../i18n'
import { useUIStore, type ModalSpec } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { useRollbackStore } from '../stores/rollback'
import { keysUnknownTo } from '../../../shared/settingsFormat'
import { rollbackIssueUrl } from '../lib/issueReport'
import { shellApi } from '../infrastructure/api'

type Spec = Extract<ModalSpec, { kind: 'version-rollback' }>

/**
 * The confirmation before going back a version (Settings → About → Previous
 * versions): what happens, in order, what the older version will not know, and
 * what may happen to saved tokens. Stacked over Settings, like the other dialogs
 * asked from there.
 */
export function RollbackConfirmDialog({ spec, onClose }: { spec: Spec; onClose?: () => void }): React.JSX.Element {
  const t = useT()
  const storeClose = useUIStore((s) => s.closeModal)
  const close = onClose ?? storeClose
  const settings = useSettingsStore((s) => s.settings)
  const start = useRollbackStore((s) => s.start)
  const [showNotes, setShowNotes] = useState(true)
  const { target, current } = spec
  // Only the keys this build knows a target lacks (`SETTINGS_FORMATS`); otherwise said in general.
  const unknown = keysUnknownTo(target, settings)

  return (
    <div className="rollback-confirm">
      <h3>
        <Undo2 size={16} /> {interp(t('rollback.confirmTitle'), { version: target })}
        <span className="beta-badge">{t('rollback.beta')}</span>
      </h3>
      <div className="rollback-last-resort" role="note">
        <AlertTriangle size={15} />
        <div>
          <strong>{t('rollback.lastResortTitle')}</strong>
          <p>{t('rollback.lastResortText')}</p>
          <p>{t('rollback.reportFirst')}</p>
          <button
            className="btn ghost small rollback-report-btn"
            type="button"
            onClick={() => void shellApi.openExternal(rollbackIssueUrl(current, target))}
          >
            <Bug size={12} /> {t('rollback.report')}
          </button>
        </div>
      </div>
      <p className="rollback-confirm-lead">{interp(t('rollback.confirmLead'), { current, version: target })}</p>

      <ol className="rollback-steps">
        <li>{t('rollback.stepBackup')}</li>
        <li>{interp(t('rollback.stepInstall'), { version: target })}</li>
        <li>{interp(t('rollback.stepSkip'), { current })}</li>
      </ol>

      <div className="rollback-note">
        <AlertTriangle size={14} />
        <div>
          <strong>{t('rollback.unknownKeysTitle')}</strong>
          <p>
            {unknown.length > 0
              ? interp(t('rollback.unknownKeysList'), { version: target, keys: unknown.join(', ') })
              : interp(t('rollback.unknownKeysGeneral'), { version: target })}
          </p>
        </div>
      </div>

      <div className="rollback-note">
        <KeyRound size={14} />
        <p>{interp(t('rollback.tokensWarning'), { version: target })}</p>
      </div>

      {spec.kindOfInstall === 'deb' && <p className="settings-hint">{t('rollback.debInstall')}</p>}

      <label className="rollback-notes-check">
        <input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} />
        {interp(t('rollback.showNotes'), { version: target })}
      </label>

      <div className="modal-actions">
        <button className="btn ghost" type="button" onClick={close}>
          {t('common.cancel')}
        </button>
        <button
          className="btn primary"
          type="button"
          autoFocus
          onClick={() => {
            close()
            void start(target, showNotes)
          }}
        >
          {interp(t('rollback.confirm'), { version: target })}
        </button>
      </div>
    </div>
  )
}
