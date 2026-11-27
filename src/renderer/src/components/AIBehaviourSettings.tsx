import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Bot, CloudUpload, Eye, FilePen, GitBranch, GitCommit, GitMerge, Lock, MessageSquare, ShieldCheck } from 'lucide-react'
import { interp, useT, useUiLanguage, type TranslationKey } from '../i18n'
import { useSettingsStore } from '../stores/settings'
import {
  APP_COAUTHOR,
  type AIConfig,
  type BranchNamingStyle,
  type ChatActionApproval,
  type CommitStyle,
  type ConflictStyle,
  type ExplainStyle,
  type HoverModifier
} from '../../../shared/types'
import {
  EXPLAIN_STYLE_NAMES,
  FEATURED_COMMIT_STYLES,
  behaviourScopeLine,
  branchNameExample,
  chatCapabilities,
  chatSummary,
  commitPreview,
  commitStyleExample,
  conflictExample,
  fileEditsAllowed,
  isFeaturedCommitStyle,
  withFileEdits
} from '../lib/aiBehaviour'

const MORE_COMMIT_STYLES: { id: CommitStyle; key: TranslationKey }[] = [
  { id: 'auto', key: 'commitStyle.auto' },
  { id: 'gitmoji-conventional', key: 'commitStyle.gitmojiConventional' },
  { id: 'plain', key: 'commitStyle.plain' },
  { id: 'caveman', key: 'commitStyle.caveman' },
  { id: 'haiku', key: 'commitStyle.haiku' }
]

const HOVER_MODIFIERS: { id: HoverModifier; key: TranslationKey }[] = [
  { id: 'shift', key: 'hoverKey.shift' },
  { id: 'alt', key: 'hoverKey.alt' },
  { id: 'ctrl', key: 'hoverKey.ctrl' },
  { id: 'meta', key: 'hoverKey.meta' },
  { id: 'none', key: 'hoverKey.none' }
]

const CONFLICT_STYLES: { id: ConflictStyle; key: TranslationKey }[] = [
  { id: 'clean', key: 'conflictStyle.clean' },
  { id: 'commented', key: 'conflictStyle.commented' },
  { id: 'conservative', key: 'conflictStyle.conservative' }
]

const BRANCH_NAMING_STYLES: { id: BranchNamingStyle; key: TranslationKey }[] = [
  { id: 'prefix/description', key: 'branchNamingStyle.prefix/description' },
  { id: 'prefix/ticket-description', key: 'branchNamingStyle.prefix/ticket-description' },
  { id: 'username/prefix/description', key: 'branchNamingStyle.username/prefix/description' },
  { id: 'plain', key: 'branchNamingStyle.plain' }
]

const APPROVALS: { id: ChatActionApproval; key: TranslationKey; hint: TranslationKey }[] = [
  { id: 'ask', key: 'chat.approvalAsk', hint: 'settings.approvalAskHint' },
  { id: 'auto-safe', key: 'chat.approvalSafe', hint: 'settings.approvalSafeHint' },
  { id: 'auto-all', key: 'chat.approvalAll', hint: 'settings.approvalAllHint' }
]

/**
 * A single choice drawn as buttons, with radio-group semantics: one tab stop,
 * arrow keys move and select, Home/End jump. Used for the commit style cards,
 * the explain pills and the approval cards.
 */
