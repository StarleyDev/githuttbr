import { app, ipcMain } from 'electron'
import { join, basename, isAbsolute } from 'path'
import { readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import type { RegistryRepo, RepoScanResult, RepoScanRoot } from '../shared/types'
import { gitDirOf, readHeadBranch, readOriginOwner } from './repoMeta'
import { scanForRepos } from './repoScan'
import { writePrivateFile } from './privateFile'

// Every repository Gitcito knows about, whether or not it is open. Kept in its
// own file rather than in settings: it is a cache of what is on *this* disk,
// while settings are preferences you would carry to another machine. Losing
// this file costs a rescan; losing settings costs information.

interface RegistryData {
  repos: RegistryRepo[]
  /** Paths the user chose to Forget. A scan skips them — otherwise the next
   *  scan of their folder, which the Scanned repositories dialog runs on every
   *  open, would quietly undo the Forget. Opening one again clears it. */
  forgotten?: string[]
}

/**
 * A sanity check on a path before it reaches the filesystem.
 *
 * Deliberately not `isSafeRepoPath` from aiSchemas: that one guards paths an
 * LLM produced, which are joined onto a repo root, so it rejects anything
 * absolute. Registry paths are absolute by definition and come from the user's
 * own folder picker or from scanning folders they configured — a different
 * threat model, and a different check.
 */
function isPlausibleRepoPath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  const p = path.trim()
  return p.length > 0 && p.length <= 4096 && isAbsolute(p) && !p.includes('\0')
}

export const registryFilePath = (): string => join(app.getPath('userData'), 'githuttbr-repos.json')

// Every mutation below is load-mutate-save, so two overlapping calls would be
// last-writer-wins — and `remember` is fired without awaiting on every tab
// open, so overlap with a long scan is normal, not exotic. Chaining every
// mutation through one promise serializes their load-mutate-save cycles.
let writeQueue: Promise<unknown> = Promise.resolve()

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(work, work)
  writeQueue = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

async function loadData(): Promise<Required<RegistryData>> {
  try {
    const raw = await readFile(registryFilePath(), 'utf-8')
    const data = JSON.parse(raw) as RegistryData
    return {
      repos: Array.isArray(data.repos) ? data.repos : [],
      forgotten: Array.isArray(data.forgotten) ? data.forgotten.filter((p) => typeof p === 'string') : []
    }
  } catch {
    return { repos: [], forgotten: [] }
  }
}

async function load(): Promise<RegistryRepo[]> {
  return (await loadData()).repos
}

/** Write the repos. `forgotten` is kept as it is on disk unless given — only
 *  Forget and a re-open change it. Every caller runs inside `serialize`, so
 *  the read here cannot race another write. */
async function save(repos: RegistryRepo[], forgotten?: string[]): Promise<void> {
  const keep = forgotten ?? (await loadData()).forgotten
  await mkdir(app.getPath('userData'), { recursive: true })
  const data: RegistryData = keep.length > 0 ? { repos, forgotten: keep } : { repos }
  await writePrivateFile(registryFilePath(), JSON.stringify(data, null, 2))
}

/** The registry, with `missing` refreshed. Stat-ing every path is why this is
 *  called on page open and not per render. */
export async function listRepos(): Promise<RegistryRepo[]> {
  return serialize(async () => {
    const repos = await load()
    let changed = false
    for (const repo of repos) {
      const missing = !existsSync(repo.path)
      if (missing !== repo.missing) {
        repo.missing = missing
        changed = true
      }
    }
    if (changed) await save(repos)
    return repos
  })
}

/** Record a repository as opened. Upserts: the same folder is one entry. */
export async function rememberRepo(repoPath: string): Promise<RegistryRepo[]> {
  if (!isPlausibleRepoPath(repoPath)) return serialize(load)
  const path = repoPath.trim()
  return serialize(async () => {
    const { repos, forgotten } = await loadData()
    const now = Math.floor(Date.now() / 1000)
    const [branch, owner] = await Promise.all([readHeadBranch(path), readOriginOwner(path)])
    const existing = repos.find((r) => r.path === path)
    if (existing) {
      existing.lastOpenedAt = now
      existing.missing = !existsSync(path)
      existing.source = 'opened'
      existing.branch = branch
      existing.owner = owner
    } else {
      repos.push({
        path,
        name: basename(path),
        owner,
        branch,
        source: 'opened',
        lastOpenedAt: now,
        missing: !existsSync(path)
      })
    }
    // Opening a forgotten repository is the user taking the Forget back.
    await save(repos, forgotten.filter((p) => p !== path))
    return repos
  })
}

