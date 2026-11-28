/**
 * Contracts for the generated repo wiki.
 *
 * Two stages, both grounded the same way as the rest of the AI features: the
 * planner may only name files that exist in the repo, and each page may only
 * cite files that were put in front of it. Anything else is a validation error
 * that the model is asked to fix, not a plausible-looking invention.
 */

import type { RepoWiki, TechStack, WikiArchetype, WikiPage, WikiPagePlan, WikiPlan } from '../shared/types'
import { isSafeRepoPath } from './aiSchemas'
import { PRODUCT_NAME } from '../shared/brand'

/** Bumping this invalidates every stored wiki. */
export const WIKI_PROMPT_VERSION = 'wiki.v1'

export const MAX_PAGES = 12
export const MAX_SECTIONS = 6
export const MAX_CLAIMS = 8

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ARCHETYPES = new Set(['overview', 'module', 'workflow', 'reference'])

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

// ─── Stage 1: the plan ──────────────────────────────────────────────────────

export const WIKI_PLAN_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['pages'],
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slug', 'title', 'archetype', 'scopePaths'],
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          archetype: { type: 'string', enum: [...ARCHETYPES] },
          scopePaths: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
}

/**
 * A plan is usable when every page is uniquely named, there is exactly one
 * overview, and every path it claims to cover is really in the repo.
 */
export function validateWikiPlan(value: unknown, knownPaths: Set<string>): string[] {
  const root = asObject(value)
  if (!root) return ['The response must be a JSON object.']
  if (!Array.isArray(root.pages)) return ['"pages" must be an array of page plans.']
  if (root.pages.length === 0) return ['"pages" is empty — plan at least an overview page.']

  const errors: string[] = []
  if (root.pages.length > MAX_PAGES) {
    errors.push(`"pages" must have at most ${MAX_PAGES} entries, not ${root.pages.length}.`)
  }

  const seen = new Set<string>()
  let overviews = 0
  root.pages.forEach((raw: unknown, i) => {
    const page = asObject(raw)
    const at = `pages[${i}]`
    if (!page) {
      errors.push(`${at} must be an object.`)
      return
    }
    if (typeof page.slug !== 'string' || !SLUG.test(page.slug)) {
      errors.push(`${at}.slug must be kebab-case, e.g. "data-layer".`)
    } else if (seen.has(page.slug)) {
      errors.push(`${at}.slug "${page.slug}" is used twice — slugs must be unique.`)
    } else {
      seen.add(page.slug)
    }
    if (!nonEmptyString(page.title)) errors.push(`${at}.title must be the page title.`)
    if (typeof page.archetype !== 'string' || !ARCHETYPES.has(page.archetype)) {
      errors.push(`${at}.archetype must be one of: ${[...ARCHETYPES].join(', ')}.`)
    }
    if (page.archetype === 'overview') overviews++

    if (!Array.isArray(page.scopePaths)) {
      errors.push(`${at}.scopePaths must be an array of repo paths.`)
      return
    }
    for (const path of page.scopePaths) {
      if (typeof path !== 'string' || !knownPaths.has(path)) {
        errors.push(`${at}.scopePaths contains ${JSON.stringify(path)}, which is not a file in this repository. Use only paths from the file list.`)
      }
    }
    if (page.archetype !== 'overview' && page.scopePaths.length === 0) {
      errors.push(`${at}.scopePaths must name at least one file this page is about.`)
    }
  })

  if (overviews !== 1) errors.push(`Exactly one page must have archetype "overview"; found ${overviews}.`)
  return errors
}

/**
 * Drops planner paths that were not in its file list. A non-overview page with
 * no evidence left is dropped as well; validation still enforces the remaining
 * plan's slugs, shape and single overview.
 */
export function sanitizeWikiPlan(value: unknown, knownPaths: Set<string>): unknown {
  const root = asObject(value)
  if (!root || !Array.isArray(root.pages)) return value
  const pages = root.pages.flatMap((raw: unknown) => {
    const page = asObject(raw)
    if (!page || !Array.isArray(page.scopePaths)) return [raw]
    const scopePaths = page.scopePaths.filter(
      (path): path is string => typeof path === 'string' && knownPaths.has(path)
    )
    if (page.archetype !== 'overview' && scopePaths.length === 0) return []
    return [{ ...page, scopePaths }]
  })
  return { ...root, pages }
}

