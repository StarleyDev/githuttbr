import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bug, History, RotateCcw, X } from 'lucide-react'
import { useT, interp } from '../i18n'
import { useRollbackStore } from '../stores/rollback'
import { useSettingsStore } from '../stores/settings'
import { rollbackIssueUrl } from '../lib/issueReport'
import { shellApi } from '../infrastructure/api'

/**
 * What a version switch leaves on screen afterwards (see docs/help/rollback.md):
 *
 * - on the older version, a band saying where the user came from and that the
 *   version left is not offered again, with a pre-filled report;
 * - on a newer version, once past the rollback, the question whether to bring
 *   back the settings copied before going back — only when they changed since.
 */
export function RollbackNotices(): React.JSX.Element {
  const t = useT()
  const init = useRollbackStore((s) => s.init)
  const appVersion = useRollbackStore((s) => s.appVersion)
  const prompt = useRollbackStore((s) => s.restorePrompt)
  const answer = useRollbackStore((s) => s.answerRestore)
  const dismiss = useRollbackStore((s) => s.dismissNotice)
  const record = useSettingsStore((s) => s.settings.versionRollback)

  // Main's switch events reach the store from start-up: a download can finish
  // with Settings closed, and the restart must still follow.
  useEffect(() => init(), [init])

  const showBand = !!record && !record.noticeDismissed && !!appVersion && record.to === appVersion

  return (
    <>
      {showBand && record && (
        <div className="rollback-band" role="status">
          <History size={14} />
          <span>{interp(t('rollback.noticeText'), { from: record.from, to: record.to })}</span>
          <button
            className="btn ghost small"
            type="button"
            onClick={() => void shellApi.openExternal(rollbackIssueUrl(record.from, record.to))}
          >
            <Bug size={12} /> {t('rollback.report')}
          </button>
          <button
            className="rollback-band-close"
            type="button"
            title={t('common.close')}
            aria-label={t('common.close')}
            onClick={dismiss}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <AnimatePresence>
        {prompt && (
          <motion.div
            className="update-banner rollback-restore"
            role="dialog"
            aria-label={t('rollback.restoreTitle')}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          >
            <div className="update-banner-head">
              <span className="update-banner-icon">
                <RotateCcw size={18} />
              </span>
              <div className="update-banner-text">
                <span className="rollback-eyebrow">{t('rollback.restoreEyebrow')}</span>
                <strong>{t('rollback.restoreTitle')}</strong>
              </div>
            </div>
            <p className="update-banner-sub">
              {interp(t('rollback.restoreBody'), { on: prompt.on, count: prompt.changed })}
            </p>
            <div className="update-banner-actions">
              <button className="update-btn update-btn-primary" type="button" onClick={() => void answer(true)}>
                {t('rollback.restoreYes')}
              </button>
              <button className="update-btn update-btn-ghost" type="button" onClick={() => void answer(false)}>
                {t('rollback.restoreNo')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
