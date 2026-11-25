import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Loader2, RefreshCw } from 'lucide-react'
import { useUIStore, type ModalSpec } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { useProfileAvatarsStore } from '../stores/profileAvatars'
import { useT, t as tNow, interp, type TranslationKey } from '../i18n'
import {
  IMPORT_PARTS,
  bundleExtrasFor,
  bundleRepoPaths,
  remapInfoExport,
  remapVaultExport,
  remapPath,
  suggestRemap,
  summarizeImport,
  type ImportPart
} from '../lib/settingsImport'
import { fsApi, infoApi, vaultApi, profileAvatarApi, SettingsSaveRefused } from '../infrastructure/api'
import { hasSettingsSecrets } from '../../../shared/secrets'
import type { AppSettings } from '../../../shared/types'

type Spec = Extract<ModalSpec, { kind: 'settings-import' }>
type Chosen = Record<ImportPart, boolean>
/** The writes an import makes, in order. Kept apart so a retry after a failure
 *  resumes at the one that failed instead of applying the earlier ones twice. */
type Step = 'settings' | 'info' | 'vault' | 'avatars'
type Remap = { from: string; to: string; existing: string[] }

/** What the disk said, once asked. `repo` lines up with the summary's repoPaths,
 *  `extra` with the bundle's info/vault keys, `machine` with the absolute
 *  program paths. 'failed' is "unknown", never "nothing exists". */
type Check = { repo: boolean[]; extra: boolean[]; machine: boolean[] } | 'failed'

/** How many sample repositories the path translation lists. Enough to see the
 *  pattern, few enough that the dialog does not turn into a file browser. */
const SAMPLE_SIZE = 6

const PART_COPY: Record<ImportPart, { title: TranslationKey; hint: TranslationKey }> = {
  profiles: { title: 'settingsImport.partProfiles', hint: 'settingsImport.partProfilesHint' },
  prefs: { title: 'settingsImport.partPrefs', hint: 'settingsImport.partPrefsHint' },
  repos: { title: 'settingsImport.partRepos', hint: 'settingsImport.partReposHint' },
  machine: { title: 'settingsImport.partMachine', hint: 'settingsImport.partMachineHint' }
}

const STEP_LABEL: Record<Step, TranslationKey> = {
  settings: 'settingsImport.stepSettings',
  info: 'settingsImport.stepInfo',
  vault: 'settingsImport.stepVault',
  avatars: 'settingsImport.stepAvatars'
}

/** A count with its noun. Two keys, because "1 profiles" reads as a bug; the
 *  locales whose plurals have more forms word the many-key as "noun: {count}". */
function counted(t: (k: TranslationKey) => string, n: number, one: TranslationKey, many: TranslationKey): string {
  return n === 1 ? t(one) : interp(t(many), { count: n })
}

// A typed prefix keeps its meaning with or without a trailing separator.
const trimPrefix = (p: string): string => {
  const s = p.trim()
  return s.length > 1 ? s.replace(/[\\/]+$/, '') : s
}

// Only an absolute path can be checked on disk; `code` or `~/bin/x` cannot.
const isAbsolutePath = (p: string): boolean => /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(p)

const countTrue = (list: readonly boolean[] | null | undefined): number => list?.filter(Boolean).length ?? 0

/**
 * Settings → Data → Import, after the file is picked and unlocked: which parts
 * of it to apply, and how its repository paths map onto this computer. Stacked
 * over Settings (a dialog, see `isDialogSpec`), so the page underneath keeps
 * its state.
 */
