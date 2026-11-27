import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, CloudUpload, FilePen, GitBranch, Settings, ShieldCheck, Sparkles } from 'lucide-react'
import type { AIConfig } from '../../../shared/types'
import { modelFor } from '../../../shared/aiAccounts'
import { interp, useT } from '../i18n'
import { ACCOUNT_STATUS_LABEL, type AccountStatus } from '../lib/aiAccountDraft'
import { chatCapabilities, fileEditsAllowed } from '../lib/aiBehaviour'
import {
  CHAT_APPROVALS,
  approvalPillKey,
  chatCapabilityTags,
  chatModelMenu,
  chatModelPill,
  isChatModelChosen,
  withChatModel
} from '../lib/repoChatHeader'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { useModelCatalogs } from './useModelCatalogs'

type PillId = 'model' | 'caps' | 'approval'

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled)'

/** Up/Down move between a menu's rows; Home/End jump. Tab is left alone. */
function moveFocus(event: React.KeyboardEvent<HTMLElement>): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (!items.length) return
  event.preventDefault()
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}

function StatusDot({ status }: { status: AccountStatus }): React.JSX.Element {
  return <span className={`repo-chat-dot ${status}`} aria-hidden="true" />
}

function Toggle({
  checked,
  disabled,
  labelledBy,
  onChange
}: {
  checked: boolean
  disabled?: boolean
  labelledBy: string
  onChange: (next: boolean) => void
}): React.JSX.Element {
  return (
    <label className={`ai-switch${disabled ? ' disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-labelledby={labelledBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="settings-toggle-control" aria-hidden="true">
        <span className="settings-toggle-thumb" />
      </span>
    </label>
  )
}

/**
 * The three pills under the chat's title: who answers, what the chat may do,
 * and how its proposals run. Each opens a small popover writing the same
 * settings as Settings → AI, through the same `saveAIFor` — so the chat and
 * Settings never disagree about what the AI may do.
 */
export function RepoChatPills({ ai, profileId }: { ai: AIConfig; profileId: string }): React.JSX.Element {
  const t = useT()
  const ids = useId()
  const saveAIFor = useSettingsStore((state) => state.saveAIFor)
  const openModal = useUIStore((state) => state.openModal)
  const { catalogs } = useModelCatalogs(ai)
  const [open, setOpen] = useState<PillId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggers = useRef<Partial<Record<PillId, HTMLButtonElement | null>>>({})
  const popRef = useRef<HTMLDivElement>(null)

  const close = (refocus: boolean): void => {
    const was = open
    setOpen(null)
    if (refocus && was) triggers.current[was]?.focus()
  }

  useEffect(() => {
    if (!open) return
    // Land on the chosen row when there is one, so Enter keeps the choice.
    requestAnimationFrame(() => {
      const pop = popRef.current
      const target =
        pop?.querySelector<HTMLElement>('[aria-checked="true"]') ?? pop?.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    })
    const onMouseDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null)
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const pill = chatModelPill(ai, catalogs)
  const groups = open === 'model' ? chatModelMenu(ai, catalogs) : []
  const can = chatCapabilities(ai)
  const abilities = chatCapabilityTags(ai)
    .map((key) => t(key))
    .join(' · ') // i18n-ignore list separator between translated tags
  const statusText = t(ACCOUNT_STATUS_LABEL[pill.status])
  const modelText = pill.account ? `${pill.account} · ${pill.model}` : pill.model // i18n-ignore account and model names

  const toggle = (id: PillId): void => setOpen((current) => (current === id ? null : id))
  const pickModel = (accountId: string, model: string): void => {
    saveAIFor(profileId, { assignments: withChatModel(ai, accountId, model) })
    close(true)
  }
  const pickApproval = (repoChatApproval: AIConfig['repoChatApproval']): void => {
    saveAIFor(profileId, { repoChatApproval })
    close(true)
  }

  const trigger = (id: PillId, label: string, content: React.ReactNode, popupRole: 'menu' | 'dialog'): React.JSX.Element => (
    <button
      ref={(el) => {
        triggers.current[id] = el
      }}
      type="button"
      className={`repo-chat-pill ${id}${open === id ? ' open' : ''}`}
      aria-haspopup={popupRole}
      aria-expanded={open === id}
      aria-controls={open === id ? `${ids}-${id}` : undefined}
      title={label}
      onClick={() => toggle(id)}
    >
      {content}
      <ChevronDown size={11} className="repo-chat-pill-caret" aria-hidden="true" />
    </button>
  )

  return (
    <div
      ref={rootRef}
      className="repo-chat-pills"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          close(true)
        }
      }}
    >
      {trigger(
        'model',
        interp(t('chat.modelPillTitle'), { model: modelText, status: statusText }),
        <>
          <StatusDot status={pill.status} />
          <span className="repo-chat-pill-text">{modelText}</span>
        </>,
        'menu'
      )}
      {trigger(
        'caps',
        t('chat.capsPillTitle'),
        <>
          <Sparkles size={11} aria-hidden="true" />
          <span className="repo-chat-pill-text">{interp(t('chat.canPill'), { abilities })}</span>
        </>,
        'dialog'
      )}
      {/* Approval only means something while the chat can propose actions. */}
      {can.git &&
        trigger(
          'approval',
          t('chat.approvalTitle'),
          <>
            <ShieldCheck size={11} aria-hidden="true" />
            <span className="repo-chat-pill-text">{t(approvalPillKey(ai))}</span>
          </>,
          'menu'
        )}

      {open === 'model' && (
        <div
          ref={popRef}
          id={`${ids}-model`}
          className="repo-chat-pop model"
          role="menu"
          aria-label={t('chat.modelLabel')}
          onKeyDown={moveFocus}
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isChatModelChosen(ai, '', '')}
            className="repo-chat-pop-item"
            onClick={() => pickModel('', '')}
          >
            <Check size={12} className="repo-chat-pop-check" aria-hidden="true" />
            <span>{interp(t('chat.modelDefault'), { model: modelFor(ai) })}</span>
          </button>
          {groups.map((group) => (
            <div key={group.accountId} role="group" aria-labelledby={`${ids}-g-${group.accountId}`}>
              <div className="repo-chat-pop-heading" id={`${ids}-g-${group.accountId}`}>
                <StatusDot status={group.status} />
                <span>{group.label}</span>
                <small>{t(ACCOUNT_STATUS_LABEL[group.status])}</small>
              </div>
              {group.models.map((model) => {
                const chosen = isChatModelChosen(ai, group.accountId, model)
                return (
                  <button
                    key={model}
                    type="button"
                    role="menuitemradio"
                    aria-checked={chosen}
                    className="repo-chat-pop-item"
                    onClick={() => pickModel(group.accountId, model)}
                  >
                    <Check size={12} className="repo-chat-pop-check" aria-hidden="true" />
                    <span>{model}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {open === 'caps' && (
        <div
          ref={popRef}
          id={`${ids}-caps`}
          className="repo-chat-pop caps"
          role="dialog"
          aria-label={t('chat.capsPillTitle')}
        >
          <ul className="repo-chat-perms">
            <li>
              <GitBranch size={13} aria-hidden="true" />
              <span id={`${ids}-git`}>{t('settings.repoChatGitActions')}</span>
              <Toggle
                checked={can.git}
                labelledBy={`${ids}-git`}
                onChange={(repoChatActions) => saveAIFor(profileId, { repoChatActions })}
              />
            </li>
            <li className={can.git ? '' : 'disabled'}>
              <FilePen size={13} aria-hidden="true" />
              <span id={`${ids}-files`}>{t('settings.repoChatFiles')}</span>
              {/* The inverse of the stored `repoChatReadOnly`, as in Settings. */}
              <Toggle
                checked={fileEditsAllowed(ai)}
                disabled={!can.git}
                labelledBy={`${ids}-files`}
                onChange={(allowed) => saveAIFor(profileId, { repoChatReadOnly: !allowed })}
              />
            </li>
            <li className={can.git ? '' : 'disabled'}>
              <CloudUpload size={13} aria-hidden="true" />
              <span id={`${ids}-remote`}>{t('settings.repoChatRemote')}</span>
              <Toggle
                checked={ai.repoChatRemoteActions === true}
                disabled={!can.git}
                labelledBy={`${ids}-remote`}
                onChange={(repoChatRemoteActions) => saveAIFor(profileId, { repoChatRemoteActions })}
              />
            </li>
          </ul>
          <button
            type="button"
            className="repo-chat-pop-link"
            onClick={() => {
              setOpen(null)
              openModal({ kind: 'settings', page: 'ai' })
            }}
          >
            <Settings size={12} aria-hidden="true" /> {t('chat.allChatSettings')}
          </button>
        </div>
      )}

      {open === 'approval' && (
        <div
          ref={popRef}
          id={`${ids}-approval`}
          className="repo-chat-pop approval"
          role="menu"
          aria-label={t('chat.approvalTitle')}
          onKeyDown={moveFocus}
        >
          {CHAT_APPROVALS.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="menuitemradio"
              aria-checked={can.approval === mode.id}
              className="repo-chat-pop-item two-line"
              onClick={() => pickApproval(mode.id)}
            >
              <Check size={12} className="repo-chat-pop-check" aria-hidden="true" />
              <span>
                <strong>{t(mode.key)}</strong>
                <small>{t(mode.hint)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
