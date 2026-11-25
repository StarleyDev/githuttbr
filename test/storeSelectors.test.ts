import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../src/shared/types'

vi.mock('../src/renderer/src/infrastructure/api', () => ({
  settingsApi: { set: vi.fn(async () => undefined) },
  reposApi: {}
}))

import { useSettingsStore } from '../src/renderer/src/stores/settings'

// Zustand 5 passes a selector straight to React's useSyncExternalStore, which
// compares its result by identity. A selector that builds a new array or object
// on every call — `s.list ?? []`, `s.x ?? defaultX()`, `({ a: s.a })` — no longer
// just re-renders too often: it loops until React throws "Maximum update depth
// exceeded". Nothing at compile time catches it, so this does.

const ROOT = join(__dirname, '..')
const RENDERER = join(ROOT, 'src/renderer/src')

/**
 * Calls a selector may return the result of. Anything else counts as building
 * a value, so a new helper or store getter has to be read and listed here.
 */
const STABLE_CALLS = new Set([
  // Store getters that hand back state they hold, or a memoised value — the
  // last test below pins each one's identity.
  'activeProfile',
  'activeAI',
  'aiOfProfile',
  'activeTab',
  'activeRepo',
  // Array lookups: an element already in the state.
  'find',
  // Primitive results (strings, booleans), compared by value.
  'pop',
  'githubAccountFingerprint',
  'effectiveProfileId',
  'repoChatAvailable',
  'lookupRepoImage',
  'tabActiveRepoPath'
])

type Fn = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/** The expressions a selector can return: its expression body, or every `return`. */
function results(fn: Fn): ts.Expression[] {
  if (!fn.body) return []
  if (!ts.isBlock(fn.body)) return [fn.body]
  const out: ts.Expression[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return
    if (ts.isReturnStatement(node) && node.expression) out.push(node.expression)
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(fn.body, visit)
  return out
}

/** The initializers of the variables a selector declares in its own body, by name. */
function locals(fn: Fn): Map<string, ts.Expression | undefined> {
  const out = new Map<string, ts.Expression | undefined>()
  if (!fn.body || !ts.isBlock(fn.body)) return out
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) out.set(node.name.text, node.initializer)
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(fn.body, visit)
  return out
}

function calleeName(call: ts.CallExpression): string {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  return ''
}

/** Whether a returned expression can hand back a value built during the call. */
function fresh(expr: ts.Expression, scope: Map<string, ts.Expression | undefined>, seen = new Set<string>()): boolean {
  while (
    ts.isParenthesizedExpression(expr) ||
    ts.isAsExpression(expr) ||
    ts.isNonNullExpression(expr) ||
    ts.isSatisfiesExpression(expr)
  ) {
    expr = expr.expression
  }
  if (ts.isArrayLiteralExpression(expr) || ts.isObjectLiteralExpression(expr)) return true
  if (ts.isNewExpression(expr) || ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return true
  if (ts.isConditionalExpression(expr)) return fresh(expr.whenTrue, scope, seen) || fresh(expr.whenFalse, scope, seen)
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind
    if (
      op === ts.SyntaxKind.QuestionQuestionToken ||
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.AmpersandAmpersandToken ||
      op === ts.SyntaxKind.CommaToken
    ) {
      return (op !== ts.SyntaxKind.CommaToken && fresh(expr.left, scope, seen)) || fresh(expr.right, scope, seen)
    }
    // Comparisons and arithmetic produce primitives.
    return false
  }
  if (ts.isCallExpression(expr)) return !STABLE_CALLS.has(calleeName(expr))
  if (ts.isIdentifier(expr) && scope.has(expr.text) && !seen.has(expr.text)) {
    // A local of the selector: what it was built from decides.
    seen.add(expr.text)
    const init = scope.get(expr.text)
    return init ? fresh(init, scope, seen) : true
  }
  // Property reads, outer bindings, literals, template strings, unary operators.
  return false
}

function selectorIsFresh(fn: Fn): boolean {
  const scope = locals(fn)
  return results(fn).some((r) => fresh(r, scope))
}

/** A selector passed by name, resolved to its declaration in the same file. */
function declaredFunction(src: ts.SourceFile, name: string): Fn | null {
  let found: Fn | null = null
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      const init = node.initializer
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) found = init
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  return found
}