// ─── Stage 2: one page ──────────────────────────────────────────────────────

export const WIKI_PAGE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'sections', 'related'],
  properties: {
    summary: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'claims'],
        properties: {
          heading: { type: 'string' },
          claims: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'sourcePaths'],
              properties: {
                text: { type: 'string' },
                sourcePaths: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    },
    related: { type: 'array', items: { type: 'string' } }
  }
}

/** A page may only cite the files it was shown and the slugs that exist. */
export function validateWikiPage(
  value: unknown,
  allowed: { paths: Set<string>; slugs: Set<string> }
): string[] {
  const root = asObject(value)
  if (!root) return ['The response must be a JSON object.']
  const errors: string[] = []
  if (!nonEmptyString(root.summary)) errors.push('"summary" must be one or two sentences about this page.')

  if (!Array.isArray(root.sections)) {
    errors.push('"sections" must be an array.')
  } else {
    if (root.sections.length > MAX_SECTIONS) {
      errors.push(`"sections" must have at most ${MAX_SECTIONS} entries, not ${root.sections.length}.`)
    }
    root.sections.forEach((raw: unknown, i) => {
      const section = asObject(raw)
      const at = `sections[${i}]`
      if (!section) {
        errors.push(`${at} must be an object.`)
        return
      }
      if (!nonEmptyString(section.heading)) errors.push(`${at}.heading must be a short heading.`)
      if (!Array.isArray(section.claims)) {
        errors.push(`${at}.claims must be an array.`)
        return
      }
      if (section.claims.length > MAX_CLAIMS) {
        errors.push(`${at}.claims must have at most ${MAX_CLAIMS} entries.`)
      }
      section.claims.forEach((rawClaim: unknown, j) => {
        const claim = asObject(rawClaim)
        const where = `${at}.claims[${j}]`
        if (!claim) {
          errors.push(`${where} must be an object.`)
          return
        }
        if (!nonEmptyString(claim.text)) errors.push(`${where}.text must be a sentence.`)
        if (!Array.isArray(claim.sourcePaths) || claim.sourcePaths.length === 0) {
          errors.push(`${where}.sourcePaths must name at least one file you were shown. Drop the claim if no file supports it.`)
          return
        }
        for (const path of claim.sourcePaths) {
          if (typeof path !== 'string' || !allowed.paths.has(path)) {
            errors.push(`${where}.sourcePaths contains ${JSON.stringify(path)}, which is not one of the files you were given.`)
          }
        }
      })
    })
  }

  if (root.related !== undefined) {
    if (!Array.isArray(root.related)) {
      errors.push('"related" must be an array of page slugs.')
    } else {
      for (const slug of root.related) {
        if (typeof slug !== 'string' || !allowed.slugs.has(slug)) {
          errors.push(`"related" contains ${JSON.stringify(slug)}, which is not another page in the plan.`)
        }
      }
    }
  }
  return errors
}

// ─── Tech stack ─────────────────────────────────────────────────────────────

export const TECH_STACK_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'groups'],
  properties: {
    summary: { type: 'string' },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'items'],
        properties: {
          name: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['dep', 'role'],
              properties: { dep: { type: 'string' }, role: { type: 'string' } }
            }
          }
        }
      }
    }
  }
}

export const MAX_STACK_GROUPS = 6

/**
 * The model groups and explains the stack, but the dependency names come from
 * the manifests: it may only place packages that are really declared, and may
 * not list the same one twice.
 */
