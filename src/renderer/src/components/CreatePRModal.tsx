import { useEffect, useMemo, useRef, useState } from 'react'
import { GitPullRequest, Loader2, ExternalLink, ArrowRight, Sparkles } from 'lucide-react'
import { gitApi, hostingApi, aiApi } from '../infrastructure/api'
import { useUIStore, type ModalSpec } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { useRepoStore } from '../stores/repo'
import { RefPicker, type RefOption } from './RefPicker'
import { PrMetaPicker } from './PrMetaPicker'
import { interp, useT, type TranslationKey } from '../i18n'
import { readOpenAfterCreate, writeOpenAfterCreate } from '../lib/prCreated'
import { prBaseHint, prBaseRemote } from '../lib/prBase'
import { announcePrCreated } from '../stores/prCreated'
import { collectMentionNames } from '../lib/markdownEdit'
import { MarkdownEditor, useRepoReferences } from './MarkdownEditor'
import {
  createPickerCache,
  freeEntry,
  labelItem,
  NO_PICKS,
  personItem,
  pickerCacheKey,
  picksForAccount,
  picksToSend,
  shownFields,
  withPendingText
} from '../lib/prPicker'
import type { PrComparison, PrMetaField, PrPickerOptions } from '../../../shared/types'

// Choices read once per repository + remote + account, and reused for a few
// minutes, so reopening the dialog does not walk the host's lists again.
const pickerCache = createPickerCache()

const FIELD_LABEL: Record<PrMetaField, TranslationKey> = {
  reviewers: 'createPR.reviewersLabel',
  assignees: 'createPR.assigneesLabel',
  labels: 'createPR.labelsLabel'
}
const FIELD_PLACEHOLDER: Record<PrMetaField, TranslationKey> = {
  reviewers: 'createPR.reviewersPlaceholder',
  assignees: 'createPR.assigneesPlaceholder',
  labels: 'createPR.labelsPlaceholder'
}

/** A free field says so: a label to type on a host that creates them, a login when the list failed. */
function placeholderFor(meta: PrPickerOptions | null, f: PrMetaField): TranslationKey {
  if (!freeEntry(meta, f)) return FIELD_PLACEHOLDER[f]
  return f === 'labels' ? 'createPR.labelsFreePlaceholder' : 'createPR.peopleFreePlaceholder'
}

/** Best guess at the base branch when none is supplied — never the source itself. */
function guessTarget(branches: string[], source: string): string {
  return (
    branches.find((b) => (b === 'main' || b === 'master') && b !== source) ??
    branches.find((b) => b !== source) ??
    ''
  )
}

