import { app, BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { basename, dirname, isAbsolute, join, relative } from 'path'
import { readdir, readFile, realpath, rm, writeFile, mkdir } from 'fs/promises'
import type {
  AIConfig,
  DependencyRef,
  ImportGraph,
  RepoFacts,
  RepoWiki,
  TechStack,
  WikiPage,
  WikiPagePlan,
  WikiProgress
} from '../shared/types'
import { isSecretFile } from '../shared/secretFiles'
import { isSafeRepoPath } from './aiSchemas'
import { gitService } from './git'
import { chatCompleteJson, InvalidAIResponse } from './ai'
import {
  MAX_PAGES,
  MAX_STACK_GROUPS,
  TECH_STACK_SCHEMA,
  cleanPageTitle,
  WIKI_PAGE_SCHEMA,
  WIKI_PLAN_SCHEMA,
  WIKI_PROMPT_VERSION,
  orderPlan,
  renderWikiPage,
  sanitizeWikiPlan,
  validateTechStack,
  validateWikiPage,
  validateWikiPlan,
  isExportedWikiFile,
  normalizeWikiDir,
  parseExportedWiki,
  WIKI_EXPORT_DIR,
  wikiExportFiles,
  wikiFreshness,
  type WikiFreshness
} from './wikiSchemas'
import { buildPagePack, rankPlanFiles, serializePack, serializeRepoFacts } from './wikiPack'
import {
  detectFrameworks,
  findManifests,
  languageBreakdown,
  meaningfulDependencies,
  parseManifest
} from '../shared/repoFacts'
import { buildImportGraph } from '../shared/importGraph'
import { writePrivateFile } from './privateFile'
import { AI_CANCELLED } from './aiRequests'

/** Thrown between steps once the user cancelled; the generator turns it into a quiet stop. */
const cancelled = (): Error => new Error(`${AI_CANCELLED} Wiki generation was cancelled.`)

// A generated wiki for a repository: the model plans the pages, writes each one
// from files the app hands it, and may only cite those files. Everything is
// built in memory and stored in one go, so a half-generated wiki never replaces
// a good one.

interface WikiData {
  repos: Record<string, RepoWiki>
  /** Per repo, the folder the wiki is exported to and read back from, when not the default. */
  dirs?: Record<string, string>
}

/**
 * The store's key for a repo. A path opened as `/x/repo/` and one opened as
 * `/x/repo` are the same repo — keyed apart, a wiki saved under one was never
 * found under the other and the page said there was none.
 */
function repoKey(repoPath: string): string {
  return repoPath.length > 1 ? repoPath.replace(/[\\/]+$/, '') : repoPath
}

function storedWiki(data: WikiData, repoPath: string): RepoWiki | null {
  const key = repoKey(repoPath)
  if (data.repos[key]) return data.repos[key]
  // Entries saved before keys were normalised.
  const legacy = Object.keys(data.repos).find((k) => repoKey(k) === key)
  return legacy ? data.repos[legacy] : null
}

/** Drops every spelling of this repo's key, so a stale legacy entry cannot resurface. */
function forget(data: WikiData, repoPath: string): void {
  const key = repoKey(repoPath)
  for (const k of Object.keys(data.repos)) if (repoKey(k) === key) delete data.repos[k]
}

function wikiDir(data: WikiData, repoPath: string): string {
  return data.dirs?.[repoKey(repoPath)] ?? WIKI_EXPORT_DIR
}

/** The wiki exported into the repo's folder, if there is one. */
async function folderWiki(repoPath: string, dir: string): Promise<RepoWiki | null> {
  const root = join(repoPath, dir)
  const names = await readdir(root).catch(() => [] as string[])
  const files = await Promise.all(
    names
      .filter((name) => name.endsWith('.md'))
      .map(async (name) => ({ name, content: await readFile(join(root, name), 'utf-8').catch(() => '') }))
  )
  return parseExportedWiki(files, dir)
}

/** The wiki this app keeps, else the one in the repo's wiki folder. */
async function currentWiki(data: WikiData, repoPath: string): Promise<RepoWiki | null> {
  return storedWiki(data, repoPath) ?? folderWiki(repoPath, wikiDir(data, repoPath))
}

const repoName = (repoPath: string): string => basename(repoKey(repoPath)) || repoPath

const filePath = (): string => join(app.getPath('userData'), 'githuttbr-wiki.json')
const empty = (): WikiData => ({ repos: {} })

async function load(): Promise<WikiData> {
  try {
    const raw = await readFile(filePath(), 'utf-8')
    return { ...empty(), ...(JSON.parse(raw) as WikiData) }
  } catch {
    return empty() // missing or corrupt → no wiki yet
  }
}

async function save(data: WikiData): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writePrivateFile(filePath(), JSON.stringify(data, null, 2))
}

