import { useEffect, useMemo, useRef, useState } from 'react'
import { GitPullRequest, Loader2, ExternalLink, ArrowRight, Sparkles } from 'lucide-react'
import { gitApi, hostingApi, aiApi } from '../infrastructure/api'
import { useUIStore, type ModalSpec } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { useRepoStore } from '../stores/repo'
import { RefPicker, type RefOption } from './RefPicker'
import { PrMetaPicker } from './PrMetaPicker'
import { useT, useUiLanguage, interp, type TranslationKey } from '../i18n'
import { createPickerCache, labelItem, personItem, picksToSend, shownFields } from '../lib/prPicker'
import type { PrMetaField, PrPickerOptions } from '../../../shared/types'

// Choices read once per repository + remote, and reused for a few minutes, so
// reopening the dialog does not walk the host's member and label lists again.
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
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [picked, setPicked] = useState<Record<PrMetaField, string[]>>({ reviewers: [], assignees: [], labels: [] })
  const [meta, setMeta] = useState<PrPickerOptions | null>(null)
  const [metaState, setMetaState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const aiEnabled = profile.ai?.enabled !== false
  const t = useT()
  const lang = useUiLanguage()

  // Draft the PR title + body from the branch's commits + diff via AI.
  const aiDraft = async (): Promise<void> => {
    if (!source || !target || source === target) return
    setAiBusy(true)
    try {
      const cmp = await gitApi.compareBranches(spec.repoPath, source, target)
      const commits = cmp.aheadCommits.map((c) => `- ${c.subject}`).join('\n')
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
    if (!remoteUrl || !source || !target || source === target) return
    if (titleTouched.current && bodyTouched.current) return
    let cancelled = false
    void gitApi.compareBranches(spec.repoPath, source, target).then((r) => {
      if (cancelled) return
      const ahead = r.aheadCommits
      if (!titleTouched.current) setTitle(ahead.length === 1 ? ahead[0].subject : source)
      if (!bodyTouched.current) setBody(ahead.map((c) => `- ${c.subject}`).join('\n'))
    })
    return () => {
      cancelled = true
    }
  }, [spec.repoPath, source, target, remoteUrl])

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
  useEffect(() => {
    if (!remoteUrl) return
    let cancelled = false
    setMetaState('loading')
    pickerCache
      .get(`${spec.repoPath}\n${remoteUrl}`, () => hostingApi.prPickerOptions(spec.repoPath, remoteUrl, tokens))
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
    // The tokens object is rebuilt each render; the remote is what decides the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.repoPath, remoteUrl])

  const fields = shownFields(meta)
  const people = useMemo(
    () => ({ reviewers: (meta?.reviewers ?? []).map(personItem), assignees: (meta?.assignees ?? []).map(personItem) }),
    [meta]
  )
  const labelRows = useMemo(() => (meta?.labels ?? []).map(labelItem), [meta])

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
        ...picksToSend(meta, picked)
      })
      closeModal()
      toast('success', interp(t('createPR.created'), { n: res.number }))
      // The PR exists either way; a pick the host refused is said, never dropped quietly.
      if (res.metaFailed?.length) {
        const parts = new Intl.ListFormat(lang, { type: 'conjunction' }).format(res.metaFailed.map((f) => t(FIELD_LABEL[f])))
        toast('error', interp(t('createPR.createdMetaFailed'), { n: res.number, parts }))
      }
      void window.api.openExternal(res.url)
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
      <textarea
        className="pr-body"
        value={body}
        onChange={(e) => {
          bodyTouched.current = true
          setBody(e.target.value)
        }}
        placeholder={t('createPR.descriptionPlaceholder')}
        spellCheck
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
                placeholder={t(f === 'labels' && meta?.freeLabels ? 'createPR.labelsFreePlaceholder' : FIELD_PLACEHOLDER[f])}
                failed={!!meta?.failed.includes(f)}
                allowFree={f === 'labels' && !!meta?.freeLabels}
              />
            </div>
          ))}
        </div>
      )}

      <label className="pr-draft">
        <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
        <span>{t('createPR.createDraft')}</span>
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