/** `file:line` of every store selector that may return a value built during the call. */
function offenders(file: string, text: string): string[] {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const out: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      /^use\w*Store$/.test(node.expression.text) &&
      node.expression.text !== 'useSyncExternalStore' &&
      node.arguments.length > 0
    ) {
      const selector = node.arguments[0]
      let bad: boolean
      if (ts.isArrowFunction(selector) || ts.isFunctionExpression(selector)) bad = selectorIsFresh(selector)
      else if (ts.isIdentifier(selector)) {
        // Declared elsewhere: this test cannot read it, so it cannot vouch for it.
        const fn = declaredFunction(src, selector.text)
        bad = !fn || selectorIsFresh(fn)
      } else bad = true
      if (bad) out.push(`${file}:${src.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  return out
}

describe('store selectors', () => {
  it('never return a value built during the call', () => {
    const found = sources(RENDERER).flatMap((file) => offenders(relative(ROOT, file), readFileSync(file, 'utf8')))
    expect(found).toEqual([])
  })

  it('the check flags every shape of a fresh result', () => {
    const flagged = (body: string): boolean => offenders('x.tsx', body).length > 0
    // Built during the call.
    expect(flagged('useAStore((s) => s.list ?? [])')).toBe(true)
    expect(flagged('useAStore((s) => s.list || {})')).toBe(true)
    expect(flagged('useAStore((s) => s.ready && [s.a, s.b])')).toBe(true)
    expect(flagged('useAStore((s) => ({ a: s.a }))')).toBe(true)
    expect(flagged('useAStore((s) => (s.on ? s.list : []))')).toBe(true)
    expect(flagged('useAStore((s) => s.x ?? defaultX())')).toBe(true)
    expect(flagged('useAStore((s) => s.list.filter(Boolean))')).toBe(true)
    expect(flagged('useAStore((s) => Object.fromEntries(s.pairs))')).toBe(true)
    expect(flagged('useAStore((s) => Array.from(s.set))')).toBe(true)
    expect(flagged("useAStore((s) => s.path.split('/'))")).toBe(true)
    expect(flagged('useAStore((s) => structuredClone(s.x))')).toBe(true)
    expect(flagged('useAStore((s) => s.todosFor(path))')).toBe(true)
    expect(flagged('useAStore((s) => new Set(s.ids))')).toBe(true)
    expect(flagged('useAStore((s) => () => s.a)')).toBe(true)
    expect(flagged('useAStore((s) => { const a = [s.a]; return a })')).toBe(true)
    expect(flagged('useAStore((s) => { const a = s.list ?? []; const b = a; return b })')).toBe(true)
    expect(flagged('function pick(s) { return { a: s.a } }\nuseAStore(pick)')).toBe(true)
    expect(flagged('const pick = (s) => s.list ?? []\nuseAStore(pick)')).toBe(true)
    expect(flagged("import { pick } from './p'\nuseAStore(pick)")).toBe(true)
    expect(flagged('useAStore(selectors.pick)')).toBe(true)
    // Held by the state, memoised, or a primitive.
    expect(flagged('useAStore((s) => s.list)')).toBe(false)
    expect(flagged('useAStore((s) => s.repos[path]?.status ?? null)')).toBe(false)
    expect(flagged('useAStore((s) => s.list.length > 0)')).toBe(false)
    expect(flagged('useAStore((s) => s.activeProfile())')).toBe(false)
    expect(flagged('useAStore((s) => s.tasks.find((t) => t.id === id))')).toBe(false)
    expect(flagged('useAStore((s) => { const r = s.repos[path]; return !!r && !r.notGit })')).toBe(false)
    expect(flagged('const pick = (s) => s.list\nuseAStore(pick)')).toBe(false)
    expect(flagged('useAStore()')).toBe(false)
  })

  it('the stable store getters keep their identity on empty settings', () => {
    useSettingsStore.setState({ settings: { ...defaultSettings(), profiles: [], tabs: [] } })
    const s = useSettingsStore.getState()
    expect(s.activeProfile()).toBe(s.activeProfile())
    expect(s.activeAI()).toBe(s.activeAI())
    expect(s.aiOfProfile('missing')).toBe(s.aiOfProfile('missing'))
    expect(s.aiOfProfile('missing')).toBe(s.activeAI())
    expect(s.activeTab()).toBeNull()
    expect(s.activeRepo()).toBeNull()
  })

  it('the stable store getters keep their identity with a profile and an open tab', () => {
    const settings = defaultSettings()
    const tab = { id: 't', kind: 'repo', repos: [{ path: '/r' }], activeRepoPath: '/r' }
    useSettingsStore.setState({
      settings: { ...settings, tabs: [tab as never], activeTabId: 't' }
    })
    const s = useSettingsStore.getState()
    const profile = s.settings.profiles[0]
    expect(s.activeProfile()).toBe(s.activeProfile())
    expect(s.activeAI()).toBe(s.activeAI())
    expect(s.aiOfProfile(profile.id)).toBe(s.aiOfProfile(profile.id))
    expect(s.activeTab()).toBe(s.activeTab())
    expect(s.activeRepo()).toBe(s.activeRepo())
    expect(s.activeRepo()).not.toBeNull()
  })
})