export function ImportSettingsDialog({ spec, onClose }: { spec: Spec; onClose?: () => void }): React.JSX.Element {
  const t = useT()
  const storeClose = useUIStore((s) => s.closeModal)
  const close = onClose ?? storeClose
  const toast = useUIStore((s) => s.toast)
  const setCloseLocked = useUIStore((s) => s.setCloseLocked)

  const summary = useMemo(() => summarizeImport(spec.settings), [spec.settings])
  const repoPaths = summary.repoPaths
  const total = repoPaths.length
  // Info and vault entries can name repositories no tab does; they are checked
  // and translated too, or the import would drop them as missing.
  const extraPaths = useMemo(() => bundleRepoPaths(spec.bundle), [spec.bundle])
  const machineAbs = useMemo(() => summary.machinePaths.filter(isAbsolutePath), [summary.machinePaths])
  const hasSecrets = useMemo(() => hasSettingsSecrets(spec.settings as AppSettings), [spec.settings])

  const [check, setCheck] = useState<Check | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [secrets, setSecrets] = useState<'merge' | 'replace'>('merge')
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failedStep, setFailedStep] = useState<Step | null>(null)
  // Once the settings are written the choices are spent: a retry finishes the
  // same plan rather than applying a different one over half of this.
  const plan = useRef<{ parts: ImportPart[]; remap?: Remap; replaceSecrets: boolean; folders: number } | null>(null)
  const done = useRef(new Set<Step>())
  const [started, setStarted] = useState(false)

  // Never leave the host locked behind us, however this closes.
  useEffect(() => () => setCloseLocked(false), [setCloseLocked])

  useEffect(() => {
    let alive = true
    setCheck(null)
    void (async () => {
      const all = [...repoPaths, ...extraPaths, ...machineAbs]
      let exists: boolean[]
      let home: string
      try {
        ;[exists, home] = await Promise.all([all.length ? fsApi.pathsExist(all) : Promise.resolve([]), fsApi.homeDir()])
      } catch {
        if (!alive) return
        // Unknown machine: nothing path-bound is ticked until a check succeeds.
        setCheck('failed')
        setChosen((c) => ({ profiles: c?.profiles ?? true, prefs: c?.prefs ?? true, repos: false, machine: false }))
        return
      }
      if (!alive) return
      const repo = exists.slice(0, total)
      const extra = exists.slice(total, total + extraPaths.length)
      const machine = exists.slice(total + extraPaths.length)
      // Evidence of the same computer: a repository folder here, or — with no
      // repositories in the file — every program path it names.
      const sameByRepos = total > 0 && repo.some(Boolean)
      const sameByPrograms = total === 0 && machine.length > 0 && machine.every(Boolean)
      setCheck({ repo, extra, machine })
      if (!repo.every(Boolean)) {
        const hint = suggestRemap(repoPaths, home)
        setFrom(hint?.from ?? '')
        setTo(hint?.to ?? '')
      }
      setChosen((c) => ({
        profiles: c?.profiles ?? true,
        prefs: c?.prefs ?? true,
        repos: total === 0 || sameByRepos,
        machine: sameByRepos || sameByPrograms
      }))
    })()
    return () => {
      alive = false
    }
  }, [repoPaths, extraPaths, machineAbs, total, attempt])

  const checked = check && check !== 'failed' ? check : null
  const checkFailed = check === 'failed'
  const baseFound = countTrue(checked?.repo)
  const fromPrefix = trimPrefix(from)
  const toPrefix = trimPrefix(to)
  const showRemap = !!chosen?.repos && !!checked && baseFound < total
  const remapOn = showRemap && fromPrefix.length > 0 && toPrefix.length > 0 && fromPrefix !== toPrefix
  const remapKey = `${fromPrefix}\n${toPrefix}`
  // Settings paths first, then the bundle's extras: the first `total` entries
  // are what the meter counts.
  const allPaths = useMemo(() => [...repoPaths, ...extraPaths], [repoPaths, extraPaths])
  const remapped = useMemo(
    () => (remapOn ? allPaths.map((p) => remapPath(p, fromPrefix, toPrefix)) : allPaths),
    [remapOn, allPaths, fromPrefix, toPrefix]
  )

  // Re-check as either prefix is typed — debounced, and only the answer for
  // the latest pair counts. A failed look is null: unknown, not "none found".
  const [remapExists, setRemapExists] = useState<{ key: string; exists: boolean[] | null } | null>(null)
  const seq = useRef(0)
  useEffect(() => {
    if (!remapOn) return
    const mine = ++seq.current
    const timer = window.setTimeout(() => {
      fsApi
        .pathsExist(remapped)
        .then((exists) => {
          if (seq.current === mine) setRemapExists({ key: remapKey, exists })
        })
        .catch(() => {
          if (seq.current === mine) setRemapExists({ key: remapKey, exists: null })
        })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [remapOn, remapped, remapKey])

  // undefined: still checking · null: the check failed · else one flag per path.
  const allExists: boolean[] | null | undefined = remapOn
    ? remapExists?.key === remapKey
      ? remapExists.exists
      : undefined
    : checked
      ? [...checked.repo, ...checked.extra]
      : checkFailed
        ? null
        : undefined
  const checking = allExists === undefined
  const repoExists = allExists ? allExists.slice(0, total) : null
  const found = countTrue(repoExists)
  // Only folders found on this computer go in, translated or not: a backup
  // restored on the same machine still drops the repositories deleted since.
  const foldersIncluded = found

  const parts = chosen ? IMPORT_PARTS.filter((p) => chosen[p]) : []

  // Repositories are the part that can quietly empty a workspace: refuse it
  // while the disk is unknown, or when the translation finds nothing.
  const blocked: TranslationKey | null = !chosen?.repos
    ? null
    : checkFailed || allExists === null
      ? 'settingsImport.blockedUnchecked'
      : !checking && found === 0 && total > 0
        ? 'settingsImport.blockedNoneFound'
        : null

  const canImport =
    !!chosen &&
    parts.length > 0 &&
    !busy &&
    !confirmingReplace &&
    (started || (!blocked && !(chosen.repos && checking)))

  const toggle = (part: ImportPart): void => setChosen((c) => (c ? { ...c, [part]: !c[part] } : c))

  const runImport = async (): Promise<void> => {
    if (!plan.current) {
      // Repositories always go through the filter, translated or not: an empty
      // prefix pair translates nothing and still drops folders missing here.
      const existing = allExists ? remapped.filter((_, i) => allExists[i]) : []
      plan.current = {
        parts,
        remap:
          parts.includes('repos') && allExists
            ? { from: remapOn ? fromPrefix : '', to: remapOn ? toPrefix : '', existing }
            : undefined,
        replaceSecrets: hasSecrets && parts.includes('profiles') && secrets === 'replace',
        folders: foldersIncluded
      }
    }
    const { parts: chosenParts, remap, replaceSecrets, folders } = plan.current
    const bundle = spec.bundle
    const extras = bundleExtrasFor(chosenParts)
    setBusy(true)
    setFailedStep(null)
    setCloseLocked(true)
    let step: Step = 'settings'
    try {
      if (!done.current.has('settings')) {
        // Through the store's normalizer, not a bare spread: that is what makes
        // the import take effect now rather than on the next launch.
        await useSettingsStore.getState().importSettings(spec.settings, { replaceSecrets, parts: chosenParts, remap })
        done.current.add('settings')
        setStarted(true)
      }
      step = 'info'
      if (!done.current.has('info')) {
        if (bundle?.info && extras.info) {
          await infoApi.importAll(remap ? remapInfoExport(bundle.info, remap.from, remap.to, remap.existing) : bundle.info)
        }
        done.current.add('info')
      }
      step = 'vault'
      if (!done.current.has('vault')) {
        // The vault rides with the profiles, but its per-repository entries are
        // keyed by path: they follow the translation like the repositories do.
        if (bundle?.vault && extras.vault) {
          await vaultApi.importAll(remap ? remapVaultExport(bundle.vault, remap.from, remap.to) : bundle.vault)
        }
        done.current.add('vault')
      }
      step = 'avatars'
      if (!done.current.has('avatars')) {
        if (bundle?.avatars && extras.avatars) {
          await profileAvatarApi.importAll(bundle.avatars)
          useProfileAvatarsStore.getState().reloadProfileImages()
        }
        done.current.add('avatars')
      }
      const names = chosenParts.map((p) =>
        p === 'repos'
          ? counted(tNow, folders, 'settingsImport.foldersCountOne', 'settingsImport.foldersCount')
          : tNow(p === 'profiles' ? 'settingsImport.doneProfiles' : p === 'prefs' ? 'settingsImport.donePrefs' : 'settingsImport.doneMachine')
      )
      // The import may have switched the language: list in the one `tNow` uses now.
      let list = names.join(', ')
      try {
        list = new Intl.ListFormat(useSettingsStore.getState().settings.language, { type: 'conjunction' }).format(names)
      } catch {
        // An engine without the locale keeps the plain list.
      }
      setCloseLocked(false)
      close()
      toast('success', interp(tNow('settingsImport.done'), { parts: list }))
    } catch (err) {
      setFailedStep(step)
      const refused = err instanceof SettingsSaveRefused ? err.reason : null
      toast(
        'error',
        step !== 'settings'
          ? interp(tNow('settingsImport.stepFailed'), { step: tNow(STEP_LABEL[step]) })
          : refused === 'keychain-required'
            ? tNow('settings.importReplaceNeedsKeychain')
            : refused === 'store-unreadable'
              ? tNow('settings.importReplaceStoreUnreadable')
              : tNow('settings.importFailed')
      )
      // Nothing was written: the choices are open again.
      if (step === 'settings') plan.current = null
    } finally {
      setBusy(false)
      setCloseLocked(false)
    }
  }

  const onImport = (): void => {
    if (!canImport) return
    // Replacing deletes credentials: say what is lost and ask, before anything.
    if (!started && hasSecrets && !!chosen?.profiles && secrets === 'replace') {
      setConfirmingReplace(true)
      return
    }
    void runImport()
  }

  // The Replace confirmation freezes the choices too: what it confirms is what runs.
  const locked = busy || started || confirmingReplace

  const header = [
    counted(t, summary.profileCount, 'settingsImport.profilesCountOne', 'settingsImport.profilesCount'),
    t(hasSecrets ? 'settingsImport.withCredentials' : 'settingsImport.withoutCredentials')
  ]

  const counts: Record<ImportPart, string> = {
    profiles: counted(t, summary.profileCount, 'settingsImport.profilesCountOne', 'settingsImport.profilesCount'),
    prefs: counted(t, summary.prefCount, 'settingsImport.prefsCountOne', 'settingsImport.prefsCount'),
    repos: counted(t, total, 'settingsImport.pathsCountOne', 'settingsImport.pathsCount'),
    machine: counted(t, summary.machinePaths.length, 'settingsImport.pathsCountOne', 'settingsImport.pathsCount')
  }

  const machineOther =
    !!checked &&
    ((total > 0 && baseFound === 0) || (total === 0 && checked.machine.length > 0 && !checked.machine.every(Boolean)))

  const reposNote = (): React.ReactNode => {
    if (!checked || total === 0) return null
    if (baseFound === 0) {
      return (
        <div className="import-why">
          <AlertTriangle size={13} aria-hidden="true" />
          <span>{interp(t('settingsImport.reposNoneExist'), { count: total })}</span>
        </div>
      )
    }
    return (
      <div className="import-why good">
        <Check size={13} aria-hidden="true" />
        <span>
          {baseFound === total
            ? interp(t('settingsImport.reposAllExist'), { count: total })
            : interp(t('settingsImport.reposSomeExist'), { found: baseFound, count: total })}
        </span>
      </div>
    )
  }

  const remapBox = (): React.ReactNode => {
    if (!showRemap) return null
    const sample = remapped.slice(0, Math.min(SAMPLE_SIZE, total))
    const pct = total ? Math.round((found / total) * 100) : 0
    return (
      <div className="import-remap">
        <div className="import-remap-title">{t('settingsImport.remapTitle')}</div>
        <div className="import-remap-row">
          <label>
            {t('settingsImport.remapFrom')}
            <input
              className="import-remap-input"
              value={from}
              spellCheck={false}
              disabled={locked}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <ArrowRight size={14} className="import-remap-arrow" aria-hidden="true" />
          <label>
            {t('settingsImport.remapTo')}
            <input
              className="import-remap-input"
              value={to}
              spellCheck={false}
              disabled={locked}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div className="import-meter">
          <div className="import-bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          <span aria-live="polite">
            {checking ? (
              <Loader2 size={12} className="spin" aria-label={t('settingsImport.checking')} />
            ) : (
              interp(t('settingsImport.remapFound'), { found, count: total })
            )}
          </span>
        </div>
        <ul className="import-repos">
          {sample.map((p, i) => {
            const ok = !!repoExists?.[i]
            return (
              <li key={`${i}:${p}`}>
                <span
                  className={`import-dot ${ok ? 'ok' : ''}`}
                  title={t(ok ? 'settingsImport.sampleFound' : 'settingsImport.sampleMissing')}
                />
                <span className="import-repo-path">{p}</span>
              </li>
            )
          })}
        </ul>
        {!checking && allExists !== null && (
          <span className="import-more">
            {found === 0
              ? t('settingsImport.remapNoneFound')
              : found < total
                ? interp(t('settingsImport.remapLeftOut'), { count: total - found })
                : t('settingsImport.remapAllFound')}
          </span>
        )}
      </div>
    )
  }

  const machineNote = (): React.ReactNode => {
    if (!machineOther || summary.machinePaths.length === 0) return null
    return (
      <div className="import-why">
        <AlertTriangle size={13} aria-hidden="true" />
        <span>
          {t('settingsImport.machineOther')}{' '}
          {summary.machinePaths.map((p) => (
            <code key={p}>{p}</code>
          ))}
        </span>
      </div>
    )
  }

  const part = (id: ImportPart, extra?: React.ReactNode): React.ReactNode => {
    const on = !!chosen?.[id]
    return (
      <div className={`import-part ${on ? 'on' : ''}`} key={id}>
        <label className="import-part-head">
          <input type="checkbox" checked={on} disabled={!chosen || locked} onChange={() => toggle(id)} />
          <b>{t(PART_COPY[id].title)}</b>
          <span className="import-count">{counts[id]}</span>
          <span className="import-what">{t(PART_COPY[id].hint)}</span>
        </label>
        {extra}
      </div>
    )
  }

  return (
    <div className="import-dialog">
      <h3>{t('settingsImport.title')}</h3>
      <p className="import-from">{header.join(' · ')}</p>

      {checkFailed && (
        <div className="import-check-failed">
          <span>{t('settingsImport.checkFailed')}</span>
          <button className="btn ghost small" onClick={() => setAttempt((n) => n + 1)} disabled={locked}>
            <RefreshCw size={12} />
            {t('settingsImport.checkAgain')}
          </button>
        </div>
      )}

      {!chosen ? (
        <p className="import-loading">
          <Loader2 size={13} className="spin" aria-hidden="true" /> {t('settingsImport.checkingPaths')}
        </p>
      ) : (
        <div className="import-body">
          {part('profiles')}
          {hasSecrets && (
            <div className={`import-secrets ${chosen.profiles ? '' : 'off'}`}>
              <span>{t('settingsImport.credentialsLabel')}</span>
              <span className="import-mini-seg" role="group" aria-label={t('settingsImport.credentialsLabel')}>
                <button
                  type="button"
                  aria-pressed={secrets === 'merge'}
                  disabled={!chosen.profiles || locked}
                  onClick={() => setSecrets('merge')}
                >
                  {t('settings.importSecretsMerge')}
                </button>
                <button
                  type="button"
                  aria-pressed={secrets === 'replace'}
                  disabled={!chosen.profiles || locked}
                  onClick={() => setSecrets('replace')}
                >
                  {t('settings.importSecretsReplace')}
                </button>
              </span>
              {secrets === 'replace' && chosen.profiles && (
                <span className="import-secrets-warn">{t('settingsImport.credentialsReplaceHint')}</span>
              )}
            </div>
          )}
          {part('prefs')}
          {part(
            'repos',
            <>
              {reposNote()}
              {remapBox()}
            </>
          )}
          {part('machine', machineNote())}
        </div>
      )}

      {confirmingReplace && (
        <div className="import-confirm" role="alertdialog" aria-labelledby="import-confirm-title">
          <b id="import-confirm-title">{t('settingsImport.replaceConfirmTitle')}</b>
          <span>{t('settingsImport.replaceConfirmMessage')}</span>
          <div className="import-confirm-actions">
            <button className="btn ghost small" onClick={() => setConfirmingReplace(false)} autoFocus>
              {t('common.cancel')}
            </button>
            <button
              className="btn danger small"
              onClick={() => {
                setConfirmingReplace(false)
                if (!blocked) void runImport()
              }}
            >
              {t('settings.importSecretsReplace')}
            </button>
          </div>
        </div>
      )}

      {failedStep && failedStep !== 'settings' && (
        <p className="import-failed" role="alert">
          {interp(t('settingsImport.stepFailed'), { step: t(STEP_LABEL[failedStep]) })}
        </p>
      )}
      {blocked && !started && <p className="import-blocked">{t(blocked)}</p>}

      <div className="modal-actions import-foot">
        <span className="import-summary">
          {chosen &&
            (parts.length === 0
              ? t('settingsImport.summaryNone')
              : chosen.repos && total > 0
                ? interp(t('settingsImport.summaryWithRepos'), {
                    count: parts.length,
                    total: IMPORT_PARTS.length,
                    repos: counted(t, foldersIncluded, 'settingsImport.foldersCountOne', 'settingsImport.foldersCount')
                  })
                : interp(t('settingsImport.summary'), { count: parts.length, total: IMPORT_PARTS.length }))}
        </span>
        <button className="btn ghost" onClick={close} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" onClick={onImport} disabled={!canImport}>
          {busy && <Loader2 size={13} className="spin" />}
          {t(started ? 'settingsImport.resume' : 'settingsImport.import')}
        </button>
      </div>
    </div>
  )
}
