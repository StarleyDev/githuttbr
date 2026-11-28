import githuttbrLaunch from '../assets/githuttbr-launch.png'
import { resolveWorktreeDir } from '../lib/branchMenu'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Globe, Cloud, Loader2, Search, Lock, FolderGit2, Folder, Plus, Check, ChevronDown, ChevronRight, RefreshCw, Sparkles, GitMerge, ArrowUpFromLine, TextCursorInput, FolderPlus } from 'lucide-react'
import { AzureLogo, BitbucketLogo, ForgejoLogo, GithubLogo, GitlabLogo } from './HostLogos'
import { useUIStore, type ModalSpec } from '../stores/ui'
import { LauncherBack } from './LauncherBack'
import { useClonesStore } from '../stores/clones'
import { cloneFolderName, cloneFolderNames } from '../lib/cloneBatch'
import { bindBeforeOpen, bindingAfterAddRemote, effectiveProfileId } from '../lib/repoProfile'
import { useSettingsStore, GROUP_COLORS } from '../stores/settings'
import { pickGroupColor } from '../lib/groupColors'
import { colorName } from './colorMenu'
import { hostingApi, gitApi, shellApi, aiApi } from '../infrastructure/api'
import { chooseRepositories } from '../openRepositories'
import { repoActions } from '../stores/repo'
import {
  defaultProfile,
  type CreateRepoOpts,
  type DivergedStrategy,
  type GroupTab,
  type RemoteOwner,
  type RemoteRepo,
  type RepoHost,
  type ResetStrategy
} from '../../../shared/types'
import { SettingsPanel } from './SettingsPanel'
import { LauncherPanel, type LauncherItem } from './Welcome'
import { confirmRemoveRecentRepo, confirmRemoveRepoFromGroup } from '../lib/repositoryMenuItems'
import { planWorktreeGroup, worktreeOpening, worktreeGroupName } from '../lib/worktrees'
import { AIConfigWizard } from './AIConfigWizard'
import { InteractiveRebase } from './InteractiveRebase'
import { ConflictRadar } from './ConflictRadar'
import { TeammateRadarModal } from './TeammateRadarModal'
import { ResetToCommitModal } from './ResetToCommitModal'
import { WorkItemBranchModal } from './WorkItemBranchModal'
import { RemoteAuthModal } from './RemoteAuthModal'
import { LocalCIModal } from './LocalCIModal'
import { KeychainConsentModal } from './KeychainConsentModal'
import { RangeDiffModal } from './RangeDiffModal'
import { AbsorbModal } from './AbsorbModal'
import { BranchCleanupModal } from './BranchCleanupModal'
import { CliEditModal } from './CliEditModal'
import { TimeMachineModal } from './TimeMachineModal'
import { ImportSettingsDialog } from './ImportSettingsDialog'
import { ExportSettingsDialog } from './ExportSettingsDialog'
import { RollbackConfirmDialog } from './RollbackConfirmDialog'
import { TimelapseModal } from './TimelapseModal'
import { AIPRReview } from './AIPRReview'
import { ReflogModal } from './ReflogModal'
import { BisectModal } from './BisectModal'
import { HooksModal } from './HooksModal'
import { LfsModal } from './LfsModal'
import { SparseCheckoutModal } from './SparseCheckoutModal'
import { CreatePRModal } from './CreatePRModal'
import { IgnoreModal } from './IgnoreModal'
import { PrPreviewModal } from './PrPreviewModal'
import { CodeSearchModal } from './CodeSearchModal'
import { StackModal } from './StackModal'
import { StackSubmitModal } from './StackSubmitModal'
import { GitflowModal } from './GitflowModal'
import { HistoryPurgeModal } from './HistoryPurgeModal'
import { SubtreeModal } from './SubtreeModal'
import { CleanModal } from './CleanModal'
import { ExportModal } from './ExportModal'
import { MaintenanceModal } from './MaintenanceModal'
import { MergeOptionsModal } from './MergeOptionsModal'
import { PushBranchesModal } from './PushBranchesModal'
import { ObjectExplorer } from './ObjectExplorer'
import { AttributesModal } from './AttributesModal'
import { CredentialsModal } from './CredentialsModal'
import { ReplaceModal } from './ReplaceModal'
import { ChangelogGenModal } from './ChangelogGenModal'
import { SnapshotsModal } from './SnapshotsModal'
import { TodosModal } from './TodosModal'
import { SecureShareModal } from './SecureShareModal'
import { SecureWorkspaceModal } from './SecureWorkspaceModal'
import { StashPartialModal } from './StashPartialModal'
import { CreateTagModal } from './CreateTagModal'
import { ErrorBoundary } from './ErrorBoundary'
import { CheatsheetModal } from './CheatsheetModal'
import { CreateIssueModal } from './CreateIssueModal'
import { RepoSettingsModal } from './RepoSettingsModal'
import { BranchFieldPicker } from './BranchFieldPicker'
import { useT, interp } from '../i18n'
import { readableError } from '../lib/gitErrorHint'
import { GitlabServerSelect } from './GitlabServerSelect'
import { GITLAB_COM, preferredGitlabBase } from '../../../shared/gitlabInstance'
import { defaultOptionIndex, isPickInput, normalizeOptions } from '../lib/launchInputs'
import { AIAccountsNotice } from './AIAccountsNotice'
import { ScannedReposModal } from './ScannedReposModal'

/**
 * After a scan, offer the folder tree as workspaces. Up-to-date rows stay
 * rather than hidden: staying silent about a folder the user knows is there
 * reads as a bug, not as tidiness.
 */
