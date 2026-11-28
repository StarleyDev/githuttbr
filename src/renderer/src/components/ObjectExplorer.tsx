import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  File,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Search,
  Tag
} from 'lucide-react'
import { gitApi } from '../infrastructure/api'
import type { GitObject, GitObjectKind, RefObject } from '../../../shared/types'
import { useT, interp, type TranslationKey } from '../i18n'
import { interpNodes } from './ConflictWorkspace'
import {
  EMPTY_HISTORY,
  canGoBack,
  canGoForward,
  findRefForRev,
  getCurrentStep,
  getCurrentTrail,
  getRefRole,
  getShortRefName,
  goBack,
  goForward,
  goToStep,
  startTrail,
  stepInto,
  type ObjectHistory,
  type RefRole,
  type StepLink,
  type TrailOrigin,
  type TrailStep
} from '../lib/objectTrail'
import { ObjectView } from './ObjectExplorerViews'

/** How many refs a group lists before asking for the filter. */
const GROUP_LIMIT = 100

type GroupId = RefRole

const GROUPS: { id: GroupId; labelKey: TranslationKey | null }[] = [
  { id: 'head', labelKey: null },
  { id: 'branch', labelKey: 'objects.groupBranches' },
  { id: 'tag', labelKey: 'objects.groupTags' },
  { id: 'remote', labelKey: 'objects.groupRemotes' },
  { id: 'other', labelKey: 'objects.groupOther' }
]

const ORIGIN_CHIP: Record<RefRole, TranslationKey | null> = {
  head: null,
  branch: 'objects.chipBranch',
  tag: 'objects.chipTag',
  remote: 'objects.chipRemote',
  other: 'objects.chipRef'
}

const KIND_CHIP: Record<GitObjectKind, TranslationKey> = {
  commit: 'objects.chipCommit',
  tree: 'objects.chipTree',
  blob: 'objects.chipBlob',
  tag: 'objects.chipTag'
}

/** A trail chip's icon, by the kind of thing it stands for. */
function KindIcon({ kind }: { kind: GitObjectKind | 'ref' }): React.JSX.Element {
  if (kind === 'tree') return <Folder size={12} aria-hidden="true" />
  if (kind === 'blob') return <File size={12} aria-hidden="true" />
  if (kind === 'tag') return <Tag size={12} aria-hidden="true" />
  if (kind === 'ref') return <GitBranch size={12} aria-hidden="true" />
  return <GitCommitHorizontal size={12} aria-hidden="true" />
}

/** What a trail chip says: the name a tree gave it, "root", or its kind and short sha. */
function stepLabel(step: TrailStep, t: (key: TranslationKey) => string): ReactNode {
  if (step.root) return <b>{t('objects.root')}</b>
  if (step.name) return <b>{step.kind === 'tree' ? `${step.name}/` : step.name}</b>
  const sha = <b className="obj-mono">{step.sha.slice(0, 7)}</b>
  return interpNodes(t(KIND_CHIP[step.kind]), { name: sha, sha })
}

function originLabel(origin: TrailOrigin, t: (key: TranslationKey) => string): ReactNode {
  const key = ORIGIN_CHIP[origin.role]
  return key ? interpNodes(t(key), { name: <b>{origin.name}</b> }) : <b>{origin.name}</b>
}

/** The shortest name that still resolves to this ref, for the revision box. */
function getRefRev(ref: string, refNames: readonly string[]): string {
  const short = getShortRefName(ref)
  return findRefForRev(short, refNames) === ref ? short : ref
}

/**
 * The layer beneath the graph: blobs, trees, commits, tags and the refs that
 * point at them, walkable.
 *
 * Nothing here mutates anything — that is the point. Git's model is four object
 * types and some pointers, and it stops being folklore the moment you can click
 * a commit, land on its tree, and find the blob your file actually is. The trail
 * above the pane is that walk, kept: every chip is a step you can return to.
 */
