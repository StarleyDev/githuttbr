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
