import React, { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Check,
  Circle,
  CircleAlert,
  CircleDot,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Terminal,
  TriangleAlert,
  X
} from 'lucide-react'
import {
  AI_FEATURES,
  AI_PROVIDERS,
  aiProviderPreset,
  type AIAccount,
  type AICliBinary,
  type AIConfig,
  type AIFeature,
  type AIProvider,
  type DetectedCli,
  type SubscriptionCli,
  type ModelCatalog
} from '../../../shared/types'
import {
  accountConnectionKey,
  accountLabel,
  accountNeedsKey,
  assignFeatureAccount,
  assignFeatureModel,
  findAccount,
  isBlankStarter,
  modelFor,
  newAccount,
  removeAccount,
  resolveAI
} from '../../../shared/aiAccounts'
import { aiApi } from '../infrastructure/api'
import { SubscriptionSetup } from './SubscriptionSetup'
import { useModelCatalogs } from './useModelCatalogs'
import { useUIStore } from '../stores/ui'
import { interp, useT, type TranslationKey } from '../i18n'
import { modelPickerView, type ModelPickerMode } from '../lib/modelPicker'
import {
  ACCOUNT_STATUS_LABEL,
  accountRowRole,
  accountStatus,
  changedFields,
  checkFingerprint,
  checkFromCatalog,
  checkFromDetection,
  checkFromError,
  checkFromSubscription,
  checkNeedsKey,
  checkPlanFor,
  commitDraft,
  isDraftDirty,
  readableReason,
  setAccountInUse,
  startNewDraft,
  type AccountCheck,
  type AccountDraft,
  type AccountStatusView
} from '../lib/aiAccountDraft'
import { accountInitial, accountSummaryParts } from '../lib/aiAccountSummary'

/**
 * The AI accounts editor.
 *
 * GitHuttBr held one provider, one key and one model. That made "use Claude for
 * chat and a cheap OpenAI model for commit messages" impossible, and it made
 * the model picker a list frozen at release time. An account is now a named
 * connection, several can coexist, and each AI surface points at one of them.
 *
 * Model lists come from the provider itself (`aiApi.listModels`), cached for a
 * day. Every model control is an `<input list>` over a datalist rather than a
 * `<select>`, so a model the provider has not listed — a preview, a private
 * deployment, a freshly pulled Ollama tag — is always typeable.
 *
 * Edits are drafts (`lib/aiAccountDraft.ts`): nothing reaches the config until
 * "Test and save", which tests the connection first, so an account nobody
 * finished can no longer become the one that answers.
 */

const CLI_BINARIES: { id: AICliBinary; labelKey: TranslationKey }[] = [
  { id: 'claude', labelKey: 'settings.cliClaude' },
  { id: 'gemini', labelKey: 'settings.cliGemini' },
  { id: 'codex', labelKey: 'settings.cliCodex' },
  { id: 'devin', labelKey: 'settings.cliDevin' }
]

const FEATURE_LABELS: Record<AIFeature, TranslationKey> = {
  commit: 'settings.featureCommit',
  chat: 'settings.featureChat',
  explain: 'settings.featureExplain',
  review: 'settings.featureReview',
  conflict: 'settings.featureConflict',
  wiki: 'settings.featureWiki',
  theme: 'settings.featureTheme'
}

/** Sentinel options: neither is a model, so both use a value no id can hold. */
const CUSTOM = '\u0000custom'
const SHOW_ALL = '\u0000all'

/**
 * A model picker: the provider's list, plus a way out of it.
 *
 * This was an `<input list>` over a datalist, which looked like a combo box and
 * behaved like an autocomplete — the browser filters the suggestions by what is
 * already typed, so an account sitting on `gpt-4o-mini` only ever offered the
 * four models whose names contain it. A `<select>` shows the whole list; the
 * "Custom…" entry keeps a model the provider never advertised typeable.
 */
