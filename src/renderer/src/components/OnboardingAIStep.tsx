import { useRef, useState } from 'react'
import { Check, CircleAlert, KeyRound, Laptop, Loader2, RefreshCw, Sparkles, Terminal } from 'lucide-react'
import {
  aiProviderPreset,
  type AIAccount,
  type AIProvider,
  type DetectedCli,
  type SubscriptionCli,
  type SubscriptionTest
} from '../../../shared/types'
import { accountLabel, resolveAI } from '../../../shared/aiAccounts'
import { aiApi, shellApi } from '../infrastructure/api'
import { useSettingsStore } from '../stores/settings'
import { interp, useT, type TranslationKey } from '../i18n'
import { checkFingerprint, checkFromCatalog, checkFromError } from '../lib/aiAccountDraft'
import {
  AI_CHOICES,
  API_KEY_PROVIDERS,
  LOCAL_SERVERS,
  accountForChoice,
  answeredInSeconds,
  subscriptionCliOf,
  withListedModel,
  type AIChoice,
  type AIChoiceInput,
  type LocalServer
} from '../lib/onboarding'
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUS, SubscriptionSetup } from './SubscriptionSetup'

/**
 * The first-run AI step: three ways to reach a model, one card each, instead
 * of the whole Settings → AI page on a screen that is meant to take a minute.
 *
 * Everything it runs is what Settings runs — CLI detection, the subscription
 * test, the model-list test — and what it saves goes through the same store
 * action (`saveAIFor`), so the account shows up in Settings as the one in use.
 */

const CHOICE_ICON: Record<AIChoice, typeof Terminal> = {
  subscription: Terminal,
  'api-key': KeyRound,
  local: Laptop
}

/** A connection test of an API-key or local account, tied to what was tested. */
type ConnectionCheck =
  | { fingerprint: string; ok: true; models: string[] }
  | { fingerprint: string; ok: false; reasonKey?: TranslationKey; detail?: string }

export interface OnboardingAI {
  clis: DetectedCli[] | null
  choice: AIChoice | null
  provider: AIProvider
  apiKey: string
  server: LocalServer
  endpoint: string
  busy: boolean
  cliTest: { status: SubscriptionTest; seconds: number } | null
  check: ConnectionCheck | null
  saved: { id: string; label: string } | null
  detectClis: () => void
  choose: (choice: AIChoice) => void
  setProvider: (provider: AIProvider) => void
  setApiKey: (key: string) => void
  setServer: (server: LocalServer) => void
  setEndpoint: (endpoint: string) => void
  testCli: () => void
  testConnection: () => Promise<AIAccount | null>
  saveSubscription: (binary: SubscriptionCli, label: string, path: string) => void
  /** Tests what is not tested yet and saves it. True when the wizard may move on. */
  continueStep: () => Promise<boolean>
}

/**
 * The step's state lives with the wizard, not the step, so going back to the
 * accounts step and returning keeps the detection, the test and the choice.
 * `saveAccount` writes the account and returns the id it was saved under.
 */