function ScanWorkspacesModal({
  spec
}: {
  spec: Extract<ModalSpec, { kind: 'scan-workspaces' }>
}): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const actionable = spec.candidates.filter((c) => c.newRepoPaths.length > 0)
  // Everything with something to add starts ticked, except the loose row: a
  // folder of odds and ends is rarely a context worth switching into.
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(actionable.filter((c) => !c.loose).map((c) => c.path))
  )

  const toggle = (path: string): void =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const confirm = (): void => {
    closeModal()
    spec.onConfirm(actionable.filter((c) => picked.has(c.path)))
  }

  return (
    <>
      <h3>{t('repos.wsTitle')}</h3>
      <p className="modal-hint">{interp(t('repos.wsIntro'), { root: spec.root })}</p>
      {spec.candidates.length === 0 ? (
        <p className="modal-hint">{t('repos.wsNone')}</p>
      ) : (
        <div className="ws-plan">
          {spec.candidates.map((c) => {
            const upToDate = c.newRepoPaths.length === 0
            return (
              <label key={c.path} className={`ws-plan-row${upToDate ? ' ws-plan-done' : ''}`}>
                <input
                  type="checkbox"
                  disabled={upToDate}
                  checked={picked.has(c.path)}
                  onChange={() => toggle(c.path)}
                />
                <span className="ws-plan-name">{c.name}</span>
                <span className="ws-plan-count">
                  {interp(t('repos.wsCount'), { n: c.repoPaths.length })}
                </span>
                <span className="ws-plan-note">
                  {upToDate
                    ? t('repos.wsUpToDate')
                    : c.existingWorkspaceId
                      ? interp(t('repos.wsMerge'), { n: c.newRepoPaths.length, name: c.name })
                      : c.loose
                        ? t('repos.wsLoose')
                        : ''}
                </span>
              </label>
            )
          })}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" disabled={picked.size === 0} onClick={confirm}>
          {t('repos.wsCreate')}
        </button>
      </div>
    </>
  )
}

function GroupColorModal({ spec }: { spec: Extract<ModalSpec, { kind: 'group-color' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const [custom, setCustom] = useState(spec.current ?? '')

  const select = (color: string): void => {
    closeModal()
    spec.onSelect(color)
  }

  return (
    <>
      <h3>{t('modal.groupColor')}</h3>
      <div className="group-color-swatches">
        {GROUP_COLORS.map((c) => (
          <button
            key={c}
            className={`group-color-swatch ${spec.current === c ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => select(c)}
          >
            {spec.current === c && <Check size={12} />}
          </button>
        ))}
      </div>
      <label className="modal-label">{t('modal.customColor')}</label>
      <div className="group-color-custom">
        <input
          type="color"
          className="group-color-input"
          value={custom || '#6366f1'}
          onChange={(e) => setCustom(e.target.value)}
        />
        <input
          className="modal-input"
          value={custom}
          placeholder={t('modal.colorPlaceholder')}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && custom) select(custom) }}
        />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!custom} onClick={() => select(custom)}>{t('modal.apply')}</button>
      </div>
    </>
  )
}

function NewGroupModal({ spec }: { spec: Extract<ModalSpec, { kind: 'new-group' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const tabs = useSettingsStore((s) => s.settings.tabs)
  const [name, setName] = useState('')
  // Preselected so Enter alone still works; one no open group already wears.
  const [color, setColor] = useState(() => pickGroupColor(tabs.map((x) => (x.kind === 'group' ? x.color : undefined))))

  const submit = (): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    closeModal()
    spec.onCreate(trimmed, color)
  }

  return (
    <>
      <h3 className="modal-title-row">
        {spec.back && <LauncherBack target={spec.back} />}
        <FolderPlus size={17} /> {t('welcome.newGroup')}
      </h3>
      <label className="modal-label">{t('welcome.groupName')}</label>
      <input
        autoFocus
        className="modal-input"
        value={name}
        placeholder={t('welcome.groupNamePlaceholder')}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') closeModal()
        }}
      />
      <label className="modal-label">{t('modal.color')}</label>
      <div className="group-color-swatches compact" role="radiogroup" aria-label={t('modal.color')}>
        {GROUP_COLORS.map((c) => (
          <button
            key={c}
            className={`group-color-swatch ${color === c ? 'selected' : ''}`}
            style={{ background: c }}
            role="radio"
            aria-checked={color === c}
            aria-label={colorName(c)}
            title={colorName(c)}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" disabled={!name.trim()} onClick={submit}>
          {t('common.create')}
        </button>
      </div>
    </>
  )
}

/** A worktree is opening while its family is already on the strip. 'convert'
 *  asks for the group's name (prefilled with the root's); 'add' just confirms
 *  joining the existing group. */
function WorktreeGroupModal({ spec }: { spec: Extract<ModalSpec, { kind: 'worktree-group' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const plan = spec.plan
  const converting = plan.kind === 'convert'
  const [name, setName] = useState(plan.kind === 'convert' ? plan.defaultName : plan.groupName)
  const groupName = plan.kind === 'add' ? plan.groupName : ''

  const submit = (choice: 'group' | 'separate'): void => {
    closeModal()
    spec.onResolve(choice, name)
  }

  return (
    <>
      <h3 className="modal-title-row">
        <FolderGit2 size={17} />
        {converting ? t('modal.worktreeGroupTitle') : interp(t('modal.worktreeGroupAddTitle'), { name: groupName })}
      </h3>
      <div className="modal-hint">
        {converting
          ? interp(t('modal.worktreeGroupHint'), { worktree: spec.repo.name })
          : interp(t('modal.worktreeGroupAddHint'), { worktree: spec.repo.name, name: groupName })}
      </div>
      {converting && (
        <>
          <label className="modal-label">{t('welcome.groupName')}</label>
          <input
            autoFocus
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit('group')
              if (e.key === 'Escape') submit('separate')
            }}
          />
        </>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => submit('separate')} type="button">
          {t('modal.worktreeGroupSeparate')}
        </button>
        <button className="btn primary" onClick={() => submit('group')} type="button">
          {converting ? t('modal.worktreeGroupCreate') : t('modal.worktreeGroupAdd')}
        </button>
      </div>
    </>
  )
}

function InputModal({
  spec,
  onClose
}: {
  spec: Extract<ModalSpec, { kind: 'input' }>
  /** How this one closes — the modal slot by default, the stacked dialog otherwise. */
  onClose?: () => void
}): React.JSX.Element {
  const t = useT()
  const storeClose = useUIStore((s) => s.closeModal)
  const closeModal = onClose ?? storeClose
  const [value, setValue] = useState(spec.initial ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  // A question asked again straight after an answer (a wrong password) lands on
  // this same instance: the stacked dialog keeps one key, and AnimatePresence
  // revives the copy still animating out. Start it from the new spec, not from
  // the refused answer.
  const [shownSpec, setShownSpec] = useState(spec)
  if (shownSpec !== spec) {
    setShownSpec(spec)
    setValue(spec.initial ?? '')
  }
  // A password is taken as typed: a leading or trailing space is part of it.
  const answer = spec.secret ? value : value.trim()
  const canSubmit = spec.allowEmpty || !!answer

  // Same contract as ConfirmModal: every way out but a submit ends this effect,
  // so a caller waiting on the answer always gets one.
  const answered = useRef(false)
  useEffect(() => {
    answered.current = false
    // autoFocus only fires on mount; a revived dialog has to take focus itself.
    inputRef.current?.focus()
    return () => {
      const { modal, dialog } = useUIStore.getState()
      if (!answered.current && modal !== spec && dialog !== spec) spec.onCancel?.()
    }
  }, [spec])

  const submit = (): void => {
    if (!canSubmit) return
    answered.current = true
    closeModal()
    spec.onSubmit(answer)
  }

  return (
    <>
      <h3>{spec.title}</h3>
      <label className="modal-label">{spec.label}</label>
      <input
        ref={inputRef}
        autoFocus
        className="modal-input"
        type={spec.secret ? 'password' : 'text'}
        autoComplete={spec.secret ? 'off' : undefined}
        spellCheck={spec.secret ? false : undefined}
        value={value}
        placeholder={spec.placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            // Handled here: left to bubble, the window's Esc listener would find
            // the stacked dialog already gone and close the modal underneath too.
            e.stopPropagation()
            closeModal()
          }
        }}
      />
      {spec.error && (
        <p className="modal-input-error" role="alert">
          {spec.error}
        </p>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" disabled={!canSubmit} onClick={submit}>
          {spec.submitLabel ?? 'OK'}
        </button>
      </div>
    </>
  )
}

/**
 * One `${input:id}` prompt from a launch.json `inputs` array, VS Code-style:
 * a `pickString` renders its options as a real picker (default preselected,
 * arrow keys + Enter, click to choose); a `promptString` is a text field,
 * masked when the input is marked `password`.
 */
function LaunchInputModal({ spec }: { spec: Extract<ModalSpec, { kind: 'launch-input' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const { input } = spec
  const pick = isPickInput(input)
  const options = normalizeOptions(input)
  const [selected, setSelected] = useState(() => defaultOptionIndex(input))
  const [value, setValue] = useState(input.default ?? '')
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (pick) listRef.current?.focus()
  }, [pick])

  const submit = (v: string): void => {
    closeModal()
    spec.onSubmit(v)
  }

  const onPickKeys = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      submit(options[selected].value)
    } else if (e.key === 'Escape') {
      closeModal()
    }
  }

  return (
    <>
      <h3 className="modal-title-row">
        <TextCursorInput size={17} /> {input.description || interp(t('launch.inputTitle'), { id: input.id })}
      </h3>
      {spec.total > 1 && (
        <p className="modal-message launch-input-step">
          {interp(t('launch.inputStep'), { current: String(spec.step), total: String(spec.total) })}
        </p>
      )}
      {pick ? (
        <>
          <div className="launch-input-options" role="listbox" tabIndex={0} ref={listRef} onKeyDown={onPickKeys}>
            {options.map((o, i) => (
              <button
                key={`${o.value}-${i}`}
                role="option"
                aria-selected={i === selected}
                className={`launch-input-option${i === selected ? ' selected' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => submit(o.value)}
              >
                <span className="launch-input-option-label">{o.label}</span>
                {o.value !== o.label && <span className="launch-input-option-value">{o.value}</span>}
                {o.value === input.default && <Check size={13} className="launch-input-default-mark" />}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={closeModal}>
              {t('common.cancel')}
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            autoFocus
            className="modal-input"
            type={input.password ? 'password' : 'text'}
            value={value}
            placeholder={input.default ?? ''}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(value)
              if (e.key === 'Escape') closeModal()
            }}
          />
          <div className="modal-actions">
            <button className="btn ghost" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button className="btn primary" onClick={() => submit(value)}>
              {t('launch.inputSubmit')}
            </button>
          </div>
        </>
      )}
    </>
  )
}

function CreateBranchModal({ spec }: { spec: Extract<ModalSpec, { kind: 'create-branch' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const toast = useUIStore((s) => s.toast)
  const profile = useSettingsStore((s) => s.activeProfile())
  const aiFor = useSettingsStore((s) => s.aiFor)
  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)

  const [name, setName] = useState(spec.initialName ?? '')
  const [description, setDescription] = useState(spec.description ?? '')
  const [aiBusy, setAiBusy] = useState(false)

  const submit = (): void => {
    if (!name.trim()) return
    closeModal()
    void repoActions.createBranch(spec.path, name.trim())
  }

  const generate = async (): Promise<void> => {
    if (!description.trim() || aiBusy) return
    setAiBusy(true)
    try {
      const suggested = await aiApi.generateBranchName(description.trim(), { ...aiFor('commit'), cliCwd: spec.path }, {
        username: profile.gitName || undefined
      })
      if (suggested.trim()) setName(suggested.trim())
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <>
      <h3>{t('modal.createBranch')}</h3>

      {aiEnabled && (
        <div className="cb-ai">
          <label className="modal-label">{t('modal.branchTaskLabel')}</label>
          <div className="cb-ai-row">
            <input
              className="modal-input"
              value={description}
              placeholder={t('modal.branchTaskPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void generate()
                if (e.key === 'Escape') closeModal()
              }}
            />
            <button className="btn ghost" onClick={() => void generate()} disabled={aiBusy || !description.trim()}>
              {aiBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} {t('modal.generate')}
            </button>
          </div>
        </div>
      )}

      <label className="modal-label">
        {spec.currentBranch ? interp(t('modal.branchFrom'), { branch: spec.currentBranch }) : t('modal.branchNameLabel')}
      </label>
      <input
        autoFocus
        className="modal-input"
        value={name}
        placeholder={t('modal.branchNamePlaceholder')}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') closeModal()
        }}
      />
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!name.trim()} onClick={submit}>{t('modal.createCheckout')}</button>
      </div>
    </>
  )
}

const REMOTE_PROVIDERS = [
  { id: 'url', label: 'URL' },
  { id: 'github', label: 'GitHub' },
  { id: 'gitlab', label: 'GitLab' },
  { id: 'bitbucket', label: 'Bitbucket' },
  { id: 'azure', label: 'Azure DevOps' },
  { id: 'forgejo', label: 'Forgejo' }
] as const

type RemoteProviderId = (typeof REMOTE_PROVIDERS)[number]['id']

const HOST_META: Record<
  RepoHost,
  { label: string; tokenField: 'githubToken' | 'gitlabToken' | 'bitbucketToken' | 'azureToken' | 'forgejoToken' }
> = {
  github: {
    label: 'GitHub',
    tokenField: 'githubToken'
  },
  gitlab: {
    label: 'GitLab',
    tokenField: 'gitlabToken'
  },
  bitbucket: {
    label: 'Bitbucket',
    tokenField: 'bitbucketToken'
  },
  azure: {
    label: 'Azure DevOps',
    tokenField: 'azureToken'
  },
  forgejo: {
    label: 'Forgejo',
    tokenField: 'forgejoToken'
  }
}

const PROVIDER_ICONS: Record<RemoteProviderId, React.ComponentType<{ size?: number }>> = {
  url: Globe,
  github: GithubLogo,
  gitlab: GitlabLogo,
  bitbucket: BitbucketLogo,
  azure: AzureLogo,
  forgejo: ForgejoLogo
}

function repoToName(repo: RemoteRepo): string {
  return cloneFolderName(repo.name)
}

/** Integration-backed repository picker shown for provider tabs. */
function RepoPicker({
  host,
  onPick,
  selectedUrl,
  selectedUrls,
  onToggle,
  onToggleAll,
  profileId,
  onProfile,
  matchName
}: {
  host: RepoHost
  /** A row click: this repository alone. */
  onPick: (repo: RemoteRepo) => void
  selectedUrl: string
  /** Multi-select (the clone dialog): rows get a checkbox that adds or removes. */
  selectedUrls?: string[]
  onToggle?: (repo: RemoteRepo) => void
  onToggleAll?: (repos: RemoteRepo[], on: boolean) => void
  profileId: string
  onProfile: (id: string) => void
  matchName?: string
}): React.JSX.Element {
  const t = useT()
  const openModal = useUIStore((s) => s.openModal)
  const closeModal = useUIStore((s) => s.closeModal)
  const profiles = useSettingsStore((s) => s.settings.profiles)
  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0] ?? defaultProfile()
  const meta = HOST_META[host]
  const token = profile[meta.tokenField] ?? ''
  const HostIcon = PROVIDER_ICONS[host]

  const [org, setOrg] = useState('')
  // GitLab: gitlab.com or one of the profile's servers — main only honours a
  // server some profile names. Remembered per profile, so another pick starts
  // from its own preferred server in the same render — no second load.
  const [gitlabPick, setGitlabPick] = useState(() => ({ profileId: profile.id, base: preferredGitlabBase(profile) }))
  const gitlabBase = gitlabPick.profileId === profile.id ? gitlabPick.base : preferredGitlabBase(profile)
  const setGitlabBase = (base: string): void => setGitlabPick({ profileId: profile.id, base })
  const scope = host === 'gitlab' ? (gitlabBase === GITLAB_COM ? undefined : gitlabBase) : org
  const [repos, setRepos] = useState<RemoteRepo[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // Only the latest request may answer: a list for the profile picked a moment
  // ago must not land under the one picked now.
  const latestLoad = useRef(0)

  const load = async (): Promise<void> => {
    const id = ++latestLoad.current
    setLoading(true)
    setError(null)
    try {
      // The picked profile, by id: main resolves a server's token from it, and
      // the clone that follows signs in and binds as the same one.
      const list = await hostingApi.listRepos(host, token, scope, profile.id)
      if (id === latestLoad.current) setRepos(list)
    } catch (e) {
      if (id !== latestLoad.current) return
      setError(e instanceof Error ? e.message : String(e))
      setRepos(null)
    } finally {
      if (id === latestLoad.current) setLoading(false)
    }
  }

  // Auto-load for providers that don't need extra input.
  useEffect(() => {
    setRepos(null)
    setError(null)
    setSearch('')
    // A typed token is optional: the main process can borrow the credential
    // Git already uses, including one supplied by `gh auth login`.
    if (host !== 'azure') void load()
    // Azure waits for an organization: whatever is in flight is no longer wanted.
    else latestLoad.current++
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, token, profile.id, gitlabBase])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!repos) return []
    const list = q ? repos.filter((r) => r.name.toLowerCase().includes(q)) : [...repos]
    const m = matchName?.trim().toLowerCase()
    if (!m) return list
    // Surface repos matching the local folder name without hiding the rest.
    const rank = (r: RemoteRepo): number => {
      const base = r.name.toLowerCase().split('/').pop() ?? r.name.toLowerCase()
      if (base === m) return 0
      if (base.includes(m) || m.includes(base)) return 1
      return 2
    }
    return list.sort((a, b) => rank(a) - rank(b))
  }, [repos, search, matchName])

  const isSelected = (repo: RemoteRepo): boolean =>
    selectedUrls ? selectedUrls.includes(repo.url) : selectedUrl === repo.url
  const allShownSelected = filtered.length > 0 && filtered.every(isSelected)

  const profileSelector = profiles.length > 1 && (
    <label className="repo-profile">
      <span>{t('modal.account')}</span>
      <select value={profileId} onChange={(e) => onProfile(e.target.value)}>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="repo-picker">
      {profileSelector}
      {host === 'gitlab' && <GitlabServerSelect profile={profile} value={gitlabBase} onChange={setGitlabBase} />}
      {host === 'azure' && (
        <div className="repo-org-row">
          <input
            className="modal-input"
            value={org}
            placeholder={t('modal.orgPlaceholder')}
            onChange={(e) => setOrg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && org.trim() && void load()}
          />
          <button className="btn ghost" type="button" disabled={!org.trim() || loading} onClick={() => void load()}>
            {t('modal.load')}
          </button>
        </div>
      )}

      {repos && repos.length > 0 && (
        <div className="repo-search">
          <Search size={13} />
          <input value={search} placeholder={t('modal.repoFilterPlaceholder')} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {onToggleAll && repos && filtered.length > 0 && (
        <div className="repo-select-bar">
          <button className="link-btn" type="button" onClick={() => onToggleAll(filtered, !allShownSelected)}>
            {allShownSelected ? t('clone.selectNone') : t('clone.selectAll')}
          </button>
          {!!selectedUrls?.length && (
            <span className="repo-select-count">{interp(t('clone.selectedCount'), { count: selectedUrls.length })}</span>
          )}
        </div>
      )}

      <div className="repo-list">
        {loading && (
          <div className="repo-list-state">
            <Loader2 size={16} className="spin" /> {t('modal.loadingRepos')}
          </div>
        )}
        {!loading && error && (
          <div className="repo-list-state danger">
            <span>{readableError(error, t, interp)}</span>
            <div className="remote-connect-actions">
              <button className="link-btn" type="button" onClick={() => void load()}>
                {t('modal.retry')}
              </button>
              <button
                className="link-btn"
                type="button"
                onClick={() => {
                  closeModal()
                  openModal({ kind: 'settings', page: 'integrations' })
                }}
              >
                {interp(t('modal.connect'), { service: meta.label })}
              </button>
            </div>
          </div>
        )}
        {!loading && !error && repos && filtered.length === 0 && (
          <div className="repo-list-state">{t('modal.noRepos')}</div>
        )}
        {!loading &&
          !error &&
          filtered.map((repo) => (
            <button
              key={repo.url || repo.name}
              type="button"
              className={`repo-row ${isSelected(repo) ? 'selected' : ''}`}
              onClick={() => onPick(repo)}
            >
              {onToggle && (
                // The checkbox adds to the selection; the rest of the row picks this one alone.
                <input
                  type="checkbox"
                  className="repo-row-check"
                  checked={isSelected(repo)}
                  aria-label={interp(t('clone.toggleRepo'), { name: repo.name })}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggle(repo)}
                />
              )}
              {repo.avatarUrl ? (
                <img className="repo-row-avatar" src={repo.avatarUrl} alt="" loading="lazy" />
              ) : (
                <span className="repo-row-avatar fallback">
                  <HostIcon size={13} />
                </span>
              )}
              <span className="repo-row-name">{repo.name}</span>
              {repo.private && <Lock size={11} className="repo-row-lock" />}
            </button>
          ))}
      </div>
    </div>
  )
}