function ModelSelect({
  value,
  placeholder,
  models,
  allModels,
  emptyLabel,
  settled = true,
  onChange
}: {
  value: string
  placeholder: string
  models: string[]
  /** Everything the provider listed, revealed by the "show all" option. */
  allModels?: string[]
  /** Shown as the first option when an empty value is meaningful. */
  emptyLabel?: string
  /** Whether the provider's list has arrived (or failed). Until then only the
   *  bundled list is known, and a saved model missing from it is no proof the
   *  model was typed by hand. */
  settled?: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const full = allModels ?? models
  const [mode, setMode] = useState<ModelPickerMode>('auto')
  // Focus only when the person asked for the field. A field that focuses
  // itself on mount scrolls Settings to it every time the page opens.
  const [focusField, setFocusField] = useState(false)
  const { options, next, hasMore } = modelPickerView({ value, models, allModels, showAll, mode, settled })
  useEffect(() => {
    if (next !== mode) setMode(next)
  }, [next, mode])
  const custom = mode === 'custom'

  if (custom) {
    return (
      <div className="model-custom">
        <input
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          autoFocus={focusField}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn ghost small"
          title={t('settings.useModelList')}
          onClick={() => {
            setMode('list')
            setFocusField(false)
            // Dropping back to the list with an unlisted model selected would
            // silently show the wrong row, so the value goes back to empty.
            if (!full.includes(value)) onChange('')
          }}
        >
          <List size={13} />
        </button>
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM) {
          setMode('custom')
          setFocusField(true)
          return
        }
        if (e.target.value === SHOW_ALL) {
          setShowAll(true)
          return
        }
        onChange(e.target.value)
      }}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
      {hasMore && !showAll && (
        <option value={SHOW_ALL}>
          {interp(t('settings.showAllModels'), { count: String(full.length - models.length) })}
        </option>
      )}
      <option value={CUSTOM}>{t('settings.customModel')}</option>
    </select>
  )
}

function CatalogNote({ catalog }: { catalog: ModelCatalog | undefined }): React.JSX.Element | null {
  const t = useT()
  if (!catalog) return null
  if (catalog.source === 'live') {
    return <span className="settings-hint">{interp(t('settings.modelsLive'), { count: String(catalog.models.length) })}</span>
  }
  if (catalog.source === 'cache') {
    const when = catalog.fetchedAt ? new Date(catalog.fetchedAt).toLocaleString() : ''
    return <span className="settings-hint">{interp(t('settings.modelsCached'), { when })}</span>
  }
  // The provider's own error body is deliberately not shown here: a raw 401
  // payload in a settings pane is noise. Refresh surfaces it as a toast, where
  // the user asked for it and can act on it.
  return (
    <span className="settings-hint warn">
      <TriangleAlert size={12} /> {t('settings.modelsFallback')}
    </span>
  )
}

/** Not checked carries no icon: grey and a word say "nothing known yet" better
 *  than a symbol that would read as one more state. */
const STATUS_ICON: Record<AccountStatusView['status'], React.JSX.Element | null> = {
  ready: <Check size={12} strokeWidth={3} />,
  failing: <X size={12} strokeWidth={3} />,
  'no-key': <CircleAlert size={12} strokeWidth={2.5} />,
  unchecked: null
}

function StatusBadge({ view, compact = false }: { view: AccountStatusView; compact?: boolean }): React.JSX.Element {
  const t = useT()
  const reason = statusReason(view, t)
  return (
    <span className={`ai-status ${view.status}${compact ? ' compact' : ''}`} title={reason || undefined}>
      {!compact && STATUS_ICON[view.status]}
      {t(ACCOUNT_STATUS_LABEL[view.status])}
    </span>
  )
}

/** A failing account's reason: our own sentence, or the provider's words. */
function statusReason(view: { reasonKey?: TranslationKey; detail?: string }, t: (key: TranslationKey) => string): string {
  if (view.reasonKey) return t(view.reasonKey)
  return view.detail ?? ''
}

/** A field label that says when the draft changed it. */
function FieldLabel({ text, changed }: { text: string; changed: boolean }): React.JSX.Element {
  const t = useT()
  return (
    <span className="ai-field-label">
      {text}
      {changed && <span className="ai-field-changed">{t('settings.accountFieldChanged')}</span>}
    </span>
  )
}

/** The second line of a provider row: what it uses, joined with middle dots. */
function AccountSummary({ account, catalog }: { account: AIAccount; catalog: ModelCatalog | undefined }): React.JSX.Element {
  const t = useT()
  const text = accountSummaryParts(account, catalog)
    .map((part) => ('key' in part ? interp(t(part.key), part.vars) : part.text))
    .join(' · ')
  return <span className="ai-accounts-item-summary">{text}</span>
}

/** Providers reached at an address the user runs: the address is a field. */
const SERVER_PROVIDERS: AIProvider[] = ['ollama', 'custom']