export function useOnboardingAI(saveAccount: (account: AIAccount) => string): OnboardingAI {
  const [clis, setClis] = useState<DetectedCli[] | null>(null)
  const [choice, setChoice] = useState<AIChoice | null>(null)
  const [provider, setProviderState] = useState<AIProvider>('openai')
  const [apiKey, setApiKeyState] = useState('')
  const [server, setServerState] = useState<LocalServer>('ollama')
  const [endpoint, setEndpointState] = useState(LOCAL_SERVERS.ollama.endpoint)
  const [busy, setBusy] = useState(false)
  const [cliTest, setCliTest] = useState<{ status: SubscriptionTest; seconds: number } | null>(null)
  const [check, setCheck] = useState<ConnectionCheck | null>(null)
  const [saved, setSaved] = useState<{ id: string; label: string; fingerprint: string } | null>(null)
  const detecting = useRef(false)
  // Each test bumps this; an answer from an older one is dropped.
  const run = useRef(0)

  const existing = (): AIAccount[] => useSettingsStore.getState().activeAI().accounts ?? []
  const cli = clis ? subscriptionCliOf(clis) : null

  const currentInput = (): AIChoiceInput | null => {
    if (choice === 'api-key') return { kind: 'api-key', provider, apiKey }
    if (choice === 'local') return { kind: 'local', server, endpoint }
    if (choice === 'subscription' && cli) {
      // No path: the account finds the CLI on PATH, as Settings' default does,
      // so an upgrade that moves the binary does not break it.
      return { kind: 'subscription', cli: cli.binary, path: '', label: SUBSCRIPTION_PLANS[cli.binary].label }
    }
    return null
  }

  const save = (account: AIAccount): void => {
    const id = saveAccount(account)
    setSaved({ id, label: accountLabel(account), fingerprint: checkFingerprint(account) })
  }

  const detectClis = (): void => {
    if (clis || detecting.current) return
    detecting.current = true
    void aiApi
      .detectCli({ versions: true })
      .then(setClis)
      .catch(() => setClis([]))
      .finally(() => {
        detecting.current = false
      })
  }

  const testCliNow = async (): Promise<SubscriptionTest | null> => {
    if (!cli) return null
    const id = ++run.current
    setBusy(true)
    setCliTest(null)
    const started = performance.now()
    let status: SubscriptionTest
    try {
      status = await aiApi.testSubscription(cli.binary, '')
    } catch {
      status = 'failed'
    }
    if (run.current !== id) return null
    setCliTest({ status, seconds: answeredInSeconds(performance.now() - started) })
    setBusy(false)
    return status
  }

  const choose = (next: AIChoice): void => {
    setChoice(next)
    // Picking the card is the go-ahead for its one test prompt; a result
    // already in hand is not paid for twice.
    if (next === 'subscription' && cli && !cliTest && !busy) void testCliNow()
  }

  const testConnection = async (): Promise<AIAccount | null> => {
    const input = currentInput()
    if (!input || input.kind === 'subscription') return null
    const account = accountForChoice(existing(), input)
    const id = ++run.current
    setBusy(true)
    setCheck(null)
    let result: ConnectionCheck
    try {
      const base = useSettingsStore.getState().activeAI()
      const cfg = resolveAI({ ...base, accounts: [...(base.accounts ?? []), account], defaultAccountId: account.id })
      const catalog = await aiApi.listModels(cfg, true)
      const outcome = checkFromCatalog(account, catalog)
      result = outcome.ok ? { fingerprint: outcome.fingerprint, ok: true, models: catalog.models } : outcome
    } catch (err) {
      const outcome = checkFromError(account, err)
      result = outcome.ok ? { fingerprint: outcome.fingerprint, ok: true, models: [] } : outcome
    }
    if (run.current !== id) return null
    setCheck(result)
    setBusy(false)
    return result.ok ? withListedModel(account, result.models) : null
  }

  // Editing a field invalidates a test of the old value.
  const edited = <T,>(set: (v: T) => void) => (v: T): void => {
    set(v)
    setCheck(null)
  }

  const continueStep = async (): Promise<boolean> => {
    const input = currentInput()
    if (!input) return true
    const account = accountForChoice(existing(), input)
    if (saved && saved.fingerprint === checkFingerprint(account)) return true
    if (input.kind === 'subscription') {
      const status = cliTest?.status ?? (await testCliNow())
      if (status !== 'connected') return false
      save(account)
      return true
    }
    if (input.kind === 'api-key' && !input.apiKey.trim()) return false
    const fp = checkFingerprint(account)
    const tested = check && check.fingerprint === fp && check.ok ? withListedModel(account, check.models) : await testConnection()
    if (!tested) return false
    save(tested)
    return true
  }

  return {
    clis,
    choice,
    provider,
    apiKey,
    server,
    endpoint,
    busy,
    cliTest,
    check,
    saved: saved ? { id: saved.id, label: saved.label } : null,
    detectClis,
    choose,
    setProvider: edited(setProviderState),
    setApiKey: edited(setApiKeyState),
    setServer: (next: LocalServer) => {
      setServerState(next)
      setEndpointState(LOCAL_SERVERS[next].endpoint)
      setCheck(null)
    },
    setEndpoint: edited(setEndpointState),
    testCli: () => void testCliNow(),
    testConnection,
    saveSubscription: (binary, label, path) => {
      save(accountForChoice(existing(), { kind: 'subscription', cli: binary, path, label }))
    },
    continueStep
  }
}

function CheckLine({ check }: { check: ConnectionCheck }): React.JSX.Element {
  const t = useT()
  if (check.ok) {
    return (
      <div className="onboarding-ai-result ok" role="status">
        <Check size={14} /> {interp(t('onboarding.aiReady'), { count: check.models.length })}
      </div>
    )
  }
  return (
    <div className="onboarding-ai-result warn" role="status">
      {/* i18n-ignore the provider's own error text, already masked */}
      <CircleAlert size={14} /> {check.detail ?? t(check.reasonKey ?? 'settings.accountCheckFailed')}
    </div>
  )
}

