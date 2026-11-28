import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Settings,
  Loader2,
  BarChart3,
  History,
  ScrollText,
  Flame,
  Info,
  KeyRound,
  FileCog,
  AlertTriangle,
  GitBranch,
  Globe,
  ArrowRight
} from 'lucide-react'
import { gitApi, logApi } from '../infrastructure/api'
import { applyRepoImage, lookupRepoImage, normalizeImagePath } from '../lib/repoImage'
import { lookupRepoAlias, repoDisplayName } from '../lib/repoAlias'
import {
  REPO_SETTINGS_NAV,
  findRepoSettingsNavItem,
  getMainRemote,
  getRepoInitials,
  getRepoSettingsPills,
  resolveRepoSettingsPage,
  type RepoSettingsPage
} from '../lib/repoSettingsNav'
import { activeRepoPath } from '../appCommands'
import { useReposStore } from '../stores/repos'
import { loadRepoImage } from './RepoTabLabel'
import { RepoImagePicker } from './RepoImagePicker'
import { useUIStore } from '../stores/ui'
import { useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { AnalyticsSection, RepoHistorySection } from './SettingsPanel'
import { InsightsPage } from './InsightsPage'
import { RepoInfoTab } from './RepoInfoTab'
import { RepoVaultTab } from './RepoVaultTab'
import type { IconTone } from '../lib/iconTone'
import { useT, t as tr, interp } from '../i18n'
import { BranchMultiSelect } from './BranchMultiSelect'
import { RepoConfigTab } from './RepoConfigTab'
import type { HostingProvider, LogEntry } from '../../../shared/types'

function relTime(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 1) return tr('time.justNow')
  if (m < 60) return interp(tr('time.minutesAgo'), { n: m })
  const h = Math.round(m / 60)
  if (h < 24) return interp(tr('time.hoursAgo'), { n: h })
  return new Date(ms).toLocaleString()
}