/** Account/org/workspace selector backed by the host's `listOwners` API. */
function OwnerSelect({
  host,
  token,
  org,
  profileId,
  value,
  onChange
}: {
  host: RepoHost
  token: string
  org?: string
  /** The profile picked in the dialog — the one whose accounts are listed. */
  profileId: string
  value: RemoteOwner | null
  onChange: (owner: RemoteOwner | null) => void
}): React.JSX.Element {
  const t = useT()
  const [owners, setOwners] = useState<RemoteOwner[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    let cancelled = false
    if (host === 'azure' && !org?.trim()) {
      setOwners(null)
      return
    }
    setLoading(true)
    setError(null)
    hostingApi
      .listOwners(host, token, org, profileId)
      .then((list) => {
        if (cancelled) return
        setOwners(list)
        if (list.length && !value) onChange(list[0])
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, token, org, profileId])

  if (loading) {
    return (
      <div className="repo-list-state">
        <Loader2 size={14} className="spin" /> {t('modal.loadingAccounts')}
      </div>
    )
  }
  if (error) return <div className="modal-hint danger">{readableError(error, t, interp)}</div>
  if (!owners?.length) return <div className="modal-hint">{t('modal.noAccounts')}</div>

  const HostIcon = PROVIDER_ICONS[host]
  const avatar = (o: RemoteOwner | null): React.JSX.Element =>
    o?.avatarUrl ? (
      <img className="repo-row-avatar" src={o.avatarUrl} alt="" loading="lazy" />
    ) : (
      <span className="repo-row-avatar fallback">
        <HostIcon size={13} />
      </span>
    )

  return (
    <div className="owner-select" ref={ddRef}>
      <button type="button" className="owner-trigger" onClick={() => setOpen((v) => !v)}>
        {avatar(value)}
        <span className="owner-label">
          {value ? value.login : t('modal.selectAccount')}
          {value && value.type !== 'user' && <span className="owner-tag">{t('modal.orgTag')}</span>}
        </span>
        <ChevronDown size={14} className="owner-chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="owner-menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            {owners.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`owner-option ${value?.id === o.id ? 'selected' : ''}`}
                onClick={() => {
                  onChange(o)
                  setOpen(false)
                }}
              >
                {avatar(o)}
                <span className="owner-label">
                  {o.login}
                  {o.type !== 'user' && <span className="owner-tag">{t('modal.orgTag')}</span>}
                </span>
                {value?.id === o.id && <Check size={13} className="owner-check" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Bind the repository to the profile picked in Add remote, when it is not the
 * one the repository already acts as, and write it before returning — main
 * reads the binding for the push that follows.
 */
async function bindToPicked(path: string, picked: string): Promise<void> {
  const store = useSettingsStore.getState()
  const bind = bindingAfterAddRemote(store.settings, path, picked)
  if (!bind) return
  store.setRepoProfile(path, bind)
  await store.flush()
}

/** Add the remote, then finish the fetch/pull/push that opened this dialog. */
function finishAddRemote(
  spec: Extract<ModalSpec, { kind: 'addRemote' }>,
  name: string,
  url: string,
  pushUrl?: string
): void {
  if (spec.resume === 'push') {
    void repoActions.addRemoteAndPush(spec.path, name, url, pushUrl)
    return
  }
  void repoActions.addRemote(spec.path, name, url, pushUrl).then((ok) => {
    if (ok && spec.resume === 'pull') void repoActions.pull(spec.path, 'default')
  })
}

/** Create-a-new-repo form for a host, with a fallback to attach an existing repo. */
function ProviderCreateForm({
  host,
  spec,
  profileId,
  onProfile
}: {
  host: RepoHost
  spec: Extract<ModalSpec, { kind: 'addRemote' }>
  profileId: string
  onProfile: (id: string) => void
}): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const toast = useUIStore((s) => s.toast)
  const profiles = useSettingsStore((s) => s.settings.profiles)
  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0] ?? defaultProfile()
  const token = profile[HOST_META[host].tokenField] ?? ''

  const [mode, setMode] = useState<'create' | 'existing'>('create')
  const [owner, setOwner] = useState<RemoteOwner | null>(null)
  // Seeded from the profile so the organization already configured in Settings
  // does not have to be typed a second time here.
  const [azureOrg, setAzureOrg] = useState(profile.azureOrg ?? '')
  const [gitlabBase, setGitlabBase] = useState(() => preferredGitlabBase(profile))
  // Another profile (picked in either mode) has its own servers, organization
  // and accounts: start again from its own, or listOwners/createRepo would send
  // the new profile with the old one's server.
  const seededFor = useRef(profile.id)
  useEffect(() => {
    if (seededFor.current === profile.id) return
    seededFor.current = profile.id
    setOwner(null)
    setAzureOrg(profile.azureOrg ?? '')
    setGitlabBase(preferredGitlabBase(profile))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])
  // Azure scopes by organization, GitLab by server (absent = gitlab.com).
  const scope = host === 'azure' ? azureOrg : host === 'gitlab' && gitlabBase !== GITLAB_COM ? gitlabBase : undefined
  const [repoName, setRepoName] = useState(spec.matchName ?? '')
  const [remoteName, setRemoteName] = useState(spec.defaultName || 'origin')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [busy, setBusy] = useState(false)
  // existing-repo path
  const [existingUrl, setExistingUrl] = useState('')

  const duplicate = spec.existingNames.includes(remoteName.trim())
  const canCreate = !!repoName.trim() && !!remoteName.trim() && !duplicate && !!owner && !busy
  const canAttach = !!existingUrl.trim() && !!remoteName.trim() && !duplicate && !busy

  const create = async (): Promise<void> => {
    if (!canCreate || !owner) return
    setBusy(true)
    try {
      const opts: CreateRepoOpts = {
        owner: host === 'azure' ? owner.id : owner.login,
        ownerType: owner.type,
        ownerId: host === 'gitlab' ? owner.id : undefined,
        project: host === 'azure' ? owner.login : undefined,
        name: repoName.trim(),
        description: description.trim() || undefined,
        private: isPrivate
      }
      const repo = await hostingApi.createRepo(host, token, opts, scope, profile.id)
      closeModal()
      // Created as the picked profile: push and every later call go as it too.
      await bindToPicked(spec.path, profile.id)
      await repoActions.addRemoteAndPush(spec.path, remoteName.trim(), repo.url)
    } catch (e) {
      setBusy(false)
      toast('error', e instanceof Error ? e.message : String(e))
    }
  }

  const attach = async (): Promise<void> => {
    if (!canAttach) return
    closeModal()
    // Listed as the picked profile: the fetch or push that follows goes as it too.
    await bindToPicked(spec.path, profile.id)
    finishAddRemote(spec, remoteName.trim(), existingUrl.trim())
  }

  const remoteNameField = (
    <>
      <label className="modal-label">{t('modal.remoteName')}</label>
      <input
        className="modal-input"
        value={remoteName}
        placeholder="origin"
        onChange={(e) => setRemoteName(e.target.value)}
      />
      {duplicate && (
        <div className="modal-hint danger">{interp(t('modal.remoteExists'), { name: remoteName.trim() })}</div>
      )}
    </>
  )

  return (
    <>
      <div className="remote-mode-toggle">
        <button
          type="button"
          className={mode === 'create' ? 'active' : ''}
          onClick={() => setMode('create')}
        >
          <Plus size={13} /> {t('modal.remoteModeCreate')}
        </button>
        <button
          type="button"
          className={mode === 'existing' ? 'active' : ''}
          onClick={() => setMode('existing')}
        >
          <Search size={13} /> {t('modal.remoteModeExisting')}
        </button>
      </div>

      {mode === 'create' ? (
        <>
          {host === 'azure' && (
            <>
              <label className="modal-label">{t('modal.organization')}</label>
              <input
                className="modal-input"
                value={azureOrg}
                placeholder="my-azure-org"
                onChange={(e) => setAzureOrg(e.target.value)}
              />
            </>
          )}
          {host === 'gitlab' && (
            <GitlabServerSelect
              profile={profile}
              value={gitlabBase}
              onChange={(base) => {
                setOwner(null)
                setGitlabBase(base)
              }}
            />
          )}
          <label className="modal-label">{host === 'azure' ? t('modal.project') : t('modal.account')}</label>
          <OwnerSelect host={host} token={token} org={scope} profileId={profile.id} value={owner} onChange={setOwner} />

          <label className="modal-label">{t('modal.repositoryName')}</label>
          <input
            autoFocus
            className="modal-input"
            value={repoName}
            placeholder="my-repo"
            onChange={(e) => setRepoName(e.target.value)}
          />

          {remoteNameField}

          <label className="modal-label">{t('modal.description')}</label>
          <input
            className="modal-input"
            value={description}
            placeholder={t('modal.optional')}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label className="modal-label">{t('modal.access')}</label>
          <select className="modal-input" value={isPrivate ? 'private' : 'public'} onChange={(e) => setIsPrivate(e.target.value === 'private')}>
            <option value="public">{t('modal.public')}</option>
            <option value="private">{t('modal.private')}</option>
          </select>

          <div className="modal-actions">
            <button className="btn ghost" onClick={closeModal} type="button">
              {t('common.cancel')}
            </button>
            <button className="btn primary" disabled={!canCreate} onClick={() => void create()} type="button">
              {busy ? <Loader2 size={14} className="spin" /> : t('modal.createRemoteAndPush')}
            </button>
          </div>
        </>
      ) : (
        <>
          <RepoPicker
            host={host}
            onPick={(repo) => setExistingUrl(repo.url)}
            selectedUrl={existingUrl}
            profileId={profileId}
            onProfile={onProfile}
            matchName={spec.matchName}
          />
          {remoteNameField}
          {existingUrl && <div className="modal-hint">{existingUrl}</div>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={closeModal} type="button">
              {t('common.cancel')}
            </button>
            <button className="btn primary" disabled={!canAttach} onClick={() => void attach()} type="button">
              {t('modal.addRemote')}
            </button>
          </div>
        </>
      )}
    </>
  )
}

function AddWorktreeModal({ spec }: { spec: Extract<ModalSpec, { kind: 'add-worktree' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const [base, setBase] = useState(spec.current)
  const [newBranch, setNewBranch] = useState('')
  // null = the folder field still follows the suggested path. The Browse button
  // fills `browseParent`; a typed value fills `dirOverride`.
  const [dirOverride, setDirOverride] = useState<string | null>(null)
  const [browseParent, setBrowseParent] = useState<string | null>(null)
  const [openAfter, setOpenAfter] = useState(true)

  const parent = spec.path.slice(0, spec.path.length - spec.repoName.length - 1)
  const creatingNew = newBranch.trim().length > 0
  const effectiveBranch = creatingNew ? newBranch.trim() : base
  const suggestedDir = browseParent
    ? `${browseParent}/${effectiveBranch}`
    : spec.suggestDir(effectiveBranch)
  const finalDir = (dirOverride ?? suggestedDir).trim()
  const baseBusy = spec.busyBranches.includes(base)
  const branchClash = spec.locals.some((b) => b.name === effectiveBranch) && creatingNew
  const dirUsed = spec.worktreePaths.some(
    (p) => p.replace(/\\/g, '/').replace(/\/+$/, '') === resolvedDir(finalDir).replace(/\\/g, '/').replace(/\/+$/, '')
  )
  const invalid = !finalDir || (!creatingNew && baseBusy) || branchClash || dirUsed

  // openRepoTab needs an absolute path — resolve ../ against the repo parent.
  // A declaration, not a const: `dirUsed` above calls it during the same render.
  function resolvedDir(d: string): string {
    return resolveWorktreeDir(parent, d)
  }

  const browse = async (): Promise<void> => {
    const picked = await window.api.selectDirectory(t('modal.worktreeBrowseTitle'))
    if (picked) {
      // The chosen folder is the PARENT — the worktree lands in a new
      // branch-named folder inside it. Picking an existing folder directly is
      // the classic "already exists" fatal.
      setBrowseParent(picked.replace(/[\\/]+$/, ''))
      setDirOverride(null)
    }
  }

  const indexCodegraph = useSettingsStore((s) => s.settings.codegraphIndexWorktrees === true)
  const autoGroup = useSettingsStore((s) => s.settings.worktreeAutoGroup === true)
  const copyIgnored = useSettingsStore((s) => s.settings.worktreeCopyIgnored === true)
  const updateSettings = useSettingsStore((s) => s.update)
  const [groupName, setGroupName] = useState(() => worktreeGroupName(spec.rootPath))
  // What grouping can actually do once the worktree lands: join an existing
  // family group, convert the standalone root tab into a new group, or
  // nothing — no family member is open.
  const tabs = useSettingsStore((s) => s.settings.tabs)
  // Always worked out: a project kept in a group takes its worktrees in,
  // checkbox or not — the checkbox only decides about making a new group.
  const groupPlan = planWorktreeGroup(tabs, spec.rootPath)
  const opening = worktreeOpening(groupPlan, autoGroup)

  const submit = (): void => {
    if (invalid) return
    closeModal()
    void repoActions
      .worktreeAdd(spec.path, finalDir, effectiveBranch, creatingNew, creatingNew ? base : undefined)
      .then((ok) => {
        if (!ok || !openAfter) return
        useSettingsStore
          .getState()
          .openWorktreeRepo(
            { path: resolvedDir(finalDir), name: `${spec.repoName} · ${effectiveBranch}` },
            spec.rootPath,
            opening === 'join' && groupPlan?.kind === 'add'
              ? groupPlan.groupName
              : opening === 'offer'
                ? groupName
                : undefined
          )
      })
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') submit()
    if (e.key === 'Escape') closeModal()
  }

  return (
    <>
      <h3 className="modal-title-row">
        <FolderGit2 size={17} /> {t('sidebar.addWorktree')}
      </h3>

      <label className="modal-label">{t('modal.worktreeBaseBranch')}</label>
      <BranchFieldPicker
        branches={spec.locals}
        value={base}
        onChange={setBase}
        ariaLabel={t('modal.worktreeBaseBranch')}
      />

      <label className="modal-label">{t('modal.worktreeNewBranch')}</label>
      <input
        autoFocus
        className="modal-input"
        value={newBranch}
        placeholder={t('modal.branchNamePlaceholder')}
        onChange={(e) => setNewBranch(e.target.value)}
        onKeyDown={onKey}
      />
      {creatingNew ? (
        <div className="modal-hint">{interp(t('modal.worktreeNewBranchFrom'), { base })}</div>
      ) : (
        <div className={`modal-hint ${baseBusy ? 'danger' : ''}`}>
          {baseBusy ? interp(t('modal.worktreeBranchBusy'), { base }) : interp(t('modal.worktreeNewBranchHint'), { base })}
        </div>
      )}
      {branchClash && <div className="modal-hint danger">{interp(t('modal.worktreeBranchClash'), { branch: effectiveBranch })}</div>}

      <label className="modal-label">{t('modal.worktreeFolder')}</label>
      <div className="repo-org-row">
        <input
          className="modal-input"
          value={dirOverride ?? suggestedDir}
          onChange={(e) => {
            setDirOverride(e.target.value)
            setBrowseParent(null)
          }}
          onKeyDown={onKey}
        />
        <button className="btn ghost" onClick={() => void browse()} type="button">
          {t('modal.browse')}
        </button>
      </div>
      {dirUsed && <div className="modal-hint danger">{t('modal.worktreeDirUsed')}</div>}

      <label className="clone-partial">
        <input type="checkbox" checked={openAfter} onChange={(e) => setOpenAfter(e.target.checked)} />
        <span>{t('modal.worktreeOpenAfter')}</span>
      </label>

      <label className="clone-partial">
        <input
          type="checkbox"
          checked={indexCodegraph}
          onChange={(e) => updateSettings((s) => ({ ...s, codegraphIndexWorktrees: e.target.checked }))}
        />
        <span>{t('modal.worktreeIndexCodegraph')}</span>
      </label>

      {/* The project lives in a group: the worktree goes there, said once in
          plain words rather than behind a checkbox. */}
      {groupPlan?.kind === 'add' ? (
        <div className="modal-hint">
          {interp(t('modal.worktreeGroupJoin'), { name: groupPlan.groupName })}
        </div>
      ) : (
        <label className="clone-partial">
          <input
            type="checkbox"
            checked={autoGroup}
            onChange={(e) => updateSettings((s) => ({ ...s, worktreeAutoGroup: e.target.checked }))}
          />
          <span>{t('modal.worktreeAutoGroup')}</span>
        </label>
      )}
      {autoGroup && groupPlan?.kind === 'convert' && (
        <>
          <label className="modal-label">{t('modal.worktreeGroupName')}</label>
          <input
            className="modal-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={onKey}
          />
        </>
      )}
      {autoGroup && !groupPlan && (
        <div className="modal-hint">{t('modal.worktreeGroupNone')}</div>
      )}

      <label className="clone-partial">
        <input
          type="checkbox"
          checked={copyIgnored}
          onChange={(e) => updateSettings((s) => ({ ...s, worktreeCopyIgnored: e.target.checked }))}
        />
        <span>{t('modal.worktreeCopyIgnored')}</span>
      </label>

      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal} type="button">
          {t('common.cancel')}
        </button>
        <button className="btn primary" disabled={invalid} onClick={submit} type="button">
          {t('common.add')}
        </button>
      </div>
    </>
  )
}

function AddRemoteModal({ spec }: { spec: Extract<ModalSpec, { kind: 'addRemote' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  // The picker starts at the profile this repository already acts as — the
  // one it is bound to, else the active one — so listing, creating and the
  // push that follows are the same account unless the user picks another.
  const startProfileId = useSettingsStore((s) => effectiveProfileId(s.settings, spec.path))
  const [provider, setProvider] = useState<RemoteProviderId>('url')
  const [profileId, setProfileId] = useState(startProfileId)
  // URL-tab state
  const [name, setName] = useState(spec.defaultName || 'origin')
  const [pullUrl, setPullUrl] = useState('')
  const [pushUrl, setPushUrl] = useState('')

  const duplicate = spec.existingNames.includes(name.trim())
  const urlValid = !!pullUrl.trim() && !!name.trim() && !duplicate

  const submitUrl = (): void => {
    if (!urlValid) return
    closeModal()
    finishAddRemote(spec, name.trim(), pullUrl.trim(), pushUrl.trim() || undefined)
  }

  return (
    <>
      <h3 className="modal-title-row">
        <Cloud size={17} /> {t('modal.addRemote')}
      </h3>
      {spec.resume && <p className="pr-warn">{t('confirm.noRemote.message')}</p>}

      <div className="remote-tabs">
        {REMOTE_PROVIDERS.map((p) => {
          const Icon = PROVIDER_ICONS[p.id]
          return (
            <button
              key={p.id}
              className={`remote-tab ${provider === p.id ? 'active' : ''}`}
              onClick={() => setProvider(p.id)}
              type="button"
            >
              <Icon size={20} />
              <span>{p.label}</span>
            </button>
          )
        })}
      </div>

      {provider === 'url' ? (
        <>
          <label className="modal-label">{t('modal.name')}</label>
          <input
            autoFocus
            className="modal-input"
            value={name}
            placeholder="origin"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl()
              if (e.key === 'Escape') closeModal()
            }}
          />
          {duplicate && (
            <div className="modal-hint danger">
              {interp(t('modal.remoteExists'), { name: name.trim() })}
            </div>
          )}
          <label className="modal-label">{t('modal.pullUrl')}</label>
          <input
            className="modal-input"
            value={pullUrl}
            placeholder="https://github.com/me/repo.git"
            onChange={(e) => setPullUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl()
              if (e.key === 'Escape') closeModal()
            }}
          />
          <label className="modal-label">{t('modal.pushUrl')}</label>
          <input
            className="modal-input"
            value={pushUrl}
            placeholder={t('modal.pushUrlPlaceholder')}
            onChange={(e) => setPushUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl()
              if (e.key === 'Escape') closeModal()
            }}
          />
          <div className="modal-actions">
            <button className="btn ghost" onClick={closeModal} type="button">
              {t('common.cancel')}
            </button>
            <button className="btn primary" disabled={!urlValid} onClick={submitUrl} type="button">
              {t('modal.addRemote')}
            </button>
          </div>
        </>
      ) : (
        <ProviderCreateForm host={provider} spec={spec} profileId={profileId} onProfile={setProfileId} />
      )}
    </>
  )
}

function EditRemoteModal({ spec }: { spec: Extract<ModalSpec, { kind: 'editRemote' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const [name, setName] = useState(spec.name)
  const [url, setUrl] = useState(spec.url)
  const [pushUrl, setPushUrl] = useState(spec.pushUrl ?? '')

  const valid = !!name.trim() && !!url.trim()
  const submit = (): void => {
    if (!valid) return
    closeModal()
    void repoActions.editRemote(spec.path, spec.name, name.trim(), url.trim(), pushUrl.trim() || undefined)
  }

  return (
    <>
      <h3 className="modal-title-row">
        <Cloud size={17} /> {t('modal.editRemote')}
      </h3>
      <label className="modal-label">{t('modal.name')}</label>
      <input autoFocus className="modal-input" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="modal-label">{t('modal.pullUrl')}</label>
      <input className="modal-input" value={url} onChange={(e) => setUrl(e.target.value)} />
      <label className="modal-label">{t('modal.pushUrl')}</label>
      <input
        className="modal-input"
        value={pushUrl}
        placeholder={t('modal.pushUrlPlaceholder')}
        onChange={(e) => setPushUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') closeModal()
        }}
      />
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal} type="button">
          {t('common.cancel')}
        </button>
        <button className="btn primary" disabled={!valid} onClick={submit} type="button">
          <Check size={14} /> {t('common.save')}
        </button>
      </div>
    </>
  )
}

/** Paths listed under a batch before it collapses to "+N more". */
const BATCH_PREVIEW = 5

function CloneModal({ spec }: { spec: Extract<ModalSpec, { kind: 'clone' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const toast = useUIStore((s) => s.toast)
  const profiles = useSettingsStore((s) => s.settings.profiles)
  const activeProfileId = useSettingsStore((s) => s.settings.activeProfileId)
  const lastClonePath = useSettingsStore((s) => s.settings.lastClonePath)
  const updateSettings = useSettingsStore((s) => s.update)
  const setRepoProfile = useSettingsStore((s) => s.setRepoProfile)
  const [provider, setProvider] = useState<RemoteProviderId>('url')
  const [profileId, setProfileId] = useState(activeProfileId)
  const [url, setUrl] = useState('')
  // Provider tabs can pick several repositories; more than one makes this a batch.
  const [selected, setSelected] = useState<RemoteRepo[]>([])
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [dir, setDir] = useState(lastClonePath ?? '')
  const [partial, setPartial] = useState(false)
  // The clone itself lives in the clones store, so a click outside the dialog
  // only hides it — it carries on in the floating tray.
  const [taskId, setTaskId] = useState<string | null>(null)
  const task = useClonesStore((s) => (taskId ? s.tasks.find((x) => x.id === taskId) : undefined))
  const cloning = !!task
  const progress = task?.progress ?? null

  // ── Advanced: what `git clone` can narrow before it starts ──
  const [advanced, setAdvanced] = useState(false)
  const [shallow, setShallow] = useState(false)
  const [depth, setDepth] = useState('1')
  const [singleBranch, setSingleBranch] = useState(false)
  const [submodules, setSubmodules] = useState(false)
  const [branch, setBranch] = useState('')
  const [branches, setBranches] = useState<string[] | null>(null)
  const [branchesError, setBranchesError] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)

  // Leaving the dialog hands a running clone to the tray.
  useEffect(() => {
    if (!taskId) return undefined
    return () => useClonesStore.getState().attach(taskId, false)
  }, [taskId])

  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0] ?? defaultProfile()
  const host: RepoHost | null = provider === 'url' ? null : provider
  const batch = provider !== 'url' && selected.length > 1
  const batchNames = useMemo(() => cloneFolderNames(selected.map((r) => r.name)), [selected])
  const valid = batch
    ? !!dir.trim() && !cloning
    : !!url.trim() && !!name.trim() && !!dir.trim() && !cloning

  const changeProvider = (id: RemoteProviderId): void => {
    setProvider(id)
    setUrl('')
    setSelected([])
    if (!nameTouched) setName('')
    resetBranches()
  }

  // The branch list belongs to one URL; changing the URL invalidates it.
  const resetBranches = (): void => {
    setBranches(null)
    setBranch('')
    setBranchesError(false)
  }

  /** Ask the remote which branches it has. One network round trip, on demand —
   *  typing a URL should not fire `ls-remote` on every keystroke. */
  const loadBranches = async (): Promise<void> => {
    if (!url.trim() || loadingBranches) return
    setLoadingBranches(true)
    setBranchesError(false)
    try {
      const token = host ? profile[HOST_META[host].tokenField] : undefined
      // Every tab: a self-hosted server's token comes from the picked profile.
      setBranches(await gitApi.remoteBranches(url.trim(), host ?? undefined, token, profile.id))
    } catch {
      // A private repo with no token, a typo'd URL, an offline machine — the
      // clone itself will report it properly, so this stays a soft failure and
      // the branch stays a free-text field.
      setBranchesError(true)
      setBranches(null)
    } finally {
      setLoadingBranches(false)
    }
  }

  const deriveName = (u: string): string => {
    const last = u.trim().replace(/\/+$/, '').split('/').pop() ?? ''
    return last.replace(/\.git$/, '')
  }

  /** One repository left selected behaves exactly like a single pick. */
  const applySelection = (next: RemoteRepo[]): void => {
    setSelected(next)
    setUrl(next.length === 1 ? next[0].url : '')
    if (!nameTouched) setName(next.length === 1 ? repoToName(next[0]) : '')
    resetBranches()
  }

  const pickRepo = (repo: RemoteRepo): void => applySelection([repo])

  const toggleRepo = (repo: RemoteRepo): void =>
    applySelection(
      selected.some((r) => r.url === repo.url) ? selected.filter((r) => r.url !== repo.url) : [...selected, repo]
    )

  const toggleAll = (shown: RemoteRepo[], on: boolean): void => {
    const shownUrls = new Set(shown.map((r) => r.url))
    applySelection(
      on
        ? [...selected, ...shown.filter((r) => !selected.some((x) => x.url === r.url))]
        : selected.filter((r) => !shownUrls.has(r.url))
    )
  }

  const browse = async (): Promise<void> => {
    const picked = await window.api.selectDirectory(t('modal.chooseCloneDir'))
    if (picked) setDir(picked)
  }

  /** Every selected repository into the same parent folder, a few at a time,
   *  straight to the tray: there is no one clone for the dialog to follow. */
  const submitBatch = (): void => {
    const token = host ? profile[HOST_META[host].tokenField] : undefined
    const parsedDepth = Number.parseInt(depth, 10)
    const parentDir = dir.trim()
    const profileForRepo = profile.id
    const { onClone } = spec
    const clones = useClonesStore.getState()
    selected.forEach((repo, i) => {
      const folder = batchNames[i]
      clones.start(
        {
          parentDir,
          url: repo.url,
          name: folder,
          opts: {
            host: host ?? undefined,
            token,
            filter: partial ? 'blob:none' : undefined,
            depth: shallow && parsedDepth > 0 ? parsedDepth : undefined,
            singleBranch: shallow ? singleBranch : singleBranch || undefined,
            // No branch: a name picked for one repository means nothing in the others.
            recurseSubmodules: submodules,
            profileId: profileForRepo
          },
          onDone: (path) =>
            void bindBeforeOpen({
              bind: () => setRepoProfile(path, profileForRepo),
              persist: () => useSettingsStore.getState().flush(),
              open: () => onClone({ path, name: folder })
            })
        },
        { attached: false }
      )
    })
    updateSettings((s) => ({ ...s, lastClonePath: parentDir }))
    closeModal()
    toast('info', interp(t('clone.batchStarted'), { count: selected.length }))
  }

  const submit = (): void => {
    if (!valid) return
    if (batch) {
      submitBatch()
      return
    }
    const token = host ? profile[HOST_META[host].tokenField] : undefined
    const parsedDepth = Number.parseInt(depth, 10)
    const folder = name.trim()
    const parentDir = dir.trim()
    const profileForRepo = profile.id
    const id = useClonesStore.getState().start({
      parentDir,
      url: url.trim(),
      name: folder,
      opts: {
        host: host ?? undefined,
        token,
        filter: partial ? 'blob:none' : undefined,
        depth: shallow && parsedDepth > 0 ? parsedDepth : undefined,
        // Only meaningful as an explicit choice: `--depth` already implies
        // single-branch, so `false` is how the user asks for the others back.
        singleBranch: shallow ? singleBranch : singleBranch || undefined,
        branch: branch.trim() || undefined,
        recurseSubmodules: submodules,
        // The profile the repository is pinned to below also signs the clone in:
        // a self-hosted server's token is read from it in main, on every tab.
        // github.com, bitbucket.org and Azure use `token`, the same profile's.
        profileId: profileForRepo
      },
      // Runs after the dialog may be long gone — it reads nothing from this render
      // but the values captured above.
      onDone: (path) => {
        updateSettings((s) => ({ ...s, lastClonePath: parentDir }))
        if (useUIStore.getState().modal === spec) closeModal()
        // Pin the new repo to the chosen profile so its identity/tokens apply
        // automatically whenever its tab is active — written before the tab opens.
        void bindBeforeOpen({
          bind: () => setRepoProfile(path, profileForRepo),
          persist: () => useSettingsStore.getState().flush(),
          open: () => spec.onClone({ path, name: folder })
        })
      }
    })
    setTaskId(id)
  }

  return (
    <>
      <h3 className="modal-title-row">
        {spec.back && <LauncherBack target={spec.back} />}
        <FolderGit2 size={17} /> {t('clone.title')}
      </h3>

      <div className="remote-tabs">
        {REMOTE_PROVIDERS.map((p) => {
          const Icon = PROVIDER_ICONS[p.id]
          return (
            <button
              key={p.id}
              className={`remote-tab ${provider === p.id ? 'active' : ''}`}
              onClick={() => changeProvider(p.id)}
              type="button"
            >
              <Icon size={20} />
              <span>{p.label}</span>
            </button>
          )
        })}
      </div>

      {provider === 'url' ? (
        <>
          <label className="modal-label">{t('modal.repositoryUrl')}</label>
          <input
            autoFocus
            className="modal-input"
            value={url}
            placeholder="https://github.com/me/repo.git"
            onChange={(e) => {
              setUrl(e.target.value)
              if (!nameTouched) setName(deriveName(e.target.value))
              resetBranches()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeModal()
            }}
          />
          {profiles.length > 1 && (
            <label className="repo-profile">
              <span>{t('modal.profile')}</span>
              <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      ) : (
        <RepoPicker
          host={provider}
          onPick={pickRepo}
          selectedUrl={url}
          selectedUrls={selected.map((r) => r.url)}
          onToggle={toggleRepo}
          onToggleAll={toggleAll}
          profileId={profileId}
          onProfile={setProfileId}
        />
      )}

      <label className="modal-label">{t('modal.cloneInto')}</label>
      <div className="repo-org-row">
        <input
          className="modal-input"
          value={dir}
          placeholder={t('modal.parentFolderPlaceholder')}
          onChange={(e) => setDir(e.target.value)}
        />
        <button className="btn ghost" type="button" onClick={() => void browse()}>
          <Folder size={14} /> {t('modal.browse')}
        </button>
      </div>

      {batch ? (
        // Each repository keeps its own name — see cloneFolderNames for collisions.
        <div className="clone-batch-list">
          {batchNames.slice(0, BATCH_PREVIEW).map((n) => (
            <div key={n} className="modal-hint">{`${dir.replace(/\/+$/, '') || '…'}/${n}`}</div>
          ))}
          {batchNames.length > BATCH_PREVIEW && (
            <div className="modal-hint">{interp(t('clone.batchMore'), { count: batchNames.length - BATCH_PREVIEW })}</div>
          )}
        </div>
      ) : (
        <>
          <label className="modal-label">{t('modal.folderName')}</label>
          <input
            className="modal-input"
            value={name}
            placeholder="repository"
            onChange={(e) => {
              setNameTouched(true)
              setName(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeModal()
            }}
          />
          {provider !== 'url' && url && <div className="modal-hint">{url}</div>}
          {dir && name && <div className="modal-hint">{`${dir.replace(/\/+$/, '')}/${name.trim()}`}</div>}
        </>
      )}

      <button className="clone-advanced-toggle" type="button" onClick={() => setAdvanced((v) => !v)}>
        {advanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {t('clone.advanced')}
      </button>

      {advanced && (
        <div className="clone-advanced">
          <label className="clone-partial">
            <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
            <span>
              {t('clone.partial')} <code>--filter=blob:none</code> {/* i18n-ignore git flag */}
              <span className="modal-hint">{t('clone.partialHint')}</span>
            </span>
          </label>

          <label className="clone-partial">
            <input type="checkbox" checked={shallow} onChange={(e) => setShallow(e.target.checked)} />
            <span>
              {t('clone.shallow')}
              <span className="modal-hint">{t('clone.shallowHint')}</span>
            </span>
          </label>
          {shallow && (
            <div className="clone-depth-row">
              <label className="modal-label">{t('clone.depth')}</label>
              <input
                className="modal-input"
                type="number"
                min={1}
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
              />
            </div>
          )}

          <label className="clone-partial">
            <input
              type="checkbox"
              checked={singleBranch}
              onChange={(e) => setSingleBranch(e.target.checked)}
            />
            <span>
              {t('clone.singleBranch')}
              <span className="modal-hint">{shallow ? t('clone.singleBranchShallowHint') : t('clone.singleBranchHint')}</span>
            </span>
          </label>

          <label className="clone-partial">
            <input type="checkbox" checked={submodules} onChange={(e) => setSubmodules(e.target.checked)} />
            <span>
              {t('clone.submodules')}
              <span className="modal-hint">{t('clone.submodulesHint')}</span>
            </span>
          </label>

          {batch ? (
            <div className="modal-hint">{t('clone.batchBranchHint')}</div>
          ) : (
            <>
              <label className="modal-label">{t('clone.branch')}</label>
              <div className="repo-org-row">
                {branches ? (
                  <select className="modal-input" value={branch} onChange={(e) => setBranch(e.target.value)}>
                    <option value="">{t('clone.branchDefault')}</option>
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="modal-input"
                    value={branch}
                    placeholder={t('clone.branchPlaceholder')}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                )}
                <button className="btn ghost" type="button" disabled={!url.trim() || loadingBranches} onClick={() => void loadBranches()}>
                  {loadingBranches ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} {t('clone.listBranches')}
                </button>
              </div>
              {branchesError && <div className="modal-hint">{t('clone.branchesFailed')}</div>}
            </>
          )}
        </div>
      )}

      {cloning && (
        <div className="clone-progress">
          <div className="clone-progress-head" role="status" aria-live="polite">
            <span>{task?.queued ? t('clone.queued') : progress ? `${progress.stage}…` : t('clone.starting')}</span>
            {progress && progress.total > 0 && (
              <span className="clone-progress-pct">{Math.round(progress.progress)}%</span>
            )}
          </div>
          <div
            className="clone-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress && progress.total > 0 ? Math.round(progress.progress) : undefined}
            aria-valuetext={progress ? `${progress.stage} ${Math.round(progress.progress)}%` : undefined}
          >
            <div
              className={`clone-progress-bar ${progress && progress.total > 0 ? '' : 'indeterminate'}`}
              style={progress && progress.total > 0 ? { width: `${progress.progress}%` } : undefined}
            />
          </div>
        </div>
      )}

      <div className="modal-actions">
        {task ? (
          <>
            <button
              className="btn danger"
              onClick={() => useClonesStore.getState().cancel(task.id)}
              type="button"
              disabled={task.cancelling}
            >
              {task.cancelling ? t('clone.cancelling') : t('clone.cancel')}
            </button>
            <button className="btn ghost" onClick={closeModal} type="button" title={t('clone.backgroundHint')}>
              {t('clone.background')}
            </button>
            <button className="btn primary" disabled type="button">
              <Loader2 size={14} className="spin" /> {t('clone.running')}
            </button>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={closeModal} type="button">
              {t('common.cancel')}
            </button>
            <button className="btn primary" disabled={!valid} onClick={submit} type="button">
              {batch ? interp(t('clone.submitMany'), { count: selected.length }) : t('clone.submit')}
            </button>
          </>
        )}
      </div>
    </>
  )
}

function ConfirmModal({
  spec,
  onClose
}: {
  spec: Extract<ModalSpec, { kind: 'confirm' }>
  /** How this one closes — the modal slot by default, the stacked dialog otherwise. */
  onClose?: () => void
}): React.JSX.Element {
  const t = useT()
  const storeClose = useUIStore((s) => s.closeModal)
  const closeModal = onClose ?? storeClose
  // Every way out but the two buttons that act (Cancel, Esc, ✕, a click
  // outside, another confirm taking this one's place) ends this effect, so a
  // caller waiting on the answer always gets one. StrictMode also runs this
  // cleanup on a dialog still showing; only one that has left the store counts.
  const answered = useRef(false)
  useEffect(() => {
    answered.current = false
    return () => {
      const { modal, dialog } = useUIStore.getState()
      if (!answered.current && modal !== spec && dialog !== spec) spec.onCancel?.()
    }
  }, [spec])
  return (
    <>
      <h3>{spec.title}</h3>
      <p className="modal-message">{spec.message}</p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal}>
          {spec.cancelLabel ?? t('common.cancel')}
        </button>
        {spec.secondaryLabel && spec.onSecondary && (
          <button
            className={`btn ${spec.secondaryDanger ? 'danger' : 'ghost'}`}
            onClick={() => {
              answered.current = true
              closeModal()
              spec.onSecondary?.()
            }}
          >
            {spec.secondaryLabel}
          </button>
        )}
        <button
          autoFocus={spec.autoFocusConfirm}
          className={`btn ${spec.danger ? 'danger' : 'primary'}`}
          onClick={() => {
            answered.current = true
            closeModal()
            spec.onConfirm()
          }}
        >
          {spec.confirmLabel ?? t('common.confirm')}
        </button>
      </div>
    </>
  )
}

function DivergedCheckoutModal({
  spec
}: {
  spec: Extract<ModalSpec, { kind: 'diverged-checkout' }>
}): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const [backup, setBackup] = useState(true)
  const commitsN = (n: number): string => interp(t(n === 1 ? 'diverged.commitsOne' : 'diverged.commitsMany'), { n })
  const vars = {
    local: spec.localName,
    remote: spec.fullName,
    ahead: commitsN(spec.ahead),
    behind: commitsN(spec.behind)
  }
  const choose = (strategy: DivergedStrategy): void => {
    closeModal()
    spec.onResolve(strategy, backup)
  }
  return (
    <>
      <h3 className="modal-title-row">
        <GitMerge size={17} /> {t('diverged.title')}
      </h3>
      <p className="modal-message">{interp(t('diverged.message'), vars)}</p>
      <label
        className="modal-label"
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}
      >
        <input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} />
        {t('aheadCheckout.backup')}
      </label>
      <div className="modal-actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <button className="btn primary" onClick={() => choose('rebase')}>
          {interp(t('diverged.rebase'), vars)}
        </button>
        <button className="btn ghost" onClick={() => choose('merge')}>
          {t('diverged.merge')}
        </button>
        <button className="btn danger" onClick={() => choose('reset-hard')}>
          {interp(t('diverged.reset'), vars)}
        </button>
        <button className="btn ghost" onClick={closeModal} style={{ marginTop: 4 }}>
          {t('common.cancel')}
        </button>
      </div>
    </>
  )
}

/**
 * The user asked for a remote branch whose local counterpart is ahead. Nothing
 * has been checked out yet — they choose between keeping their commits and
 * moving the branch back to the remote tip, picking how much of the discarded
 * work survives (soft keeps it staged, mixed unstaged, hard nothing).
 */
function AheadCheckoutModal({
  spec
}: {
  spec: Extract<ModalSpec, { kind: 'ahead-checkout' }>
}): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const [backup, setBackup] = useState(true)
  const vars = { local: spec.localName, remote: spec.fullName, n: spec.ahead }
  const reset = (strategy: ResetStrategy): void => {
    closeModal()
    spec.onReset(strategy, backup)
  }
  return (
    <>
      <h3 className="modal-title-row">
        <ArrowUpFromLine size={17} /> {t('aheadCheckout.title')}
      </h3>
      <p className="modal-message">{interp(t('aheadCheckout.message'), vars)}</p>
      <label
        className="modal-label"
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}
      >
        <input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} />
        {t('aheadCheckout.backup')}
      </label>
      <div className="modal-actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <button
          className="btn primary"
          onClick={() => {
            closeModal()
            spec.onKeepLocal()
          }}
        >
          {interp(t('aheadCheckout.keepLocal'), vars)}
        </button>
        <button className="btn ghost" onClick={() => reset('reset-soft')}>
          {interp(t('aheadCheckout.soft'), vars)}
        </button>
        <button className="btn ghost" onClick={() => reset('reset-mixed')}>
          {interp(t('aheadCheckout.mixed'), vars)}
        </button>
        <button className="btn danger" onClick={() => reset('reset-hard')}>
          {interp(t('aheadCheckout.hard'), vars)}
        </button>
        <button className="btn ghost" onClick={closeModal} style={{ marginTop: 4 }}>
          {t('common.cancel')}
        </button>
      </div>
    </>
  )
}

