/**
 * Is a translated handbook page still a translation of the English page?
 *
 * Pure functions, no filesystem — `docs-check.mjs` feeds them file contents and
 * the tests feed them strings.
 *
 * Two signals, because neither is enough alone:
 *
 *   - **Provenance.** A translation records, in its front matter, the git blob
 *     id of the English file it was translated from (`source: <sha>`). If the
 *     English file hashes differently today, the English changed since — any
 *     change, including a reworded paragraph that no structure check can see.
 *     The id is the one `git hash-object` prints, so `git diff <old> <new>`
 *     shows a translator exactly what to catch up on, and computing it needs
 *     no git at all.
 *   - **Structure.** Pages without a `source:` (everything translated before it
 *     existed) are compared by shape: the heading levels in order, the images,
 *     the table rows. Translated prose differs from English by design; those do
 *     not, so a mismatch is a missing or extra section, not a style choice. It
 *     is blind to edits inside a paragraph, which is why provenance exists.
 */
import { createHash } from 'node:crypto'

/** Line endings normalised, so a Windows checkout hashes what the repository stores. */
const normalise = (text) => text.replace(/\r\n/g, '\n')

/** The git blob id of `text` — identical to `git hash-object` on a file holding it. */
export function blobSha(text) {
  const body = Buffer.from(normalise(text), 'utf8')
  return createHash('sha1')
    .update(`blob ${body.length}\0`)
    .update(body)
    .digest('hex')
}

/** The flat `key: value` front matter, and the body after it. */
export function splitFrontMatter(source) {
  const text = normalise(source)
  if (!text.startsWith('---')) return { meta: {}, body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { meta: {}, body: text }
  const meta = {}
  for (const line of text.slice(3, end).split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return { meta, body: text.slice(end + 4) }
}

const IMAGE = /!\[[^\]]*\]\((?:[^)]*\/)?([\w.-]+\.(?:png|gif|jpe?g|webp|svg))\)/g
// Things a translator leaves alone: inline code, page links, images. They are
// what tells two translated sections apart when their headings cannot.
const MARKERS = /`([^`\n]+)`|\]\(([\w-]+\.md)(?:#[\w-]*)?\)|\(([^)\s]*\.(?:png|gif|webp|svg))\)/g

/**
 * The shape of a page: its sections (heading level, text, and the untranslatable
 * markers under it), its images in order, and how many table rows it has.
 * Fenced code is skipped — a `# comment` in a shell sample is not a heading.
 */
export function outline(markdown) {
  const { body } = splitFrontMatter(markdown)
  const sections = [{ level: 0, text: '', markers: new Set() }]
  const images = []
  let tableRows = 0
  let fence = null
  // Images are matched over the prose between headings rather than per line: a
  // long alt text wraps, and a per-line match would miss the image entirely.
  // A fence breaks the run so an image cannot span into or out of code.
  let prose = []
  const flushImages = () => {
    for (const m of prose.join('\n').matchAll(IMAGE)) images.push(m[1])
    prose = []
  }
  for (const line of body.split('\n')) {
    const fenceMatch = /^\s*(```|~~~)/.exec(line)
    if (fenceMatch) {
      flushImages()
      if (fence === null) fence = fenceMatch[1]
      else if (fenceMatch[1] === fence) fence = null
      continue
    }
    if (fence !== null) continue
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      flushImages()
      sections.push({ level: heading[1].length, text: heading[2], markers: new Set() })
      continue
    }
    const current = sections[sections.length - 1]
    for (const m of line.matchAll(MARKERS)) current.markers.add(m[1] ?? m[2] ?? m[3])
    prose.push(line)
    // The separator row (`|---|---|`) is layout, not content.
    if (/^\s*\|/.test(line) && !/^\s*\|[\s:|-]+\|\s*$/.test(line)) tableRows++
  }
  flushImages()
  return { sections: sections.filter((s) => s.level > 0), images, tableRows }
}

const jaccard = (a, b) => {
  if (a.size === 0 && b.size === 0) return 0
  let shared = 0
  for (const x of a) if (b.has(x)) shared++
  return shared / (a.size + b.size - shared)
}

/**
 * Pair English sections with translated ones. Only equal heading levels can
 * pair; among the alignments that pair the most, the one whose sections share
 * the most code spans, links and images wins — which is what puts a missing
 * section in the right place instead of blaming the one after it.
 */
export function alignSections(en, tr) {
  const n = en.length
  const m = tr.length
  const score = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  const pair = (i, j) => (en[i].level === tr[j].level ? 1 + jaccard(en[i].markers, tr[j].markers) : -Infinity)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      score[i][j] = Math.max(score[i + 1][j], score[i][j + 1], pair(i, j) + score[i + 1][j + 1])
    }
  }
  const missing = []
  const extra = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (score[i][j] === pair(i, j) + score[i + 1][j + 1]) {
      i++
      j++
    } else if (score[i][j] === score[i + 1][j]) missing.push(en[i++])
    else extra.push(tr[j++])
  }
  while (i < n) missing.push(en[i++])
  while (j < m) extra.push(tr[j++])
  return { missing, extra }
}

/** Multiset difference: what `a` has that `b` lacks, as many times as it lacks it. */
const lacking = (a, b) => {
  const left = new Map()
  for (const x of b) left.set(x, (left.get(x) ?? 0) + 1)
  const out = []
  for (const x of a) {
    const k = left.get(x) ?? 0
    if (k > 0) left.set(x, k - 1)
    else out.push(x)
  }
  return out
}

const heading = (s) => `${'#'.repeat(s.level)} ${s.text}`

/** Every structural way a translation differs from its English page, as readable lines. */
export function compareStructure(enSource, trSource) {
  const en = outline(enSource)
  const tr = outline(trSource)
  const reasons = []
  const { missing, extra } = alignSections(en.sections, tr.sections)
  for (const s of missing) reasons.push(`missing section "${heading(s)}"`)
  if (extra.length) {
    reasons.push(`${extra.length} section${extra.length === 1 ? '' : 's'} with no English counterpart`)
  }
  for (const img of lacking(en.images, tr.images)) reasons.push(`missing image ${img}`)
  for (const img of lacking(tr.images, en.images)) reasons.push(`image ${img} is not on the English page`)
  if (en.tableRows !== tr.tableRows) {
    reasons.push(`table rows: English has ${en.tableRows}, translation ${tr.tableRows}`)
  }
  return reasons
}

/**
 * The verdict for one translated page.
 *
 *   - `fresh`: its `source:` is the English page as it is now.
 *   - `stale`: the English changed since its `source:`, or (without one) the
 *     shape no longer matches. `reasons` says what to look at.
 *   - `unverified`: no `source:`, and the shape matches. Probably fine, but a
 *     reworded paragraph would look exactly like this.
 */
export function staleness(enSource, trSource) {
  const { meta } = splitFrontMatter(trSource)
  const structure = compareStructure(enSource, trSource)
  const recorded = (meta.source ?? '').toLowerCase()
  if (recorded) {
    const current = blobSha(enSource)
    if (current.startsWith(recorded) || recorded.startsWith(current)) {
      // A current `source:` over a page that lost a section is a translation
      // that was stamped without being finished — still worth saying.
      return structure.length ? { status: 'stale', reasons: structure } : { status: 'fresh', reasons: [] }
    }
    const short = recorded.slice(0, 12)
    return {
      status: 'stale',
      reasons: [
        `English changed since ${short} — git diff ${short} ${current.slice(0, 12)}`,
        ...structure
      ]
    }
  }
  if (structure.length) return { status: 'stale', reasons: structure }
  return { status: 'unverified', reasons: [] }
}