function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  itemClassName,
  disabled,
  children
}: {
  label: string
  value: T | undefined
  options: readonly T[]
  onChange: (next: T) => void
  className: string
  itemClassName: string
  disabled?: boolean
  children: (id: T) => ReactNode
}): React.JSX.Element {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const at = value === undefined ? -1 : options.indexOf(value)
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number): void => {
    // Left and right swap in a right-to-left layout, as the eye reads them.
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    const step: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1
    }
    let next: number
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else if (e.key in step) next = (i + step[e.key] + options.length) % options.length
    else return
    e.preventDefault()
    onChange(options[next])
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((id, i) => (
        <button
          key={id}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={id === value}
          tabIndex={i === (at >= 0 ? at : 0) ? 0 : -1}
          className={`${itemClassName}${id === value ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {children(id)}
        </button>
      ))}
    </div>
  )
}

/** A bare on/off switch, for rows whose title sits elsewhere. */
function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  disabled
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  labelledBy?: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <label className={`ai-switch${disabled ? ' disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-labelledby={labelledBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="settings-toggle-control" aria-hidden="true">
        <span className="settings-toggle-thumb" />
      </span>
    </label>
  )
}

/** A sentence with one control in it, where `{token}` sits in the translation. */
function SentenceWith({ template, token, children }: { template: string; token: string; children: ReactNode }): React.JSX.Element {
  const [before, after = ''] = template.split(`{${token}}`)
  return (
    <>
      {before}
      {children}
      {after}
    </>
  )
}

/**
 * How one AI writes and what its chat may do — the half of the AI page below
 * the accounts. Only presentation lives here: every control writes the same
 * `AIConfig` field it always did, so saved settings read the same.
 */
export function AIBehaviourSettings({
  ai,
  onChange,
  scope
}: {
  ai: AIConfig
  onChange: (next: AIConfig) => void
  /** `general` or `profile:<id>`; onboarding passes none and gets no scope line. */
  scope?: string
}): React.JSX.Element {
  const t = useT()
  const lang = useUiLanguage()
  const profiles = useSettingsStore((s) => s.settings.profiles)
  const ids = useId()
  const list = (items: string[]): string => new Intl.ListFormat(lang, { type: 'conjunction' }).format(items)

  const scopeLine = behaviourScopeLine(scope, profiles)
  const featured = isFeaturedCommitStyle(ai.commitStyle)
  const can = chatCapabilities(ai)
  const summary = chatSummary(ai)
  const hoverOn = ai.hoverExplain !== false
  const hoverKey = ai.hoverExplainKey ?? 'shift'
  const explain = EXPLAIN_STYLE_NAMES.find((s) => s.id === (ai.explainStyle ?? 'normal')) ?? EXPLAIN_STYLE_NAMES[0]

  return (
    <div className="ai-behaviour">
      {scopeLine && (
        <p className="ai-behaviour-scope" role="note">
          {interp(t(scopeLine.key), { profile: scopeLine.profile ?? '', profiles: list(scopeLine.profiles) })}
        </p>
      )}

      <section className="ai-card">
        <h4><GitCommit size={14} /> {t('settings.aiSectionCommits')}</h4>
        <div className="settings-field" data-setting="settings.commitStyle">
          <span className="settings-field-label">{t('settings.commitStyle')}</span>
          <div className="ai-style-row">
            <ChoiceGroup
              label={t('settings.commitStyle')}
              value={featured ? ai.commitStyle : undefined}
              options={FEATURED_COMMIT_STYLES.map((s) => s.id)}
              onChange={(commitStyle) => onChange({ ...ai, commitStyle })}
              className="ai-style-cards"
              itemClassName="ai-style-card"
            >
              {(id) => (
                <>
                  <strong>{t(FEATURED_COMMIT_STYLES.find((s) => s.id === id)?.nameKey ?? 'commitStyleName.conventional')}</strong>
                  <code>{commitStyleExample(id)}</code>
                </>
              )}
            </ChoiceGroup>
            <label className={`ai-style-card more${featured ? '' : ' active'}`}>
              <select
                aria-label={t('settings.commitStyleMore')}
                value={featured ? '' : ai.commitStyle}
                onChange={(e) => e.target.value && onChange({ ...ai, commitStyle: e.target.value as CommitStyle })}
              >
                {featured && <option value="" disabled hidden>{t('settings.commitStyleMore')}</option>}
                {MORE_COMMIT_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(s.key)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span className="settings-hint">{t('settings.commitStyleHint')}</span>
        </div>

        <div className="settings-grid two">
          <label className="settings-toggle-card">
            <input
              type="checkbox"
              checked={ai.generateDescription}
              onChange={(e) => onChange({ ...ai, generateDescription: e.target.checked })}
            />
            <span className="settings-toggle-control" aria-hidden="true">
              <span className="settings-toggle-thumb" />
            </span>
            <span className="settings-toggle-copy">
              <strong>{t('settings.generateDescription')}</strong>
              <span className="settings-hint">{t('settings.generateDescriptionHint')}</span>
            </span>
          </label>
          <label className="settings-toggle-card">
            <input
              type="checkbox"
              checked={ai.coAuthor !== false}
              onChange={(e) => onChange({ ...ai, coAuthor: e.target.checked })}
            />
            <span className="settings-toggle-control" aria-hidden="true">
              <span className="settings-toggle-thumb" />
            </span>
            <span className="settings-toggle-copy">
              <strong>{t('settings.coAuthor')}</strong>
              <span className="settings-hint">{t('settings.coAuthorHint')}</span>
            </span>
          </label>
        </div>

        {/* The stored field is still `customInstructions`; only commit generation reads it. */}
        <label className="settings-field">
          <span className="settings-field-label">{t('settings.commitRules')}</span>
          <span className="settings-hint">{t('settings.commitRulesHint')}</span>
          <textarea
            rows={3}
            value={ai.customInstructions}
            placeholder={t('settings.customInstructionsPlaceholder')}
            onChange={(e) => onChange({ ...ai, customInstructions: e.target.value })}
          />
        </label>

        <div className="settings-field ai-preview" data-setting="settings.commitPreview">
          <span className="settings-field-label">{t('settings.commitPreview')}</span>
          <pre className="ai-preview-message">{commitPreview(ai, APP_COAUTHOR)}</pre>
          <span className="settings-hint">{t('settings.commitPreviewHint')}</span>
        </div>
      </section>

      <section className="ai-card">
        <h4><MessageSquare size={14} /> {t('settings.aiSectionExplain')}</h4>
        <div className="settings-field" data-setting="settings.explainStyle">
          <span className="settings-field-label">{t('settings.explainStyle')}</span>
          <ChoiceGroup
            label={t('settings.explainStyle')}
            value={explain.id}
            options={EXPLAIN_STYLE_NAMES.map((s) => s.id)}
            onChange={(explainStyle: ExplainStyle) => onChange({ ...ai, explainStyle })}
            className="ai-pills"
            itemClassName="ai-pill"
          >
            {(id) => t(EXPLAIN_STYLE_NAMES.find((s) => s.id === id)?.nameKey ?? 'explainStyleName.normal')}
          </ChoiceGroup>
          <span className="settings-hint">{t(explain.key)}</span>
        </div>

        <div className="ai-hover-row" data-setting="settings.hoverExplain">
          <Switch checked={hoverOn} label={t('settings.hoverExplain')} onChange={(hoverExplain) => onChange({ ...ai, hoverExplain })} />
          <span className="settings-toggle-copy">
            <span className="ai-hover-sentence">
              <SentenceWith
                template={t(hoverKey === 'none' ? 'settings.hoverExplainNoKey' : 'settings.hoverExplainWhile')}
                token="key"
              >
                <select
                  className="ai-kbd"
                  data-setting="settings.hoverExplainKey"
                  aria-label={t('settings.hoverExplainKey')}
                  value={hoverKey}
                  disabled={!hoverOn}
                  onChange={(e) => onChange({ ...ai, hoverExplainKey: e.target.value as HoverModifier })}
                >
                  {HOVER_MODIFIERS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {t(m.key)}
                    </option>
                  ))}
                </select>
              </SentenceWith>
            </span>
            <span className="settings-hint">{t('settings.hoverExplainHint')}</span>
          </span>
        </div>
      </section>

      <section className="ai-card">
        <h4><GitMerge size={14} /> {t('settings.aiSectionBranches')}</h4>
        <div className="settings-grid two">
          <label className="settings-field">
            <span className="settings-field-label">{t('settings.conflictStyle')}</span>
            <span className="settings-hint">{t('settings.conflictStyleHint')}</span>
            <select
              value={ai.conflictStyle ?? 'clean'}
              onChange={(e) => onChange({ ...ai, conflictStyle: e.target.value as ConflictStyle })}
            >
              {CONFLICT_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.key)}
                </option>
              ))}
            </select>
            <span className="ai-example">
              <span className="ai-example-label">{t('settings.styleExample')}</span>
              <pre>{conflictExample(ai.conflictStyle)}</pre>
            </span>
          </label>
          <label className="settings-field">
            <span className="settings-field-label">{t('settings.branchNamingStyle')}</span>
            <span className="settings-hint">{t('settings.branchNamingStyleHint')}</span>
            <select
              value={ai.branchNamingStyle ?? 'prefix/description'}
              onChange={(e) => onChange({ ...ai, branchNamingStyle: e.target.value as BranchNamingStyle })}
            >
              {BRANCH_NAMING_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.key)}
                </option>
              ))}
            </select>
            <span className="ai-example">
              <span className="ai-example-label">{t('settings.styleExample')}</span>
              <pre>{branchNameExample(ai.branchNamingStyle)}</pre>
            </span>
          </label>
        </div>
      </section>

      <section className="ai-card">
        <div className="ai-card-header">
          <h4><Bot size={14} /> {t('settings.repoChat')}</h4>
          <span data-setting="settings.repoChatEnable" title={t('settings.repoChatEnableHint')}>
            <Switch checked={can.chat} label={t('settings.repoChatEnable')} onChange={(repoChat) => onChange({ ...ai, repoChat })} />
          </span>
        </div>
        <span className="settings-hint">{t('settings.repoChatEnableHint')}</span>

        <p className={`ai-chat-summary${can.chat ? '' : ' off'}`} role="status">
          {interp(t(summary.key), {
            abilities: list(summary.abilities.map((k) => t(k))),
            approval: summary.approval ? t(summary.approval) : ''
          })}
        </p>

        <fieldset className="ai-chat-body" disabled={!can.chat}>
          <span className="settings-field-label">{t('settings.repoChatPermissions')}</span>
          <ul className="ai-permissions">
            <li className="ai-permission" data-setting="settings.repoChatRead">
              <span className="ai-permission-icon" aria-hidden="true"><Eye size={15} /></span>
              <span className="settings-toggle-copy">
                <strong>{t('settings.repoChatRead')}</strong>
                <span className="settings-hint">{t('settings.repoChatReadHint')}</span>
              </span>
              <span className="ai-permission-always">{t('settings.repoChatAlways')}</span>
            </li>
            <li className="ai-permission" data-setting="settings.repoChatGitActions">
              <span className="ai-permission-icon" aria-hidden="true"><GitBranch size={15} /></span>
              <span className="settings-toggle-copy">
                <strong id={`${ids}-git`}>{t('settings.repoChatGitActions')}</strong>
                <span className="settings-hint">{t('settings.repoChatGitActionsHint')}</span>
              </span>
              <Switch
                checked={can.git}
                labelledBy={`${ids}-git`}
                onChange={(repoChatActions) => onChange({ ...ai, repoChatActions })}
              />
            </li>
            <li className={`ai-permission${can.git ? '' : ' disabled'}`} data-setting="settings.repoChatFiles">
              <span className="ai-permission-icon" aria-hidden="true"><FilePen size={15} /></span>
              <span className="settings-toggle-copy">
                <strong id={`${ids}-files`}>{t('settings.repoChatFiles')}</strong>
                <span className="settings-hint">{t('settings.repoChatFilesHint')}</span>
              </span>
              {/* Shown as the inverse of the stored `repoChatReadOnly`. */}
              <Switch
                checked={fileEditsAllowed(ai)}
                labelledBy={`${ids}-files`}
                disabled={!can.git}
                onChange={(allowed) => onChange(withFileEdits(ai, allowed))}
              />
            </li>
            <li className={`ai-permission${can.git ? '' : ' disabled'}`} data-setting="settings.repoChatRemote">
              <span className="ai-permission-icon" aria-hidden="true"><CloudUpload size={15} /></span>
              <span className="settings-toggle-copy">
                <strong id={`${ids}-remote`}>{t('settings.repoChatRemote')}</strong>
                <span className="settings-hint">{t('settings.repoChatRemoteActionsHint')}</span>
              </span>
              <Switch
                checked={ai.repoChatRemoteActions === true}
                labelledBy={`${ids}-remote`}
                disabled={!can.git}
                onChange={(repoChatRemoteActions) => onChange({ ...ai, repoChatRemoteActions })}
              />
            </li>
          </ul>

          <div className="settings-field" data-setting="settings.repoChatApprovalTitle">
            <span className="settings-field-label">{t('settings.repoChatApprovalTitle')}</span>
            <ChoiceGroup
              label={t('settings.repoChatApprovalTitle')}
              value={can.approval}
              options={APPROVALS.map((a) => a.id)}
              onChange={(repoChatApproval) => onChange({ ...ai, repoChatApproval })}
              className="ai-approval-cards"
              itemClassName="ai-approval-card"
              disabled={!can.chat || !can.git}
            >
              {(id) => {
                const a = APPROVALS.find((x) => x.id === id) ?? APPROVALS[0]
                return (
                  <>
                    <strong>{t(a.key)}</strong>
                    <span className="settings-hint">{t(a.hint)}</span>
                  </>
                )
              }}
            </ChoiceGroup>
            <span className="settings-hint ai-approval-note">
              <ShieldCheck size={12} aria-hidden="true" /> {t('settings.repoChatApprovalHint')}
            </span>
          </div>

          <div className="ai-privacy">
            <span className="settings-field-label">
              <Lock size={11} aria-hidden="true" /> {t('settings.repoChatPrivacy')}
            </span>
            <label className="settings-toggle-card">
              <input
                type="checkbox"
                checked={ai.repoChatCommittedOnly === true}
                onChange={(e) => onChange({ ...ai, repoChatCommittedOnly: e.target.checked })}
              />
              <span className="settings-toggle-control" aria-hidden="true">
                <span className="settings-toggle-thumb" />
              </span>
              <span className="settings-toggle-copy">
                <strong>{t('settings.repoChatCommitted')}</strong>
                <span className="settings-hint">{t('settings.repoChatCommittedHint')}</span>
              </span>
            </label>
          </div>
        </fieldset>
      </section>
    </div>
  )
}
