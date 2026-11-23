// The macOS half of a release arrives on its own schedule: GitHub's macOS
// queue sometimes hands out no runner for a whole release. Linux and Windows
// publish without it; this script decides when to build macOS again and keeps
// one issue per release telling the maintainer that macOS is missing.
//
// Usage:
//   node scripts/release-mac.mjs pick <release.json> <runs.json> [tag]
//       release.json = `gh release view [TAG] --json tagName,isDraft,publishedAt,assets`
//       runs.json    = `gh run list --workflow release.yml --json status,headBranch`
//       Prints `tag=<tag>` or `skip=<reason>`.
//   node scripts/release-mac.mjs issue open|close <tag>
//       Opens/updates or closes the "<tag>: macOS build missing" issue with gh.
//       Reads GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID and, for open,
//       MAC_RESULT / MAC_RUNNER.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** How long the scheduled backfill keeps trying after a release is published. */
export const BACKFILL_WINDOW_HOURS = 48
export const TAG_RE = /^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$/
const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested'])

/**
 * @typedef {{ tagName?: string; isDraft?: boolean; publishedAt?: string | null; assets?: Array<{ name: string }> }} Release
 * @typedef {{ status?: string; headBranch?: string }} Run
 */

/**
 * Which release the scheduled job should build macOS for, if any. Idempotent:
 * a release that already carries latest-mac.yml is never rebuilt.
 * @param {{ release: Release | null; runs: Run[]; explicitTag?: string; now: number; windowHours?: number }} input
 * @returns {{ tag: string } | { skip: string }}
 */
export function pickTarget({ release, runs, explicitTag, now, windowHours = BACKFILL_WINDOW_HOURS }) {
  if (explicitTag && !TAG_RE.test(explicitTag)) return { skip: `'${explicitTag}' is not vX.Y.Z` }
  if (!release || !release.tagName) return { skip: 'no release found' }
  const tag = release.tagName
  if (!TAG_RE.test(tag)) return { skip: `'${tag}' is not vX.Y.Z` }
  if (explicitTag && tag !== explicitTag) return { skip: `asked for ${explicitTag}, found ${tag}` }
  if ((release.assets ?? []).some((a) => a.name === 'latest-mac.yml')) return { skip: `${tag} already has latest-mac.yml` }
  // The Release run (or its automatic re-run) may still deliver macOS itself.
  if (runs.some((r) => r.headBranch === tag && ACTIVE.has(r.status ?? ''))) {
    return { skip: `a Release run for ${tag} is still going` }
  }
  // A draft has not shipped to anyone; only a person should push it along.
  if (release.isDraft && !explicitTag) return { skip: `${tag} is a draft` }
  if (!explicitTag) {
    const published = release.publishedAt ? Date.parse(release.publishedAt) : NaN
    if (Number.isNaN(published)) return { skip: `${tag} has no publish date` }
    if (now - published > windowHours * 3600_000) {
      return { skip: `${tag} was published more than ${windowHours} h ago; automatic tries have stopped` }
    }
  }
  return { tag }
}

/** @param {string} tag */
export function issueTitle(tag) {
  return `${tag}: macOS build missing`
}

/**
 * @param {{ tag: string; repo: string; server?: string; runUrl: string; result: string; runner?: string; deadline?: string | null }} o
 */
export function issueBody({ tag, repo, server = 'https://github.com', runUrl, result, runner, deadline }) {
  const base = `${server}/${repo}`
  const why =
    result === 'cancelled' || result === 'skipped'
      ? 'the macOS job never got a runner (GitHub cancels a job its macOS queue does not pick up)'
      : `the macOS job ended with \`${result}\``
  const next = deadline
    ? `The **Release mac backfill** workflow retries every 6 hours until **${deadline}** (48 h after publishing) and closes this issue when the upload lands.`
    : 'The **Release mac backfill** workflow retries every 6 hours for 48 h after the release is published, and closes this issue when the upload lands.'
  return [
    `The release [${tag}](${base}/releases/tag/${tag}) has no macOS build: ${why}.`,
    '',
    `- Last attempt: ${runUrl}${runner ? ` (\`${runner}\`)` : ''}`,
    `- Release runs for this tag: ${base}/actions/workflows/release.yml?query=branch%3A${encodeURIComponent(tag)}`,
    '',
    '**What this means.** Linux and Windows are published. macOS users are not offered the update until ' +
      '`latest-mac.yml` is attached, and the download page has no `.dmg` for this version.',
    '',
    `**What happens next.** ${next}`,
    '',
    '**To do it by hand:** Actions → **Release mac backfill** → *Run workflow*, tag `' +
      tag +
      '` (pick the other macOS runner if one keeps failing). It builds macOS from the tag and uploads to the existing release; re-running it is safe.',
    '',
    '_Updated by the release workflows._'
  ].join('\n')
}

/** @param {string[]} args */
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim()
}

/** @param {string} repo @param {string} title */
function findIssue(repo, title) {
  const out = gh(['issue', 'list', '-R', repo, '--state', 'open', '--search', `"${title}" in:title`, '--json', 'number,title'])
  const hit = /** @type {Array<{ number: number; title: string }>} */ (JSON.parse(out || '[]')).find((i) => i.title === title)
  return hit ? String(hit.number) : null
}

/** @param {string} tag */
function deadlineFor(repo, tag) {
  try {
    const at = gh(['release', 'view', tag, '-R', repo, '--json', 'publishedAt', '-q', '.publishedAt'])
    const t = Date.parse(at)
    if (Number.isNaN(t)) return null
    return new Date(t + BACKFILL_WINDOW_HOURS * 3600_000).toISOString().replace(/:\d\d\.\d+Z$/, ' UTC').replace('T', ' ')
  } catch {
    return null
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'pick') {
    const [releaseFile, runsFile, explicitTag] = rest
    const read = (f) => {
      try {
        const t = readFileSync(f, 'utf8').trim()
        return t ? JSON.parse(t) : null
      } catch {
        return null
      }
    }
    const r = pickTarget({ release: read(releaseFile), runs: read(runsFile) ?? [], explicitTag: explicitTag || undefined, now: Date.now() })
    console.log('tag' in r ? `tag=${r.tag}` : `skip=${r.skip}`)
  } else if (cmd === 'issue') {
    const [mode, tag] = rest
    if (!TAG_RE.test(tag ?? '')) throw new Error(`refusing tag '${tag}'`)
    const repo = process.env.GITHUB_REPOSITORY ?? ''
    const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com'
    const runUrl = `${server}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID ?? ''}`
    const title = issueTitle(tag)
    const issue = findIssue(repo, title)
    if (mode === 'close') {
      if (issue) gh(['issue', 'close', issue, '-R', repo, '-c', `macOS artifacts for ${tag} were uploaded by ${runUrl}.`])
      console.log(issue ? `closed #${issue}` : 'no open issue')
    } else if (mode === 'open') {
      const body = issueBody({
        tag,
        repo,
        server,
        runUrl,
        result: process.env.MAC_RESULT || 'failure',
        runner: process.env.MAC_RUNNER || undefined,
        deadline: deadlineFor(repo, tag)
      })
      if (issue) gh(['issue', 'edit', issue, '-R', repo, '--body', body])
      else gh(['issue', 'create', '-R', repo, '--title', title, '--body', body])
      console.log(issue ? `updated #${issue}` : 'opened')
    } else {
      throw new Error('usage: release-mac.mjs issue open|close <tag>')
    }
  } else {
    console.error('usage: release-mac.mjs pick|issue …')
    process.exit(2)
  }
}