function CreateRepoModal({ spec }: { spec: Extract<ModalSpec, { kind: 'create-repo' }> }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const toast = useUIStore((s) => s.toast)
  const [name, setName] = useState('')
  const [dir, setDir] = useState('')
  const [creating, setCreating] = useState(false)

  const valid = !!name.trim() && !!dir.trim() && !creating

  const browse = async (): Promise<void> => {
    const picked = await window.api.selectDirectory(t('modal.chooseCreateDir'))
    if (picked) setDir(picked)
  }

  const submit = async (): Promise<void> => {
    if (!valid) return
    setCreating(true)
    try {
      const path = await gitApi.init(dir.trim(), name.trim())
      closeModal()
      spec.onCreate({ path, name: name.trim() })
      toast('success', interp(t('modal.repoCreated'), { name: name.trim() }))
    } catch (e) {
      toast('error', e instanceof Error ? e.message : String(e))
      setCreating(false)
    }
  }

  return (
    <>
      <h3 className="modal-title-row">
        {spec.back && <LauncherBack target={spec.back} />}
        <FolderGit2 size={17} /> {t('modal.createRepository')}
      </h3>
      <label className="modal-label">{t('modal.createIn')}</label>
      <div className="repo-org-row">
        <input
          className="modal-input"
          value={dir}
          placeholder={t('modal.parentFolderPlaceholder')}
          onChange={(e) => setDir(e.target.value)}
        />
        <button className="btn ghost" type="button" onClick={() => void browse()}>
          <Folder size={14} /> {t('modal.browse')}
        </button>
      </div>
      <label className="modal-label">{t('modal.repositoryName')}</label>
      <input
        autoFocus
        className="modal-input"
        value={name}
        placeholder="my-project"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
          if (e.key === 'Escape') closeModal()
        }}
      />
      {dir && name && <div className="modal-hint">{`${dir.replace(/\/+$/, '')}/${name.trim()}`}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={closeModal} type="button" disabled={creating}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" disabled={!valid} onClick={() => void submit()} type="button">
          {creating ? (
            <>
              <Loader2 size={14} className="spin" /> {t('modal.creating')}
            </>
          ) : (
            t('common.create')
          )}
        </button>
      </div>
    </>
  )
}

