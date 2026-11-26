#!/usr/bin/env node
/**
 * Adds the "- " items of each changelog entry's commit body under that entry.
 *
 * The conventional-changelog writer prints only a commit's subject. GitHuttBr
 * merges a feature into main with one commit whose body lists what the
 * release brings, so without this the in-app "What's new" page and the
 * GitHub release notes (cut from CHANGELOG.md at the tag) show one line per
 * version. Run by release-it before the release commit (`before:git:release`),
 * so the tag carries the full entry.
 *
 *   node scripts/enrich-changelog.mjs          # the newest version only
 *   node scripts/enrich-changelog.mjs --all    # every version (backfill)
 *
 * Idempotent: an entry that already has a sub-list is left alone. Trailers
 * (Co-Authored-By and the like) and prose paragraphs are never copied. A `#`
 * followed by a digit gets a word joiner after it, because GitHub would link
 * `#123` in release notes as an issue reference.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ENTRY = /^\* .*\(\[[0-9a-f]{7,40}\]\([^)]*\/commit\/([0-9a-f]{40})\)\)\s*$/
const WORD_JOINER = '⁠'

/** The "- " items of a commit body, each joined onto one line. */
export function bodyItems(body) {
  const items = []
  let current = null
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (line.startsWith('- ')) {
      if (current) items.push(current)
      current = line.slice(2).trim()
    } else if (current !== null && /^\s+\S/.test(line)) {
      // A wrapped item is indented; a trailer never is, so a continuation line
      // that happens to read like one ("purpose: …") stays part of the item.
      current += ' ' + line.trim()
    } else {
      if (current) items.push(current)
      current = null
    }
  }
  if (current) items.push(current)
  return items.map((item) => item.replace(/#(\d)/g, `#${WORD_JOINER}$1`))
}

/**
 * The changelog with each entry's body items added under it. `getBody` maps a
 * full commit sha to its body; `all` widens the pass from the newest version
 * to every version.
 */
export function enrichChangelog(text, getBody, { all = false } = {}) {
  const lines = text.split('\n')
  const out = []
  let versions = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    out.push(line)
    if (line.startsWith('## ')) versions++
    if (!all && versions > 1) continue
    const match = ENTRY.exec(line)
    if (!match) continue
    // Already enriched (a re-run, or edited by hand): leave it.
    if ((lines[i + 1] ?? '').startsWith('  - ')) continue
    let body = ''
    try {
      body = getBody(match[1])
    } catch {
      continue
    }
    for (const item of bodyItems(body)) out.push(`  - ${item}`)
  }
  return out.join('\n')
}

function gitBody(sha) {
  return execFileSync('git', ['log', '-1', '--format=%b', sha], { encoding: 'utf8' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = 'CHANGELOG.md'
  const all = process.argv.includes('--all')
  const before = readFileSync(file, 'utf8')
  const after = enrichChangelog(before, gitBody, { all })
  if (after !== before) writeFileSync(file, after)
}
