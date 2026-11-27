import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check, ChevronRight, ChevronLeft, ShieldCheck, Minus, PartyPopper,
  Upload, AlertTriangle, Sun, Moon, Monitor, Loader2, ExternalLink, Lock
} from 'lucide-react'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { interp, useT } from '../i18n'
import {
  defaultProfile,
  type AIAccount,
  type AppSettings,
  type GithubEnterpriseHost,
  type GitlabServer,
  type BitbucketServerHost,
  type Profile,
  type ThemeMode
} from '../../../shared/types'
import { APP_THEMES, applyAppTheme, findAppTheme } from '../theme/themes'
import { infoApi, profileAvatarApi, settingsApi, shellApi, vaultApi } from '../infrastructure/api'
import { toastVaultRefused, vaultRefusalOf } from './VaultUnreadableNotice'
import { hasSettingsSecrets, stripSettingsSecrets } from '../../../shared/secrets'
import {
  parseSettingsImport,
  planProfileMerge,
  remapProfileKeyed,
  type ParsedSettingsImport
} from '../lib/settingsImport'
import { settingsDecryptMessageKey } from '../lib/settingsPassword'
import { isEncryptedSettingsExport } from '../../../shared/settingsEncryption'
import { useProfileAvatarsStore } from '../stores/profileAvatars'
import { IntegrationsPage } from './SettingsPanel'
import { OnboardingAIStep, useOnboardingAI } from './OnboardingAIStep'
import {
  ONBOARDING_STEPS,
  addAccountInUse,
  stepEyebrow,
  stepStates,
  type OnboardingProgress,
  type OnboardingStepId
} from '../lib/onboarding'
import githuttbrLaunch from '../assets/githuttbr-launch.png'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shared with main: also sees AI account keys, which a hand-kept list here missed.
 *  A bundle's vault counts too — it is only exported when secrets were opted in. */
const detectSecrets = (p: ParsedSettingsImport): boolean =>
  hasSettingsSecrets(p.settings as AppSettings) || !!p.bundle?.vault


// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardData {
  profileName: string
  gitName: string
  gitEmail: string
  themeId: string
  themeMode: ThemeMode
  githubToken: string
  gitlabToken: string
  gitlabTokenIssuer?: string
  forgejoTokenIssuer?: string
  azureToken: string
  bitbucketToken: string
  gitlabServers?: GitlabServer[]
  forgejoUrl?: string
  forgejoToken?: string
  githubEnterprise?: GithubEnterpriseHost[]
  bitbucketServers?: BitbucketServerHost[]
  defaultOpenApp?: { name: string; path: string }
  importData: ParsedSettingsImport | null
  importHasSecrets: boolean
  importIncludeSecrets: boolean
  /** A password-protected export, still sealed, waiting for its password. Asked
   *  for in this step rather than in a dialog, which would open behind the wizard. */
  importLocked: unknown | null
  importPassword: string
  importPasswordError: string
}

/** -1 is the welcome screen; 0… index ONBOARDING_STEPS. */
const WELCOME = -1
const LAST = ONBOARDING_STEPS.length - 1
const stepIndex = (id: OnboardingStepId): number => ONBOARDING_STEPS.findIndex((s) => s.id === id)