function AccountCard({
  account,
  isNew,
  dirty,
  changed,
  status,
  check,
  failedSave,
  testing,
  catalog,
  loading,
  settled,
  clis,
  canDelete,
  lastOne,
  onEdit,
  onDelete,
  onRefresh,
  onSave,
  onSaveAnyway,
  onDiscard,
  onTest
}: {
  account: AIAccount
  /** A draft not yet added: Cancel instead of Delete. */
  isNew: boolean
  /** Changes waiting for Save. False in the commit-on-edit mode. */
  dirty: boolean
  /** Which fields differ from the saved account. */
  changed: Set<keyof AIAccount>
  status: AccountStatusView
  /** The last check run against exactly this connection, if any. */
  check: AccountCheck | undefined
  /** Save tested the draft and it failed: offer to save it anyway. */
  failedSave: boolean
  testing: boolean
  catalog: ModelCatalog | undefined
  loading: boolean
  /** The provider's list request for this account has finished. */
  settled: boolean
  clis: DetectedCli[]
  /** The last provider cannot be deleted: something has to answer. */
  canDelete: boolean
  /** Deleting it leaves a blank starter, which the confirm has to say. */
  lastOne: boolean
  onEdit: (next: AIAccount) => void
  onDelete: () => void
  onRefresh: () => void
  onSave: () => void
  onSaveAnyway: () => void
  onDiscard: () => void
  onTest: () => void
}): React.JSX.Element {
  const t = useT()
  const openModal = useUIStore((s) => s.openModal)
  const preset = aiProviderPreset(account.provider)
  const models = catalog?.models ?? preset.models
  const detected = clis.find((c) => c.binary === (account.cli ?? 'claude'))
  const failure = failedSave && check && !check.ok ? check : undefined
  const isCli = account.provider === 'cli'
  const isServer = SERVER_PROVIDERS.includes(account.provider)
  // Ollama answers without a key; its key field only stays for an account that
  // already holds one, so nothing saved becomes uneditable.
  const showKey = !isCli && (account.provider !== 'ollama' || !!(account.apiKey ?? '').trim())
  const fieldClass = (field: keyof AIAccount, failed = false): string | undefined =>
    [changed.has(field) ? 'changed' : '', failed && failure ? 'failed' : ''].filter(Boolean).join(' ') || undefined

  const setProvider = (id: AIProvider): void => {
    const next = aiProviderPreset(id)
    onEdit({
      ...account,
      provider: id,
      subscription: undefined,
      endpoint: next.endpoint,
      model: next.defaultModel,
      // A label the user never renamed should follow the provider rather than
      // leaving "OpenAI" sitting on an Anthropic account.
      label: account.label === preset.label ? next.label : account.label,
      ...(id === 'cli' ? { cli: account.cli ?? 'claude' } : {})
    })
  }

  // The footer's sentence says what pressing a button there will do.
  const footerHint = testing
    ? t('settings.accountTesting')
    : failure
      ? t('settings.accountSaveAnywayHint')
      : isNew
        ? t('settings.accountDraftHint')
        : ''

  return (
    <section className="ai-account-editor" aria-label={isNew ? t('settings.accountNewTitle') : accountLabel(account)}>
      <div className="ai-account-header">
        <h5 className="ai-account-title">{isNew ? t('settings.accountNewTitle') : accountLabel(account)}</h5>
        {isNew ? (
          <span className="ai-account-chip draft">{t('settings.accountNotSaved')}</span>
        ) : (
          <StatusBadge view={status} compact />
        )}
        <span className="ai-account-rule" aria-hidden="true" />
      </div>

      <div className={`ai-account${isNew ? ' draft' : ''}${!isNew && dirty ? ' dirty' : ''}`}>
        {!isNew && dirty && (
          <div className="ai-account-banner" role="status">
            <Circle size={10} strokeWidth={3} aria-hidden="true" /> {t('settings.accountUnsavedBanner')}
          </div>
        )}

        <fieldset className="ai-account-fields" disabled={testing}>
          <div className="ai-account-grid">
            <label className={fieldClass('provider')}>
              <FieldLabel text={t('settings.provider')} changed={changed.has('provider')} />
              <select value={account.provider} onChange={(e) => setProvider(e.target.value as AIProvider)}>
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldClass('label')}>
              <FieldLabel text={t('settings.name')} changed={changed.has('label')} />
              <input
                className="ai-account-name"
                value={account.label}
                placeholder={preset.label}
                onChange={(e) => onEdit({ ...account, label: e.target.value })}
              />
            </label>
          </div>

          {isCli && (
            <>
              <div className="ai-account-grid">
                <label className={fieldClass('cli', true)}>
                  <FieldLabel text={t('settings.cliBinary')} changed={changed.has('cli')} />
                  <select
                    value={account.cli ?? 'claude'}
                    onChange={(e) =>
                      onEdit({ ...account, cli: e.target.value as AICliBinary, cliPath: undefined, subscription: undefined, model: '' })
                    }
                  >
                    {CLI_BINARIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {t(c.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={fieldClass('cliPath', true)}>
                  <FieldLabel text={t('settings.cliPath')} changed={changed.has('cliPath')} />
                  <input
                    value={account.cliPath ?? ''}
                    placeholder={detected?.path ?? account.cli ?? 'claude'}
                    spellCheck={false}
                    onChange={(e) => onEdit({ ...account, cliPath: e.target.value })}
                  />
                </label>
              </div>
              <span className={detected ? 'settings-hint' : 'settings-hint warn'}>
                {detected ? (
                  <>
                    <Terminal size={12} /> {interp(t('settings.cliFound'), { path: detected.path })}
                  </>
                ) : (
                  <>
                    <TriangleAlert size={12} /> {t('settings.cliNotFound')}
                  </>
                )}
              </span>
              <span className="settings-hint">{t('settings.cliPrivacyHint')}</span>
            </>
          )}

          {isServer && (
            <label className={fieldClass('endpoint', true)}>
              <FieldLabel text={t('settings.endpoint')} changed={changed.has('endpoint')} />
              <input
                value={account.endpoint}
                placeholder={preset.endpoint || 'https://api.openai.com/v1'}
                spellCheck={false}
                onChange={(e) => onEdit({ ...account, endpoint: e.target.value })}
              />
            </label>
          )}

          {showKey && (
            <label className={fieldClass('apiKey', !isServer)}>
              <FieldLabel
                text={preset.needsKey ? t('settings.apiKey') : t('settings.apiKeyOptional')}
                changed={changed.has('apiKey')}
              />
              <input
                type="password"
                value={account.apiKey}
                placeholder={preset.needsKey ? 'sk-…' : t('settings.notRequired')}
                onChange={(e) => onEdit({ ...account, apiKey: e.target.value })}
              />
            </label>
          )}
          {!isCli && preset.keyUrl && <span className="settings-hint">{interp(t('settings.getKey'), { url: preset.keyUrl })}</span>}

          <label className={fieldClass('model')}>
            <FieldLabel text={t('settings.model')} changed={changed.has('model')} />
            <div className="model-row">
              <ModelSelect
                value={account.model}
                placeholder={preset.defaultModel || 'model-name'}
                models={models}
                allModels={catalog?.allModels}
                settled={settled}
                emptyLabel={isCli ? t('settings.cliDefaultModel') : undefined}
                onChange={(model) => onEdit({ ...account, model })}
              />
              <button
                type="button"
                className="btn ghost small icon-only"
                disabled={loading || testing}
                title={t('settings.fetchModelsTitle')}
                aria-label={t('settings.fetchModelsTitle')}
                onClick={onRefresh}
              >
                {loading ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
              </button>
            </div>
          </label>
          {!dirty && <CatalogNote catalog={catalog} />}

          {accountNeedsKey(account) && !failure && (
            <span className="settings-hint warn">
              <TriangleAlert size={12} /> {t('settings.accountNeedsKey')}
            </span>
          )}
        </fieldset>

        {failure ? (
          <div className="ai-account-error" role="alert">
            <X size={16} strokeWidth={2.5} aria-hidden="true" />
            <div className="ai-account-error-text">
              <strong>{t('settings.accountCheckFailedTitle')}</strong>
              {/* i18n-ignore the provider's own words, already masked for secrets */}
              <span className="ai-account-error-reason">{statusReason(failure, t)}</span>
            </div>
          </div>
        ) : (
          check && !testing && <CheckLine check={check} />
        )}

        <div className="ai-account-actions">
          {!isNew && (
            <button
              type="button"
              className="btn small ai-btn-danger"
              disabled={!canDelete || testing}
              onClick={() =>
                // Deleting an account drops its API key from the keychain with it,
                // and nothing here can put it back.
                openModal({
                  kind: 'confirm',
                  title: t('settings.deleteAccount'),
                  message: interp(t(lastOne ? 'settings.deleteLastAccountConfirm' : 'settings.deleteAccountConfirm'), {
                    name: accountLabel(account)
                  }),
                  danger: true,
                  confirmLabel: t('settings.deleteAccountAction'),
                  onConfirm: onDelete
                })
              }
            >
              {t('settings.deleteAccountAction')}
            </button>
          )}
          <span className="ai-account-actions-hint">{footerHint}</span>
          {dirty ? (
            <>
              <button type="button" className="btn small ai-btn-quiet" disabled={testing} onClick={onDiscard}>
                {isNew ? t('common.cancel') : t('settings.accountDiscard')}
              </button>
              {failure && (
                <button type="button" className="btn small ai-btn-warn" disabled={testing} onClick={onSaveAnyway}>
                  {t('settings.accountSaveAnyway')}
                </button>
              )}
              <button type="button" className="btn primary small" disabled={testing} onClick={onSave}>
                {testing && <Loader2 size={13} className="spin" />} {t('settings.accountTestAndSave')}
              </button>
            </>
          ) : (
            <button type="button" className="btn small ai-btn-quiet" disabled={testing} onClick={onTest}>
              {testing && <Loader2 size={13} className="spin" />} {t('settings.accountTest')}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/** What the last check said, above the card's buttons. */
function CheckLine({ check }: { check: AccountCheck }): React.JSX.Element {
  const t = useT()
  if (check.ok) {
    return (
      <span role="status" className="settings-hint ok">
        <Check size={12} />{' '}
        {check.models !== undefined
          ? interp(t('settings.accountCheckOk'), { count: String(check.models) })
          : t('settings.connected')}
      </span>
    )
  }
  return (
    <span role="status" className="settings-hint warn">
      <X size={12} /> {interp(t('settings.accountCheckFailedDetail'), { reason: statusReason(check, t) })}
    </span>
  )
}

/** The key a new draft's check is filed under: no saved account can hold it. */
const NEW_DRAFT = '\u0000new'

/**
 * Drafts survive the editor unmounting — closing Settings, switching to
 * another page — so typed input is never lost silently. Held in memory only,
 * never written to disk: a draft key is no more persisted than before.
 */
interface KeptEditor {
  draft: AccountDraft | null
  editingId: string | null
  checks: Record<string, AccountCheck>
}
const kept = new Map<string, KeptEditor>()

export function AIAccountsEditor({
  ai,
  onChange,
  scope,
  commitOnEdit = false
}: {
  ai: AIConfig
  onChange: (next: AIConfig) => void
  /** Which config this edits, so an unsaved draft comes back to the same one. */
  scope?: string
  /** Edits to an existing account apply at once. For a caller that is itself
   *  a draft — onboarding, saved only when the wizard finishes. */
  commitOnEdit?: boolean
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const openModal = useUIStore((s) => s.openModal)
  const [setup, setSetup] = useState(false)
  const [clis, setClis] = useState<DetectedCli[]>([])
  const [clisLoaded, setClisLoaded] = useState(false)
  const accounts = ai.accounts ?? []
  const { catalogs, loading, settled, refresh } = useModelCatalogs(ai)
  const restored = useRef(scope ? kept.get(scope) : undefined)
  // Only one account is edited at a time — a column of expanded cards turns
  // into a scroll the moment a second provider exists.
  const [editingId, setEditingId] = useState<string | null>(restored.current?.editingId ?? null)
  const [draft, setDraft] = useState<AccountDraft | null>(() => {
    const d = restored.current?.draft ?? null
    // A draft of an account deleted meanwhile has nothing left to edit.
    if (d?.original && !accounts.some((a) => a.id === d.original?.id)) return null
    return d
  })
  const [checks, setChecks] = useState<Record<string, AccountCheck>>(restored.current?.checks ?? {})
  /** The account being tested, by check key: only one test runs at a time. */
  const [testing, setTesting] = useState<string | null>(null)
  const [failedSave, setFailedSave] = useState(false)
  const [keptNotice, setKeptNotice] = useState(() => isDraftDirty(draft))

  const latest = useRef({ ai, draft })
  latest.current = { ai, draft }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (scope) kept.set(scope, { draft: isDraftDirty(draft) ? draft : null, editingId, checks })
  }, [scope, draft, editingId, checks])

  useEffect(() => {
    let live = true
    // A failed detection still ends the loading, so CLI accounts do not stay
    // "not checked" forever; a closed editor ignores the late answer.
    void aiApi
      .detectCli()
      .catch(() => [])
      .then((found) => {
        if (!live) return
        setClis(found)
        setClisLoaded(true)
      })
    return () => {
      live = false
    }
  }, [])

  const newDraft = draft && !draft.original ? draft : null
  const saved = accounts.find((a) => a.id === editingId) ?? accounts.find((a) => a.id === ai.defaultAccountId) ?? accounts[0]
  const editDraft = draft?.original && draft.original.id === saved?.id ? draft : null
  const activeDraft = newDraft ?? editDraft
  const shown = activeDraft?.account ?? saved
  const shownKey = newDraft ? NEW_DRAFT : (saved?.id ?? '')
  const dirty = isDraftDirty(activeDraft)

  const cliDetected = (account: AIAccount): boolean | undefined => {
    if (account.provider !== 'cli' || account.subscription) return undefined
    if ((account.cliPath ?? '').trim() || !clisLoaded) return undefined
    return clis.some((c) => c.binary === (account.cli ?? 'claude'))
  }
  const statusOf = (account: AIAccount, key: string): AccountStatusView =>
    accountStatus(account, catalogs[account.id], checks[key], cliDetected(account))

  const setCheck = (key: string, check: AccountCheck | undefined): void =>
    setChecks(({ [key]: _old, ...rest }) => (check ? { ...rest, [key]: check } : rest))

  /** Tests a connection without saving anything: lists models with the cache
   *  bypassed, or probes the CLI. Null when there is nothing that can be asked. */
  const runCheck = async (account: AIAccount): Promise<AccountCheck | null> => {
    const plan = checkPlanFor(account)
    try {
      if (plan === 'needs-key') return checkNeedsKey(account)
      if (plan === 'subscription') {
        const binary = account.cli === 'codex' ? 'codex' : 'claude'
        return checkFromSubscription(account, await aiApi.testSubscription(binary, account.cliPath ?? ''))
      }
      if (plan === 'detect') {
        // A typed path cannot be proven without running the CLI, which costs
        // the user a prompt; finding the command on PATH is all a plain CLI gets.
        if ((account.cliPath ?? '').trim()) return null
        const found = await aiApi.detectCli()
        if (mounted.current) setClis(found)
        return checkFromDetection(account, found.some((c) => c.binary === (account.cli ?? 'claude')))
      }
      const base = latest.current.ai
      const others = (base.accounts ?? []).filter((a) => a.id !== account.id)
      const cfg = resolveAI({ ...base, accounts: [...others, account], defaultAccountId: account.id })
      return checkFromCatalog(account, await aiApi.listModels(cfg, true))
    } catch (err) {
      return checkFromError(account, err)
    }
  }

  const commitAccountDraft = (d: AccountDraft, check: AccountCheck | null): void => {
    const { ai: next, accountId } = commitDraft(latest.current.ai, d)
    const committed = (next.accounts ?? []).find((a) => a.id === accountId)
    onChange(next)
    setDraft(null)
    setFailedSave(false)
    setKeptNotice(false)
    setEditingId(accountId)
    // The check was run on the draft; a new account's id is only final now.
    setChecks(({ [NEW_DRAFT]: _draft, ...rest }) =>
      check && committed ? { ...rest, [accountId]: { ...check, fingerprint: checkFingerprint(committed) } } : rest
    )
  }

  /** Tests the draft and saves it when the test passes. True when saved. */
  const saveAccountDraft = async (): Promise<boolean> => {
    const d = latest.current.draft
    if (!d) return false
    const key = d.original ? d.original.id : NEW_DRAFT
    setTesting(key)
    const check = await runCheck(d.account)
    // Closed mid-test: the draft is kept, nothing is saved behind the user's back.
    if (!mounted.current) return false
    setTesting(null)
    if (check) setCheck(key, check)
    // Fields are locked while testing, so the draft is still the one tested.
    if (!check || check.ok) {
      commitAccountDraft(d, check)
      return true
    }
    setFailedSave(true)
    return false
  }

  const testAccountConnection = async (account: AIAccount, key: string): Promise<void> => {
    setTesting(key)
    const check = await runCheck(account)
    if (!mounted.current) return
    setTesting(null)
    setCheck(key, check ?? undefined)
  }

  const reload = async (account: AIAccount): Promise<void> => {
    const catalog = await refresh(account.id)
    if (!catalog) return
    if (catalog.error) toast('info', readableReason(catalog.error, [account.apiKey ?? '']))
    // A refresh is a check too — except a CLI's, whose list is bundled.
    if (account.provider !== 'cli' && mounted.current) setCheck(account.id, checkFromCatalog(account, catalog))
  }

  /** Runs `then` now, or after the user agrees to drop unsaved changes. */
  const leaveDraft = (then: () => void): void => {
    if (!isDraftDirty(latest.current.draft)) {
      setDraft(null)
      then()
      return
    }
    const pending = latest.current.draft
    // Save · Discard · Keep editing: Save runs the same test as the card's
    // button and only moves on when it passed; a failure stays on the card.
    openModal({
      kind: 'confirm',
      title: interp(t('settings.accountLeaveTitle'), { name: pending ? accountLabel(pending.account) : '' }),
      message: t('settings.accountLeaveConfirm'),
      confirmLabel: t('common.save'),
      cancelLabel: t('settings.accountKeepEditing'),
      secondaryLabel: t('settings.accountDiscard'),
      secondaryDanger: true,
      onConfirm: () => {
        void saveAccountDraft().then((saved) => saved && then())
      },
      onSecondary: () => {
        discardAccountDraft()
        then()
      }
    })
  }

  const editAccount = (next: AIAccount): void => {
    setFailedSave(false)
    if (newDraft) {
      setDraft({ original: null, account: next })
      return
    }
    if (!saved) return
    if (commitOnEdit) {
      onChange({ ...ai, accounts: accounts.map((a) => (a.id === saved.id ? next : a)) })
      return
    }
    const d = { original: editDraft?.original ?? saved, account: next }
    // Typing back to what is saved leaves nothing pending.
    setDraft(isDraftDirty(d) ? d : null)
  }

  const discardAccountDraft = (): void => {
    setDraft(null)
    setFailedSave(false)
    setKeptNotice(false)
    setCheck(NEW_DRAFT, undefined)
  }

  const addAccount = (): void =>
    leaveDraft(() => {
      setSetup(false)
      setDraft(startNewDraft(latest.current.ai.accounts ?? []))
    })

  const connect = (binary: SubscriptionCli, label: string, cliPath: string): void => {
    // The setup already tested this connection: it is added as it stands.
    const account = { ...newAccount(accounts, 'cli'), cli: binary, subscription: true, cliPath, label }
    const starter = accounts.length === 1 && accounts[0].id === 'default' && accountNeedsKey(accounts[0])
    onChange({
      ...ai,
      accounts: [...accounts, account],
      defaultAccountId: starter || !accounts.length ? account.id : ai.defaultAccountId
    })
    setCheck(account.id, { fingerprint: checkFingerprint(account), ok: true })
    setEditingId(account.id)
    setSetup(false)
  }

  /** One click, saved at once: which provider answers is a choice, not an edit
   *  to hold in a draft. A pending draft of any account is left as it is. */
  const putAccountInUse = (id: string): void => {
    const next = setAccountInUse(latest.current.ai, id)
    if (next !== latest.current.ai) onChange(next)
  }

  // removeAccount swaps a blank starter in when the last one goes, so a provider
  // that stopped answering is removable without inventing a second account first.
  const deleteAccount = (id: string): void => onChange(removeAccount(ai, id))


  // A draft whose connection differs from the saved one has no fetched list of
  // its own: until a test brings one, it shows the provider's bundled models.
  const ownCheck = checks[shownKey]
  const checkCatalog = shown && ownCheck?.ok && ownCheck.fingerprint === checkFingerprint(shown) ? ownCheck.catalog : undefined
  const sameConnection = !!shown && !!saved && !newDraft && accountConnectionKey(shown) === accountConnectionKey(saved)
  const shownCatalog = checkCatalog ?? (sameConnection && saved ? catalogs[saved.id] : undefined)
  const shownCheck = shown && ownCheck && ownCheck.fingerprint === checkFingerprint(shown) ? ownCheck : undefined

  return (
    <>
      <h4>
        <Bot size={14} /> {t('settings.aiAccounts')}
      </h4>
      <span className="settings-hint">{t('settings.aiAccountsHint')}</span>

      {/* A list, not a listbox: rows carry their own buttons (Use, Test again),
          which an option may not contain. The name is the row's select button. */}
      <div className="ai-accounts-list" role="list" aria-label={t('settings.selectAccount')}>
        {accounts.map((a) => {
          const active = !setup && !newDraft && a.id === saved?.id
          const view = statusOf(a, a.id)
          const role = accountRowRole(ai, a.id)
          const select = (): void => {
            if (active) return
            leaveDraft(() => {
              setSetup(false)
              setEditingId(a.id)
            })
          }
          return (
            <div
              role="listitem"
              key={a.id}
              className={`ai-accounts-item${active ? ' active' : ''}${view.status === 'failing' ? ' failing' : ''}`}
              onClick={select}
            >
              <div className="ai-accounts-item-main">
                <span className="ai-accounts-avatar" aria-hidden="true">
                  {accountInitial(a)}
                </span>
                <div className="ai-accounts-item-text">
                  <span className="ai-accounts-item-title">
                    <button
                      type="button"
                      className="ai-accounts-item-name ai-accounts-item-select"
                      aria-current={active ? 'true' : undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        select()
                      }}
                    >
                      {accountLabel(a)}
                    </button>
                    {editDraft && editDraft.original?.id === a.id && dirty && (
                      <span
                        className="ai-accounts-item-unsaved"
                        role="img"
                        title={t('settings.accountUnsaved')}
                        aria-label={t('settings.accountUnsaved')}
                      >
                        <CircleDot size={11} />
                      </span>
                    )}
                  </span>
                  <AccountSummary account={a} catalog={catalogs[a.id]} />
                </div>
                <StatusBadge view={view} />
                {/* At the end, where the other rows have Use: the same place
                    answers "is this the one?" on every row. */}
                {role === 'in-use' && (
                  <span className="ai-accounts-item-in-use" title={t('settings.accountInUseTitle')}>
                    <Check size={12} strokeWidth={3} />
                    {t('settings.accountInUse')}
                  </span>
                )}
                {role === 'use' && (
                  <button
                    type="button"
                    className="btn small ai-btn-accent ai-accounts-item-use"
                    title={interp(t('settings.accountUseTitle'), { name: accountLabel(a) })}
                    aria-label={interp(t('settings.accountUseTitle'), { name: accountLabel(a) })}
                    onClick={(e) => {
                      // Using a provider is not opening it: the row keeps its selection.
                      e.stopPropagation()
                      putAccountInUse(a.id)
                    }}
                  >
                    {t('settings.accountUse')}
                  </button>
                )}
              </div>
              {view.status === 'failing' && (
                // Under the name, past the avatar; the retry ends the sentence.
                <p className="ai-accounts-item-reason">
                  {statusReason(view, t)}{' '}
                  <button
                    type="button"
                    className="link-inline"
                    disabled={testing !== null}
                    onClick={(e) => {
                      e.stopPropagation()
                      void testAccountConnection(a, a.id)
                    }}
                  >
                    {testing === a.id && <Loader2 size={11} className="spin" />}
                    {t('settings.accountTestAgain')}
                  </button>
                </p>
              )}
            </div>
          )
        })}
        {newDraft && (
          <div role="listitem" className={`ai-accounts-item draft${setup ? '' : ' active'}`} onClick={() => setSetup(false)}>
            <div className="ai-accounts-item-main">
              <span className="ai-accounts-avatar" aria-hidden="true">
                {accountInitial(newDraft.account)}
              </span>
              <div className="ai-accounts-item-text">
                <span className="ai-accounts-item-title">
                  <button
                    type="button"
                    className="ai-accounts-item-name ai-accounts-item-select"
                    aria-current={!setup ? 'true' : undefined}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSetup(false)
                    }}
                  >
                    {accountLabel(newDraft.account)}
                  </button>
                </span>
                <AccountSummary account={newDraft.account} catalog={undefined} />
              </div>
              <span className="ai-status draft">{t('settings.accountNotSaved')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="ai-accounts-bar">
        <button type="button" className="btn small ai-btn-accent" disabled={!!newDraft} onClick={addAccount}>
          <Plus size={13} /> {t('settings.addAccount')}
        </button>
        <button
          type="button"
          className="btn small ai-btn-quiet"
          disabled={ai.enabled === false}
          aria-expanded={setup}
          onClick={() => (setup ? setSetup(false) : leaveDraft(() => setSetup(true)))}
        >
          {t('settings.usePlan')}
        </button>
      </div>

      {keptNotice && dirty && !setup && (
        <span className="settings-hint warn">
          <CircleDot size={12} /> {t('settings.accountDraftKept')}
        </span>
      )}

      {setup && ai.enabled !== false && <SubscriptionSetup onConnect={connect} />}
      {!setup && shown && (
        <AccountCard
          key={newDraft ? NEW_DRAFT : shown.id}
          account={shown}
          isNew={!!newDraft}
          dirty={dirty}
          changed={changedFields(activeDraft)}
          status={statusOf(shown, shownKey)}
          check={shownCheck}
          failedSave={failedSave}
          testing={testing !== null}
          catalog={shownCatalog}
          loading={!newDraft && sameConnection && loading.includes(shown.id)}
          settled={shownCatalog ? true : sameConnection ? settled.includes(shown.id) : true}
          clis={clis}
          // The last account can go too — a blank starter takes its place —
          // unless it already is that starter and deleting changes nothing.
          canDelete={!isBlankStarter(accounts)}
          lastOne={accounts.length < 2}
          onEdit={editAccount}
          onDelete={() => {
            const id = shown.id
            setDraft(null)
            setFailedSave(false)
            setEditingId(null)
            setCheck(id, undefined)
            deleteAccount(id)
          }}
          onRefresh={() => (dirty ? void testAccountConnection(shown, shownKey) : void reload(shown))}
          onSave={() => void saveAccountDraft()}
          onSaveAnyway={() => {
            const d = latest.current.draft
            if (d) commitAccountDraft(d, checks[shownKey] ?? null)
          }}
          onDiscard={discardAccountDraft}
          onTest={() => void testAccountConnection(shown, shownKey)}
        />
      )}

      <h4>{t('settings.featureModels')}</h4>
      <span className="settings-hint">{t('settings.featureModelsHint')}</span>
      <div className="ai-assignments">
        {AI_FEATURES.map((feature) => {
          const assignment = ai.assignments?.[feature]
          const accountId = assignment?.accountId ?? ''
          const resolvedId = accountId || ai.defaultAccountId
          // Before its catalog loads, a row lists its own provider's presets — not
          // the default account's, which put Gemini models on an Ollama row.
          const provider = findAccount(ai, resolvedId)?.provider ?? ai.provider
          const models = catalogs[resolvedId]?.models ?? aiProviderPreset(provider).models
          return (
            <div className="ai-assignment" key={feature}>
              <span className="ai-assignment-label">{t(FEATURE_LABELS[feature])}</span>
              <select
                value={accountId}
                onChange={(e) => onChange({ ...ai, assignments: assignFeatureAccount(ai, feature, e.target.value) })}
              >
                <option value="">{t('settings.useAccountInUse')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
              </select>
              <ModelSelect
                value={assignment?.model ?? ''}
                placeholder={modelFor(ai, feature)}
                models={models}
                allModels={catalogs[resolvedId]?.allModels}
                settled={settled.includes(resolvedId)}
                emptyLabel={interp(t('settings.accountDefaultModel'), { model: modelFor(ai, feature) })}
                onChange={(model) => onChange({ ...ai, assignments: assignFeatureModel(ai, feature, model) })}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
