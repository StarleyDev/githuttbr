#!/usr/bin/env node
// Release guard: refuse a release whose changelog would silently miss work.
//
// Run by release-it (before:init hook). The changelog reads first-parent
// history only (.release-it.json → gitRawCommitsOpts.firstParent), so on main
// the only commit a merged branch contributes is the merge itself. A merge
// whose subject is not a conventional commit ("Merge branch 'x'") is dropped,
// and with it everything the branch brought — v4.44.0 shipped without its PR
// review footer that way. Fix: reword the merge with the feature's message
// (`git commit --amend` right after merging) or rebase the branch and
// fast-forward instead.
//
// Blocks in every mode: a wrong changelog is published with the release, and
// the release notes are cut from it.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CONVENTIONAL = /^(feat|fix|perf|revert|docs|chore|refactor|test|build|ci|style)(\([^)]+\))?!?: \S/

/**
 * The merges on the first-parent line whose subject the changelog will drop.
 * `log` is `git log --first-parent --format=%H%x09%P%x09%s <range>` output.
 */
export function findHiddenMerges(log) {
  return log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, parents, ...subject] = line.split('\t')
      return { hash, parents: parents.split(' ').filter(Boolean), subject: subject.join('\t') }
    })
    .filter((c) => c.parents.length > 1 && !CONVENTIONAL.test(c.subject))
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf-8' }).trim()
}

function main() {
  let since
  try {
    since = git(['describe', '--tags', '--abbrev=0'])
  } catch {
    process.exit(0) // no tag yet: nothing to compare against
  }
  const log = git(['log', '--first-parent', '--format=%H%x09%P%x09%s', `${since}..HEAD`])
  const hidden = findHiddenMerges(log)
  if (!hidden.length) process.exit(0)
  console.error(`\n✖ ${hidden.length} merge(s) since ${since} would be missing from the changelog:`)
  for (const m of hidden) console.error(`  ${m.hash.slice(0, 8)}  ${m.subject}`)
  console.error(
    '\n  The changelog reads first-parent history, where a merge is the only commit a\n' +
      '  branch shows. Give each merge a conventional message (feat: …, fix: …) or\n' +
      '  rebase the branch and fast-forward, then run the release again.\n'
  )
  process.exit(1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