/** This repo's recent operation log, inline; the full filterable log opens as a page. */
function RepoLogsTab({ repoPath }: { repoPath: string }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    logApi
      .get()
      .then((all) => setEntries(all.filter((e) => e.repoPath === repoPath).reverse()))
      .finally(() => setLoading(false))
  }, [repoPath])

  const openAll = (): void => {
    useSettingsStore.getState().openPageTab({ type: 'logs' })
    closeModal()
  }

  return (
    <>
      <div className="repo-logs-head">
        <span className="settings-hint">{t('repoLogs.hint')}</span>
        <button className="btn ghost small" onClick={openAll}>
          <ScrollText size={13} /> {t('repoLogs.openFull')}
        </button>
      </div>
      {loading ? (
        <div style={{ padding: 12 }}>
          <Loader2 size={15} className="spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="settings-hint" style={{ marginTop: 10 }}>
          {t('repoLogs.empty')}
        </p>
      ) : (
        <div className="repo-logs-list">
          {entries.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="repo-log-row">
              <span className={`repo-log-dot ${e.ok ? 'ok' : 'fail'}`} />
              <span className="repo-log-event">{e.event}</span>
              <span className="repo-log-err">{!e.ok && e.error ? e.error : ''}</span>
              <span className="repo-log-time">{relTime(e.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// Product names: the same in every language.
const HOST_NAME: Record<Exclude<HostingProvider, null>, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  azure: 'Azure DevOps',
  forgejo: 'Forgejo'
}

/**
 * Each page's icon colour (Settings → Themes → Icon colors), one tone per nav
 * group like Settings' own menu: Repository in the accent, Security red,
 * Activity green. General stays grey, as Settings' General does.
 */
const PAGE_TONE: Partial<Record<RepoSettingsPage, IconTone>> = {
  config: 'ref',
  info: 'ref',
  vault: 'guard',
  analytics: 'outgoing',
  insights: 'outgoing',
  history: 'outgoing',
  logs: 'outgoing'
}

const PAGE_ICON: Record<RepoSettingsPage, React.ReactNode> = {
  general: <Settings size={14} />,
  config: <FileCog size={14} />,
  info: <Info size={14} />,
  vault: <KeyRound size={14} />,
  analytics: <BarChart3 size={14} />,
  insights: <Flame size={14} />,
  history: <History size={14} />,
  logs: <ScrollText size={14} />
}

/** One setting: what it is and why on the left, the control on the right. */
function SettingRow({
  label,
  hint,
  children,
  danger
}: {
  label: string
  hint: string
  children: React.ReactNode
  danger?: boolean
}): React.JSX.Element {
  return (
    <div className={`repo-settings-row ${danger ? 'danger' : ''}`}>
      <div className="repo-settings-row-text">
        <span className="repo-settings-row-label">{label}</span>
        <span className="repo-settings-row-hint">{hint}</span>
      </div>
      <div className="repo-settings-row-control">{children}</div>
    </div>
  )
}

function GeneralTab({ repoPath, onOpenPage }: { repoPath: string; onOpenPage: (p: RepoSettingsPage) => void }): React.JSX.Element {
  const closeModal = useUIStore((s) => s.closeModal)
  const openDialog = useUIStore((s) => s.openDialog)
  const toast = useUIStore((s) => s.toast)
  const t = useT()
  const repo = useRepoStore((s) => s.repos[repoPath])
  const profiles = useSettingsStore((s) => s.settings.profiles)
  const branchOptions = useMemo(() => repo?.branches.locals.map((b) => b.name) ?? [], [repo])
  const [protectedBranches, setProtected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alias, setAlias] = useState(
    () => lookupRepoAlias(repoPath, useSettingsStore.getState().settings.repoAliases) ?? ''
  )
  // '' is Auto: no binding, the repository follows the active profile.
  const [profileId, setProfileId] = useState(() => useSettingsStore.getState().settings.repoProfiles[repoPath] ?? '')
  const [imagePath, setImagePath] = useState(
    () => lookupRepoImage(repoPath, useSettingsStore.getState().settings.repoImages) ?? ''
  )
  const [preview, setPreview] = useState<{ file: string; url: string | null } | null>(null)
  const imageFile = normalizeImagePath(imagePath)
  const imageBroken = imageFile !== '' && preview?.file === imageFile && preview.url === null
  const config = repo?.config
  const configFile = config?.exists ? (config.path.split(/[\\/]/).pop() ?? '') : ''

  useEffect(() => {
    gitApi
      .protectedBranches(repoPath)
      .then(setProtected)
      .catch(() => setProtected([]))
      .finally(() => setLoading(false))
  }, [repoPath])

  // Debounced so typing a path does not read a file per keystroke. `fresh`
  // because the point of looking here is often "I replaced the picture".
  useEffect(() => {
    if (!imageFile) return
    let live = true
    const timer = setTimeout(() => {
      void loadRepoImage(repoPath, imageFile, true).then((url) => live && setPreview({ file: imageFile, url }))
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [repoPath, imageFile])

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const store = useSettingsStore.getState()
      store.update((s) => ({ ...s, repoImages: applyRepoImage(s.repoImages, repoPath, imageFile || null) }))
      // Only what changed: re-applying an unchanged alias would still rewrite
      // every tab chip that names this repository.
      if (alias.trim() !== (lookupRepoAlias(repoPath, store.settings.repoAliases) ?? '')) {
        store.setRepoAlias(repoPath, alias.trim() || null)
      }
      const bound = store.settings.repoProfiles[repoPath] ?? ''
      if (profileId !== bound) {
        store.setRepoProfile(repoPath, profileId || null)
        // The title-bar switcher activates a profile as it binds it; do the same
        // when this repository is the one on screen, or the binding would only
        // take effect on the next tab switch.
        if (profileId && activeRepoPath() === repoPath) store.setActiveProfile(profileId)
      }
      await gitApi.setProtectedBranches(repoPath, protectedBranches)
      toast('success', t('repoSettings.saved'))
      closeModal()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const name = repoDisplayName(repoPath, useSettingsStore.getState().settings.repoAliases, repo?.name)
  // "Remove from list" reads as "delete"; the confirm says the folder stays.
  // A dialog over the settings, not in their place: Cancel keeps them open.
  const confirmForget = (): void => {
    openDialog({
      kind: 'confirm',
      title: t('repos.forget'),
      message: interp(t('repos.forgetConfirm'), { name }),
      danger: true,
      confirmLabel: t('repos.forgetAction'),
      onConfirm: () => {
        void useReposStore
          .getState()
          .forget(repoPath)
          .then(() => {
            toast('success', interp(t('repoSettings.removedFromList'), { name }))
            closeModal()
          })
          .catch((err: unknown) => toast('error', err instanceof Error ? err.message : String(err)))
      }
    })
  }

  return (
    <>
      {configFile && (
        <div className="repo-settings-banner" role="note">
          <FileCog size={15} />
          <span>{interp(t('repoSettings.configBanner'), { file: configFile })}</span>
          <button className="btn ghost small" onClick={() => onOpenPage('config')}>
            {t('repoSettings.configBannerOpen')} <ArrowRight size={13} />
          </button>
        </div>
      )}
      <div className="repo-settings-rows">
        <SettingRow label={t('repoSettings.displayName')} hint={t('repoSettings.displayNameHint')}>
          <input
            className="modal-input"
            value={alias}
            placeholder={repo?.name ?? ''}
            onChange={(e) => setAlias(e.target.value)}
          />
        </SettingRow>
        <SettingRow label={t('repoSettings.profile')} hint={t('repoSettings.profileHint')}>
          <select className="modal-input" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">{t('profile.auto')}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label={t('repoSettings.protectedBranches')} hint={t('repoSettings.protectedBranchesHint')}>
          {loading ? (
            <Loader2 size={15} className="spin" />
          ) : (
            <BranchMultiSelect
              options={branchOptions}
              value={protectedBranches}
              onChange={setProtected}
              placeholder={t('repoSettings.addBranch')}
            />
          )}
        </SettingRow>
        <SettingRow label={t('repoSettings.tabImage')} hint={t('repoSettings.tabImageHint')}>
          <RepoImagePicker
            repoPath={repoPath}
            value={imagePath}
            onChange={setImagePath}
            preview={imageFile && preview?.file === imageFile ? preview.url : null}
            invalid={imageBroken}
          />
          {imageBroken && (
            <p className="repo-image-warning" role="alert">
              <AlertTriangle size={13} /> {t('repoSettings.tabImageBroken')}
            </p>
          )}
        </SettingRow>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal} disabled={saving}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" onClick={() => void save()} disabled={saving || loading}>
          {saving ? <Loader2 size={14} className="spin" /> : null} {t('common.save')}
        </button>
      </div>
      <div className="repo-settings-rows repo-settings-danger">
        <SettingRow label={t('repoSettings.removeFromList')} hint={t('repoSettings.removeFromListHint')} danger>
          <button className="btn danger" onClick={confirmForget}>
            {t('repoSettings.removeFromListAction')}
          </button>
        </SettingRow>
      </div>
    </>
  )
}

export function RepoSettingsModal({ repoPath, initialTab }: { repoPath: string; initialTab?: string }): React.JSX.Element {
  const repo = useRepoStore((s) => s.repos[repoPath])
  const aliases = useSettingsStore((s) => s.settings.repoAliases)
  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)
  const t = useT()
  const [page, setPage] = useState<RepoSettingsPage>(() => resolveRepoSettingsPage(initialTab))
  const [vaultCount, setVaultCount] = useState<number | null>(null)
  const onVaultCount = useCallback((n: number) => setVaultCount(n), [])
  // Easter egg: five title clicks inside 1.5s open the cosmos view. Deliberately
  // undocumented — finding it is the point, so it stays out of docs/help and the
  // screenshot manifest.
  const titleClicks = useRef<number[]>([])

  // A second deep link while the modal is open (palette → Insights) moves it.
  useEffect(() => {
    if (initialTab) setPage(resolveRepoSettingsPage(initialTab))
  }, [initialTab])

  const onTitleClick = (): void => {
    const now = Date.now()
    const clicks = titleClicks.current.filter((ts) => now - ts < 1500)
    clicks.push(now)
    titleClicks.current = clicks
    if (clicks.length >= 5) {
      titleClicks.current = []
      useUIStore.getState().openCosmos(repoPath)
    }
  }

  const name = repoDisplayName(repoPath, aliases, repo?.name)
  const remote = getMainRemote(repo?.remotes ?? [], repo?.prProvider ?? null)
  const hostLabel = remote ? (remote.kind ? HOST_NAME[remote.kind] : remote.hostname) : null
  const pills = getRepoSettingsPills({ branchCount: repo ? repo.branches.locals.length : null, vaultCount })
  const current = findRepoSettingsNavItem(page)

  return (
    <div className="repo-settings repo-settings-shell">
      <header className="repo-settings-summary">
        <span className="repo-settings-avatar" aria-hidden="true">
          {getRepoInitials(name)}
        </span>
        <div className="repo-settings-summary-text">
          <h3 className="repo-settings-name" onClick={onTitleClick}>
            {name}
          </h3>
          <div className="repo-settings-meta">
            <span className="repo-settings-path" title={repoPath}>
              {repoPath}
            </span>
            {repo?.branches.current && (
              <span className="repo-settings-meta-item">
                <GitBranch size={12} /> {repo.branches.current}
              </span>
            )}
            <span className="repo-settings-meta-item">
              <Globe size={12} />
              {remote ? (
                <>
                  {remote.name}
                  {hostLabel && <span className="repo-settings-host">{hostLabel}</span>}
                </>
              ) : (
                t('repoSettings.noRemote')
              )}
            </span>
          </div>
        </div>
        {pills.length > 0 && (
          <div className="repo-settings-pills">
            {pills.map((p) => (
              <span key={p.id} className="repo-settings-pill" title={interp(t(p.titleKey), { n: p.count })}>
                {p.id === 'branches' ? <GitBranch size={12} /> : <KeyRound size={12} />}
                {interp(t(p.titleKey), { n: p.count })}
              </span>
            ))}
          </div>
        )}
      </header>
      <div className="repo-settings-layout">
        <nav className="repo-settings-nav" aria-label={t('repoSettings.title')}>
          {REPO_SETTINGS_NAV.map((group) => (
            <div key={group.id} className="repo-settings-nav-group">
              <span className="repo-settings-nav-heading">{t(group.labelKey)}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`repo-settings-nav-item ${page === item.id ? 'active' : ''}`}
                  data-tone={PAGE_TONE[item.id]}
                  aria-current={page === item.id ? 'page' : undefined}
                  onClick={() => setPage(item.id)}
                >
                  {PAGE_ICON[item.id]}
                  <span>{t(item.labelKey)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <section className="repo-settings-content">
          {/* The page title reads like a Settings page heading: icon, accent, rule. */}
          <div className="settings-general-header repo-settings-page-head">
            <h4 className="settings-section-title">
              {PAGE_ICON[page]} {t(current.labelKey)}
            </h4>
            <p className="settings-hint">{t(current.descriptionKey)}</p>
          </div>
          <div className="repo-settings-body">
            {page === 'general' && <GeneralTab repoPath={repoPath} onOpenPage={setPage} />}
            {page === 'config' && <RepoConfigTab repoPath={repoPath} />}
            {page === 'info' && <RepoInfoTab repoPath={repoPath} />}
            {page === 'vault' && <RepoVaultTab repoPath={repoPath} onCount={onVaultCount} />}
            {page === 'analytics' && <AnalyticsSection aiEnabled={aiEnabled} />}
            {page === 'insights' && <InsightsPage repoPath={repoPath} embedded />}
            {page === 'history' && <RepoHistorySection />}
            {page === 'logs' && <RepoLogsTab repoPath={repoPath} />}
          </div>
        </section>
      </div>
    </div>
  )
}