/** How many pages are written at once. Enough to be quick, few enough to be polite. */
const WORKERS = 3

function nativeWikiSchema(cfg: AIConfig): boolean {
  const provider = cfg.provider ?? 'custom'
  return provider !== 'custom' && provider !== 'ollama'
}

/** Files whose paths are shown to the planner. */
const PLAN_FILE_LIMIT = 400
/** Files packed into one page's prompt. */
const PAGE_FILE_LIMIT = 12

async function headSha(repoPath: string): Promise<string> {
  const [head] = await gitService.log(repoPath, 1).catch(() => [])
  return head?.hash ?? ''
}

/** Every readable, non-secret file the repo tracks. */
async function candidateFiles(repoPath: string): Promise<string[]> {
  const tracked = await gitService.listTrackedFiles(repoPath).catch(() => [] as string[])
  // A wiki is a summary of the code, never of the credentials sitting next to it.
  return tracked.filter((path) => !isSecretFile(path))
}

async function planWiki(
  repoPath: string,
  repoName: string,
  files: string[],
  cfg: AIConfig,
  signal: AbortSignal
): Promise<WikiPagePlan[]> {
  const [branch, insights] = await Promise.all([
    gitService.open(repoPath).then((r) => r.current).catch(() => ''),
    gitService.repoInsights(repoPath, 0).catch(() => null)
  ])
  const ranked = rankPlanFiles(files, insights?.hotspots.map((h) => h.path) ?? [], PLAN_FILE_LIMIT)
  const facts = serializeRepoFacts({
    name: repoName,
    branch,
    totalCommits: insights?.totalCommits ?? 0,
    authors: insights?.authors ?? [],
    hotspots: insights?.hotspots ?? []
  })

  const system = `You are a staff engineer planning a short wiki that explains a codebase to a new contributor.

You are given the repository's file list and some facts about it. Plan the pages.

Rules:
- Between 3 and ${MAX_PAGES} pages. Fewer, better pages beat many thin ones.
- Exactly one page must have archetype "overview": what the project is and how it fits together.
- Every other page must list, in "scopePaths", the files it is about — copied EXACTLY from the file list. Never invent a path.
- Group by what the code does (a subsystem, a workflow), not by folder depth.
- "slug" is kebab-case and unique.
- "title" names the thing itself, in sentence case: "Data layer", "Release process", "Commit graph". Never repeat the archetype in it — no "… Module", "… Page", "… Overview", "… Reference".

Reply ONLY with valid JSON (no markdown fences):
{"pages":[{"slug":"overview","title":"Overview","archetype":"overview","scopePaths":["README.md"]}]}
- "archetype" is one of: overview, module, workflow, reference.`

  const known = new Set(ranked)
  const plan = await chatCompleteJson<{ pages: WikiPagePlan[] }>(
    cfg,
    [
      { role: 'system', content: system },
      { role: 'user', content: `${facts}\n\nFiles:\n${ranked.join('\n')}` }
    ],
    'wikiPlan',
    {
      name: 'wiki_plan',
      schema: WIKI_PLAN_SCHEMA,
      normalize: (v) => sanitizeWikiPlan(v, known),
      validate: (v) => validateWikiPlan(v, known),
      maxTokens: 2048,
      nativeStructuredOutput: nativeWikiSchema(cfg),
      signal
    },
    0.2
  )
  return orderPlan(plan.pages.map((p) => ({ ...p, title: cleanPageTitle(p.title) })))
}

