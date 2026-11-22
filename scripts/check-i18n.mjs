#!/usr/bin/env node
/**
 * i18n guard — fails when a user-facing string is hardcoded in the renderer
 * instead of going through the per-locale dictionaries in
 * `src/renderer/src/i18n/` (`en.ts`, `es.ts`, …).
 *
 * Run it with `npm run lint:i18n`. It also runs as part of the test suite
 * (`test/i18n.test.ts`, `test/i18nGuard.test.ts`) and on pre-commit.
 *
 * Two passes over every file:
 *   - line rules (regex): UI props, single-line JSX text, inline ternaries,
 *     toast calls with a literal first argument;
 *   - syntax rules (the TypeScript parser): shapes a line regex cannot see —
 *     JSX text that wraps or sits next to an `{expression}`, template literals,
 *     DOM text assignments, `setAttribute`, canvas text, sentence-shaped
 *     `new Error(…)` messages, state setters and the run()/busy labels.
 *
 * Escape hatches, in order of preference:
 *   1. `// i18n-ignore <reason>` on the same line, or on the line above
 *      (`{/* i18n-ignore <reason> *\/}` directly above, in JSX).
 *   2. Add the exact string to `scripts/i18n-allowlist.json` when it is a
 *      proper noun, a filename, a git/CLI token, or anything else that must
 *      read the same in every language.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_DIR = join(ROOT, 'src/renderer/src')
const ALLOWLIST = new Set(
  JSON.parse(readFileSync(join(ROOT, 'scripts/i18n-allowlist.json'), 'utf8')).allow
)

/** Files that hold no user-facing copy at all. */
const SKIP_PATH = [
  '/i18n/',
  '.test.ts',
  '.d.ts',
  '/components/cosmos/shaders',
  'vite-env'
]

/** Props / object keys whose string value is rendered to the user. */
const UI_PROPS = [
  'label',
  'title',
  'placeholder',
  'aria-label',
  'ariaLabel',
  'alt',
  'tooltip',
  'description',
  'subtitle',
  'heading',
  'header',
  'confirmLabel',
  'cancelLabel',
  'okLabel',
  'submitLabel',
  'emptyText',
  'emptyLabel',
  'emptyMessage',
  'listTitle',
  'hint',
  'summary',
  'caption',
  'legend'
]

/**
 * Props the syntax pass also checks, on top of UI_PROPS. `message` is left to
 * the syntax pass only: as an object key it is just as often a commit message
 * or a log payload, and only a sentence there is copy (see `isSentence`).
 */
const SENTENCE_PROPS = ['message']

/** Calls whose first string argument is shown to the user. */
const UI_CALLS = ['pushToast', 'toast', 'notify', 'showError', 'confirmDialog']

/**
 * Calls the syntax pass checks in every argument position — `toast('success',
 * `Saved ${file}`)` carries its copy second. `fillText`/`strokeText` draw onto
 * a canvas (the timelapse overlay), `selectDirectory` titles a native dialog.
 */
const UI_CALLS_ANY_ARG = [...UI_CALLS, 'setBusy', 'selectDirectory', 'fillText', 'strokeText']

/** DOM properties whose assigned value the user reads. */
const DOM_TEXT_PROPS = ['textContent', 'innerText', 'title', 'placeholder', 'ariaLabel', 'alt', 'label']

/** Attributes whose `setAttribute` value the user reads (or hears). */
const UI_ATTRIBUTES = ['aria-label', 'aria-description', 'aria-placeholder', 'title', 'placeholder', 'alt']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(full)) out.push(full)
  }
  return out
}

/**
 * Heuristic: does this literal read like human copy rather than an
 * identifier, class name, path, or protocol token?
 */
