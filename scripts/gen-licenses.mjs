#!/usr/bin/env node
/**
 * Bundles the licence of every dependency that actually ships.
 *
 * Attribution is a shipping requirement, not a nicety: MIT, BSD and Apache all
 * ask that their notice travels with the binary. Reading `node_modules` at
 * runtime is not an option — it does not exist inside a packaged app — so the
 * texts are collected here, at build time, into a JSON the renderer imports.
 *
 * Scope is the production tree (every lockfile entry not flagged `dev`, the set
 * `npm ls --omit=dev --all` shows) plus Electron, which ships as the runtime
 * even though npm files it under devDeps.
 *
 * Run by `npm run build`; the result is committed so typecheck and tests work
 * on a fresh clone without a generate step.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/renderer/src/licenses.generated.json')

/** Files a package may keep its licence text in, in preference order. */
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/** The licence text a package ships, if it ships one. */
function licenseText(dir) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return null
  }
  const hits = names.filter((n) => LICENSE_FILE.test(n)).sort()
  for (const name of hits) {
    try {
      const text = readFileSync(join(dir, name), 'utf8').trim()
      // Some packages ship a stub pointing elsewhere; a one-liner is not a text.
      if (text.length > 40) return text
    } catch {
      /* unreadable — try the next candidate */
    }
  }
  return null
}

/** npm records `license`, older packages `licenses: [{type}]`. */
function licenseId(pkg) {
  if (typeof pkg.license === 'string') return pkg.license
  if (pkg.license?.type) return pkg.license.type
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ')
  return 'UNKNOWN'
}

function homepage(pkg) {
  if (pkg.homepage) return pkg.homepage
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  if (!repo) return null
  return repo
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^github:/, 'https://github.com/')
}

/**
 * Every package that ships, read from the lockfile: each `node_modules/...` key
 * not flagged `dev`. That is the set `npm ls --omit=dev` prints — devOptional
 * and optional entries included — without parsing a printed path. npm 12 masks
 * hex- and UUID-looking path segments as `***` in that output, so a checkout
 * under such a directory resolved to nothing and the list silently shrank to
 * Electron alone; and a symlinked node_modules made npm call every dev package
 * extraneous and list it. The lockfile has neither problem.
 *
 * Returns `{ path, optional }` with `path` relative to the project root,
 * hoisted packages before nested ones. That order is what the output's stable
 * sort by name falls back on when two versions share a name (tslib, argparse),
 * so it decides the bytes of the committed file. Exported for the test suite.
 */
export function productionPackages(lock) {
  if (!lock || typeof lock.packages !== 'object' || lock.packages === null) {
    throw new Error('package-lock.json has no `packages` map (lockfileVersion 2 or later is required)')
  }
  const out = []
  for (const [key, entry] of Object.entries(lock.packages)) {
    // '' is the project itself; anything outside node_modules is a workspace or a link target.
    if (!key.startsWith('node_modules/') && !key.includes('/node_modules/')) continue
    if (entry.dev) continue
    out.push({ path: key, optional: Boolean(entry.optional || entry.devOptional) })
  }
  const depth = (p) => p.split('node_modules/').length
  return out.sort((a, b) => depth(a.path) - depth(b.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

/** Fail the build rather than ship an attribution list with holes in it. */
function fail(message) {
  console.error(`licenses: ${message}`)
  process.exit(1)
}

function entryFor(dir) {
  const pkg = readJson(join(dir, 'package.json'))
  return {
    name: pkg.name,
    version: pkg.version ?? '',
    license: licenseId(pkg),
    homepage: homepage(pkg),
    text: licenseText(dir)
  }
}

function main() {
  const lock = readJson(join(ROOT, 'package-lock.json'))
  const manifest = readJson(join(ROOT, 'package.json'))
  const packages = productionPackages(lock)

  // Every direct dependency must be in the lockfile; one that is not means the
  // lockfile is stale, and the list would be too.
  const listed = new Set(packages.map((p) => p.path))
  const stale = Object.keys(manifest.dependencies ?? {}).filter((n) => !listed.has(`node_modules/${n}`))
  if (stale.length) fail(`not in package-lock.json: ${stale.join(', ')} — run npm install`)

  const entries = new Map()
  const missing = []
  for (const { path, optional } of packages) {
    const dir = join(ROOT, path)
    if (!existsSync(join(dir, 'package.json'))) {
      // An optional package for another platform is legitimately absent, as in `npm ls`.
      if (!optional) missing.push(path)
      continue
    }
    const entry = entryFor(dir)
    if (!entry.name) fail(`${path}/package.json has no name`)
    entries.set(`${entry.name}@${entry.version}`, entry)
  }
  if (missing.length) {
    fail(`${missing.length} production package(s) not installed, e.g. ${missing.slice(0, 5).join(', ')} — run npm ci`)
  }

  // Electron is a devDependency by convention but is the runtime the app ships.
  const electron = join(ROOT, 'node_modules', 'electron')
  if (!existsSync(join(electron, 'package.json'))) fail('node_modules/electron is not installed — run npm ci')
  const e = entryFor(electron)
  entries.set(`${e.name}@${e.version}`, e)

  const list = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(OUT, `${JSON.stringify(list, null, 2)}\n`)

  const withText = list.filter((x) => x.text).length
  console.log(`licenses: ${list.length} packages (${withText} with full text) → ${OUT.replace(`${ROOT}/`, '')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