const slideVariants = {
  enter: (d: number) => ({ x: d * 32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d * -32, opacity: 0 })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildProfile(data: WizardData, base: Profile): Profile {
  return {
    ...defaultProfile(),
    name: data.profileName || 'Default',
    gitName: data.gitName,
    gitEmail: data.gitEmail,
    githubToken: data.githubToken,
    gitlabToken: data.gitlabToken,
    gitlabTokenIssuer: data.gitlabTokenIssuer,
    azureToken: data.azureToken,
    bitbucketToken: data.bitbucketToken,
    gitlabServers: data.gitlabServers,
    forgejoUrl: data.forgejoUrl,
    forgejoToken: data.forgejoToken,
    forgejoTokenIssuer: data.forgejoTokenIssuer,
    githubEnterprise: data.githubEnterprise,
    bitbucketServers: data.bitbucketServers,
    ai: base.ai
  }
}

/** Any hosting token or self-hosted server entered on the accounts step. */
function hasHostAccount(data: WizardData): boolean {
  const tokens = [data.githubToken, data.gitlabToken, data.azureToken, data.bitbucketToken, data.forgejoToken]
  return (
    tokens.some((v) => !!v?.trim()) ||
    !!data.gitlabServers?.length ||
    !!data.githubEnterprise?.length ||
    !!data.bitbucketServers?.length
  )
}

// ── Step sub-components ───────────────────────────────────────────────────────

/** "Step N of M · Optional", the heading and one line under it. */
function StepHeader({
  index,
  title,
  subtitle
}: {
  index: number
  title: string
  subtitle: string
}): React.JSX.Element {
  const t = useT()
  const eyebrow = stepEyebrow(index)
  return (
    <div className="onboarding-step-header">
      <div className="onboarding-eyebrow">{interp(t(eyebrow.key), eyebrow.vars)}</div>
      <div className="onboarding-title">{title}</div>
      <div className="onboarding-subtitle">{subtitle}</div>
    </div>
  )
}

/** The left column: where the user is, what is done, and what was left empty. */
function Stepper({ current, progress }: { current: number; progress: OnboardingProgress }): React.JSX.Element {
  const t = useT()
  const states = stepStates(current, progress)
  return (
    <aside className="onboarding-stepper">
      <div className="onboarding-stepper-title">{t('onboarding.welcomeTitle')}</div>
      <ol className="onboarding-steps">
        {ONBOARDING_STEPS.map((step, i) => {
          const state = states[i]
          return (
            <li
              key={step.id}
              className={`onboarding-step ${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="onboarding-step-mark" aria-hidden="true">
                {state === 'done' ? <Check size={12} /> : state === 'skipped' ? <Minus size={12} /> : i + 1}
              </span>
              <span className="onboarding-step-label">{t(step.labelKey)}</span>
              {state === 'skipped' && <span className="onboarding-sr-only">{t('onboarding.stepSkipped')}</span>}
              {state === 'done' && <span className="onboarding-sr-only">{t('onboarding.stepCompleted')}</span>}
            </li>
          )
        })}
      </ol>
      <p className="onboarding-stepper-hint">{t('onboarding.laterHint')}</p>
    </aside>
  )
}

function WelcomeStep({
  data,
  patch,
  onImport,
  onApplyImport,
  onUnlockImport,
  importing
}: {
  data: WizardData
  patch: (p: Partial<WizardData>) => void
  onImport: () => void
  onApplyImport: () => void
  onUnlockImport: () => void
  importing: boolean
}): React.JSX.Element {
  const t = useT()
  return (
    <div className="onboarding-welcome">
      <div className="onboarding-logo">
        <img src={githuttbrLaunch} alt="" draggable={false} className="onboarding-art" />
      </div>
      <div className="onboarding-subtitle">{t('onboarding.welcomeSubtitle')}</div>

      <div className="onboarding-import-box">
        {data.importData ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Check size={16} color="var(--green)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>{t('onboarding.settingsLoaded')}</span>
            </div>
            {data.importHasSecrets && (
              <div className="onboarding-warning">
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>{t('onboarding.secretsWarning')}</strong>
                  <br />
                  {t('onboarding.secretsStripped')}
                  <label className="onboarding-secret-check">
                    <input
                      type="checkbox"
                      checked={data.importIncludeSecrets}
                      onChange={(e) => patch({ importIncludeSecrets: e.target.checked })}
                    />
                    {t('onboarding.includeSecrets')}
                  </label>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn primary" onClick={onApplyImport}>
                <Check size={14} /> {t('onboarding.applyContinue')}
              </button>
              <button
                className="btn ghost"
                onClick={() => patch({ importData: null, importHasSecrets: false, importIncludeSecrets: false })}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : data.importLocked ? (
          <div className="onboarding-import-locked">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Lock size={16} color="var(--text-1)" aria-hidden="true" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>{t('settings.importPasswordTitle')}</span>
            </div>
            <label className="onboarding-import-password">
              <span className="settings-hint">{t('settings.importPasswordLabel')}</span>
              <input
                type="password"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={data.importPassword}
                aria-invalid={!!data.importPasswordError}
                onChange={(e) => patch({ importPassword: e.target.value, importPasswordError: '' })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && data.importPassword) onUnlockImport()
                }}
              />
            </label>
            {data.importPasswordError && (
              <p className="settings-export-password-error" role="alert">
                {data.importPasswordError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn primary" onClick={onUnlockImport} disabled={!data.importPassword || importing}>
                {importing ? <Loader2 size={14} className="spin" /> : <Lock size={14} />} {t('settings.importPasswordUnlock')}
              </button>
              <button
                className="btn ghost"
                onClick={() => patch({ importLocked: null, importPassword: '', importPasswordError: '' })}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="onboarding-import-empty">
            <Upload size={22} color="var(--text-2)" />
            <p>{t('onboarding.haveSettingsFile')}</p>
            <button className="btn ghost" onClick={onImport} disabled={importing}>
              {importing ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
              {t('onboarding.importSettings')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileStep({
  data,
  patch
}: {
  data: WizardData
  patch: (p: Partial<WizardData>) => void
}): React.JSX.Element {
  const t = useT()
  return (
    <div>
      <StepHeader index={stepIndex('identity')} title={t('onboarding.profileTitle')} subtitle={t('onboarding.profileSubtitle')} />

      <div className="onboarding-section">{t('onboarding.displayName')}</div>
      <input
        className="modal-input"
        placeholder={t('onboarding.displayNamePlaceholder')}
        value={data.profileName}
        onChange={(e) => patch({ profileName: e.target.value })}
      />

      <div className="onboarding-section">{t('onboarding.gitIdentity')}</div>
      <input
        className="modal-input"
        placeholder={t('onboarding.gitNamePlaceholder')}
        value={data.gitName}
        onChange={(e) => patch({ gitName: e.target.value })}
      />
      <input
        className="modal-input"
        placeholder="you@example.com"
        value={data.gitEmail}
        onChange={(e) => patch({ gitEmail: e.target.value })}
        style={{ marginTop: 8 }}
      />
      <p className="onboarding-hint">{t('onboarding.gitIdentityHint')}</p>
    </div>
  )
}

function ThemeStep({
  data,
  patch
}: {
  data: WizardData
  patch: (p: Partial<WizardData>) => void
}): React.JSX.Element {
  const t = useT()
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const effectiveMode = data.themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : data.themeMode

  return (
    <div>
      <StepHeader index={stepIndex('appearance')} title={t('onboarding.themeTitle')} subtitle={t('onboarding.themeSubtitle')} />

      <div className="onboarding-theme-grid">
        {APP_THEMES.map((theme) => {
          const c = theme[effectiveMode]
          const selected = data.themeId === theme.id
          return (
            <button
              key={theme.id}
              className={`onboarding-theme-card${selected ? ' selected' : ''}`}
              onClick={() => patch({ themeId: theme.id })}
            >
              <div className="onboarding-theme-swatch" style={{ background: c.bg0 }}>
                <div className="onboarding-theme-sidebar" style={{ background: c.bg1, borderRight: `1px solid ${c.border}` }} />
                <div className="onboarding-theme-content" style={{ background: c.bg2 }}>
                  <div className="onboarding-theme-bar" style={{ background: c.accent }} />
                  <div className="onboarding-theme-bar" style={{ background: c.bg3, width: '80%' }} />
                  <div className="onboarding-theme-bar" style={{ background: c.bg3, width: '55%' }} />
                </div>
              </div>
              {selected && (
                <div className="onboarding-theme-check">
                  <Check size={10} />
                </div>
              )}
              <div className="onboarding-theme-name">{theme.name}</div>
            </button>
          )
        })}
      </div>

      <div className="onboarding-mode-toggle">
        {(
          [
            ['light', 'settings.modeLight', Sun],
            ['dark', 'settings.modeDark', Moon],
            ['auto', 'settings.modeAuto', Monitor]
          ] as const
        ).map(
          ([id, labelKey, Icon]) => (
            <button
              key={id}
              className={`onboarding-mode-btn${data.themeMode === id ? ' selected' : ''}`}
              onClick={() => patch({ themeMode: id })}
            >
              <Icon size={13} /> {t(labelKey)}
            </button>
          )
        )}
      </div>
    </div>
  )
}

function IntegrationsStep({
  data,
  patch,
  base
}: {
  data: WizardData
  patch: (p: Partial<WizardData>) => void
  base: Profile
}): React.JSX.Element {
  const t = useT()
  return (
    <>
      <StepHeader
        index={stepIndex('accounts')}
        title={t('onboarding.integrationsTitle')}
        subtitle={t('onboarding.integrationsSubtitle')}
      />
      <div className="settings-form">
        <IntegrationsPage
          profile={buildProfile(data, base)}
          edit={(partial) => {
            const p = partial as Partial<WizardData>
            patch({
              ...(p.githubToken !== undefined && { githubToken: p.githubToken }),
              ...(p.azureToken !== undefined && { azureToken: p.azureToken }),
              ...('gitlabTokenIssuer' in p && { gitlabTokenIssuer: p.gitlabTokenIssuer }),
              ...(p.gitlabToken !== undefined && { gitlabToken: p.gitlabToken }),
              ...(p.bitbucketToken !== undefined && { bitbucketToken: p.bitbucketToken }),
              // Fields the page grew after the wizard was written: dropping them made
              // the inputs look dead and left a self-managed token pointed at gitlab.com.
              ...(p.gitlabServers !== undefined && { gitlabServers: p.gitlabServers }),
              ...(p.forgejoUrl !== undefined && { forgejoUrl: p.forgejoUrl }),
              ...('forgejoTokenIssuer' in p && { forgejoTokenIssuer: p.forgejoTokenIssuer }),
              ...(p.forgejoToken !== undefined && { forgejoToken: p.forgejoToken }),
              ...(p.githubEnterprise !== undefined && { githubEnterprise: p.githubEnterprise }),
              ...(p.bitbucketServers !== undefined && { bitbucketServers: p.bitbucketServers })
            })
          }}
        />
      </div>
      <div className="onboarding-secret-note">
        <ShieldCheck size={15} />
        <span>
          {t('onboarding.tokensNote')}
        </span>
      </div>
      <div className="settings-app-picker onboarding-app-picker">
        <span className="settings-app-picker-name">
          <ExternalLink size={13} />
          {data.defaultOpenApp?.name ?? t('onboarding.noAppSelected')}
        </span>
        <button
          type="button"
          className="btn ghost small"
          onClick={async () => {
            const app = await shellApi.pickApplication()
            if (app) patch({ defaultOpenApp: app })
          }}
        >
          {t('onboarding.chooseApp')}
        </button>
      </div>
      <div className="settings-hint onboarding-app-picker-hint">
        {t('onboarding.appPickerHint')}
      </div>
    </>
  )
}

function DoneStep({
  data,
  aiLabel
}: {
  data: WizardData
  aiLabel: string | null
}): React.JSX.Element {
  const t = useT()
  const theme = findAppTheme(data.themeId, [])
  const hosts = hasHostAccount(data)
  const identity = !!data.gitName.trim() && !!data.gitEmail.trim()
  // Each line says what was set up, or plainly that it was not.
  const rows: { ok: boolean; text: string }[] = [
    {
      ok: identity,
      text: identity
        ? interp(t('onboarding.doneIdentity'), { name: data.gitName.trim(), email: data.gitEmail.trim() })
        : t('onboarding.doneNoIdentity')
    },
    { ok: hosts, text: t(hosts ? 'onboarding.doneAccounts' : 'onboarding.doneNoAccounts') },
    { ok: !!aiLabel, text: aiLabel ? interp(t('onboarding.doneAI'), { name: aiLabel }) : t('onboarding.doneNoAI') },
    { ok: true, text: interp(t('onboarding.doneTheme'), { theme: theme.name }) }
  ]
  return (
    <div>
      <StepHeader index={stepIndex('done')} title={t('onboarding.doneTitle')} subtitle={t('onboarding.doneSubtitle')} />
      <ul className="onboarding-summary">
        {rows.map((row, i) => (
          <li key={i} className={row.ok ? 'ok' : 'empty'}>
            <span className="onboarding-step-mark" aria-hidden="true">
              {row.ok ? <Check size={12} /> : <Minus size={12} />}
            </span>
            <span>{row.text}</span>
          </li>
        ))}
      </ul>
      <div className="onboarding-done-art" aria-hidden="true">
        <PartyPopper size={28} />
      </div>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function OnboardingWizard(): React.JSX.Element {
  const t = useT()
  const profile = useSettingsStore((s) => s.activeProfile())
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const importSettings = useSettingsStore((s) => s.importSettings)
  const saveAIFor = useSettingsStore((s) => s.saveAIFor)
  const toast = useUIStore((s) => s.toast)

  const [step, setStep] = useState(WELCOME)
  const [dir, setDir] = useState(1)
  const [importing, setImporting] = useState(false)

  const [data, setData] = useState<WizardData>({
    profileName: profile.name,
    gitName: profile.gitName,
    gitEmail: profile.gitEmail,
    themeId: settings.appThemeId,
    themeMode: settings.themeMode,
    githubToken: profile.githubToken,
    gitlabToken: profile.gitlabToken,
    gitlabTokenIssuer: profile.gitlabTokenIssuer,
    azureToken: profile.azureToken,
    bitbucketToken: profile.bitbucketToken,
    gitlabServers: profile.gitlabServers,
    forgejoUrl: profile.forgejoUrl,
    forgejoToken: profile.forgejoToken,
    forgejoTokenIssuer: profile.forgejoTokenIssuer,
    githubEnterprise: profile.githubEnterprise,
    bitbucketServers: profile.bitbucketServers,
    defaultOpenApp: settings.defaultOpenApp,
    importData: null,
    importHasSecrets: false,
    importIncludeSecrets: false,
    importLocked: null,
    importPassword: '',
    importPasswordError: ''
  })

  const patch = (partial: Partial<WizardData>): void => setData((d) => ({ ...d, ...partial }))

  // The AI step saves its account at once, through the action Settings → AI
  // uses, and puts it in use: Settings then shows it as the account in use.
  // The AI lands where the active profile reads it — the general AI on a fresh
  // install — so the first profile added afterwards inherits it.
  const ai = useOnboardingAI((account: AIAccount, replacingId?: string) => {
    const state = useSettingsStore.getState()
    const { ai: next, accountId } = addAccountInUse(state.activeAI(), account, replacingId)
    saveAIFor(state.settings.activeProfileId, next)
    return accountId
  })

  const aiIndex = stepIndex('ai')
  const appearanceIndex = stepIndex('appearance')

  useEffect(() => {
    if (step === appearanceIndex) applyAppTheme(findAppTheme(data.themeId, []), data.themeMode)
  }, [data.themeId, data.themeMode, step, appearanceIndex])

  // Looked for when the AI step first opens, not when the wizard does: the
  // lookup spawns a process per CLI, which a wizard skipped earlier never needs.
  // `ai` is a fresh object every render; the step change is what matters, and
  // detectClis itself refuses a second lookup.
  const detectClis = ai.detectClis
  const onAIStep = step === aiIndex
  useEffect(() => {
    if (onAIStep) detectClis()
  }, [onAIStep]) // eslint-disable-line react-hooks/exhaustive-deps

  const progress: OnboardingProgress = {
    gitName: data.gitName,
    gitEmail: data.gitEmail,
    hasHostAccount: hasHostAccount(data),
    aiAccountId: ai.saved?.id ?? null
  }

  const next = (): void => { setDir(1); setStep((s) => Math.min(LAST, s + 1)) }
  // "Skip, no AI" means no AI: the default config is on, with an OpenAI account
  // that has no key, which left a red "AI: OpenAI" chip and AI buttons behind
  // while the Done step said "No AI".
  const skipAIStep = (): void => {
    const state = useSettingsStore.getState()
    saveAIFor(state.settings.activeProfileId, { enabled: false })
    next()
  }
  const back = (): void => { setDir(-1); setStep((s) => Math.max(WELCOME, s - 1)) }
  const continueAI = async (): Promise<void> => {
    if (await ai.continueStep()) next()
  }

  // Enter advances on the form steps (not Welcome, where the import box owns
  // focus, nor the AI step, where Enter in a key field must not spend a test).
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key !== 'Enter' || step === WELCOME || step === aiIndex) return
    const el = e.target as HTMLElement
    if (el.closest('.ai-account') || el.tagName === 'SELECT') return
    if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.tagName === 'A') return
    e.preventDefault()
    if (step < LAST) next()
    else finish()
  }

  const doImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const result = await settingsApi.importFile()
      if (!result) return
      if (isEncryptedSettingsExport(result)) {
        patch({ importLocked: result, importPassword: '', importPasswordError: '' })
        return
      }
      loadImport(result)
    } catch {
      toast('error', t('onboarding.importFailed'))
    } finally {
      setImporting(false)
    }
  }

  const loadImport = (result: unknown): void => {
    const parsed = parseSettingsImport(result)
    if (!parsed) {
      toast('error', t('onboarding.importFailed'))
      return
    }
    patch({ importData: parsed, importHasSecrets: detectSecrets(parsed) })
  }

  const unlockImport = async (): Promise<void> => {
    if (!data.importLocked || !data.importPassword) return
    setImporting(true)
    try {
      const r = await settingsApi.decryptImport(data.importLocked, data.importPassword)
      if (r.ok) {
        // The password has done its job; it does not stay in the wizard's state.
        patch({ importLocked: null, importPassword: '', importPasswordError: '' })
        loadImport(r.data)
      } else if (r.reason === 'bad-password') {
        patch({ importPassword: '', importPasswordError: t(settingsDecryptMessageKey(r.reason)) })
      } else {
        patch({ importLocked: null, importPassword: '', importPasswordError: '' })
        toast('error', t(settingsDecryptMessageKey(r.reason)))
      }
    } catch {
      toast('error', t('onboarding.importFailed'))
    } finally {
      setImporting(false)
    }
  }

  const applyImport = async (): Promise<void> => {
    if (!data.importData) return
    const { settings: raw, bundle } = data.importData
    const keepSecrets = data.importIncludeSecrets
    // The shared strip: a hand-kept list here missed newer secrets (Forgejo, AI account keys).
    const toApply = keepSecrets ? raw : stripSettingsSecrets(raw as AppSettings)
    try {
      // The side stores first: once onboardingCompleted lands, this wizard unmounts.
      if (bundle?.info) await infoApi.importAll(bundle.info)
      // An unreadable vault refuses the merge: the rest of the import still
      // goes in, and the vault's refusal is said on its own (below).
      const vaultRefused = keepSecrets && bundle?.vault ? vaultRefusalOf(await vaultApi.importAll(bundle.vault)) : null
      if (bundle?.avatars) {
        // Same id moves the import applies to the profiles (a file `default`
        // named differently from ours gets its own id): pictures follow them.
        const { idMap } = planProfileMerge(
          useSettingsStore.getState().settings.profiles,
          toApply.profiles ?? [],
          'replace'
        )
        await profileAvatarApi.importAll(remapProfileKeyed(bundle.avatars, idMap) ?? {})
        useProfileAvatarsStore.getState().reloadProfileImages()
      }
      await importSettings({ ...toApply, onboardingCompleted: true })
      toast('success', t('onboarding.imported'))
      if (vaultRefused) toastVaultRefused(vaultRefused)
    } catch {
      toast('error', t('onboarding.importFailed'))
    }
  }

  const finish = (): void => {
    // No AI here: the AI step already saved what it set up.
    update((s) => ({
        ...s,
        appThemeId: data.themeId,
        themeMode: data.themeMode,
        onboardingCompleted: true,
        defaultOpenApp: data.defaultOpenApp,
        profiles: s.profiles.map((p) =>
          p.id === s.activeProfileId
            ? {
                ...p,
                name: data.profileName || p.name,
                gitName: data.gitName,
                gitEmail: data.gitEmail,
                githubToken: data.githubToken,
                gitlabToken: data.gitlabToken,
                gitlabTokenIssuer: data.gitlabTokenIssuer,
                azureToken: data.azureToken,
                bitbucketToken: data.bitbucketToken,
                gitlabServers: data.gitlabServers,
                forgejoUrl: data.forgejoUrl,
                forgejoToken: data.forgejoToken,
                forgejoTokenIssuer: data.forgejoTokenIssuer,
                githubEnterprise: data.githubEnterprise,
                bitbucketServers: data.bitbucketServers
              }
            : p
        )
      }))
  }

  const currentStep = ONBOARDING_STEPS[step]?.id
  const busy = step === aiIndex && ai.busy

  return (
    <div className="onboarding-overlay">
      <motion.div
        className="onboarding-card"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        onKeyDown={onKeyDown}
      >
        <Stepper current={step} progress={progress} />

        <div className="onboarding-main">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.16, ease: 'easeInOut' }}
              className="onboarding-body"
            >
              {step === WELCOME && (
                <WelcomeStep
                  data={data}
                  patch={patch}
                  onImport={() => void doImport()}
                  onApplyImport={() => void applyImport()}
                  onUnlockImport={() => void unlockImport()}
                  importing={importing}
                />
              )}
              {currentStep === 'identity' && <ProfileStep data={data} patch={patch} />}
              {currentStep === 'accounts' && <IntegrationsStep data={data} patch={patch} base={profile} />}
              {currentStep === 'ai' && (
                <>
                  <StepHeader index={aiIndex} title={t('onboarding.aiAskTitle')} subtitle={t('onboarding.aiAskSubtitle')} />
                  <OnboardingAIStep ai={ai} />
                </>
              )}
              {currentStep === 'appearance' && <ThemeStep data={data} patch={patch} />}
              {currentStep === 'done' && <DoneStep data={data} aiLabel={ai.saved?.label ?? null} />}
            </motion.div>
          </AnimatePresence>

          <div className="onboarding-footer">
            {step === WELCOME ? (
              <button className="btn primary onboarding-start-btn" onClick={next}>
                {t('onboarding.getStarted')} <ChevronRight size={15} />
              </button>
            ) : (
              <>
                <button className="btn ghost" onClick={back} disabled={busy}>
                  <ChevronLeft size={14} /> {t('onboarding.back')}
                </button>
                <div className="onboarding-footer-right">
                  {step === aiIndex ? (
                    <>
                      <button className="onboarding-skip" onClick={skipAIStep} disabled={busy}>
                        {t('onboarding.skipNoAI')}
                      </button>
                      <button className="btn primary" onClick={() => void continueAI()} disabled={busy}>
                        {busy ? <Loader2 size={14} className="spin" /> : null} {t('onboarding.continue')}{' '}
                        <ChevronRight size={14} />
                      </button>
                    </>
                  ) : step < LAST ? (
                    <>
                      <button className="onboarding-skip" onClick={finish}>
                        {t('onboarding.skip')}
                      </button>
                      <button className="btn primary" onClick={next}>
                        {t('onboarding.next')} <ChevronRight size={14} />
                      </button>
                    </>
                  ) : (
                    <button className="btn primary" onClick={finish}>
                      <Check size={14} /> {t('onboarding.finish')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