function LauncherModal({ spec }: { spec: Extract<ModalSpec, { kind: 'launcher' }> }): React.JSX.Element {
  const t = useT()
  const { closeModal, openModal } = useUIStore()
  const { settings, openRepoTab, createGroupTab, addRepoToGroup, renameRepoInGroup, reorderReposInGroup } = useSettingsStore()

  const groupTab = spec.groupId
    ? settings.tabs.find((t): t is GroupTab => t.id === spec.groupId && t.kind === 'group')
    : undefined

  const openRepo = async (): Promise<void> => {
    const inGroup = (path: string): boolean => !!groupTab?.repos.some((r) => r.path === path)
    const repos = await chooseRepositories(spec.groupId ? inGroup : undefined)
    if (!repos.length) return
    if (spec.groupId) {
      for (const repo of repos) addRepoToGroup(spec.groupId, repo)
    } else {
      closeModal()
      for (const repo of repos) openRepoTab(repo)
    }
  }

  const cloneRepo = (): void => {
    closeModal()
    openModal({
      kind: 'clone',
      back: { groupId: spec.groupId },
      onClone: (repo) => {
        if (spec.groupId) addRepoToGroup(spec.groupId, repo)
        else openRepoTab(repo)
      }
    })
  }

  const createRepo = (): void => {
    closeModal()
    openModal({
      kind: 'create-repo',
      back: { groupId: spec.groupId },
      onCreate: (repo) => {
        if (spec.groupId) addRepoToGroup(spec.groupId, repo)
        else openRepoTab(repo)
      }
    })
  }

  const createGroup = (): void => {
    closeModal()
    openModal({ kind: 'new-group', back: {}, onCreate: (name, color) => createGroupTab(name, color) })
  }

  const items: LauncherItem[] = spec.groupId && groupTab
    ? groupTab.repos.map((r) => ({
        name: r.name,
        path: r.path,
        onRemove: () => confirmRemoveRepoFromGroup(spec.groupId!, r.path),
        onRename: (newName) => renameRepoInGroup(spec.groupId!, r.path, newName)
      }))
    : settings.recentRepos.map((r) => ({
        name: r.name,
        path: r.path,
        onSelect: () => {
          closeModal()
          openRepoTab(r)
        },
        onRemove: () => confirmRemoveRecentRepo(r.path)
      }))

  const recentItems: LauncherItem[] | undefined = spec.groupId && groupTab
    ? settings.recentRepos
        .filter((r) => !groupTab.repos.some((gr) => gr.path === r.path))
        .map((r) => ({
          name: r.name,
          path: r.path,
          onSelect: () => addRepoToGroup(spec.groupId!, r),
          onRemove: () => confirmRemoveRecentRepo(r.path)
        }))
    : undefined

  const listTitle = spec.groupId
    ? groupTab?.repos.length ? t('launcher.listRepositories') : undefined
    : settings.recentRepos.length ? t('launcher.listRecent') : undefined

  const emptyMessage = spec.groupId ? t('launcher.emptyGroup') : undefined

  return (
    <>
      {/* The same welcome art as a new workspace: opening a repository is the
          other way into the app, and it should greet you the same way. */}
      <img className="launcher-art" src={githuttbrLaunch} alt="" draggable={false} />
      <h3>
        {spec.groupId
          ? interp(t('launcher.manageGroup'), { name: groupTab?.name ?? t('launcher.groupFallback') })
          : t('welcome.openRepo')}
      </h3>
      <LauncherPanel
        onOpen={() => void openRepo()}
        onClone={cloneRepo}
        onCreate={createRepo}
        onCreateGroup={spec.groupId ? undefined : createGroup}
        onScanned={() => openModal({ kind: 'scanned-repos', groupId: spec.groupId, from: 'launcher' })}
        onReorder={spec.groupId ? (from, to) => reorderReposInGroup(spec.groupId!, from, to) : undefined}
        items={items}
        listTitle={listTitle}
        emptyMessage={emptyMessage}
        recentItems={recentItems}
      />
    </>
  )
}