export function OnboardingAIStep({ ai }: { ai: OnboardingAI }): React.JSX.Element {
  const t = useT()
  const cli = ai.clis ? subscriptionCliOf(ai.clis) : null
  const preset = aiProviderPreset(ai.provider)

  return (
    <div className="onboarding-ai">
      <div className="onboarding-ai-choices" role="radiogroup" aria-label={t('onboarding.aiAskTitle')}>
        {AI_CHOICES.map((c) => {
          const Icon = CHOICE_ICON[c.id]
          const selected = ai.choice === c.id
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`onboarding-ai-choice${selected ? ' selected' : ''}`}
              onClick={() => ai.choose(c.id)}
            >
              <Icon size={18} className="onboarding-ai-choice-icon" />
              <strong>{t(c.titleKey)}</strong>
              <span>{t(c.descKey)}</span>
            </button>
          )
        })}
      </div>

      {ai.saved && (
        <div className="onboarding-ai-result ok" role="status">
          <Check size={14} /> {interp(t('onboarding.aiSaved'), { name: ai.saved.label })}
        </div>
      )}

      {ai.choice === 'subscription' && (
        <div className="onboarding-ai-detail">
          {ai.clis === null ? (
            <div className="onboarding-ai-result" role="status">
              <Loader2 size={14} className="spin" /> {t('onboarding.aiDetecting')}
            </div>
          ) : cli ? (
            <div className="onboarding-ai-found">
              <div className="onboarding-ai-found-head">
                <Sparkles size={16} />
                <div className="onboarding-ai-found-copy">
                  <strong>{interp(t('onboarding.aiCliFound'), { cli: cli.label })}</strong>
                  {cli.version && (
                    <span className="settings-hint">{interp(t('onboarding.aiCliVersion'), { version: cli.version })}</span>
                  )}
                </div>
                <button type="button" className="btn ghost small" disabled={ai.busy} onClick={ai.testCli}>
                  <RefreshCw size={12} /> {t('onboarding.aiTestAgain')}
                </button>
              </div>
              {ai.busy && !ai.cliTest ? (
                <div className="onboarding-ai-result" role="status">
                  <Loader2 size={14} className="spin" /> {t('onboarding.aiTesting')}
                </div>
              ) : ai.cliTest?.status === 'connected' ? (
                <div className="onboarding-ai-result ok" role="status">
                  <Check size={14} /> {interp(t('onboarding.aiTestedReady'), { seconds: ai.cliTest.seconds })}
                </div>
              ) : ai.cliTest ? (
                <div className="onboarding-ai-result warn" role="status">
                  <CircleAlert size={14} />{' '}
                  {interp(t(SUBSCRIPTION_STATUS[ai.cliTest.status]), { command: SUBSCRIPTION_PLANS[cli.binary].login })}
                </div>
              ) : null}
              <span className="settings-hint">{t('onboarding.aiTestCost')}</span>
            </div>
          ) : null}
          {/* Nothing found, or found but not signed in: the same setup Settings shows. */}
          {ai.clis !== null && (!cli || (ai.cliTest && ai.cliTest.status !== 'connected')) && !ai.saved && (
            <>
              {!cli && <span className="settings-hint">{t('onboarding.aiCliMissing')}</span>}
              <SubscriptionSetup onConnect={ai.saveSubscription} />
            </>
          )}
        </div>
      )}

      {ai.choice === 'api-key' && (
        <div className="onboarding-ai-detail">
          <div className="onboarding-section">{t('onboarding.aiProvider')}</div>
          <div className="onboarding-ai-chips">
            {API_KEY_PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                className={`onboarding-provider-card${ai.provider === p ? ' selected' : ''}`}
                disabled={ai.busy}
                onClick={() => ai.setProvider(p)}
              >
                {aiProviderPreset(p).label}
              </button>
            ))}
          </div>
          <div className="onboarding-section">{t('onboarding.aiApiKey')}</div>
          <div className="onboarding-ai-row">
            <input
              className="modal-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              disabled={ai.busy}
              value={ai.apiKey}
              placeholder={t('onboarding.aiApiKeyPlaceholder')}
              onChange={(e) => ai.setApiKey(e.target.value)}
            />
            {preset.keyUrl && (
              <button type="button" className="btn ghost small" onClick={() => void shellApi.openExternal(preset.keyUrl ?? '')}>
                {t('onboarding.aiGetKey')}
              </button>
            )}
          </div>
          <div className="onboarding-ai-row">
            <button
              type="button"
              className="btn ghost small"
              disabled={ai.busy || !ai.apiKey.trim()}
              onClick={() => void ai.testConnection()}
            >
              {ai.busy ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} {t('onboarding.aiTest')}
            </button>
          </div>
          {ai.check && <CheckLine check={ai.check} />}
          <span className="settings-hint">{t('onboarding.aiKeyHint')}</span>
        </div>
      )}

      {ai.choice === 'local' && (
        <div className="onboarding-ai-detail">
          <div className="onboarding-section">{t('onboarding.aiServer')}</div>
          <div className="onboarding-ai-chips">
            {(Object.keys(LOCAL_SERVERS) as LocalServer[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`onboarding-provider-card${ai.server === s ? ' selected' : ''}`}
                disabled={ai.busy}
                onClick={() => ai.setServer(s)}
              >
                {LOCAL_SERVERS[s].label}
              </button>
            ))}
          </div>
          <div className="onboarding-section">{t('onboarding.aiEndpoint')}</div>
          <div className="onboarding-ai-row">
            <input
              className="modal-input"
              spellCheck={false}
              disabled={ai.busy}
              value={ai.endpoint}
              onChange={(e) => ai.setEndpoint(e.target.value)}
            />
            <button type="button" className="btn ghost small" disabled={ai.busy} onClick={() => void ai.testConnection()}>
              {ai.busy ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} {t('onboarding.aiTest')}
            </button>
          </div>
          {ai.check && <CheckLine check={ai.check} />}
          <span className="settings-hint">{t('onboarding.aiLocalHint')}</span>
        </div>
      )}

      <p className="onboarding-hint">{t('onboarding.aiMoreInSettings')}</p>
    </div>
  )
}