export function validateTechStack(value: unknown, declared: Set<string>): string[] {
  const root = asObject(value)
  if (!root) return ['The response must be a JSON object.']
  const errors: string[] = []
  if (!nonEmptyString(root.summary)) errors.push('"summary" must be a sentence or two about the stack.')
  if (!Array.isArray(root.groups)) return [...errors, '"groups" must be an array.']
  if (root.groups.length > MAX_STACK_GROUPS) {
    errors.push(`"groups" must have at most ${MAX_STACK_GROUPS} entries, not ${root.groups.length}.`)
  }

  const seen = new Set<string>()
  root.groups.forEach((raw: unknown, i) => {
    const group = asObject(raw)
    const at = `groups[${i}]`
    if (!group) {
      errors.push(`${at} must be an object.`)
      return
    }
    if (!nonEmptyString(group.name)) errors.push(`${at}.name must be a short category, e.g. "UI" or "Build".`)
    if (!Array.isArray(group.items)) {
      errors.push(`${at}.items must be an array.`)
      return
    }
    group.items.forEach((rawItem: unknown, j) => {
      const item = asObject(rawItem)
      const where = `${at}.items[${j}]`
      if (!item) {
        errors.push(`${where} must be an object.`)
        return
      }
      if (typeof item.dep !== 'string' || !declared.has(item.dep)) {
        errors.push(`${where}.dep ${JSON.stringify(item.dep ?? null)} is not a dependency this project declares. Use only names from the list.`)
      } else if (seen.has(item.dep)) {
        errors.push(`${where}.dep "${item.dep}" appears twice — list each dependency once.`)
      } else {
        seen.add(item.dep)
      }
      if (!nonEmptyString(item.role)) errors.push(`${where}.role must say what it is used for, in a few words.`)
    })
  })
  return errors
}

// ─── Rendering ──────────────────────────────────────────────────────────────

/**
 * Renders a page to Markdown. The model supplies prose and file names; every
 * heading, bullet and citation is written here, so a page can never contain a
 * link or path the app did not resolve itself.
 */
export function renderWikiPage(page: WikiPage): string {
  const out: string[] = [`# ${page.title}`, '', page.summary, '']
  for (const section of page.sections) {
    out.push(`## ${section.heading}`, '')
    for (const claim of section.claims) {
      const cites = claim.sourcePaths.map((p) => `\`${p}\``).join(', ')
      out.push(`- ${claim.text}${cites ? ` — ${cites}` : ''}`)
    }
    out.push('')
  }
  return out.join('\n').trim() + '\n'
}

/** Where an exported wiki lands in the repo. */
export const WIKI_EXPORT_DIR = 'docs/wiki'

/**
 * The wiki as files to write into the repo: one Markdown page each plus an
 * index. Pure, so what lands on disk is decided (and tested) here rather than
 * inside the writing.
 */
export function wikiExportFiles(
  wiki: RepoWiki,
  repoName: string,
  dir = WIKI_EXPORT_DIR
): { path: string; content: string }[] {
  const stamp = new Date(wiki.generatedAt).toISOString().slice(0, 10)
  const note = `<!-- Generated by ${PRODUCT_NAME} from ${wiki.headSha.slice(0, 7) || 'the working tree'} on ${stamp}. Regenerate rather than editing by hand. -->`

  const index = [
    `# ${repoName} wiki`,
    '',
    note,
    '',
    ...wiki.pages.map((page) => `- [${page.title}](${page.slug}.md) — ${page.summary}`),
    '',
    // The stack's grouping is not prose, so it rides along as data: without it a
    // wiki read back from the folder would lose the overview's stack.
    ...(wiki.stack ? [`<!-- wiki-stack: ${stackComment(wiki.stack)} -->`, ''] : [])
  ].join('\n')

  const pages = wiki.pages.map((page) => {
    const related = page.related
      .map((slug) => wiki.pages.find((p) => p.slug === slug))
      .filter((p): p is WikiPage => !!p)
    const tail = related.length
      ? ['', '## See also', '', ...related.map((p) => `- [${p.title}](${p.slug}.md)`), '']
      : []
    return {
      path: `${dir}/${page.slug}.md`,
      // The archetype is not in the Markdown itself; without it a wiki read back
      // from the folder would lose its page icons and its overview.
      content: [note, `<!-- archetype: ${page.archetype} -->`, '', page.markdown.trimEnd(), ...tail, '', INDEX_LINK, '']
        .join('\n')
    }
  })

  return [{ path: `${dir}/README.md`, content: index }, ...pages]
}

const INDEX_LINK = '[← Index](README.md)'

/** JSON that can sit inside an HTML comment: `--` would end it early, and only occurs inside strings. */
function stackComment(stack: TechStack): string {
  return JSON.stringify(stack).replace(/--/g, '-\\u002d')
}

