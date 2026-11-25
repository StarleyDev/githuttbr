import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { semanticCompare } from '../src/main/semantic'
import { GRAMMARS } from '../scripts/grammars.mjs'

// Every grammar the semantic diff ships, loaded by the installed web-tree-sitter.
// The runtime and the grammars share an ABI and a WASM module format (0.25
// changed it and stranded every older build), so a runtime bump that leaves a
// grammar behind fails here rather than silently turning that language back
// into a line diff — semanticCompare swallows load errors by design.
//
// Runs in the portable job too: the files reach resources/tree-sitter through
// the postinstall hook on every OS, and this is where a path or copy slip shows.

const GRAMMAR_DIR = resolve(__dirname, '../resources/tree-sitter')

/**
 * One file per grammar: `start` renamed to `boot` with the body untouched.
 * The rename names the symbol the way the summary does (`Class.method`).
 */
const CASES: { file: string; grammar: string; before: string; from?: string; to?: string }[] = [
  { file: 'a.sh', grammar: 'bash', before: 'start() {\n  echo "$1"\n}\n' },
  { file: 'a.c', grammar: 'c', before: 'int start(int a) { return a + 1; }\n' },
  {
    file: 'a.cs',
    grammar: 'c_sharp',
    before: 'class A { int Start(int a) { return a; } }',
    from: 'A.Start',
    to: 'A.Boot'
  },
  { file: 'a.cpp', grammar: 'cpp', before: 'int start(int a) { return a + 1; }\n' },
  { file: 'a.go', grammar: 'go', before: 'package m\nfunc Start(a int) int { return a }\n', from: 'Start', to: 'Boot' },
  { file: 'a.java', grammar: 'java', before: 'class A { int start(int a) { return a; } }', from: 'A.start', to: 'A.boot' },
  { file: 'a.js', grammar: 'javascript', before: 'function start(a) {\n  return a + 1\n}\n' },
  { file: 'a.kt', grammar: 'kotlin', before: 'fun start(a: Int): Int {\n  return a + 1\n}\n' },
  { file: 'a.lua', grammar: 'lua', before: 'local function start(a)\n  return a + 1\nend\n' },
  { file: 'a.php', grammar: 'php', before: '<?php\nfunction start($a) { return $a + 1; }\n' },
  { file: 'a.py', grammar: 'python', before: 'def start(a):\n    return a\n' },
  { file: 'a.rb', grammar: 'ruby', before: 'def start(a)\n  a\nend\n' },
  { file: 'a.rs', grammar: 'rust', before: 'fn start(a: u8) -> u8 { a }\n' },
  { file: 'a.scala', grammar: 'scala', before: 'def start(a: Int): Int = a + 1\n' },
  { file: 'a.swift', grammar: 'swift', before: 'func start(a: Int) -> Int {\n  return a + 1\n}\n' },
  { file: 'a.tsx', grammar: 'tsx', before: 'export function start(a: number) {\n  return <b>{a}</b>\n}\n' },
  { file: 'a.ts', grammar: 'typescript', before: 'export function start(a: number) {\n  return a + 1\n}\n' },
  { file: 'a.zig', grammar: 'zig', before: 'fn start(a: u8) u8 {\n    return a;\n}\n' }
]

describe('semantic diff grammars', () => {
  it('has a parse case for every shipped grammar, and nothing else in the folder', () => {
    const shipped = GRAMMARS.map((g) => g.language).sort()
    expect(CASES.map((c) => c.grammar).sort()).toEqual(shipped)
    // The postinstall hook mirrors GRAMMARS exactly, runtime included.
    expect(existsSync(GRAMMAR_DIR), 'run `node scripts/sync-grammars.mjs`').toBe(true)
    const files = readdirSync(GRAMMAR_DIR).sort()
    expect(files).toEqual(['web-tree-sitter.wasm', ...shipped.map((l) => `tree-sitter-${l}.wasm`)].sort())
  })

  it.each(CASES)('$file loads the $grammar grammar and reads a rename', async (c) => {
    const { file, grammar, before, from = 'start', to = 'boot' } = c
    const after = before.replace(/\bstart\b/, 'boot').replace(/\bStart\b/, 'Boot')
    const r = await semanticCompare(file, before, after)
    expect(r.language).toBe(grammar)
    expect(r.changes.map((x) => [x.kind, x.oldName, x.symbol])).toEqual([['renamed', from, to]])
  })
})

/**
 * A parameter added, body untouched: every grammar must report it as a
 * signature change — the verdict the handbook promises. Grammars keep their
 * parameters in different places (a field, an unnamed child, a C declarator, a
 * row of Swift `parameter` nodes), so each one is checked, with the exact text
 * shown to the user.
 */
