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

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/** The expressions a selector can return: its expression body, or every `return`. */
function results(fn: ts.ArrowFunction | ts.FunctionExpression): ts.Expression[] {
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

/** Whether a returned expression can hand back a value built during the call. */
function fresh(expr: ts.Expression): boolean {
  while (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr)) expr = expr.expression
  if (ts.isArrayLiteralExpression(expr) || ts.isObjectLiteralExpression(expr)) return true
  if (ts.isNewExpression(expr)) return true
  if (ts.isConditionalExpression(expr)) return fresh(expr.whenTrue) || fresh(expr.whenFalse)
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) {
      return fresh(expr.left) || fresh(expr.right)
    }
    return false
  }
  if (ts.isCallExpression(expr)) {
    const callee = expr.expression
    const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : ''
    return /^default[A-Z]/.test(name) || ['map', 'filter', 'slice', 'concat', 'flatMap', 'entries', 'keys', 'values'].includes(name)
  }
  return false
}

describe('store selectors', () => {
  it('never return a value built during the call', () => {
    const offenders: string[] = []
    for (const file of sources(RENDERER)) {
      const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          /^use\w*Store$/.test(node.expression.text) &&
          node.expression.text !== 'useSyncExternalStore'
        ) {
          const selector = node.arguments[0]
          if (selector && (ts.isArrowFunction(selector) || ts.isFunctionExpression(selector))) {
            if (results(selector).some(fresh)) {
              const { line } = src.getLineAndCharacterOfPosition(node.getStart())
              offenders.push(`${relative(ROOT, file)}:${line + 1}`)
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(src)
    }
    expect(offenders).toEqual([])
  })

  it('activeProfile() and activeAI() keep their identity while the settings hold no profile', () => {
    useSettingsStore.setState({ settings: { ...defaultSettings(), profiles: [] } })
    const s = useSettingsStore.getState()
    expect(s.activeProfile()).toBe(s.activeProfile())
    expect(s.activeAI()).toBe(s.activeAI())
  })
})