export function isHumanCopy(s) {
  const str = s.trim()
  if (str.length < 2) return false
  if (!/[A-Za-z]/.test(str)) return false
  if (ALLOWLIST.has(str)) return false
  // Already translated: a template literal built from t()/interp().
  if (/\$\{\s*(t|tr|interp)\(/.test(str)) return false
  // A dictionary key passed around as data ("settings.termPlaceBottom").
  if (/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/.test(str)) return false
  // Identifiers, kebab/snake keys, CSS classes, enum values, sample values.
  if (/^[a-z0-9]+([-_.][a-z0-9]+)*$/.test(str)) return false
  // camelCase identifiers.
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(str)) return false
  // PascalCase identifiers / component names ("FileTree", "RepoCosmos").
  // A single capitalized word ("Dismiss") IS copy, so require two humps.
  if (/^([A-Z][a-z0-9]*){2,}$/.test(str)) return false
  // SCREAMING_CASE.
  if (/^[A-Z][A-Z0-9_]*$/.test(str)) return false
  // Paths, urls, globs, selectors, filenames, CLI flags, format strings.
  if (/^(https?:|\/|\.\/|\.\.\/|#|\?|@|\*|%|\$|--)/.test(str)) return false
  if (/^[\w.@/-]+\.[A-Za-z0-9]{1,6}$/.test(str)) return false
  if (!/\s/.test(str) && str.includes('/')) return false
  // Dotfile names (".windsurfrules", ".aiderignore").
  if (/^\.[\w.-]+$/.test(str)) return false
  // CSS declarations and lengths.
  if (str.includes('var(--') || /^\d+(\.\d+)?(px|em|rem|%|vh|vw)\b/.test(str)) return false
  // Must contain at least one lowercase letter — pure acronyms are usually keys.
  if (!/[a-z]/.test(str)) return false
  return true
}

/**
 * JSX text is copy by position, so it is held to a looser bar than a string
 * literal: a lone lowercase word between tags ("new", "draft") is something
 * a user reads, where the same word in a literal is usually an enum value.
 * All-caps words stay exempt: between tags they are acronyms (SSH, HEAD).
 */
function isJsxCopy(s) {
  const str = s.trim()
  if (ALLOWLIST.has(str)) return false
  if (isHumanCopy(str)) return true
  return /^[A-Za-z][a-z]+$/.test(str)
}

/** Copy that reads as a sentence — the bar for keys that are copy only sometimes. */
function isSentence(s) {
  const str = s.trim()
  return isHumanCopy(str) && /^[A-Z]/.test(str) && /\s/.test(str)
}

/** Several words of copy, in any case: "x commits" counts, "galaxy" does not. */
function isPhrase(s) {
  const str = s.trim()
  return isHumanCopy(str) && /[A-Za-z]{2,}\s+\S|\S\s+[A-Za-z]{2,}/.test(str)
}

/**
 * A template literal as the text a reader would see, with every `${…}`
 * standing in as `x`: `${n} files` reads as "x files". Null when the literal
 * parts hold no word at all (`${a} · ${b}`, `(${n})` — punctuation around
 * values that are already translated or are data), or when the template is
 * built from t()/interp().
 */
function templateText(node, sf) {
  if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) return node.text
  if (!ts.isTemplateExpression(node)) return null
  const spans = node.templateSpans
  if (spans.some((s) => /^\s*(t|tr|interp|translate)\(/.test(s.expression.getText(sf)))) return null
  const parts = [node.head.text, ...spans.map((s) => s.literal.text)]
  if (!/[A-Za-z]{2}/.test(parts.join(' '))) return null
  return parts.join('x')
}

/**
 * The literal strings an expression can evaluate to, looking through the
 * shapes copy hides behind: `a ? 'x' : 'y'`, `a ?? 'x'`, `a || 'x'`, parens.
 */
function literalsOf(node, sf) {
  if (!node) return []
  if (ts.isParenthesizedExpression(node)) return literalsOf(node.expression, sf)
  if (ts.isConditionalExpression(node)) return [...literalsOf(node.whenTrue, sf), ...literalsOf(node.whenFalse, sf)]
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  )
    return literalsOf(node.right, sf)
  const text = templateText(node, sf)
  return text === null ? [] : [{ node, text }]
}

function nameOf(node) {
  if (!node) return null
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  return null
}

/** The syntax pass: every violation in one parsed file. */
function syntaxViolations(sf, add) {
  const tsx = sf.fileName.endsWith('.tsx')
  const flag = (node, kind, text, test = isHumanCopy) => {
    if (test(text)) add(node, kind, text)
  }
  const flagExpr = (expr, kind, test) => {
    for (const { node, text } of literalsOf(expr, sf)) flag(node, kind, text, test)
  }

  const visit = (node) => {
    // JSX text, wherever it sits: wrapped over lines, beside `{expr}`, after `/>`.
    if (tsx && ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) {
      flag(node, 'jsx-text', node.text.replace(/\s+/g, ' '), isJsxCopy)
    }

    // A literal or template rendered as a JSX child: {`${n} files`}, {x ?? 'None'}.
    if (tsx && ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      flagExpr(node.expression, 'jsx-expression')
    }

    // UI props as JSX attributes or object keys, with any expression shape.
    if ((ts.isJsxAttribute(node) || ts.isPropertyAssignment(node)) && node.initializer) {
      const prop = nameOf(node.name)
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer
      if (UI_PROPS.includes(prop)) flagExpr(value, prop)
      else if (SENTENCE_PROPS.includes(prop)) flagExpr(value, prop, isSentence)
    }

    // el.textContent = '…', el.title = `…`
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      DOM_TEXT_PROPS.includes(node.left.name.text)
    ) {
      flagExpr(node.right, `dom-${node.left.name.text}`)
    }

    if (ts.isCallExpression(node)) {
      const callee = nameOf(node.expression)
      const args = node.arguments

      // el.setAttribute('aria-label', '…')
      if (callee === 'setAttribute' && args.length >= 2 && ts.isStringLiteralLike(args[0])) {
        if (UI_ATTRIBUTES.includes(args[0].text)) flagExpr(args[1], `setAttribute-${args[0].text}`)
      }

      // toast('success', `Saved ${file}`), ctx.fillText(`${n} commits`, x, y)
      if (UI_CALLS_ANY_ARG.includes(callee)) for (const a of args) flagExpr(a, callee)

      // run(path, label, fn, …): the busy label and the result toast.
      if (callee === 'run' && args.length >= 3) flagExpr(args[1], 'run-label')

      // setCaption(`Showing ${n} files`) — a state setter holding finished copy.
      // Phrases only: setMode('galaxy') holds a value, not copy. useState('My
      // palette') seeds the same state, so it is held to the same bar.
      if (callee && /^(set[A-Z]\w*|useState)$/.test(callee) && args.length >= 1) flagExpr(args[0], callee, isPhrase)
    }

    // throw new Error('This repository has no remote…') — a message a catch
    // block is likely to toast. Internal errors here are lowercase by habit
    // ("unclosed <dict>"), so only a sentence-shaped message is flagged.
    if (ts.isNewExpression(node) && nameOf(node.expression) === 'Error' && node.arguments?.length) {
      flagExpr(node.arguments[0], 'error-message', isSentence)
    }

    ts.forEachChild(node, visit)
  }
  visit(sf)
}

/**
 * Every hardcoded user-facing string in one source file, as
 * `{ line, col, kind, text }` (1-based line). `file` only needs the right
 * extension: `.tsx` turns the JSX rules on.
 */
export function scanSource(code, file) {
  const lines = code.split('\n')
  const ignored = (i) => {
    const prev = lines[i - 1] ?? ''
    return (lines[i] ?? '').includes('i18n-ignore') || /^\s*(\/\/|\{?\/\*)\s*i18n-ignore/.test(prev)
  }
  const out = []
  const seen = new Set()
  const push = (line, col, kind, text) => {
    const clean = text.trim()
    const id = `${line}\u0000${clean}`
    if (seen.has(id)) return
    seen.add(id)
    out.push({ line: line + 1, col, kind, text: clean })
  }

  lines.forEach((line, i) => {
    if (ignored(i)) return
    // Ignore comment-only lines.
    const code = line.replace(/^\s*(\/\/|\*).*$/, '')
    if (!code.trim()) return

    const add = (col, kind, text) => push(i, col, kind, text)

    // 1. UI-bearing props and object keys: label="…" / label: '…'
    for (const prop of UI_PROPS) {
      const re = new RegExp(
        `(?:^|[\\s{(,])['"]?${prop}['"]?\\s*[=:]\\s*\\{?\\s*['"\`]([^'"\`]{2,120})['"\`]`,
        'g'
      )
      let m
      while ((m = re.exec(code))) {
        if (isHumanCopy(m[1])) add(m.index, prop, m[1])
      }
    }

    // 2. JSX text nodes: >Some copy</   (tsx only — `=>` and generics in .ts
    //    files would otherwise look like tags)
    if (file.endsWith('.tsx')) {
      const jsxText = /(?<![=-])>([^<>{}\n]*[A-Za-z]{2}[^<>{}\n]*)<\//g
      let m2
      while ((m2 = jsxText.exec(code))) {
        if (isHumanCopy(m2[1])) add(m2.index, 'jsx-text', m2[1])
      }
    }

    // 3. Copy chosen inline: `{cond ? 'Show less' : 'Show more'}`.
    //    Skipped on className/style lines — those ternaries pick CSS, not copy.
    if (file.endsWith('.tsx') && !/className=|style=/.test(code)) {
      const ternary = /\?\s*'([^']{2,120})'\s*:\s*'([^']{2,120})'/g
      let m3
      while ((m3 = ternary.exec(code))) {
        for (const side of [m3[1], m3[2]]) if (isHumanCopy(side)) add(m3.index, 'ternary', side)
      }
    }

    // 4. Toast / dialog calls with a literal first argument.
    for (const fn of UI_CALLS) {
      const re = new RegExp(`\\b${fn}\\s*\\(\\s*['"\`]([^'"\`]{2,160})['"\`]`, 'g')
      let m
      while ((m = re.exec(code))) {
        if (isHumanCopy(m[1])) add(m.index, fn, m[1])
      }
    }
  })

  const sf = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  syntaxViolations(sf, (node, kind, text) => {
    // A JSX text node starts at the end of the previous tag; report (and match
    // `i18n-ignore` against) the line its first word is on.
    const lead = ts.isJsxText(node) ? node.text.length - node.text.trimStart().length : 0
    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf) + lead)
    if (ignored(pos.line)) return
    push(pos.line, pos.character, kind, text)
  })

  return out.sort((a, b) => a.line - b.line || a.col - b.col)
}