const SIGNATURES: { file: string; grammar: string; before: string; after: string; symbol: string; old: string; new: string }[] = [
  { file: 'a.sh', grammar: 'bash', before: 'f() {\n  echo\n}\n', after: 'f() {\n  echo\n}\n', symbol: '', old: '', new: '' },
  {
    file: 'a.c',
    grammar: 'c',
    before: 'int *start(int a) { return 0; }\n',
    after: 'int *start(int a, char *b) { return 0; }\n',
    symbol: 'start',
    old: '(int a): int',
    new: '(int a, char *b): int'
  },
  {
    file: 'a.cs',
    grammar: 'c_sharp',
    before: 'class A { int Start(int a) { return a; } }',
    after: 'class A { long Start(int a, int b) { return a; } }',
    symbol: 'A.Start',
    old: '(int a): int',
    new: '(int a, int b): long'
  },
  {
    file: 'a.cpp',
    grammar: 'cpp',
    before: 'class B { int start(int a) { return a; } };\n',
    after: 'class B { int start(int a) const { return a; } };\n',
    symbol: 'B.start',
    old: '(int a): int',
    new: '(int a) const: int'
  },
  {
    file: 'a.go',
    grammar: 'go',
    before: 'package m\nfunc (r T) Start(a int) int { return a }\n',
    after: 'package m\nfunc (r T) Start(a int) (int, error) { return a }\n',
    symbol: 'Start',
    old: '(a int): int',
    new: '(a int): (int, error)'
  },
  {
    file: 'a.java',
    grammar: 'java',
    before: 'class A { int start(int a) { return a; } }',
    after: 'class A { long start(int a) { return a; } }',
    symbol: 'A.start',
    old: '(int a): int',
    new: '(int a): long'
  },
  {
    file: 'a.js',
    grammar: 'javascript',
    before: 'function start(a) {\n  return a\n}\n',
    after: 'function start(a, b) {\n  return a\n}\n',
    symbol: 'start',
    old: '(a)',
    new: '(a, b)'
  },
  {
    file: 'a.kt',
    grammar: 'kotlin',
    before: 'class K {\n  fun start(a: Int): Int {\n    return a\n  }\n}\n',
    after: 'class K {\n  fun start(a: Int, b: String = "é"): Int {\n    return a\n  }\n}\n',
    symbol: 'K.start',
    old: '(a: Int): Int',
    new: '(a: Int, b: String = "é"): Int'
  },
  {
    file: 'a.lua',
    grammar: 'lua',
    before: 'function M.start(a)\n  return a\nend\n',
    after: 'function M.start(a, b)\n  return a\nend\n',
    symbol: 'M.start',
    old: '(a)',
    new: '(a, b)'
  },
  {
    file: 'a.php',
    grammar: 'php',
    before: '<?php\nfunction start(int $a): int { return $a; }\n',
    after: '<?php\nfunction start(int $a, int $b): int { return $a; }\n',
    symbol: 'start',
    old: '(int $a): int',
    new: '(int $a, int $b): int'
  },
  {
    file: 'a.py',
    grammar: 'python',
    before: 'def start(a: int) -> int:\n    return a\n',
    after: 'def start(a: int) -> str:\n    return a\n',
    symbol: 'start',
    old: '(a: int): int',
    new: '(a: int): str'
  },
  {
    file: 'a.rb',
    grammar: 'ruby',
    before: 'def start(a)\n  a\nend\n',
    after: 'def start(a, b)\n  a\nend\n',
    symbol: 'start',
    old: '(a)',
    new: '(a, b)'
  },
  {
    file: 'a.rs',
    grammar: 'rust',
    before: 'fn start(a: u8) -> u8 { a }\n',
    after: 'fn start(a: u8) -> u16 { a }\n',
    symbol: 'start',
    old: '(a: u8): u8',
    new: '(a: u8): u16'
  },
  {
    file: 'a.scala',
    grammar: 'scala',
    before: 'def start[T](a: Int)(b: T): Int = a\n',
    after: 'def start[T](a: Int)(b: T, c: T): Int = a\n',
    symbol: 'start',
    old: '[T](a: Int)(b: T): Int',
    new: '[T](a: Int)(b: T, c: T): Int'
  },
  {
    file: 'a.swift',
    grammar: 'swift',
    before: 'class K {\n  func start(a: Int) -> Int {\n    return a\n  }\n}\n',
    after: 'class K {\n  func start(a: Int, b label: String) -> Int {\n    return a\n  }\n}\n',
    symbol: 'K.start',
    old: '(a: Int) -> Int',
    new: '(a: Int, b label: String) -> Int'
  },
  {
    file: 'a.tsx',
    grammar: 'tsx',
    before: 'const Start = (p: P): JSX.Element => <b>{p}</b>\n',
    after: 'const Start = (p: P, q: Q): JSX.Element => <b>{p}</b>\n',
    symbol: 'Start',
    old: '(p: P): JSX.Element',
    new: '(p: P, q: Q): JSX.Element'
  },
  {
    file: 'a.ts',
    grammar: 'typescript',
    before: 'export function start(a: number): number {\n  return a\n}\n',
    after: 'export function start(a: number): string {\n  return a\n}\n',
    symbol: 'start',
    old: '(a: number): number',
    new: '(a: number): string'
  },
  {
    file: 'a.zig',
    grammar: 'zig',
    before: 'fn start(a: u8) u8 {\n    return a;\n}\n',
    after: 'fn start(a: u8) u16 {\n    return a;\n}\n',
    symbol: 'start',
    old: '(a: u8) u8',
    new: '(a: u8) u16'
  }
]

describe('semantic diff signatures', () => {
  it('has a signature case for every shipped grammar', () => {
    expect(SIGNATURES.map((c) => c.grammar).sort()).toEqual(GRAMMARS.map((g) => g.language).sort())
  })

  it.each(SIGNATURES)('$file reads a $grammar signature change', async (c) => {
    const r = await semanticCompare(c.file, c.before, c.after)
    expect(r.language).toBe(c.grammar)
    // Bash functions take no declared parameters: nothing to change, nothing reported.
    if (!c.symbol) return expect(r.changes).toEqual([])
    const sig = r.changes.map((x) => [x.kind, x.symbol, x.oldSignature, x.newSignature, x.bodyChanged])
    expect(sig).toEqual([['signature', c.symbol, c.old, c.new, false]])
  })
})
