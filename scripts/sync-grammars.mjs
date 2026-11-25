#!/usr/bin/env node
/**
 * Copies the tree-sitter WASM runtime and the grammars the semantic diff needs
 * into resources/tree-sitter/, which electron-builder ships as extraResources.
 *
 * The runtime is web-tree-sitter's own web-tree-sitter.wasm. Each grammar comes
 * from its official npm package's prebuilt .wasm, or from vendor/ when the
 * package publishes none (scripts/grammars.mjs says which). The folder is
 * gitignored and rebuilt from the lockfile on every install.
 */
import { existsSync, mkdirSync, copyFileSync, statSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GRAMMARS, grammarSource } from './grammars.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'resources', 'tree-sitter')
const RUNTIME_FILE = 'web-tree-sitter.wasm'
const RUNTIME = join(ROOT, 'node_modules', 'web-tree-sitter', RUNTIME_FILE)

if (!existsSync(RUNTIME)) {
  // Nothing to parse with; the app degrades to line diffs.
  console.log('[grammars] web-tree-sitter not installed, skipping')
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })

// Drop files from an earlier layout (the 0.24 runtime's tree-sitter.wasm, a
// language since removed) so the folder mirrors GRAMMARS exactly.
const keep = new Set([RUNTIME_FILE, ...GRAMMARS.map((g) => `tree-sitter-${g.language}.wasm`)])
for (const f of readdirSync(OUT)) if (!keep.has(f)) rmSync(join(OUT, f))

let bytes = 0
let copied = 0
const absent = []
const broken = []
const rel = (p) => p.slice(ROOT.length + 1)

for (const [from, to] of [
  [RUNTIME, join(OUT, RUNTIME_FILE)],
  ...GRAMMARS.map((g) => [join(ROOT, grammarSource(g), g.file), join(OUT, `tree-sitter-${g.language}.wasm`)])
]) {
  if (existsSync(from)) {
    // Always copy: a size check would keep a stale grammar whose new build
    // happened to come out the same length.
    copyFileSync(from, to)
    bytes += statSync(to).size
    copied++
    continue
  }
  // Never leave an older copy behind to be shipped as if it were current.
  rmSync(to, { force: true })
  // A package that is not installed at all is a production install
  // (`--omit=dev`): that language falls back to line diffs. A package that is
  // installed without the file means it renamed or dropped its .wasm — an
  // upgrade that has to be looked at, not shipped without the language.
  if (existsSync(join(dirname(from), 'package.json'))) broken.push(rel(from))
  else absent.push(rel(dirname(from)))
}

if (absent.length) console.warn(`[grammars] not installed: ${[...new Set(absent)].join(', ')}`)
if (broken.length) {
  console.error(`[grammars] installed but missing its .wasm: ${broken.join(', ')} — see scripts/grammars.mjs`)
  process.exit(1)
}
console.log(`[grammars] ${copied} files, ${(bytes / 1024 / 1024).toFixed(1)} MB → resources/tree-sitter`)