async function writePage(
  repoPath: string,
  plan: WikiPagePlan,
  slugs: Set<string>,
  cfg: AIConfig,
  signal: AbortSignal
): Promise<WikiPage> {
  const paths = plan.scopePaths.slice(0, PAGE_FILE_LIMIT)
  const contents = await Promise.all(
    paths.map(async (path) => ({ path, content: await gitService.fileContent(repoPath, path).catch(() => '') }))
  )
  const pack = buildPagePack(contents)
  const allowed = { paths: new Set(pack.files.map((f) => f.path)), slugs: new Set([...slugs].filter((s) => s !== plan.slug)) }

  const system = `You are writing one page of a wiki that explains a codebase, for a new contributor.

You are given the full text of the files this page covers. Rules:
- Every claim must be supported by one of those files, named in "sourcePaths" exactly as given. If no file supports a claim, leave the claim out.
- Never invent file paths, function names or behaviour you cannot see.
- Never write Markdown, links or line numbers — the app renders those from what you return.
- At most 6 sections, at most 8 claims each. Prefer explaining how things fit together over listing what exists.
- "related" may only contain slugs of other pages in this wiki: ${[...allowed.slugs].join(', ') || '(none)'}.

Reply ONLY with valid JSON (no markdown fences):
{"summary":"one or two sentences","sections":[{"heading":"...","claims":[{"text":"...","sourcePaths":["src/x.ts"]}]}],"related":[]}`

  const user = `Page: ${plan.title} (${plan.archetype})

Files:

${serializePack(pack)}`

  const content = await chatCompleteJson<{
    summary: string
    sections: WikiPage['sections']
    related: string[]
  }>(
    cfg,
    [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    'wikiPage',
    {
      name: 'wiki_page',
      schema: WIKI_PAGE_SCHEMA,
      validate: (v) => validateWikiPage(v, allowed),
      maxTokens: 4096,
      nativeStructuredOutput: nativeWikiSchema(cfg),
      signal
    },
    0.3
  )

  const page: WikiPage = {
    slug: plan.slug,
    title: plan.title,
    archetype: plan.archetype,
    summary: content.summary.trim(),
    sections: content.sections ?? [],
    related: content.related ?? [],
    markdown: ''
  }
  return { ...page, markdown: renderWikiPage(page) }
}

/**
 * What the repo is made of, counted rather than guessed: language shares by
 * bytes and the dependencies its manifests declare.
 */
async function repoFacts(repoPath: string, files: string[]): Promise<RepoFacts> {
  const sizes = await gitService.fileSizes(repoPath, files).catch(() => ({}) as Record<string, { size: number; binary: boolean }>)
  const sized = files
    .filter((path) => !sizes[path]?.binary)
    .map((path) => ({ path, size: sizes[path]?.size ?? 0 }))
  const languages = languageBreakdown(sized)

  const manifests = findManifests(files)
  const parsed = await Promise.all(
    manifests.map(async (path) => {
      const content = await gitService.fileContent(repoPath, path).catch(() => '')
      return parseManifest(path, content)
    })
  )
  // Same package declared by two manifests counts once.
  const byName = new Map<string, DependencyRef>()
  for (const dep of parsed.flat()) if (!byName.has(dep.name)) byName.set(dep.name, dep)

  return {
    languages,
    totalBytes: sized.reduce((sum, f) => sum + f.size, 0),
    manifests,
    dependencies: [...byName.values()]
  }
}

/**
 * Groups the declared dependencies into a readable stack. The names come from
 * the manifests — the model only decides where each belongs and what it is for,
 * and is rejected if it names something the project does not declare.
 */
async function describeStack(facts: RepoFacts, cfg: AIConfig, signal: AbortSignal): Promise<TechStack | null> {
  // Scaffolding out, sub-packages folded in: the model should be reasoning about
  // what this project is built on, not about ts-loader.
  const notable = meaningfulDependencies(facts.dependencies)
  if (notable.length === 0) return null
  const declared = new Set(notable.map((d) => d.name))
  const frameworks = detectFrameworks(notable)
  const list = notable
    .map((d) => `${d.name}${d.version ? ` ${d.version}` : ''}${d.dev ? ' (dev)' : ''}`)
    .join('\n')
  const languages = facts.languages
    .slice(0, 5)
    .map((l) => `${l.language} ${Math.round(l.share * 100)}%`)
    .join(', ')
  const detected = frameworks.map((f) => f.label).join(', ')

  const system = `You are explaining what a project is built on, to someone deciding whether they could work on it.

You get the languages it is written in and the dependencies it declares. Write the stack, not an inventory.

Rules:
- "summary": 2-3 sentences describing the ARCHITECTURE — what kind of application this is, what runs where, and which pieces carry the weight. Name frameworks, not packages. Say "a desktop app built with Electron, React in the renderer and a Go service for indexing", never "this project uses a mix of technologies".
- Group by architectural role: "Frontend", "Backend", "Desktop shell", "Data", "Testing", "Build". At most ${MAX_STACK_GROUPS} groups.
- Include only dependencies that tell someone something. Skip a package whose presence is implied by another (a React app obviously has react-dom), skip plugins and helpers. It is correct to leave most of the list out.
- "dep" must be copied EXACTLY from the list. Never invent one, never list one twice.
- "role" says what THIS project uses it for, in a few words. Not a description of the package in general — "renders the commit graph", not "a library for rendering".

Reply ONLY with valid JSON (no markdown fences):
{"summary":"…","groups":[{"name":"Frontend","items":[{"dep":"react","role":"renders the whole interface"}]}]}`

  const user = `Languages: ${languages || '(unknown)'}
${detected ? `Frameworks detected: ${detected}\n` : ''}
Declared dependencies:
${list}`

  try {
    return await chatCompleteJson<TechStack>(
      cfg,
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      'wikiStack',
      {
        name: 'tech_stack',
        schema: TECH_STACK_SCHEMA,
        validate: (v) => validateTechStack(v, declared),
        maxTokens: 2048,
        nativeStructuredOutput: nativeWikiSchema(cfg),
        signal
      },
      0.2
    )
  } catch (err) {
    // The stack is a bonus on top of the pages; a bad reply just means no stack.
    if (!(err instanceof InvalidAIResponse)) throw err
    return null
  }
}

/** Source files worth parsing for imports, and small enough to be worth reading. */
const IMPORTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|vue|svelte|py|go|rs|dart|rb|php|c|h|cc|cpp|cxx|hpp|hh|m|mm)$/i
const IMPORT_FILE_LIMIT = 1200
const IMPORT_MAX_FILE_BYTES = 400_000