/** Drop an entry from the index. Never touches the folder on disk. */
export async function forgetRepo(repoPath: string): Promise<RegistryRepo[]> {
  return serialize(async () => {
    const data = await loadData()
    const repos = data.repos.filter((r) => r.path !== repoPath)
    const forgotten = data.forgotten.includes(repoPath) ? data.forgotten : [...data.forgotten, repoPath]
    await save(repos, forgotten)
    return repos
  })
}

/** Re-read branch for the given paths. Cheap enough to call whenever the page
 *  opens: one file read each, no process spawned. */
export async function refreshRepos(paths: string[]): Promise<RegistryRepo[]> {
  return serialize(async () => {
    const repos = await load()
    const wanted = new Set(paths)
    await Promise.all(
      repos
        .filter((r) => wanted.has(r.path) && !r.missing)
        .map(async (r) => {
          r.branch = await readHeadBranch(r.path)
        })
    )
    await save(repos)
    return repos
  })
}

/** Index every repository under the configured roots. A repo already in the
 *  registry keeps its `source` and `lastOpenedAt` — a scan adds knowledge, it
 *  never demotes a repo the user has actually opened. */
export async function scanRoots(rootList: RepoScanRoot[]): Promise<RepoScanResult> {
  return serialize(async () => {
    const { repos, forgotten } = await loadData()
    const skip = new Set(forgotten)
    const byPath = new Map(repos.map((r) => [r.path, r]))
    // A Set, not a counter: two roots that overlap reach the same repository twice.
    const found = new Set<string>()
    let added = 0

    for (const root of rootList) {
      if (!isPlausibleRepoPath(root.path)) continue
      for (const repoPath of await scanForRepos(root.path, root.depth)) {
        // Forgotten on purpose: neither listed nor counted.
        if (skip.has(repoPath)) continue
        found.add(repoPath)
        const existing = byPath.get(repoPath)
        if (existing) {
          existing.missing = false
          continue
        }
        const [branch, owner] = await Promise.all([readHeadBranch(repoPath), readOriginOwner(repoPath)])
        const entry: RegistryRepo = {
          path: repoPath,
          name: basename(repoPath),
          owner,
          branch,
          source: 'scanned',
          lastOpenedAt: 0,
          missing: false
        }
        repos.push(entry)
        byPath.set(repoPath, entry)
        added += 1
      }
    }

    await save(repos)
    return { repos, found: found.size, added }
  })
}

/** Re-point a missing entry at the folder it moved to. Favourites and aliases
 *  are path-keyed and live in settings, so the renderer migrates those; this
 *  moves the index entry and refreshes what it caches. */
export async function locateRepo(oldPath: string, newPath: string): Promise<RegistryRepo[]> {
  if (!isPlausibleRepoPath(newPath)) return serialize(load)
  if (!(await gitDirOf(newPath))) return serialize(load)
  return serialize(async () => {
    const repos = await load()
    const entry = repos.find((r) => r.path === oldPath)
    if (!entry) return repos
    const [branch, owner] = await Promise.all([readHeadBranch(newPath), readOriginOwner(newPath)])
    entry.path = newPath
    entry.name = basename(newPath)
    entry.branch = branch
    entry.owner = owner
    entry.missing = !existsSync(newPath)
    await save(repos)
    return repos
  })
}

export function registerRepoRegistryHandlers(): void {
  ipcMain.handle('repos:list', () => listRepos())
  ipcMain.handle('repos:remember', (_e, repoPath: string) => rememberRepo(repoPath))
  ipcMain.handle('repos:forget', (_e, repoPath: string) => forgetRepo(repoPath))
  ipcMain.handle('repos:scan', (_e, rootList: RepoScanRoot[]) => scanRoots(rootList))
  ipcMain.handle('repos:locate', (_e, oldPath: string, newPath: string) => locateRepo(oldPath, newPath))
  ipcMain.handle('repos:refresh', (_e, paths: string[]) => refreshRepos(paths))
}
