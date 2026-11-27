import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BarChart3, Settings, Sparkles } from 'lucide-react'
import type { DetectedCli } from '../../../shared/types'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { aiApi } from '../infrastructure/api'
import { interp, useT } from '../i18n'
import { ACCOUNT_STATUS_LABEL, type AccountStatusView } from '../lib/aiAccountDraft'
import { aiStatusView, inUsePatch, needsCliDetection, type AIStatusRow } from '../lib/aiStatusBar'
import { useModelCatalogs } from './useModelCatalogs'

interface PopoverPosition {
  left: number
  bottom: number
  width: number
  maxHeight: number
}

const POPOVER_WIDTH = 340

function StatusDot({ status, label }: { status: AccountStatusView['status']; label: string }): React.JSX.Element {
  return <span className={`ai-chip-dot ${status}`} role="img" aria-label={label} title={label} />
}

/**
 * The AI the active profile answers with, always in view. A profile with its
 * own AI ignores the general default, and until this the only place that said
 * so was the AI page in Settings — so "I changed the default and nothing
 * changed" had no visible answer. The popover names the scope and switches the
 * account in use within it.
 *
 * Status comes from the model lists the catalogs fetch anyway (cached a day on
 * disk by main) and the CLI detection; nothing here polls.
 */
export function AIStatusChip({ repoPath }: { repoPath: string }): React.JSX.Element | null {
  const t = useT()
  const ai = useSettingsStore((s) => s.activeAI())
  const profile = useSettingsStore((s) => s.activeProfile())
  const keysKnown = useSettingsStore((s) => s.unlocked)
  const saveAIFor = useSettingsStore((s) => s.saveAIFor)
  const openModal = useUIStore((s) => s.openModal)
  const { catalogs } = useModelCatalogs(ai)
  const [clis, setClis] = useState<DetectedCli[] | null>(null)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const wantsDetection = needsCliDetection(ai)
  useEffect(() => {
    if (!wantsDetection || clis) return
    let live = true
    // A failed detection reads as "nothing found" rather than leaving the
    // chip waiting for an answer that never comes.
    void aiApi
      .detectCli()
      .catch(() => [])
      .then((found) => {
        if (live) setClis(found)
      })
    return () => {
      live = false
    }
  }, [wantsDetection, clis])

  const closePopover = (restoreFocus: boolean): void => {
    setPosition(null)
    if (restoreFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!position) return
    // Focus lands inside, on the first action, so the keyboard can reach it.
    popoverRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
    const onMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      closePopover(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closePopover(true)
      }
    }
    const onResize = (): void => closePopover(false)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onResize)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('blur', onResize)
    }
    // Only on opening: re-focusing on every render would steal focus from the rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position !== null])

  const view = aiStatusView(ai, profile, { catalogs, clis: wantsDetection ? clis : [], keysKnown })
  if (!view) return null

  const togglePopover = (): void => {
    if (position) {
      closePopover(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const bottom = window.innerHeight - rect.top + 6
    setPosition({ left, bottom, width, maxHeight: rect.top - 14 })
  }

  const putInUse = (row: AIStatusRow): void => {
    const patch = inUsePatch(ai, row.id)
    // Through `saveAIFor`, so it lands where this profile reads its AI.
    if (patch) saveAIFor(profile.id, patch)
  }

  const openPage = (open: () => void): void => {
    closePopover(false)
    open()
  }

  const reasonOf = (status: AccountStatusView): string =>
    status.reasonKey ? t(status.reasonKey) : (status.detail ?? '')

  const inUseStatus = t(ACCOUNT_STATUS_LABEL[view.inUse.status.status])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="status-issue-btn status-ai-btn"
        title={interp(t('aiStatus.buttonTitle'), { account: view.inUse.label, status: inUseStatus })}
        aria-haspopup="dialog"
        aria-expanded={position !== null}
        onClick={togglePopover}
      >
        <span className={`ai-chip-dot ${view.inUse.status.status}`} aria-hidden="true" />
        <span>{interp(t('aiStatus.button'), { account: view.inUse.label })}</span>
      </button>
      {/* The separator rides with the chip, so a hidden chip leaves no double rule. */}
      <span className="status-sep" />

      {position &&
        createPortal(
          <div
            ref={popoverRef}
            className="ai-chip-popover"
            role="dialog"
            aria-label={t('aiStatus.heading')}
            onBlur={(event) => {
              // Tabbing out of the popover closes it, the way a menu does.
              const next = event.relatedTarget as Node | null
              if (next && !popoverRef.current?.contains(next) && next !== triggerRef.current) closePopover(false)
            }}
            style={{ left: position.left, bottom: position.bottom, width: position.width, maxHeight: position.maxHeight }}
          >
            <header className="ai-chip-head">
              <div className="ai-chip-eyebrow">
                <Sparkles size={11} />
                <span>{t('aiStatus.heading')}</span>
                <span aria-hidden="true">·</span>
                <span className="ai-chip-profile">{interp(t('aiStatus.profile'), { profile: profile.name })}</span>
              </div>
              <p className="ai-chip-scope">
                {t(view.scope === 'general' ? 'aiStatus.followsGeneral' : 'aiStatus.ownAI')}
              </p>
            </header>

            <ul className="ai-chip-rows">
              {view.rows.map((row) => {
                const reason = row.status.status === 'failing' ? reasonOf(row.status) : ''
                return (
                  <li key={row.id} className={`ai-chip-row ${row.role === 'in-use' ? 'in-use' : ''}`}>
                    <StatusDot status={row.status.status} label={t(ACCOUNT_STATUS_LABEL[row.status.status])} />
                    <div className="ai-chip-row-text">
                      <span className="ai-chip-row-name">
                        {interp(t('aiStatus.row'), { label: row.label, model: row.model })}
                      </span>
                      {reason && <span className="ai-chip-row-reason">{reason}</span>}
                    </div>
                    {row.role === 'in-use' ? (
                      <span className="ai-chip-in-use" title={t('settings.accountInUseTitle')}>
                        {t('settings.accountInUse')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn small ai-chip-use"
                        title={interp(t('settings.accountUseTitle'), { name: row.label })}
                        onClick={() => putInUse(row)}
                      >
                        {t('settings.accountUse')}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>

            <footer className="ai-chip-foot">
              <button
                type="button"
                className="ai-chip-link"
                onClick={() => openPage(() => openModal({ kind: 'settings', page: 'ai' }))}
              >
                <Settings size={12} /> {t('aiStatus.configure')}
              </button>
              <button
                type="button"
                className="ai-chip-link"
                onClick={() => openPage(() => openModal({ kind: 'repo-settings', repoPath, tab: 'analytics' }))}
              >
                <BarChart3 size={12} /> {t('aiStatus.usage')}
              </button>
            </footer>
          </div>,
          document.body
        )}
    </>
  )
}