/**
 * Which folder imports which, read from the source. Big repos are capped at the
 * largest slice we can read quickly; the graph says how much it left out.
 */
async function importGraph(repoPath: string, depth: number): Promise<ImportGraph> {
  const files = (await candidateFiles(repoPath)).filter((path) => IMPORTABLE.test(path))
  const sizes = await gitService
    .fileSizes(repoPath, files)
    .catch(() => ({}) as Record<string, { size: number; binary: boolean }>)
  const readable = files
    .filter((path) => !sizes[path]?.binary && (sizes[path]?.size ?? 0) <= IMPORT_MAX_FILE_BYTES)
    .slice(0, IMPORT_FILE_LIMIT)

  const contents = await Promise.all(
    readable.map(async (path) => ({ path, content: await gitService.fileContent(repoPath, path).catch(() => '') }))
  )
  return buildImportGraph(contents, { depth })
}

/** Runs `task` over `items`, `limit` at a time, preserving input order. Stops picking up work once aborted. */
async function pool<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      if (signal?.aborted) throw cancelled()
      const index = next++
      results[index] = await task(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

/** A generation in flight. Lives in main, so leaving the wiki page does not stop it. */
interface WikiJob {
  controller: AbortController
  progress: WikiProgress
  promise: Promise<RepoWiki | null>
}

const jobs = new Map<string, WikiJob>()

async function generate(
  repoPath: string,
  cfg: AIConfig,
  signal: AbortSignal,
  send: (progress: WikiProgress) => void
): Promise<RepoWiki | null> {
  const check = (): void => {
    if (signal.aborted) throw cancelled()
  }

  try {
    send({ phase: 'planning' })
    const files = await candidateFiles(repoPath)
    if (files.length === 0) throw new Error('This repository has no tracked files to read.')

    const facts = await repoFacts(repoPath, files)
    check()
    const plan = await planWiki(repoPath, repoName(repoPath), files, cfg, signal)
    const slugs = new Set(plan.map((p) => p.slug))

    let done = 0
    const pages = await pool(
      plan,
      WORKERS,
      async (pagePlan) => {
        const page = await writePage(repoPath, pagePlan, slugs, cfg, signal)
        done++
        send({ phase: 'page', slug: pagePlan.slug, title: pagePlan.title, done, total: plan.length })
        return page
      },
      signal
    )

    check()
    const stack = await describeStack(facts, cfg, signal)
    // Last chance to back out: past this point the previous wiki is replaced.
    check()

    // Publish all at once: if any page threw, the previous wiki is still there.
    const wiki: RepoWiki = {
      headSha: await headSha(repoPath),
      generatedAt: Date.now(),
      model: cfg.model || '',
      promptVersion: WIKI_PROMPT_VERSION,
      pages,
      stack
    }
    const data = await load()
    forget(data, repoPath)
    data.repos[repoKey(repoPath)] = wiki
    await save(data)
    send({ phase: 'done' })
    return wiki
  } catch (err) {
    // A cancel is an answer, not a failure: the stored wiki is untouched.
    if (signal.aborted) {
      send({ phase: 'cancelled' })
      return null
    }
    const message = err instanceof Error ? err.message : String(err)
    send({ phase: 'error', message })
    throw err
  }
}

/**
 * Starts a generation, or joins the one already running for this repo — the
 * page may have been left and reopened, and a second click must not start a
 * second, competing run.
 */
function startJob(repoPath: string, cfg: AIConfig, wc: WebContents | null): Promise<RepoWiki | null> {
  const running = jobs.get(repoKey(repoPath))
  if (running) return running.promise

  const controller = new AbortController()
  const job: WikiJob = { controller, progress: { phase: 'planning' }, promise: Promise.resolve(null) }
  let ended = false
  const send = (progress: WikiProgress): void => {
    // Once the run has ended, a page still finishing in another worker must not
    // tell the UI it is generating again.
    if (ended) return
    if (progress.phase === 'done' || progress.phase === 'error' || progress.phase === 'cancelled') ended = true
    job.progress = progress
    if (wc && !wc.isDestroyed()) wc.send('wiki:progress', { repoPath, progress })
  }
  // The window that asked is gone: nobody is left to wait for the result.
  const abandon = (): void => controller.abort()
  wc?.once('destroyed', abandon)
  job.promise = generate(repoPath, cfg, controller.signal, send)
    .catch((err: unknown) => {
      // One page failed: stop the others rather than keep paying for a wiki
      // that will not be published.
      controller.abort()
      throw err
    })
    .finally(() => {
      wc?.removeListener('destroyed', abandon)
      if (jobs.get(repoKey(repoPath)) === job) jobs.delete(repoKey(repoPath))
    })
  jobs.set(repoKey(repoPath), job)
  return job.promise
}

export interface StoredWiki {
  wiki: RepoWiki | null
  freshness: WikiFreshness
  /** HEAD at the time of asking, so the UI can say how far behind the wiki is. */
  headSha: string
  /** The repo-relative folder the wiki is exported to and read back from. */
  dir: string
}

async function get(repoPath: string, model: string): Promise<StoredWiki> {
  const data = await load()
  const wiki = await currentWiki(data, repoPath)
  const head = await headSha(repoPath)
  return { wiki, freshness: wikiFreshness(wiki, { headSha: head, model }), headSha: head, dir: wikiDir(data, repoPath) }
}

/**
 * Writes the stored wiki into the repo as Markdown, so it can be committed and
 * read on the host. Returns the paths written, relative to the repo.
 */
export type WikiExportResult = { written: string[] } | { conflicts: string[] }

async function exportToRepo(repoPath: string): Promise<WikiExportResult> {
  const data = await load()
  const wiki = await currentWiki(data, repoPath)
  if (!wiki) throw new Error('There is no wiki for this repository yet.')

  const files = wikiExportFiles(wiki, repoName(repoPath), wikiDir(data, repoPath))
  // Slugs are validated kebab-case, but this writes into the user's repo —
  // check anyway rather than trust the shape of stored data.
  for (const file of files) if (!isSafeRepoPath(file.path)) throw new Error(`Refusing to write ${file.path}`)
  // The folder may be one the user chose, holding the project's own README.md:
  // only a file the export wrote before may be replaced. Checked for every file
  // first, so a refusal writes nothing at all.
  const conflicts: string[] = []
  for (const file of files) {
    const existing = await readFile(join(repoPath, file.path), 'utf-8').catch(() => null)
    if (existing !== null && !isExportedWikiFile(existing)) conflicts.push(file.path)
  }
  if (conflicts.length > 0) return { conflicts }
  for (const file of files) {
    const full = join(repoPath, file.path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, file.content, 'utf-8')
  }
  return { written: files.map((f) => f.path) }
}

async function clear(repoPath: string): Promise<void> {
  const data = await load()
  forget(data, repoPath)
  await save(data)
}

/**
 * Deletes a wiki read back from the repo's folder: only the files the export
 * wrote (they carry its note), never anything else living there. Returns the
 * repo-relative paths removed.
 */
async function removeExport(repoPath: string): Promise<string[]> {
  const data = await load()
  const dir = wikiDir(data, repoPath)
  const root = join(repoPath, dir)
  const names = await readdir(root).catch(() => [] as string[])
  const removed: string[] = []
  for (const name of names.filter((n) => n.endsWith('.md'))) {
    const rel = `${dir}/${name}`
    if (!isSafeRepoPath(rel)) continue
    const content = await readFile(join(root, name), 'utf-8').catch(() => '')
    if (!isExportedWikiFile(content)) continue
    await rm(join(root, name), { force: true })
    removed.push(rel)
  }
  return removed
}

/**
 * Lets the user point the wiki at another folder of the repo. Null when the
 * dialog was cancelled; throws when the folder is not one the export may use.
 */
export type WikiDirChoice = { dir: string } | { invalid: true } | null

async function chooseDir(repoPath: string, wc: WebContents): Promise<WikiDirChoice> {
  const data = await load()
  const current = join(repoPath, wikiDir(data, repoPath))
  const win = BrowserWindow.fromWebContents(wc)
  const options = {
    defaultPath: current,
    properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
  }
  const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  if (picked.canceled || !picked.filePaths[0]) return null

  // Both resolved: the dialog may answer with the real path (/private/tmp/…)
  // of a repo opened through a symlink (/tmp/…).
  const real = async (p: string): Promise<string> => realpath(p).catch(() => p)
  const rel = relative(await real(repoKey(repoPath)), await real(picked.filePaths[0]))
  const dir = isAbsolute(rel) ? null : normalizeWikiDir(rel)
  // The renderer words the refusal: it is the user's language, not main's.
  if (!dir) return { invalid: true }
  const key = repoKey(repoPath)
  const dirs = { ...(data.dirs ?? {}) }
  // The default is not stored, so a later change of default reaches this repo too.
  if (dir === WIKI_EXPORT_DIR) delete dirs[key]
  else dirs[key] = dir
  await save({ ...data, dirs })
  return { dir }
}

export function registerWikiHandlers(): void {
  ipcMain.handle('wiki:imports', (_e, repoPath: string, depth: number) => importGraph(repoPath, depth))
  ipcMain.handle('wiki:facts', async (_e, repoPath: string) => repoFacts(repoPath, await candidateFiles(repoPath)))
  ipcMain.handle('wiki:get', (_e, repoPath: string, model: string) => get(repoPath, model))
  ipcMain.handle('wiki:generate', (e, repoPath: string, cfg: AIConfig) => startJob(repoPath, cfg, e.sender))
  ipcMain.handle('wiki:status', (_e, repoPath: string) => jobs.get(repoKey(repoPath))?.progress ?? null)
  ipcMain.handle('wiki:cancel', (_e, repoPath: string) => {
    jobs.get(repoKey(repoPath))?.controller.abort()
  })
  ipcMain.handle('wiki:export', (_e, repoPath: string) => exportToRepo(repoPath))
  ipcMain.handle('wiki:clear', (_e, repoPath: string) => clear(repoPath))
  ipcMain.handle('wiki:removeExport', (_e, repoPath: string) => removeExport(repoPath))
  ipcMain.handle('wiki:chooseDir', (e, repoPath: string) => chooseDir(repoPath, e.sender))
}
