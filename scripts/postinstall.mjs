#!/usr/bin/env node
/**
 * The postinstall hook: rebuild node-pty for Electron, then copy the
 * tree-sitter grammars into resources/tree-sitter.
 *
 * A Node script rather than `electron-rebuild … || true && node …` in
 * package.json: npm runs scripts through cmd.exe on Windows, which has no
 * `true`, so a failed rebuild there skipped the grammar copy as well.
 *
 * A failed rebuild is tolerated, as before — the terminal then falls back to
 * basic shell mode, and `npm run check:native` is what refuses to package it.
 * A failed grammar copy is not: sync-grammars only fails on a real problem.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// shell: npm puts node_modules/.bin on PATH, and on Windows the binary is a .cmd shim.
const rebuild = spawnSync('electron-rebuild -f -w node-pty', { stdio: 'inherit', shell: true })
if (rebuild.status !== 0) console.warn('[postinstall] electron-rebuild failed; continuing without it')

const sync = spawnSync(process.execPath, [join(HERE, 'sync-grammars.mjs')], { stdio: 'inherit' })
process.exit(sync.status ?? 1)