/** Scan the renderer tree. */
export function scanTree() {
  const violations = []
  for (const file of walk(SCAN_DIR)) {
    const posix = file.replace(/\\/g, '/')
    if (SKIP_PATH.some((p) => posix.includes(p))) continue
    const rel = relative(ROOT, file)
    for (const v of scanSource(readFileSync(file, 'utf8'), file)) violations.push({ rel, ...v })
  }
  return violations
}

function main() {
  const violations = scanTree()
  if (violations.length) {
    const byFile = new Map()
    for (const v of violations) {
      if (!byFile.has(v.rel)) byFile.set(v.rel, [])
      byFile.get(v.rel).push(v)
    }
    console.error(
      `\n✖ ${violations.length} hardcoded user-facing string(s) in ${byFile.size} file(s).\n` +
        `  Every string the user can read must come from src/renderer/src/i18n/.\n` +
        `  Add the key to EVERY locale file there (en.ts, es.ts, …) and render it with \`t('your.key')\`.\n` +
        `  If the string must not be translated (proper noun, filename, git token), add it to\n` +
        `  scripts/i18n-allowlist.json or annotate the line with \`// i18n-ignore <reason>\`.\n`
    )
    for (const [rel, vs] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
      console.error(`  ${rel}  (${vs.length})`)
      for (const v of vs) console.error(`    ${rel}:${v.line}  [${v.kind}] ${v.text}`)
    }
    console.error('')
    process.exit(1)
  }
  console.log('✔ i18n: no hardcoded user-facing strings found.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