/** Keep Tab cycling inside `box`; the background is visually inert but still in the tab order. */
function trapTabIn(e: React.KeyboardEvent, box: HTMLElement | null): void {
  if (e.key !== 'Tab' || !box) return
  const focusables = Array.from(
    box.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null)
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

export function ModalHost(): React.JSX.Element {
  const t = useT()
  const { modal, closeModal, dialog, closeDialog } = useUIStore()
  const dialogRef = useRef<HTMLDivElement>(null)
  const stackedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      // A dialog in the middle of a write (the settings import) closes itself.
      if (useUIStore.getState().closeLocked) return
      // Esc answers the question on top, not the screen it was asked over.
      if (useUIStore.getState().dialog) closeDialog()
      else closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal, closeDialog])

  // The stacked dialog takes focus while it is up, and gives it back to the
  // control in the modal underneath that asked the question.
  useEffect(() => {
    if (!dialog) return
    const opener = document.activeElement as HTMLElement | null
    const box = stackedRef.current
    if (box && !box.contains(document.activeElement)) box.focus()
    return () => {
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [dialog])

  // Dialog semantics: name the dialog after its own heading, move focus inside
  // on open (unless a child already autofocused), and hand it back on close.
  useEffect(() => {
    if (!modal) return
    const opener = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    if (dialog) {
      const heading = dialog.querySelector('h1, h2, h3')
      if (heading) {
        if (!heading.id) heading.id = 'modal-title'
        dialog.setAttribute('aria-labelledby', heading.id)
      }
      if (!dialog.contains(document.activeElement)) dialog.focus()
    }
    return () => {
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [modal])

  // Keep Tab inside the dialog — the background is visually inert but would
  // otherwise still be in the tab order.
  const trapTab = (e: React.KeyboardEvent): void => trapTabIn(e, dialogRef.current)


  return (
    <>
      <AnimatePresence>
        {modal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !useUIStore.getState().closeLocked) closeModal()
            }}
          >
            <motion.div
              className={`modal ${
                modal.kind === 'clone'
                  ? 'modal-clone'
                  : modal.kind === 'push-branches'
                  ? 'modal-push-branches'
                  : modal.kind === 'branch-cleanup'
                  ? 'modal-branch-cleanup'
                  : modal.kind === 'create-pr'
                  ? 'modal-create-pr'
                  : modal.kind === 'settings'
                  ? 'modal-wide modal-settings'
                  : modal.kind === 'settings-import' || modal.kind === 'settings-export'
                  ? 'modal-settings-import'
                  : modal.kind === 'ai-config-wizard'
                  ? 'modal-wide'
                  : modal.kind === 'launcher' || modal.kind === 'scanned-repos'
                  ? 'modal-launcher'
                  : modal.kind === 'merge-options'
                  ? 'modal-merge-options'
                  : modal.kind === 'interactive-rebase' ||
                      modal.kind === 'conflict-radar' ||
                      modal.kind === 'range-diff' ||
                      modal.kind === 'time-machine' ||
                      modal.kind === 'timelapse' ||
                      modal.kind === 'ai-pr-review' ||
                      modal.kind === 'reflog' ||
                      modal.kind === 'hooks' ||
                      modal.kind === 'lfs' ||
                      modal.kind === 'sparse' ||
                      modal.kind === 'code-search' ||
                      modal.kind === 'clean' ||
                      modal.kind === 'maintenance' ||
                      modal.kind === 'objects' ||
                      modal.kind === 'attributes' ||
                      modal.kind === 'credentials' ||
                      modal.kind === 'replace' ||
                      modal.kind === 'changelog-gen' ||
                      modal.kind === 'repo-settings' ||
                      modal.kind === 'secure-share' ||
                      modal.kind === 'secure-workspace' ||
                      modal.kind === 'snapshots' ||
                      modal.kind === 'todos' ||
                      modal.kind === 'teammate-radar' ||
                      modal.kind === 'local-ci' ||
                      modal.kind === 'cli-edit' ||
                      modal.kind === 'stack'
                    ? 'modal-tall'
                    : ''
              }`}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              onKeyDown={trapTab}
            >
              <button
                className="modal-close"
                onClick={() => {
                  if (!useUIStore.getState().closeLocked) closeModal()
                }}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X size={15} />
              </button>
              {/* The frame holds still with the close button; this scrolls (see .modal-scroll). */}
              <div className="modal-scroll">
              <ErrorBoundary key={modal.kind} label={t('modal.dialogError')} onReset={closeModal}>
              {modal.kind === 'input' && <InputModal spec={modal} />}
              {modal.kind === 'launch-input' && <LaunchInputModal spec={modal} />}
              {modal.kind === 'create-branch' && <CreateBranchModal spec={modal} />}
              {modal.kind === 'confirm' && <ConfirmModal spec={modal} />}
              {modal.kind === 'settings-import' && <ImportSettingsDialog spec={modal} />}
              {modal.kind === 'settings-export' && <ExportSettingsDialog />}
              {modal.kind === 'version-rollback' && <RollbackConfirmDialog spec={modal} />}
              {modal.kind === 'diverged-checkout' && <DivergedCheckoutModal spec={modal} />}
              {modal.kind === 'ahead-checkout' && <AheadCheckoutModal spec={modal} />}
              {modal.kind === 'addRemote' && <AddRemoteModal spec={modal} />}
              {modal.kind === 'remoteAuth' && <RemoteAuthModal spec={modal} />}
              {modal.kind === 'add-worktree' && <AddWorktreeModal spec={modal} />}
              {modal.kind === 'editRemote' && <EditRemoteModal spec={modal} />}
              {modal.kind === 'clone' && <CloneModal spec={modal} />}
              {modal.kind === 'work-item-branch' && <WorkItemBranchModal spec={modal} />}
              {modal.kind === 'settings' && <SettingsPanel initialPage={modal.page} initialThemeTab={modal.themeTab} />}
              {modal.kind === 'launcher' && <LauncherModal spec={modal} />}
              {modal.kind === 'scanned-repos' && <ScannedReposModal spec={modal} />}
              {modal.kind === 'create-repo' && <CreateRepoModal spec={modal} />}
              {modal.kind === 'ai-config-wizard' && <AIConfigWizard spec={modal} />}
              {modal.kind === 'interactive-rebase' && (
                <InteractiveRebase repoPath={modal.repoPath} base={modal.base} baseSubject={modal.baseSubject} />
              )}
              {modal.kind === 'keychain-consent' && (
                <KeychainConsentModal reason={modal.reason} adopted={modal.adopted} />
              )}
              {modal.kind === 'absorb' && <AbsorbModal repoPath={modal.repoPath} />}
              {modal.kind === 'branch-cleanup' && <BranchCleanupModal repoPath={modal.repoPath} />}
              {modal.kind === 'cli-edit' && (
                <CliEditModal file={modal.file} sentinel={modal.sentinel} content={modal.content} />
              )}
              {modal.kind === 'time-machine' && <TimeMachineModal repoPath={modal.repoPath} />}
              {modal.kind === 'timelapse' && <TimelapseModal repoPath={modal.repoPath} />}
              {modal.kind === 'range-diff' && (
                <RangeDiffModal repoPath={modal.repoPath} branch={modal.branch} initialOld={modal.initialOld} />
              )}
              {modal.kind === 'pr-preview' && (
                <PrPreviewModal
                  repoPath={modal.repoPath}
                  initialNumber={modal.number}
                  initialRemote={modal.remote}
                  initialBranch={modal.branch}
                />
              )}
              {modal.kind === 'conflict-radar' && (
                <ConflictRadar repoPath={modal.repoPath} initialBase={modal.base} />
              )}
              {modal.kind === 'ai-pr-review' && (
                <AIPRReview repoPath={modal.repoPath} prTitle={modal.prTitle} sourceBranch={modal.sourceBranch} targetBranch={modal.targetBranch} diff={modal.diff} />
              )}
              {modal.kind === 'group-color' && <GroupColorModal spec={modal} />}
              {modal.kind === 'new-group' && <NewGroupModal spec={modal} />}
              {modal.kind === 'worktree-group' && <WorktreeGroupModal spec={modal} />}
              {modal.kind === 'scan-workspaces' && <ScanWorkspacesModal spec={modal} />}
              {modal.kind === 'reflog' && <ReflogModal repoPath={modal.repoPath} />}
              {modal.kind === 'code-search' && <CodeSearchModal repoPath={modal.repoPath} query={modal.query} />}
              {modal.kind === 'stack' && <StackModal repoPath={modal.repoPath} />}
              {modal.kind === 'stack-submit' && <StackSubmitModal spec={modal} />}
              {modal.kind === 'gitflow' && <GitflowModal repoPath={modal.repoPath} />}
              {modal.kind === 'subtree' && <SubtreeModal repoPath={modal.repoPath} />}
              {modal.kind === 'clean' && <CleanModal repoPath={modal.repoPath} />}
              {modal.kind === 'export' && <ExportModal repoPath={modal.repoPath} initialTab={modal.tab} />}
              {modal.kind === 'maintenance' && <MaintenanceModal repoPath={modal.repoPath} />}
              {modal.kind === 'push-branches' && (
                <PushBranchesModal repoPath={modal.repoPath} preselect={modal.preselect} />
              )}
              {modal.kind === 'merge-options' && (
                <MergeOptionsModal repoPath={modal.repoPath} source={modal.source} />
              )}
              {modal.kind === 'objects' && <ObjectExplorer repoPath={modal.repoPath} rev={modal.rev} />}
              {modal.kind === 'attributes' && <AttributesModal repoPath={modal.repoPath} />}
              {modal.kind === 'credentials' && <CredentialsModal repoPath={modal.repoPath} />}
              {modal.kind === 'replace' && <ReplaceModal repoPath={modal.repoPath} commit={modal.commit} />}
              {modal.kind === 'history-purge' && (
                <HistoryPurgeModal repoPath={modal.repoPath} initialPath={modal.initialPath} />
              )}
              {modal.kind === 'changelog-gen' && <ChangelogGenModal repoPath={modal.repoPath} />}
              {modal.kind === 'snapshots' && <SnapshotsModal repoPath={modal.repoPath} />}
              {modal.kind === 'todos' && <TodosModal repoPath={modal.repoPath} focusId={modal.focusId} />}
              {modal.kind === 'teammate-radar' && <TeammateRadarModal repoPath={modal.repoPath} />}
              {modal.kind === 'reset-to-commit' && <ResetToCommitModal spec={modal} />}
              {modal.kind === 'local-ci' && <LocalCIModal repoPath={modal.repoPath} rev={modal.rev} />}
              {modal.kind === 'secure-share' && (
                <SecureShareModal repoPath={modal.repoPath} initialMode={modal.initialMode} />
              )}
              {modal.kind === 'secure-workspace' && <SecureWorkspaceModal initialMode={modal.initialMode} />}
              {modal.kind === 'stash-partial' && <StashPartialModal repoPath={modal.repoPath} />}
              {modal.kind === 'create-tag' && <CreateTagModal repoPath={modal.repoPath} hash={modal.hash} at={modal.at} />}
              {modal.kind === 'cheatsheet' && <CheatsheetModal />}
              {modal.kind === 'ai-accounts-notice' && <AIAccountsNotice />}
              {modal.kind === 'create-issue' && <CreateIssueModal repoPath={modal.repoPath} remoteUrl={modal.remoteUrl} />}
              {modal.kind === 'repo-settings' && <RepoSettingsModal repoPath={modal.repoPath} initialTab={modal.tab} />}
              {modal.kind === 'bisect' && <BisectModal repoPath={modal.repoPath} />}
              {modal.kind === 'hooks' && <HooksModal repoPath={modal.repoPath} />}
              {modal.kind === 'lfs' && <LfsModal repoPath={modal.repoPath} />}
              {modal.kind === 'sparse' && <SparseCheckoutModal repoPath={modal.repoPath} />}
              {modal.kind === 'create-pr' && <CreatePRModal spec={modal} />}
              {modal.kind === 'ignore' && <IgnoreModal spec={modal} />}
              </ErrorBoundary>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* A question asked from inside the modal, drawn over it so the modal
          underneath keeps its state (Settings: the profile, the tab, the scroll). */}
      <AnimatePresence>
        {dialog && (
          <motion.div
            key="stacked-dialog"
            className="modal-backdrop modal-backdrop-stacked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !useUIStore.getState().closeLocked) closeDialog()
            }}
          >
            <motion.div
              className={
                dialog.kind === 'settings-import' || dialog.kind === 'settings-export'
                  ? 'modal modal-settings-import'
                  : 'modal'
              }
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              ref={stackedRef}
              // A confirm is an alert; a name prompt is an ordinary dialog.
              role={dialog.kind === 'confirm' || dialog.kind === 'version-rollback' ? 'alertdialog' : 'dialog'}
              aria-modal="true"
              tabIndex={-1}
              onKeyDown={(e) => trapTabIn(e, stackedRef.current)}
            >
              <div className="modal-scroll">
                {dialog.kind === 'confirm' && <ConfirmModal spec={dialog} onClose={closeDialog} />}
                {dialog.kind === 'input' && <InputModal spec={dialog} onClose={closeDialog} />}
                {dialog.kind === 'settings-import' && <ImportSettingsDialog spec={dialog} onClose={closeDialog} />}
                {dialog.kind === 'settings-export' && <ExportSettingsDialog onClose={closeDialog} />}
                {dialog.kind === 'version-rollback' && <RollbackConfirmDialog spec={dialog} onClose={closeDialog} />}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