export function CreatePRModal({ spec }: { spec: Extract<ModalSpec, { kind: 'create-pr' }> }): React.JSX.Element {
  const closeModal = useUIStore((s) => s.closeModal)
  const toast = useUIStore((s) => s.toast)
  const profile = useSettingsStore((s) => s.activeProfile())
  const boundProfileId = useSettingsStore((s) => s.settings.repoProfiles[spec.repoPath])
  const aiFor = useSettingsStore((s) => s.aiFor)
  const repo = useRepoStore((s) => s.repos[spec.repoPath])

  const locals = repo?.branches.locals.map((b) => b.name) ?? []
  // A long branch list is unusable as a <select>: typing filters it instead.
  const branchOptions: RefOption[] = locals.map((value) => ({ value, kind: 'local' }))
  const origin = repo?.remotes.find((r) => r.name === 'origin') ?? repo?.remotes[0]
  const remoteUrl = spec.remoteUrl ?? origin?.url ?? ''

  const initialSource = spec.source ?? repo?.branches.current ?? locals[0] ?? ''
  const [source, setSource] = useState(initialSource)
  const [target, setTarget] = useState(spec.target ?? guessTarget(locals, initialSource))
  const [title, setTitle] = useState(spec.defaultTitle ?? '')
  const [body, setBody] = useState(spec.defaultBody ?? '')
  const [draft, setDraft] = useState(false)
  // Remembered per machine, like the other dialog and diff toggles; off until turned on.
  const [openAfter, setOpenAfter] = useState(() => readOpenAfterCreate(globalThis.localStorage))
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [picked, setPicked] = useState<Record<PrMetaField, string[]>>({ ...NO_PICKS })
  // What each picker's field holds but was not confirmed with Enter — added on Create.
  const [pending, setPending] = useState<Partial<Record<PrMetaField, string>>>({})
  const [meta, setMeta] = useState<PrPickerOptions | null>(null)
  const [metaState, setMetaState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [baseHint, setBaseHint] = useState<TranslationKey | null>(null)
  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)
  const t = useT()

  // The host measures a PR against its own copy of the target, so the prefill
  // and the AI draft do too: a local `main` left behind after `git pull origin
  // main` was merged into the source would otherwise count every upstream commit.
  const sourceUpstream = repo?.branches.locals.find((b) => b.name === source)?.upstream
  const baseRemote = prBaseRemote(repo?.remotes ?? [], remoteUrl, sourceUpstream)
  // One refresh of the base per remote + target while the dialog is open: the
  // prefill and the AI draft share it, and switching back and forth costs nothing.
  const refreshes = useRef(new Map<string, Promise<boolean>>())
  const refreshBase = (): Promise<boolean> => {
    const key = `${baseRemote}\0${target}`
    let refreshed = refreshes.current.get(key)
    if (!refreshed) {
      refreshed = gitApi.refreshPrBase(spec.repoPath, baseRemote, target).catch(() => false)
      refreshes.current.set(key, refreshed)
    }
    return refreshed
  }
  const comparePr = (): Promise<PrComparison> => gitApi.prComparison(spec.repoPath, source, target, baseRemote)

  // Draft the PR title + body from the branch's commits + diff via AI.
  const aiDraft = async (): Promise<void> => {
    if (!source || !target || source === target) return
    setAiBusy(true)
    try {
      const ok = await refreshBase()
      const cmp = await comparePr()
      setBaseHint(prBaseHint(cmp.baseIsRemote, ok))
      const commits = cmp.commits.map((c) => `- ${c.subject}`).join('\n')
      const { title: t, body: b } = await aiApi.prDescription(commits, cmp.diff, { ...aiFor('review'), cliCwd: spec.repoPath })
      if (t) {
        titleTouched.current = true
        setTitle(t)
      }
      if (b) {
        bodyTouched.current = true
        setBody(b)
      }
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setAiBusy(false)
    }
  }

  // Auto-fill title/body from the commits unique to `source` — unless the opener
  // already supplied a title, or the user has started editing the fields.
  const titleTouched = useRef(!!spec.defaultTitle)
  const bodyTouched = useRef(!!spec.defaultBody)
  useEffect(() => {
    setBaseHint(null)
    if (!remoteUrl || !source || !target || source === target) return
    if (titleTouched.current && bodyTouched.current) return
    let cancelled = false
    const fill = (r: PrComparison): void => {
      const ahead = r.commits
      if (!titleTouched.current) setTitle(ahead.length === 1 ? ahead[0].subject : source)
      if (!bodyTouched.current) setBody(ahead.map((c) => `- ${c.subject}`).join('\n'))
    }
    // Fill at once from the remote base as last fetched, then again once it is
    // refreshed — a slow or unreachable remote never holds the dialog up.
    void (async () => {
      const first = await comparePr()
      if (cancelled) return
      fill(first)
      const ok = await refreshBase()
      if (cancelled) return
      const cmp = ok ? await comparePr() : first
      if (cancelled) return
      fill(cmp)
      setBaseHint(prBaseHint(cmp.baseIsRemote, ok))
    })().catch(() => {})
    return () => {
      cancelled = true
    }
    // comparePr and refreshBase read only what the dependencies below already cover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.repoPath, source, target, remoteUrl, baseRemote])

  const tokens = {
    github: profile.githubToken || undefined,
    azure: profile.azureToken || undefined,
    gitlab: profile.gitlabToken || undefined,
    bitbucket: profile.bitbucketToken || undefined,
    forgejo: profile.forgejoToken || undefined
  }
  const valid = !!remoteUrl && !!source && !!target && source !== target && !!title.trim() && !busy

  // Reviewers, assignees and labels: which ones the host takes, and the choices,
  // read lazily once the dialog is open. A failure only costs those fields.
  // Keyed by account too: another profile, or a new token, must not be served this one's lists.
  const cacheKey = pickerCacheKey(spec.repoPath, remoteUrl, [profile.id, boundProfileId], tokens)
  const loadedKey = useRef<string | null>(null)
  useEffect(() => {
    if (!remoteUrl) return
    let cancelled = false
    // Another account while open: its lists are reloaded and the picks start over —
    // never send people or labels chosen from one account's lists under another.
    const prev = loadedKey.current
    loadedKey.current = cacheKey
    if (prev !== null && prev !== cacheKey) {
      setPicked((p) => picksForAccount(prev, cacheKey, p))
      setPending({})
      setMeta(null)
    }
    setMetaState('loading')
    pickerCache
      .get(cacheKey, () => hostingApi.prPickerOptions(spec.repoPath, remoteUrl, tokens))
      .then(
        (o) => {
          if (cancelled) return
          setMeta(o)
          setMetaState('ready')
        },
        () => !cancelled && setMetaState('failed')
      )
    return () => {
      cancelled = true
    }
    // The tokens object is rebuilt each render; the key carries their fingerprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  const fields = shownFields(meta)
  const people = useMemo(
    () => ({ reviewers: (meta?.reviewers ?? []).map(personItem), assignees: (meta?.assignees ?? []).map(personItem) }),
    [meta]
  )
  const labelRows = useMemo(() => (meta?.labels ?? []).map(labelItem), [meta])
  // An @ in the description offers the people the reviewer and assignee pickers
  // already read, then the authors of the loaded PRs; a # those PRs and issues.
  const repoPrs = repo?.prs
  const mentions = useMemo(
    () =>
      collectMentionNames(
        meta?.reviewers.map((p) => p.login),
        meta?.assignees.map((p) => p.login),
        repoPrs?.map((p) => p.author)
      ),
    [meta, repoPrs]
  )
  const references = useRepoReferences(spec.repoPath)

  const submit = async (): Promise<void> => {
    if (!valid) return
    setBusy(true)
    try {
      const res = await hostingApi.createPR(spec.repoPath, remoteUrl, tokens, {
        title: title.trim(),
        body,
        source,
        target,
        draft,
        ...picksToSend(meta, withPendingText(meta, picked, pending))
      })
      closeModal()
      void announcePrCreated(res, { repoPath: spec.repoPath, remoteUrl, title: title.trim(), openInBrowser: openAfter })
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const openInBrowser = (): void => {
    closeModal()
    void hostingApi.openCreatePR(remoteUrl, source, target)
  }

  return (
    <>
      <h3>
        <GitPullRequest size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
        {t('createPR.title')}
      </h3>

      <div className="pr-branch-pick">
        <label className="pr-branch-field">
          <span>{t('createPR.from')}</span>
          <RefPicker value={source} options={branchOptions} onChange={setSource} />
        </label>
        <ArrowRight size={14} className="pr-branch-arrow" />
        <label className="pr-branch-field">
          <span>{t('createPR.into')}</span>
          <RefPicker value={target} options={branchOptions} onChange={setTarget} />
        </label>
      </div>
      {source === target && <p className="pr-warn">{t('createPR.differentBranches')}</p>}
      {baseHint && source !== target && (
        <p className="prmeta-hint">{interp(t(baseHint), { remote: baseRemote, target })}</p>
      )}
      {!remoteUrl && <p className="pr-warn">{t('createPR.noRemote')}</p>}

      <label className="modal-label">{t('createPR.titleLabel')}</label>
      <input
        autoFocus
        className="modal-input"
        value={title}
        onChange={(e) => {
          titleTouched.current = true
          setTitle(e.target.value)
        }}
        placeholder={t('createPR.titlePlaceholder')}
      />

      <div className="pr-desc-label">
        <label className="modal-label">{t('createPR.descriptionLabel')}</label>
        {aiEnabled && (
          <button
            className="btn ghost small"
            onClick={() => void aiDraft()}
            disabled={aiBusy || !remoteUrl || source === target}
            title={t('createPR.aiDraftTitle')}
          >
            {aiBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} {t('createPR.aiDraft')}
          </button>
        )}
      </div>
      <MarkdownEditor
        inputClassName="pr-body"
        value={body}
        onChange={(v) => {
          bodyTouched.current = true
          setBody(v)
        }}
        placeholder={t('createPR.descriptionPlaceholder')}
        ariaLabel={t('createPR.descriptionLabel')}
        mentions={mentions}
        references={references}
        // A dialog would cover the handbook page the hint opens.
        helpLink={false}
      />

      {remoteUrl && metaState === 'loading' && (
        <p className="prmeta-status">
          <Loader2 size={12} className="spin" /> {t('createPR.metaLoading')}
        </p>
      )}
      {remoteUrl && metaState === 'failed' && <p className="prmeta-hint">{t('createPR.metaLoadFailed')}</p>}
      {fields.length > 0 && (
        <div className="pr-meta">
          {fields.map((f) => (
            <div key={f} className="prmeta-field">
              <label className="modal-label">{t(FIELD_LABEL[f])}</label>
              <PrMetaPicker
                label={t(FIELD_LABEL[f])}
                items={f === 'labels' ? labelRows : people[f]}
                value={picked[f]}
                onChange={(next) => setPicked((p) => ({ ...p, [f]: next }))}
                placeholder={t(placeholderFor(meta, f))}
                failed={!!meta?.failed.includes(f)}
                partial={!!meta?.partial?.includes(f)}
                allowFree={freeEntry(meta, f)}
                people={f !== 'labels'}
                text={pending[f] ?? ''}
                onTextChange={(text) => setPending((p) => ({ ...p, [f]: text }))}
              />
            </div>
          ))}
        </div>
      )}

      <label className="pr-draft">
        <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
        <span>{t('createPR.createDraft')}</span>
      </label>
      <label className="pr-draft">
        <input
          type="checkbox"
          checked={openAfter}
          onChange={(e) => {
            setOpenAfter(e.target.checked)
            writeOpenAfterCreate(globalThis.localStorage, e.target.checked)
          }}
        />
        <span>{t('createPR.openAfterCreate')}</span>
      </label>

      <div className="modal-actions pr-actions">
        <button
          className="btn ghost small"
          onClick={openInBrowser}
          disabled={busy || !remoteUrl || source === target}
          title={t('createPR.openBrowserTitle')}
        >
          <ExternalLink size={13} /> {t('createPR.openBrowser')}
        </button>
        <span className="pr-actions-spacer" />
        <button className="btn ghost" onClick={closeModal} disabled={busy}>
          {t('bisect.cancel')}
        </button>
        <button className="btn primary" onClick={() => void submit()} disabled={!valid}>
          {busy ? <Loader2 size={13} className="spin" /> : null} {t('createPR.createButton')}
        </button>
      </div>
    </>
  )
}