export function ObjectExplorer({ repoPath, rev }: { repoPath: string; rev?: string }): React.JSX.Element {
  const t = useT()
  const [refs, setRefs] = useState<RefObject[] | null>(null)
  const [history, setHistory] = useState<ObjectHistory>(EMPTY_HISTORY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(rev ?? '')
  const [filter, setFilter] = useState('')
  // Remotes start folded: they mirror the branches, and would push the tags off screen.
  const [collapsed, setCollapsed] = useState<Record<GroupId, boolean>>({
    head: false,
    branch: false,
    tag: false,
    remote: true,
    other: true
  })
  const [examplePath, setExamplePath] = useState('')
  const [hasParent, setHasParent] = useState(false)
  // Objects never change under a sha, so Back and a chip click never ask twice.
  const cache = useRef(new Map<string, GitObject>())

  const refNames = useMemo(() => (refs ?? []).map((r) => r.name), [refs])

  const fetchObject = useCallback(
    async (target: string): Promise<GitObject> => {
      const cached = cache.current.get(target)
      if (cached) return cached
      const found = await gitApi.gitObject(repoPath, target)
      cache.current.set(found.sha, found)
      return found
    },
    [repoPath]
  )

  const runRead = useCallback(async (work: () => Promise<void>): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const openRev = useCallback(
    (target: string): Promise<void> =>
      runRead(async () => {
        const wanted = target.trim() || 'HEAD'
        const found = await fetchObject(wanted)
        setHistory((h) => startTrail(h, wanted, found, refNames))
        setQuery(wanted)
      }),
    [runRead, fetchObject, refNames]
  )

  const followLink = (sha: string, link: StepLink): void => {
    void runRead(async () => {
      const found = await fetchObject(sha)
      const next = stepInto(history, found, link)
      setHistory(next)
      setQuery(getCurrentStep(next)?.rev ?? sha)
    })
  }

  // A move through the history lands on an object already seen, but the cache
  // is asked anyway: it costs nothing, and a miss still has the sha to fetch.
  const moveTo = (next: ObjectHistory): void => {
    void runRead(async () => {
      const step = getCurrentStep(next)
      if (step) await fetchObject(step.sha)
      setHistory(next)
      setQuery(step?.rev ?? '')
    })
  }

  useEffect(() => {
    let live = true
    void gitApi
      .objectRefs(repoPath)
      .catch(() => [] as RefObject[])
      .then((list) => {
        if (live) setRefs(list)
      })
    return () => {
      live = false
    }
  }, [repoPath])

  // Open the first object once the refs are known, so a branch opens as
  // `branch main → commit` rather than as a bare HEAD.
  const opened = useRef(false)
  useEffect(() => {
    if (!refs || opened.current) return
    opened.current = true
    const head = refs.find((r) => r.name === 'HEAD')
    void openRev(rev ?? head?.symbolic ?? 'HEAD')
    // The examples must name things that exist here: a parent, and a real path.
    if (!head) return
    void fetchObject('HEAD')
      .then(async (commit) => {
        setHasParent(!!commit.commit?.parents.length)
        if (!commit.commit) return
        const tree = await fetchObject(commit.commit.tree)
        // A dotfile is a real path too, but `HEAD:README.md` teaches more than `HEAD:.gitmodules`.
        const blobs = tree.tree?.filter((c) => c.kind === 'blob' && c.mode !== '120000') ?? []
        const blob = blobs.find((c) => !c.name.startsWith('.')) ?? blobs[0]
        if (blob) setExamplePath(blob.name)
      })
      .catch(() => undefined)
  }, [refs, rev, openRev, fetchObject])

  const trail = getCurrentTrail(history)
  const step = getCurrentStep(history)
  const object = step ? (cache.current.get(step.sha) ?? null) : null

  const examples = [
    ...(hasParent ? ['HEAD~1'] : []),
    'HEAD^{tree}', // i18n-ignore a git revision expression
    ...(examplePath ? [`HEAD:${examplePath}`] : [])
  ]

  const headRef = refs?.find((r) => r.name === 'HEAD')
  const originRef = trail?.origin ? refs?.find((r) => r.name === trail.origin?.ref) : undefined

  /** The ref the trail started from is the active row; HEAD, or HEAD's branch, shares its tint. */
  const getRowState = (ref: RefObject): string => {
    if (!originRef) return ''
    if (ref.name === originRef.name) return 'active'
    if (ref.name === 'HEAD' && ref.sha === originRef.sha) return 'same'
    if (originRef.name === 'HEAD' && headRef?.symbolic && ref.name === `refs/heads/${headRef.symbolic}`) return 'same'
    return ''
  }

  const needle = filter.trim().toLowerCase()
  const grouped = useMemo(() => {
    const out: Record<GroupId, RefObject[]> = { head: [], branch: [], tag: [], remote: [], other: [] }
    for (const ref of refs ?? []) {
      if (needle && !getShortRefName(ref.name).toLowerCase().includes(needle)) continue
      out[getRefRole(ref.name)].push(ref)
    }
    return out
  }, [refs, needle])

  const chipCount = trail ? trail.steps.length + (trail.origin ? 1 : 0) : 0

  return (
    <div className="obj-root">
      <header className="obj-header">
        <Boxes size={18} className="obj-header-icon" aria-hidden="true" />
        <h3>{t('objects.title')}</h3>
        <span className="obj-pill">{t('objects.readOnly')}</span>
      </header>

      <div className="obj-toolbar">
        <button
          className="obj-nav"
          disabled={!canGoBack(history)}
          onClick={() => moveTo(goBack(history))}
          aria-label={t('objects.back')}
          title={t('objects.back')}
        >
          <ChevronLeft size={15} className="obj-flip" />
        </button>
        <button
          className="obj-nav"
          disabled={!canGoForward(history)}
          onClick={() => moveTo(goForward(history))}
          aria-label={t('objects.forward')}
          title={t('objects.forward')}
        >
          <ChevronRight size={15} className="obj-flip" />
        </button>
        <label className="obj-rev">
          <span>{t('objects.revision')}</span>
          <input
            value={query}
            spellCheck={false}
            aria-label={t('objects.revision')}
            placeholder="HEAD~2^{tree}" // i18n-ignore a git revision expression, not prose
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void openRev(query)
            }}
          />
        </label>
        <button className="btn primary small obj-open" onClick={() => void openRev(query)}>
          {loading ? <Loader2 size={13} className="spin" /> : t('objects.open')}
        </button>
        <span className="obj-examples">
          {t('objects.examples')}
          {examples.map((example) => (
            <button key={example} className="obj-example" onClick={() => void openRev(example)}>
              {example}
            </button>
          ))}
        </span>
      </div>

      <nav className="obj-trail" aria-label={t('objects.trailLabel')}>
        <span className="obj-section-label">{t('objects.trail')}</span>
        {trail?.origin && (
          <>
            <button className="obj-chip kind-ref" onClick={() => moveTo(goToStep(history, 0))} title={trail.origin.ref}>
              <KindIcon kind={trail.origin.role === 'tag' ? 'tag' : 'ref'} />
              <span>{originLabel(trail.origin, t)}</span>
            </button>
            <ChevronRight size={14} className="obj-trail-sep obj-flip" aria-hidden="true" />
          </>
        )}
        {trail?.steps.map((s, i) => {
          const current = i === trail.steps.length - 1
          const body = (
            <>
              <KindIcon kind={s.kind} />
              <span>{stepLabel(s, t)}</span>
            </>
          )
          return current ? (
            <span key={`${i}:${s.sha}`} className={`obj-chip kind-${s.kind} current`} aria-current="page" title={s.sha}>
              {body}
            </span>
          ) : (
            <span key={`${i}:${s.sha}`} className="obj-trail-item">
              <button className={`obj-chip kind-${s.kind}`} onClick={() => moveTo(goToStep(history, i))} title={s.sha}>
                {body}
              </button>
              <ChevronRight size={14} className="obj-trail-sep obj-flip" aria-hidden="true" />
            </span>
          )
        })}
        {chipCount > 1 && <span className="obj-trail-hint">{t('objects.trailHint')}</span>}
      </nav>

      <div className="obj-body">
        <aside className="obj-rail" aria-label={t('objects.refsLabel')}>
          <label className="obj-filter">
            <Search size={13} aria-hidden="true" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('objects.filterRefs')}
              aria-label={t('objects.filterRefs')}
              spellCheck={false}
            />
          </label>
          {refs && !Object.values(grouped).some((list) => list.length) && (
            <p className="obj-rail-empty">{t('objects.noRefs')}</p>
          )}
          {GROUPS.map(({ id, labelKey }) => {
            const list = grouped[id]
            if (!list.length) return null
            // While filtering every group opens: a match hidden in a folded group is no match.
            const open = id === 'head' || !!needle || !collapsed[id]
            return (
              <div key={id} className="obj-group">
                {labelKey ? (
                  <button
                    className="obj-group-head"
                    aria-expanded={open}
                    onClick={() => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
                  >
                    {open ? <ChevronDown size={11} /> : <ChevronRight size={11} className="obj-flip" />}
                    {t(labelKey)}
                    <span className="obj-count">{list.length}</span>
                  </button>
                ) : (
                  // i18n-ignore git's own name for the ref
                  <div className="obj-group-head static">HEAD</div>
                )}
                {open &&
                  list.slice(0, GROUP_LIMIT).map((ref) => (
                    <button
                      key={ref.name}
                      className={`obj-ref ${getRowState(ref)}`}
                      onClick={() => void openRev(getRefRev(ref.name, refNames))}
                      title={ref.name}
                    >
                      <span className={`obj-ref-mark ${ref.kind === 'tag' ? 'annotated' : ''}`} aria-hidden="true" />
                      <span className="obj-ref-name">
                        {ref.name === 'HEAD' ? 'HEAD' : getShortRefName(ref.name)}
                        {ref.symbolic && <span className="obj-ref-aside"> → {ref.symbolic}</span>}
                        {ref.kind === 'tag' && <span className="obj-ref-annotated">{t('objects.annotated')}</span>}
                      </span>
                      <code>{ref.sha.slice(0, 7)}</code>
                    </button>
                  ))}
                {open && list.length > GROUP_LIMIT && (
                  <p className="obj-rail-more">{interp(t('objects.moreRefs'), { n: list.length - GROUP_LIMIT })}</p>
                )}
              </div>
            )
          })}
        </aside>

        <main className="obj-pane">
          {error && <p className="obj-error">{error}</p>}
          {object && step ? (
            <ObjectView repoPath={repoPath} object={object} step={step} onFollow={followLink} />
          ) : (
            !error && <p className="settings-hint">{t('common.loading')}</p>
          )}
        </main>
      </div>
    </div>
  )
}