/** The stack the index carries, or null when absent or not the shape the UI reads. */
function parseStackComment(index: string): TechStack | null {
  const raw = /<!-- wiki-stack: (.*?) -->/.exec(index)?.[1]
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    const stack = asObject(value)
    if (!stack || typeof stack.summary !== 'string' || !Array.isArray(stack.groups)) return null
    const groups = stack.groups.flatMap((g) => {
      const group = asObject(g)
      if (!group || typeof group.name !== 'string' || !Array.isArray(group.items)) return []
      const items = group.items.flatMap((i) => {
        const item = asObject(i)
        return item && typeof item.dep === 'string' && typeof item.role === 'string'
          ? [{ dep: item.dep, role: item.role }]
          : []
      })
      return [{ name: group.name, items }]
    })
    return { summary: stack.summary, groups }
  } catch {
    return null // edited by hand into something else: the pages still read
  }
}

/**
 * True for a file the export wrote: the only kind read back as a page, and the
 * only kind deleting a read-back wiki may remove. Any product name, so an export
 * from before the app was renamed still counts.
 */
export function isExportedWikiFile(content: string): boolean {
  return /<!-- Generated by \S+ from \S+(?: \S+){0,2} on \d{4}-\d{2}-\d{2}\./.test(content)
}

/**
 * A wiki folder chosen by the user, as a path relative to the repo, or null when
 * it is not one the export may write into: outside the repo, the repo root
 * (its README.md is the project's own), or inside `.git`.
 */
export function normalizeWikiDir(dir: string): string | null {
  const clean = dir
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.')
    .join('/')
  if (!clean || !isSafeRepoPath(clean)) return null
  if (clean.split('/')[0] === '.git') return null
  return clean
}

