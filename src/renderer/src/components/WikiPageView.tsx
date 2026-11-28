import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, Boxes, Loader2, RefreshCw, Sparkles, FileText, FolderCog, FolderDown, Trash2, Workflow, X
} from 'lucide-react'
import { wikiApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { useRepoStore } from '../stores/repo'
import { MarkdownHtml } from './MarkdownHtml'
import { interp, useT } from '../i18n'
import { ImportMap, LanguageBar, PageMap, StackList } from './WikiOverview'
import { topLanguages } from '../../../shared/repoFacts'
import type { ImportGraph, RepoFacts, RepoWiki, WikiArchetype, WikiProgress } from '../../../shared/types'
import { PageHead } from './PageHead'

type Freshness = 'current' | 'behind' | 'outdated'

/** What kind of page this is, shown as an icon rather than a label. */
function pageIcon(archetype: WikiArchetype): React.JSX.Element {
  switch (archetype) {
    case 'overview':
      return <BookOpen size={13} />
    case 'workflow':
      return <Workflow size={13} />
    case 'reference':
      return <FileText size={13} />
    default:
      return <Boxes size={13} />
  }
}

/** A generated wiki for one repo: pages on the left, the page itself on the right. */
export function WikiPageView({ repoPath }: { repoPath: string }): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const openModal = useUIStore((s) => s.openModal)
  const setFileView = useUIStore((s) => s.setFileView)
  const aiFor = useSettingsStore((s) => s.aiFor)
  const openRepoTab = useSettingsStore((s) => s.openRepoTab)
  const repoName = useRepoStore((s) => s.repos[repoPath]?.name ?? repoPath.split('/').pop() ?? repoPath)

  const [wiki, setWiki] = useState<RepoWiki | null>(null)
  const [freshness, setFreshness] = useState<Freshness>('outdated')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [progress, setProgress] = useState<WikiProgress | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [facts, setFacts] = useState<RepoFacts | null>(null)
  const [exporting, setExporting] = useState(false)
  const [imports, setImports] = useState<ImportGraph | null>(null)
  // Where the wiki is exported to and read back from; main sends the default.
  const [dir, setDir] = useState('')

  // Loads the stored wiki. Also what picks up a run that finished while this
  // page was closed or attached to someone else's click.
  const loadStored = useRef<() => Promise<void>>(async () => undefined)
  loadStored.current = async () => {
    const stored = await wikiApi.get(repoPath, aiFor('wiki').model || '')
    setWiki(stored.wiki)
    setFreshness(stored.freshness)
    setDir(stored.dir)
    setSlug((current) =>
      stored.wiki?.pages.some((p) => p.slug === current) ? current : (stored.wiki?.pages[0]?.slug ?? null)
    )
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    wikiApi
      .get(repoPath, aiFor('wiki').model || '')
      .then((stored) => {
        if (cancelled) return
        setWiki(stored.wiki)
        setFreshness(stored.freshness)
        setDir(stored.dir)
        setSlug(stored.wiki?.pages[0]?.slug ?? null)
      })
      .catch((err) => !cancelled && toast('error', err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false))
    // Generation runs in the main process and outlives this page: reopening it
    // mid-run shows that run instead of offering to start a second one.
    void wikiApi
      .status(repoPath)
      .then((running) => {
        if (cancelled || !running) return
        setGenerating(true)
        setProgress(running)
      })
      .catch(() => undefined)
    void wikiApi
      .facts(repoPath)
      .then((f) => !cancelled && setFacts(f))
      .catch(() => undefined)
    // Reading every source file takes a moment, so it lands on its own.
    void wikiApi
      .imports(repoPath, 0)
      .then((g) => !cancelled && setImports(g))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [repoPath, aiFor, toast])

  // Progress is pushed per page while generating; only this repo's is ours.
  // The run's end arrives here too, which is how a page that joined a run
  // already under way — rather than starting it — learns it is over.
  useEffect(
    () =>
      wikiApi.onProgress(({ repoPath: path, progress: p }) => {
        if (path !== repoPath) return
        if (p.phase === 'done' || p.phase === 'cancelled' || p.phase === 'error') {
          setGenerating(false)
          setCancelling(false)
          setProgress(null)
          if (p.phase === 'done') void loadStored.current().catch(() => undefined)
          return
        }
        setGenerating(true)
        setProgress(p)
      }),
    [repoPath]
  )

  // Results and errors are reported by the promise, which settles even after
  // this page is closed — so the toast still arrives when the user is elsewhere.
  const generate = async (): Promise<void> => {
    setGenerating(true)
    setProgress({ phase: 'planning' })
    try {
      const fresh = await wikiApi.generate(repoPath, { ...aiFor('wiki'), cliCwd: repoPath })
      if (!fresh) {
        toast('info', t('wiki.cancelled'))
        return
      }
      setWiki(fresh)
      setFreshness('current')
      setSlug(fresh.pages[0]?.slug ?? null)
      toast('success', t('wiki.generated'))
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
      setCancelling(false)
      setProgress(null)
    }
  }

  // Nothing is lost by cancelling: the previous wiki is only replaced once
  // every page is written.
  const cancel = (): void => {
    setCancelling(true)
    void wikiApi.cancel(repoPath).catch(() => setCancelling(false))
  }

  // The wiki is a page tab, and the file viewer only lives in a repo tab — so
  // opening a source means switching to that repo first, then pointing it at
  // the file.
  const openSource = (path: string): void => {
    openRepoTab({ path: repoPath, name: repoName })
    setFileView({ repoPath, file: path, source: { type: 'tree' }, mode: 'file' })
  }

  // Writing the wiki into the repo turns it into something reviewable in a PR
  // instead of something that only exists on this machine.
  const exportToRepo = async (): Promise<void> => {
    setExporting(true)
    try {
      const result = await wikiApi.export(repoPath)
      if ('conflicts' in result) {
        toast('error', interp(t('wiki.exportConflict'), { dir, files: result.conflicts.join(', ') }))
        return
      }
      toast('success', interp(t('wiki.exported'), { n: result.written.length, dir }))
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  const remove = async (): Promise<void> => {
    await wikiApi.clear(repoPath)
    // Reload rather than blank the page: an exported copy in the repo's
    // folder is still there, and is what the page now shows.
    await loadStored.current().catch(() => undefined)
  }

  // A wiki read from the folder is files in the user's repo, so deleting it
  // deletes them — only the ones the export wrote, and only after asking.
  const removeFolderWiki = (folder: string): void => {
    openModal({
      kind: 'confirm',
      title: t('wiki.clear'),
      message: interp(t('wiki.deleteFolderConfirm'), { dir: folder }),
      danger: true,
      confirmLabel: t('wiki.clear'),
      onConfirm: async () => {
        try {
          const removed = await wikiApi.removeExport(repoPath)
          toast('success', interp(t('wiki.deletedFolder'), { n: removed.length, dir: folder }))
        } catch (err) {
          toast('error', err instanceof Error ? err.message : String(err))
        }
        await loadStored.current().catch(() => undefined)
      }
    })
  }

  // The folder is chosen in main's own dialog, which checks it is inside the repo.
  const chooseDir = async (): Promise<void> => {
    try {
      const choice = await wikiApi.chooseDir(repoPath)
      if (!choice) return
      if ('invalid' in choice) {
        toast('error', t('wiki.dirInvalid'))
        return
      }
      setDir(choice.dir)
      toast('success', interp(t('wiki.dirChanged'), { dir: choice.dir }))
      await loadStored.current()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
    }
  }

  const page = useMemo(() => wiki?.pages.find((p) => p.slug === slug) ?? wiki?.pages[0] ?? null, [wiki, slug])
  const sources = useMemo(() => {
    if (!page) return []
    const paths = new Set<string>()
    for (const section of page.sections) for (const claim of section.claims) for (const p of claim.sourcePaths) paths.add(p)
    return [...paths].sort()
  }, [page])

  const progressLabel = (p: WikiProgress): string => {
    if (p.phase === 'planning') return t('wiki.planning')
    if (p.phase === 'page') return `${p.title} (${p.done}/${p.total})`
    if (p.phase === 'error') return p.message
    if (p.phase === 'cancelled') return t('wiki.cancelled')
    return t('wiki.generated')
  }

  return (
    <div className="changelog-page wiki-page">
      <motion.div
        className="changelog-inner"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <PageHead>
          <header className="changelog-header">
            <div className="changelog-title">
              <BookOpen size={20} />
              <h1>{t('wiki.title')}</h1>
              <span className="settings-hint">{repoName}</span>
            </div>
            <div className="wiki-actions">
              {wiki && (
                <button
                  className="btn ghost small"
                  onClick={() => void exportToRepo()}
                  disabled={generating || exporting}
                  title={dir ? interp(t('wiki.exportTitle'), { dir }) : undefined}
                >
                  {exporting ? <Loader2 size={13} className="spin" /> : <FolderDown size={13} />} {t('wiki.export')}
                </button>
              )}
              <button
                className="btn ghost small"
                onClick={() => void chooseDir()}
                disabled={generating || exporting}
                title={interp(t('wiki.chooseDirTitle'), { dir })}
                aria-label={interp(t('wiki.chooseDirTitle'), { dir })}
              >
                <FolderCog size={13} />
              </button>
              {/* This machine's copy is only forgotten; one read from the folder is deleted from the repo, after a confirm. */}
              {wiki && (
                <button
                  className="btn ghost small"
                  onClick={() => (wiki.importedFrom !== undefined ? removeFolderWiki(wiki.importedFrom) : void remove())}
                  disabled={generating || exporting}
                >
                  <Trash2 size={13} /> {t('wiki.clear')}
                </button>
              )}
              {generating && (
                <button className="btn ghost small" onClick={cancel} disabled={cancelling}>
                  {cancelling ? <Loader2 size={13} className="spin" /> : <X size={13} />} {t('wiki.cancel')}
                </button>
              )}
              <button className="btn primary small" onClick={() => void generate()} disabled={generating}>
                {generating ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}{' '}
                {wiki ? t('wiki.regenerate') : t('wiki.generate')}
              </button>
            </div>
          </header>
        </PageHead>

        {wiki?.importedFrom !== undefined && (
          <p className="settings-hint wiki-from-folder">{interp(t('wiki.fromFolder'), { dir: wiki.importedFrom })}</p>
        )}

        {wiki && freshness !== 'current' && (
          <p className="wiki-stale">
            {freshness === 'behind' ? t('wiki.behind') : t('wiki.outdated')}
          </p>
        )}

        {generating && progress && (
          <p className="settings-hint wiki-progress">
            <Loader2 size={13} className="spin" /> {progressLabel(progress)}
          </p>
        )}

        {loading ? (
          <p className="settings-hint">{t('wiki.loading')}</p>
        ) : !wiki ? (
          <>
            <div className="wiki-empty">
              <Sparkles size={22} />
              <p>{t('wiki.emptyTitle')}</p>
              <span className="settings-hint">{t('wiki.emptyHint')}</span>
            </div>
            {facts && <LanguageBar languages={topLanguages(facts.languages)} />}
            {imports && <ImportMap graph={imports} />}
          </>
        ) : (
          <div className="wiki-body">
            <nav className="wiki-nav">
              {wiki.pages.map((p) => (
                <button
                  key={p.slug}
                  className={`wiki-nav-item ${p.slug === page?.slug ? 'active' : ''}`}
                  onClick={() => setSlug(p.slug)}
                  title={p.title}
                >
                  {pageIcon(p.archetype)}
                  <span className="wiki-nav-title">{p.title}</span>
                </button>
              ))}
            </nav>

            {page && (
              <article className="wiki-content">
                {page.archetype === 'overview' && (
                  <div className="wiki-facts">
                    {facts && <LanguageBar languages={topLanguages(facts.languages)} />}
                    {facts && <StackList stack={wiki.stack} facts={facts} />}
                    <PageMap pages={wiki.pages} activeSlug={page.slug} onSelect={setSlug} />
                    {imports && <ImportMap graph={imports} />}
                  </div>
                )}
                <MarkdownHtml className="md-preview" markdown={page.markdown} />

                {sources.length > 0 && (
                  <section className="wiki-sources">
                    <h3>{t('wiki.sources')}</h3>
                    <div className="wiki-source-list">
                      {sources.map((path) => (
                        <button
                          key={path}
                          className="wiki-source"
                          onClick={() => openSource(path)}
                        >
                          <FileText size={12} /> {path}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {page.related.length > 0 && (
                  <section className="wiki-sources">
                    <h3>{t('wiki.related')}</h3>
                    <div className="wiki-source-list">
                      {page.related.map((s) => (
                        <button key={s} className="wiki-source" onClick={() => setSlug(s)}>
                          {wiki.pages.find((p) => p.slug === s)?.title ?? s}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </article>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
