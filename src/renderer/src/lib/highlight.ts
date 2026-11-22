// The only module that imports highlight.js. The full build registers ~190
// languages and weighed 1.6 MB of the startup chunk; the core plus the set
// below is what the file, diff, blame and conflict views actually ask for.
// Everything else (a fenced ```haskell block in a README, say) is fetched the
// first time it is needed — see loadLanguage.
import hljs from 'highlight.js/lib/core'
import type { LanguageFn } from 'highlight.js'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import dart from 'highlight.js/lib/languages/dart'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import less from 'highlight.js/lib/languages/less'
import lua from 'highlight.js/lib/languages/lua'
import makefile from 'highlight.js/lib/languages/makefile'
import markdown from 'highlight.js/lib/languages/markdown'
import perl from 'highlight.js/lib/languages/perl'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import r from 'highlight.js/lib/languages/r'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import scala from 'highlight.js/lib/languages/scala'
import scss from 'highlight.js/lib/languages/scss'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

/** Registered at import time: every target of `guessLanguage`, so the
 *  synchronous line highlighters never wait, plus `diff` and `shell` for the
 *  fences that show up in commit messages and READMEs. */
const EAGER: Record<string, LanguageFn> = {
  bash, c, cpp, csharp, css, dart, diff, dockerfile, go, ini, java, javascript, json, kotlin, less, lua,
  makefile, markdown, perl, php, plaintext, python, r, ruby, rust, scala, scss, shell, sql, swift,
  typescript, xml, yaml
}
for (const [name, fn] of Object.entries(EAGER)) hljs.registerLanguage(name, fn)

/** Names of the eagerly registered languages — also the candidate set for
 *  auto-detection, so a guess never depends on what happened to load. */
export const EAGER_LANGUAGES: readonly string[] = Object.keys(EAGER)

// One lazy chunk per language file. The `.js.js` files are legacy shims that
// highlight.js ships next to the real modules. The eager set is excluded so
// rollup does not warn that each is both statically and dynamically imported —
// keep that list in step with EAGER (a miss costs a build warning, nothing more).
const LOADERS = import.meta.glob<LanguageFn>(
  [
    '../../../../node_modules/highlight.js/es/languages/*.js',
    '!../../../../node_modules/highlight.js/es/languages/*.js.js',
    '!../../../../node_modules/highlight.js/es/languages/{bash,c,cpp,csharp,css,dart,diff,dockerfile,go,ini,java,javascript,json,kotlin,less,lua,makefile,markdown,perl,php,plaintext,python,r,ruby,rust,scala,scss,shell,sql,swift,typescript,xml,yaml}.js'
  ],
  { import: 'default' }
)
const LOADABLE = new Map<string, () => Promise<LanguageFn>>()
for (const [path, load] of Object.entries(LOADERS)) {
  LOADABLE.set(path.slice(path.lastIndexOf('/') + 1, -'.js'.length), load)
}

/** Fence names that are an alias inside a language file rather than its file
 *  name. highlight.js only knows an alias once its language is registered, so
 *  for the on-demand set the alias → file mapping has to live here. Aliases of
 *  the eager set need no entry: registering a language registers its aliases. */
export const ON_DEMAND_ALIASES: Readonly<Record<string, string>> = {
  bat: 'dos', cmd: 'dos', clj: 'clojure', coffee: 'coffeescript', erl: 'erlang', ex: 'elixir',
  exs: 'elixir', fs: 'fsharp', gql: 'graphql', hbs: 'handlebars', hs: 'haskell', jinja: 'django',
  jl: 'julia', m: 'objectivec', mm: 'objectivec', ml: 'ocaml', objc: 'objectivec', proto: 'protobuf',
  ps: 'powershell', ps1: 'powershell', pwsh: 'powershell', tex: 'latex', vb: 'vbnet', asm: 'x86asm'
}

/** Lowercase file extension (no dot), or '' when none. */
export function fileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || ''
}

/** HTML-escape the three characters that matter inside a text node. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Map a filename to a highlight.js language id, or '' when unknown. Every
 *  value here must be in EAGER — callers highlight synchronously. */
export function guessLanguage(filename: string): string {
  const ext = fileExt(filename)
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', py: 'python', rb: 'ruby', go: 'go',
    rs: 'rust', java: 'java', cpp: 'cpp', cc: 'cpp', c: 'c', h: 'cpp',
    cs: 'csharp', php: 'php', swift: 'swift', kt: 'kotlin', scala: 'scala',
    sh: 'bash', bash: 'bash', zsh: 'bash', json: 'json', xml: 'xml',
    html: 'xml', htm: 'xml', vue: 'xml', css: 'css', scss: 'scss', less: 'less',
    md: 'markdown', markdown: 'markdown', yml: 'yaml', yaml: 'yaml',
    toml: 'ini', ini: 'ini', sql: 'sql', r: 'r', dart: 'dart', lua: 'lua',
    pl: 'perl', dockerfile: 'dockerfile', makefile: 'makefile'
  }
  return map[ext] || ''
}

/** The language file that would provide `name`, or null when none does.
 *  Pure: `available` is the set of loadable file names. */
export function languageModuleFor(name: string, available: { has(name: string): boolean }): string | null {
  const n = name.trim().toLowerCase()
  if (!n) return null
  if (available.has(n)) return n
  const alias = ON_DEMAND_ALIASES[n]
  return alias && available.has(alias) ? alias : null
}

/** True when `lang` (a name or alias) can be highlighted right now. */
export function isLanguageReady(lang: string): boolean {
  return !!lang && !!hljs.getLanguage(lang)
}

/** True when `lang` is not registered yet but loadLanguage could provide it. */
export function canLoadLanguage(lang: string): boolean {
  return !isLanguageReady(lang) && languageModuleFor(lang, LOADABLE) !== null
}

const loading = new Map<string, Promise<boolean>>()

/** Register `lang` on first use. Resolves true once it is highlightable,
 *  false when no language file provides it or the chunk failed to load.
 *  Never rejects, and loads each file at most once. */
export function loadLanguage(lang: string): Promise<boolean> {
  if (isLanguageReady(lang)) return Promise.resolve(true)
  const mod = languageModuleFor(lang, LOADABLE)
  const load = mod ? LOADABLE.get(mod) : undefined
  if (!mod || !load) return Promise.resolve(false)
  let pending = loading.get(mod)
  if (!pending) {
    pending = load().then(
      (fn) => {
        if (!hljs.getLanguage(mod)) hljs.registerLanguage(mod, fn)
        return true
      },
      () => false
    )
    loading.set(mod, pending)
  }
  return pending.then(() => isLanguageReady(lang))
}

/** Syntax-highlight text to HTML, falling back to plain escaped text when the
 *  language is unknown, not loaded yet, or highlight.js throws. */
export function highlightCode(text: string, lang: string): string {
  if (!isLanguageReady(lang)) return escapeHtml(text)
  try {
    return hljs.highlight(text, { language: lang }).value
  } catch {
    return escapeHtml(text)
  }
}

/** Kept for the line-by-line callers; identical to highlightCode. */
export const highlightLine = highlightCode

/** Best-guess highlighting for code with no (or an unknown) language. Only the
 *  eager set is considered, so the result does not change once some other
 *  language happens to have loaded. */
export function highlightAuto(text: string): string {
  try {
    return hljs.highlightAuto(text, EAGER_LANGUAGES as string[]).value
  } catch {
    return escapeHtml(text)
  }
}