/** One exported page back into a WikiPage. Hand edits survive in `markdown`; claims are read where they still parse. */
function parseExportedPage(slug: string, content: string): { page: WikiPage; sha: string; date: string } | null {
  // "from the working tree" when the repo had no commit yet: then there is no sha.
  const note = /Generated by \S+ from (.+?) on (\d{4}-\d{2}-\d{2})/.exec(content)
  const sha = note && /^[0-9a-f]{4,40}$/.test(note[1]) ? note[1] : ''
  const declared = /<!-- archetype: (\w+) -->/.exec(content)?.[1] as WikiArchetype | undefined
  // Only the export's own comments go; one a person added is part of the page
  // and must survive a re-export.
  let body = content
    .replace(/<!-- Generated by [^\n]*?-->\n?/g, '')
    .replace(/<!-- archetype: \w+ -->\n?/g, '')
    .trim()
  if (body.endsWith(INDEX_LINK)) body = body.slice(0, -INDEX_LINK.length).trim()

  // "See also" is the export's rendering of `related` — its heading and its
  // links. Anything written after that list stays with the page.
  const related: string[] = []
  const seeAlso = body.search(/^## See also\s*$/m)
  if (seeAlso >= 0) {
    const after = body.slice(seeAlso).split('\n').slice(1)
    let i = 0
    for (; i < after.length; i++) {
      const link = /^- \[[^\]]*\]\(([\w-]+)\.md\)\s*$/.exec(after[i])
      if (link) related.push(link[1])
      else if (after[i].trim()) break
    }
    body = [body.slice(0, seeAlso).trim(), after.slice(i).join('\n').trim()].filter(Boolean).join('\n\n')
  }

  const lines = body.split('\n')
  const titleLine = lines.findIndex((l) => l.startsWith('# '))
  if (titleLine < 0) return null
  const title = lines[titleLine].slice(2).trim()
  const sections: WikiPage['sections'] = []
  const summary: string[] = []
  for (const line of lines.slice(titleLine + 1)) {
    if (line.startsWith('## ')) {
      sections.push({ heading: line.slice(3).trim(), claims: [] })
      continue
    }
    const current = sections[sections.length - 1]
    if (!current) {
      if (line.trim()) summary.push(line.trim())
      continue
    }
    const claim = /^- (.*?)(?: — ((?:`[^`]+`(?:, )?)+))?$/.exec(line)
    if (claim) {
      // The folder is the repo's content, so a cloned repo writes these: a
      // source is opened from disk, and must not point outside the repo.
      const sourcePaths = [...(claim[2] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter(isSafeRepoPath)
      current.claims.push({ text: claim[1], sourcePaths })
    }
  }

  const archetype =
    declared && ARCHETYPES.has(declared) ? declared : slug === 'overview' ? 'overview' : 'module'
  return {
    page: { slug, title, archetype, summary: summary.join(' '), sections, related, markdown: body + '\n' },
    sha,
    date: note?.[2] ?? ''
  }
}

/**
 * Reads back a wiki the export wrote into the repo — someone else's, or this
 * machine's from before its stored copy was lost. Pages follow the index's
 * order; a page the index lists but the folder lacks is skipped. Null when the
 * folder holds nothing that looks like an exported wiki.
 */
export function parseExportedWiki(files: { name: string; content: string }[], dir: string): RepoWiki | null {
  const bySlug = new Map(
    files
      // The team's own notes can share the folder; only what the export wrote is a page.
      .filter((f) => f.name.endsWith('.md') && f.name !== 'README.md' && isExportedWikiFile(f.content))
      .map((f) => [f.name.slice(0, -3), f.content])
  )
  const index = files.find((f) => f.name === 'README.md')?.content ?? ''
  const listed = [...index.matchAll(/^- \[[^\]]*\]\(([\w-]+)\.md\)/gm)].map((m) => m[1])
  const order = [...new Set([...listed.filter((s) => bySlug.has(s)), ...[...bySlug.keys()].sort()])]

  const parsed = order
    .map((slug) => parseExportedPage(slug, bySlug.get(slug) ?? ''))
    .filter((p): p is NonNullable<typeof p> => p !== null)
  if (parsed.length === 0) return null
  const slugs = new Set(parsed.map((p) => p.page.slug))
  const first = parsed.find((p) => p.sha) ?? parsed[0]
  const generatedAt = first.date ? Date.parse(`${first.date}T00:00:00Z`) : 0
  return {
    headSha: first.sha,
    generatedAt: Number.isNaN(generatedAt) ? 0 : generatedAt,
    model: '',
    promptVersion: '',
    pages: parsed.map(({ page }) => ({ ...page, related: page.related.filter((s) => slugs.has(s)) })),
    stack: parseStackComment(index),
    importedFrom: dir
  }
}

/** Every file a page cites, deduplicated, for the "sources" list in the UI. */
export function pageSources(page: WikiPage): string[] {
  const paths = new Set<string>()
  for (const section of page.sections) {
    for (const claim of section.claims) {
      for (const path of claim.sourcePaths) paths.add(path)
    }
  }
  return [...paths].sort()
}

// ─── Freshness ──────────────────────────────────────────────────────────────

export type WikiFreshness = 'current' | 'behind' | 'outdated'

/**
 * Whether a stored wiki still describes the repo: 'behind' when the repo moved
 * on since it was written, 'outdated' when this build would generate it
 * differently (prompt or model changed).
 */
export function wikiFreshness(
  wiki: { headSha: string; promptVersion: string; model: string; importedFrom?: string } | null,
  current: { headSha: string; model: string }
): WikiFreshness {
  if (!wiki) return 'outdated'
  // Read back from the folder: neither model nor prompt is known, and the note
  // carries an abbreviated sha — the commit is all there is to compare.
  if (wiki.importedFrom !== undefined) {
    return wiki.headSha && current.headSha.startsWith(wiki.headSha) ? 'current' : 'behind'
  }
  if (wiki.promptVersion !== WIKI_PROMPT_VERSION || wiki.model !== current.model) return 'outdated'
  return wiki.headSha === current.headSha ? 'current' : 'behind'
}

const REDUNDANT_TAIL = /\s+(module|page|overview|reference|workflow|section)$/i

/**
 * Drops the archetype from a title. The kind of page is already shown by its
 * icon, so "Database module" reads as "Database" — unless that is all the title
 * was, as with a page genuinely called "Overview".
 */
export function cleanPageTitle(title: string): string {
  const trimmed = title.trim()
  const stripped = trimmed.replace(REDUNDANT_TAIL, '').trim()
  return stripped.length >= 2 ? stripped : trimmed
}

/** Plans arrive ordered by the model; the overview always reads first. */
export function orderPlan(pages: WikiPagePlan[]): WikiPagePlan[] {
  return [...pages].sort((a, b) => {
    if (a.archetype === 'overview') return -1
    if (b.archetype === 'overview') return 1
    return a.title.localeCompare(b.title)
  })
}

export type { WikiPlan }
