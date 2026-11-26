#!/usr/bin/env node
/**
 * Static site generator for GitHuttBr's GitHub Pages.
 *
 * Two outputs from one source of truth:
 *   - a landing page, whose feature copy is the same one the README carries;
 *   - the whole handbook (`docs/help/*.md`), the same Markdown the app renders
 *     offline and GitHub renders in the repository.
 *
 * No framework, no client-side router, no build step beyond this file — a
 * marketing page that needs `npm install` to fix a typo is a page nobody fixes.
 *
 *   node scripts/build-site.mjs          # → dist-site/
 *   node scripts/build-site.mjs --serve  # …and print how to preview it
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { LOCALE_NAMES, RTL_LOCALES, SITE, coverage, strings } from './site-i18n/index.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HELP_DIR = join(ROOT, 'docs/help')
const SHOTS_DIR = join(ROOT, 'docs/screenshots')
const OUT = join(ROOT, 'dist-site')

const REPO = 'StarleyDev/githuttbr'
// Served by Cloudflare Pages on the project's own domain. Canonical and hreflang
// URLs, and the share card, are absolute, so they follow this constant.
const SITE_URL = 'https://git.huttbr.com'
// The project GitHuttBr was derived from, credited in the footer (NOTICE).
const UPSTREAM_REPO = 'MyAppDesk/gitcito' // upstream-name: attribution credit
const UPSTREAM_NAME = 'Gitcito' // upstream-name: attribution credit
const RELEASES = `https://github.com/${REPO}/releases`
const LATEST = `${RELEASES}/latest`
const SPONSOR = 'https://github.com/sponsors/StarleyDev'
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

marked.setOptions({ gfm: true, breaks: false })

// The README and the roadmap stay English on purpose: they duplicate what the
// handbook already says in sixteen languages, and translated copies of them
// would rot silently — nothing in the gate reads them.
const ROADMAP_URL = `https://github.com/${REPO}/blob/main/ROADMAP.md`

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ── Handbook ────────────────────────────────────────────────────────────────

/** Flat `key: value` front matter — the same shape the app parses. */
function parsePage(file) {
  const src = readFileSync(join(HELP_DIR, file), 'utf8')
  // `file` may be `absorb.md` or `es/absorb.md`; the id is the basename either way.
  const id = (file.split('/').pop() ?? file).replace(/\.md$/, '')
  if (!src.startsWith('---')) return { id, title: id, category: 'Guide', order: 999, summary: '', body: src }
  const end = src.indexOf('\n---', 3)
  const meta = {}
  for (const line of src.slice(3, end).split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    meta[line.slice(0, colon).trim()] = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return {
    id,
    title: meta.title ?? id,
    category: meta.category ?? 'Guide',
    order: Number(meta.order ?? 999),
    summary: meta.summary ?? '',
    keywords: meta.keywords ?? '',
    body: src.slice(end + 4).replace(/^\n+/, '')
  }
}

const pages = readdirSync(HELP_DIR)
  .filter((f) => f.endsWith('.md'))
  .map(parsePage)
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

const sections = []
for (const page of pages) {
  const found = sections.find((s) => s.category === page.category)
  if (found) found.pages.push(page)
  else sections.push({ category: page.category, pages: [page] })
}

/**
 * Rewrite in-repo links so they resolve on the site instead of on GitHub.
 *
 * `depth` is how deep the page sits under the site root: 1 for the English
 * handbook (`help/x.html`), 2 for a translation (`help/es/x.html`), which is
 * also why the Markdown's own image path differs by one `../`.
 */
function siteLinks(markdown, depth = 1) {
  const assets = `${'../'.repeat(depth)}assets/`
  return markdown
    .replace(/\]\(([\w-]+)\.md\)/g, '](./$1.html)')
    .replace(/\]\(\.\.\/(?:\.\.\/)?screenshots\/([\w.-]+)\)/g, `](${assets}$1)`)
}

// ── Translated handbooks ────────────────────────────────────────────────────

/** locale → its pages, merged over English so a partial translation still works. */
const localeSets = new Map()
const localeCoverage = new Map()
for (const entry of readdirSync(HELP_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const locale = entry.name
  const translated = new Map()
  for (const file of readdirSync(join(HELP_DIR, locale)).filter((f) => f.endsWith('.md'))) {
    const page = parsePage(join(locale, file))
    translated.set(page.id, page)
  }
  if (!translated.size) continue
  // English order wins so every language's sidebar keeps one shape.
  localeSets.set(
    locale,
    pages.map((en) => {
      const local = translated.get(en.id)
      return local ? { ...local, id: en.id, order: en.order } : en
    })
  )
  // Tracked separately from the merged set: every locale renders all 61 pages
  // because untranslated ones fall back, so the merged count would report a
  // half-finished language as complete.
  localeCoverage.set(locale, translated.size)
}

const siteLocales = ['en', ...[...localeSets.keys()].sort()]

/** Sections for a given locale's page set. */
function sectionsOf(pageList) {
  const out = []
  for (const page of pageList) {
    const found = out.find((s) => s.category === page.category)
    if (found) found.pages.push(page)
    else out.push({ category: page.category, pages: [page] })
  }
  return out
}

/** `<link rel="alternate" hreflang>` for the landing page, in every language. */
function alternatesForHome() {
  if (siteLocales.length < 2) return ''
  const url = (loc) => `${SITE_URL}/${loc === 'en' ? '' : `${loc}/`}`
  return (
    siteLocales.map((loc) => `<link rel="alternate" hreflang="${loc}" href="${url(loc)}" />`).join('\n') +
    `\n<link rel="alternate" hreflang="x-default" href="${url('en')}" />\n`
  )
}

/** `<link rel="alternate" hreflang>` for one page id, in every language. */
function alternatesFor(id) {
  if (siteLocales.length < 2) return ''
  const url = (loc) => `${SITE_URL}/help/${loc === 'en' ? '' : `${loc}/`}${id}.html`
  return (
    siteLocales.map((loc) => `<link rel="alternate" hreflang="${loc}" href="${url(loc)}" />`).join('\n') +
    `\n<link rel="alternate" hreflang="x-default" href="${url('en')}" />\n`
  )
}

// ── Shared chrome ───────────────────────────────────────────────────────────

const head = (title, description, depth, opts = {}) => {
  const base = '../'.repeat(depth)
  const { lang = 'en', dir = 'ltr', alternates = '', bodyClass = '' } = opts
  // The landing page is always dark — it is the app's own look, the one the
  // screenshots are taken in. The handbook follows the reader's system theme.
  const dark = bodyClass === 'home'
  const theme = dark
    ? '<meta name="color-scheme" content="dark" />\n<meta name="theme-color" content="#0d1020" />'
    : '<meta name="color-scheme" content="light dark" />\n' +
      '<meta name="theme-color" content="#fafafc" media="(prefers-color-scheme: light)" />\n' +
      '<meta name="theme-color" content="#0d1020" media="(prefers-color-scheme: dark)" />'
  return `<!doctype html>
<html lang="${lang}" dir="${dir}"${dark ? ' class="dark"' : ''}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${SITE_URL}/assets/og-image.jpg" />
${theme}
<link rel="icon" href="${base}assets/githuttbr-mark.png" />
<link rel="stylesheet" href="${base}styles.css" />
${alternates}</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>`
}

/**
 * `depth` is how deep the page sits under the site root, `home` the locale's
 * own root — an English reader clicking the logo should not land in Japanese,
 * and a Japanese reader should not land in English.
 */
const nav = (depth, locale = 'en', extra = '') => {
  const base = '../'.repeat(depth)
  const t = strings(locale)
  const home = locale === 'en' ? `${base}index.html` : `${base}${locale}/index.html`
  const handbook =
    locale === 'en' ? `${base}help/getting-started.html` : `${base}help/${locale}/getting-started.html`
  // Roadmap, GitHub and Sponsor fold away on a phone (`.nav-extra`): the footer
  // carries all three, and a wrapped nav bar is worse than a short one.
  return `<header class="nav">
  <div class="nav-inner">
    <a class="brand" href="${home}">
      <img src="${base}assets/githuttbr-mark.png" alt="" width="28" height="28" />
      <span>GitHuttBr</span>
    </a>
    <nav>
      <a href="${handbook}">${t('nav.handbook')}</a>
      <a class="nav-extra" href="${ROADMAP_URL}">${t('nav.roadmap')}</a>
      <a class="nav-extra" href="https://github.com/${REPO}">${t('nav.github')}</a>
      <a class="nav-extra" href="${SPONSOR}">${t('nav.sponsor')}</a>
${extra}
      <a class="btn small primary" href="${LATEST}">${t('nav.download')}</a>
    </nav>
  </div>
</header>`
}

/** `languages` is the landing page's endonym list; handbook pages have their own in the sidebar. */
const footer = (locale = 'en', languages = '', depth = 0) => {
  const t = strings(locale)
  const base = '../'.repeat(depth)
  const langs = languages ? `\n  <nav class="lang-bar wrap">\n${languages}\n  </nav>` : ''
  return `<footer class="foot">${langs}
  <div class="foot-inner wrap">
    <p class="foot-brand"><img src="${base}assets/githuttbr-mark.png" alt="" width="20" height="20" /> <span>${t('foot.license')}</span></p>
    <p class="foot-credit">${t('foot.credit').replace('{upstream}', `<a href="https://github.com/${UPSTREAM_REPO}">${UPSTREAM_NAME}</a>`)}</p>
    <nav class="foot-links">
      <a href="https://github.com/${REPO}">${t('foot.source')}</a>
      <a href="${ROADMAP_URL}">${t('foot.roadmap')}</a>
      <a href="https://github.com/${REPO}/issues/new">${t('foot.reportIssue')}</a>
      <a href="${SPONSOR}">${t('foot.sponsor')}</a>
    </nav>
  </div>
</footer>
</body>
</html>`
}

// ── Images ──────────────────────────────────────────────────────────────────

const sizes = new Map()

/**
 * Pixel size of a screenshot, read from its WebP header, so every <img> can
 * carry width/height and the page does not jump as images arrive. Null for
 * anything that is not a WebP we can read — the image still renders.
 */
function imageSize(name) {
  if (sizes.has(name)) return sizes.get(name)
  let size = null
  try {
    const b = readFileSync(join(SHOTS_DIR, name))
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const kind = b.toString('ascii', 12, 16)
      if (kind === 'VP8 ') size = { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
      else if (kind === 'VP8L') {
        const bits = b.readUInt32LE(21)
        size = { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }
      } else if (kind === 'VP8X') size = { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 }
    }
  } catch {
    size = null
  }
  sizes.set(name, size)
  return size
}

const dims = (name) => {
  const s = imageSize(name)
  return s ? ` width="${s.w}" height="${s.h}"` : ''
}

/**
 * Polish the HTML `marked` produces: screenshots get their size and load lazily,
 * and tables sit in a scroller so a wide one cannot push a phone sideways.
 */
function enhanceProse(html) {
  return html
    .replace(/<img src="([^"]*\/assets\/([\w.-]+))"/g, (_, src, name) => `<img src="${src}"${dims(name)} loading="lazy" decoding="async"`)
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>')
}

// ── Landing ─────────────────────────────────────────────────────────────────

// The showcase: the features big enough for a row of their own, each beside its
// screenshot. Title and body are the same `feature.<id>.*` copy the cards use, and
// each id is the handbook page the row links to.
const SHOWCASE = [
  { id: 'conflict-radar', shot: 'conflict-radar.webp' },
  { id: 'semantic-diff', shot: 'semantic-diff.webp' },
  { id: 'time-machine', shot: 'clip-time-machine.webp' },
  { id: 'hosting', shot: 'pull-request-page.webp' },
  { id: 'mission-control', shot: 'mission-control.webp' }
]

// The landing page's smaller cards, in display order — what the showcase above
// does not already cover. Each id is a handbook page; the card's title and body
// live in `site-i18n/` as `feature.<id>.*`.
const FEATURES = [
  { icon: '🛡️', id: 'recovery' },
  { icon: '✏️', id: 'commit-edit' },
  { icon: '🧲', id: 'absorb' },
  { icon: '🔁', id: 'range-diff' },
  { icon: '👀', id: 'pr-preview' },
  { icon: '🎞️', id: 'timelapse' },
  { icon: '📎', id: 'attributes' },
  { icon: '⌨️', id: 'cli' },
  { icon: '🌍', id: 'languages' }
]

// Hosts by their own names. `beta` marks the ones tested only against simulated
// servers — the same three the README's disclaimer names.
const HOSTS = [
  { name: 'GitHub' },
  { name: 'GitLab' },
  { name: 'Forgejo · Gitea · Codeberg' },
  { name: 'Azure DevOps' },
  { name: 'Bitbucket' },
  { name: 'GitHub Enterprise Server', beta: true },
  { name: 'GitLab self-managed', beta: true },
  { name: 'Bitbucket Data Center', beta: true }
]

const AI_PROVIDERS = ['OpenAI', 'Anthropic', 'Gemini', 'OpenRouter', 'Groq', 'Mistral', 'Ollama']

// One card per platform. `asset` is a fragment of the installer's file name in
// the latest release (the names carry the version, so they cannot be written
// here); the inline script swaps each link for the real file. Until it runs, or
// if GitHub's API does not answer, every button leads to the release page.
// Button labels are product and format names; only the notes beside them are copy.
const DOWNLOADS = [
  {
    os: 'mac',
    name: 'macOS',
    icon: 'apple',
    noteKey: 'download.macNote',
    hintKey: 'download.macHint',
    files: [
      { label: 'Apple silicon', ext: '.dmg', asset: 'arm64.dmg' },
      { label: 'Intel', ext: '.dmg', asset: 'x64.dmg', ghost: true }
    ]
  },
  {
    os: 'win',
    name: 'Windows',
    icon: 'windows',
    noteKey: 'download.autoUpdate',
    files: [{ labelKey: 'download.winNote', ext: '.exe', asset: 'Setup' }]
  },
  {
    os: 'linux',
    name: 'Linux',
    icon: 'linux',
    noteKey: 'download.linuxNote',
    hintKey: 'download.autoUpdate',
    files: [
      { label: 'AppImage', ext: 'x86_64', asset: '.AppImage' },
      { label: 'Debian / Ubuntu', ext: '.deb', asset: '.deb', ghost: true }
    ]
  }
]

// Inline SVG so the page needs no icon font and no request for one.
const ICONS = {
  github:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></svg>',
  apple:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.79-3.33-1.81-1.42-.14-2.77.84-3.5.84-.72 0-1.83-.82-3.01-.8-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.6-.75 3-.75s1.79.75 3.01.73c1.25-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.45-3.71ZM14.06 5.84c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.78-.97 2.83 1.02.08 2.07-.52 2.71-1.29Z"/></svg>',
  windows:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5.1 10.4 4v7.2H3V5.1Zm0 13.8L10.4 20v-7.1H3v6Zm8.3 1.2L21 21.5v-8.6h-9.7v7.2Zm0-16.2v7.3H21V2.5l-9.7 1.4Z"/></svg>',
  linux:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.5 2c-2.3 0-3.6 1.9-3.6 4.4 0 1.3.3 2.2-.4 3.4-.9 1.4-2.8 3.6-2.9 6.4-.1.8 0 1.5.3 2.1-.7.5-1.6.9-1.5 1.7.1.9 1.6.7 2.6 1.2 1 .4 1.8.9 2.6.6.6-.2.9-.7 1-1.2.7.1 1.5.1 2.3.1s1.6 0 2.3-.1c.2.6.6 1 1.2 1.2.8.2 1.6-.3 2.5-.8.9-.4 2.3-.4 2.4-1.2.1-.7-.6-1.1-1.2-1.6.4-.7.5-1.5.4-2.4-.3-2.6-2.1-4.5-2.9-5.9-.7-1.2-.4-2.1-.4-3.4C15.9 3.9 14.8 2 12.5 2Z"/></svg>'
}

// A feature card shows the handbook page's own screenshot. The file is named
// after the page id, bar the one case where the page covers more than its shot.
const CARD_SHOT = { recovery: 'snapshots', cli: 'cli-edit' }

/** The card's screenshot, or null when there is none to show. */
function cardShot(id) {
  const name = `${CARD_SHOT[id] ?? id}.webp`
  return existsSync(join(SHOTS_DIR, name)) ? name : null
}

/** The language menu in the landing page's header: every locale, by its own name. */
function languageMenu(locale, base) {
  const t = strings(locale)
  const links = siteLocales
    .map((loc) => {
      const href = loc === 'en' ? `${base}index.html` : `${base}${loc}/index.html`
      const current = loc === locale ? ' aria-current="true"' : ''
      return `          <a${current} href="${href}" lang="${loc}" hreflang="${loc}">${esc(LOCALE_NAMES[loc] ?? loc)}</a>`
    })
    .join('\n')
  // The summary shows the language code rather than its name: sixteen endonyms
  // differ wildly in width, and the header has no room to spare on a phone.
  return `    <details class="nav-lang">
      <summary aria-label="${esc(t('nav.language'))}" title="${esc(t('nav.language'))}">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
        <span>${esc(locale.split('-')[0].toUpperCase())}</span>
      </summary>
      <div class="nav-lang-list">
${links}
      </div>
    </details>`
}

function landing(locale = 'en') {
  const t = strings(locale)
  const forOs = t('download.forOs').split('{os}')
  const depth = locale === 'en' ? 0 : 1
  const base = '../'.repeat(depth)
  // The handbook a link points at is the one in the reader's language.
  const helpDir = locale === 'en' ? `${base}help/` : `${base}help/${locale}/`
  const pageList = locale === 'en' ? pages : (localeSets.get(locale) ?? pages)

  const img = (name, alt, extra = 'loading="lazy" decoding="async"') =>
    `<img src="${base}assets/${name}"${dims(name)} alt="${esc(alt)}" ${extra} />`

  // The counts are read from the build, never typed: a hand-written number is a
  // fact nobody remembers to update (see the docs test that forbids them).
  const stats = [
    [3, 'stat.platforms'],
    [siteLocales.length, 'stat.languages'],
    [pages.length, 'stat.pages'],
    [0, 'stat.servers']
  ]
    .map(([n, key]) => `        <div class="stat"><b>${n}</b><span>${t(key)}</span></div>`)
    .join('\n')

  const showcase = SHOWCASE.map(
    (s, i) => `      <div class="feature${i % 2 ? ' flip' : ''} reveal">
        <div class="feature-copy">
          <h3>${t(`feature.${s.id}.title`)}</h3>
          <p>${t(`feature.${s.id}.body`)}</p>
          <a class="more" href="${helpDir}${s.id}.html">${t('showcase.more')}</a>
        </div>
        <figure class="shot">${img(s.shot, t(`feature.${s.id}.title`))}</figure>
      </div>`
  ).join('\n')

  const cards = FEATURES.map((f) => {
    const shot = cardShot(f.id)
    const title = t(`feature.${f.id}.title`)
    // The title's link stretches over the whole card (see `.card h3 a::after`),
    // so the screenshot needs no second link to the same page.
    const figure = shot ? `\n      <div class="card-shot">${img(shot, title)}</div>` : ''
    return `    <article class="card reveal">${figure}
      <div class="card-body">
        <span class="card-icon" aria-hidden="true">${f.icon}</span>
        <h3><a href="${helpDir}${f.id}.html">${title}</a></h3>
        <p>${t(`feature.${f.id}.body`)}</p>
      </div>
    </article>`
  }).join('\n')

  const hosts = HOSTS.map(
    (h) => `        <span class="chip">${esc(h.name)}${h.beta ? `<small>${t('hosts.beta')}</small>` : ''}</span>`
  ).join('\n')

  const providers = [...AI_PROVIDERS.map(esc), t('ai.compatible')]
    .map((p) => `<span>${p}</span>`)
    .join('')

  const checks = ['keychain', 'server', 'plain', 'confirm']
    .map(
      (k) => `        <li>${ICONS.check}<div><b>${t(`sec.${k}.title`)}</b><span>${t(`sec.${k}.body`)}</span></div></li>`
    )
    .join('\n')

  const downloads = DOWNLOADS.map((d) => {
    const files = d.files
      .map(
        (f) =>
          `          <a class="btn ${f.ghost ? 'ghost' : 'primary'} dl-file" href="${LATEST}" data-asset="${f.asset}">` +
          `${f.labelKey ? t(f.labelKey) : esc(f.label)} <small>${esc(f.ext)}</small></a>`
      )
      .join('\n')
    return `      <div class="dl" data-os="${d.os}" data-badge="${esc(t('download.yours'))}">
        <div class="dl-os">${ICONS[d.icon]}<h3>${d.name}</h3></div>
        <p>${t(d.noteKey)}</p>
        <div class="dl-files">
${files}
        </div>${d.hintKey ? `\n        <p class="dl-hint">${t(d.hintKey)}</p>` : ''}
      </div>`
  }).join('\n')

  const handbook = sectionsOf(pageList)
    .map(
      (s) => `      <div class="hb-col">
        <h3>${esc(s.category)}</h3>
        ${s.pages.map((p) => `<a href="${helpDir}${p.id}.html">${esc(p.title)}</a>`).join('\n        ')}
      </div>`
    )
    .join('\n')

  const ordinary = (keys) => keys.map((k) => `        <li>${t(`ordinary.${k}`)}</li>`).join('\n')

  const switcher = siteLocales
    .map((loc) => {
      const href = loc === 'en' ? `${base}index.html` : `${base}${loc}/index.html`
      const current = loc === locale ? ' aria-current="true"' : ''
      return `      <a${current} href="${href}" lang="${loc}">${esc(LOCALE_NAMES[loc] ?? loc)}</a>`
    })
    .join('\n')

  return `${head(t('meta.title'), t('meta.description'), depth, {
    lang: locale,
    dir: RTL_LOCALES.has(locale) ? 'rtl' : 'ltr',
    alternates: alternatesForHome(),
    bodyClass: 'home'
  })}
<script>document.documentElement.classList.add('js')</script>
${nav(depth, locale, languageMenu(locale, base))}
<main>
  <section class="hero">
    <div class="wrap hero-copy">
      <img class="hero-mascot" src="${base}assets/githuttbr-mark.png" alt="" width="148" height="148" />
      <p class="pill"><span class="dot" aria-hidden="true"></span>${t('hero.terms', { version: pkg.version })}</p>
      <h1>${t('hero.title')}</h1>
      <p class="lede">${t('hero.lede')}</p>
      <div class="cta">
        <a class="btn primary large" href="${LATEST}" id="download">${ICONS.download}<span>${t('hero.download')}</span></a>
        <a class="btn ghost large" href="https://github.com/${REPO}">${ICONS.github}<span>${t('hero.source')}</span></a>
      </div>
    </div>
    <figure class="window hero-shot reveal">
      <div class="window-bar" aria-hidden="true"><i></i><i></i><i></i><span>GitHuttBr — octopus-merge · main</span></div>
      ${img('graph-dark.webp', t('hero.graphAlt'), 'fetchpriority="high" decoding="async"')}
    </figure>
    <div class="wrap">
      <div class="stats reveal">
${stats}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <header class="section-head">
        <h2>${t('ordinary.title')}</h2>
        <p class="sub">${t('ordinary.sub')}</p>
      </header>
      <div class="two">
        <ul class="ticks">
${ordinary(['graph', 'staging', 'conflicts', 'rebase', 'stacks', 'recovery'])}
        </ul>
        <ul class="ticks">
${ordinary(['prs', 'terminal', 'launch', 'ai', 'themes', 'languages'])}
        </ul>
      </div>
    </div>
  </section>

  <section class="section alt">
    <div class="wrap">
      <header class="section-head">
        <h2>${t('features.title')}</h2>
        <p class="sub">${t('features.sub')}</p>
      </header>
${showcase}
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <header class="section-head center">
        <h2>${t('more.title')}</h2>
      </header>
      <div class="grid">
${cards}
      </div>
      <header class="section-head center hosts-head">
        <h2>${t('hosts.title')}</h2>
      </header>
      <div class="chips reveal">
${hosts}
      </div>
    </div>
  </section>

  <section class="section alt">
    <div class="wrap split">
      <div>
        <h2 class="split-title">${t('feature.repo-chat.title')}</h2>
        <p class="sub">${t('feature.repo-chat.body')}</p>
        <p class="sub">${t('feature.ai.body')}</p>
        <div class="providers">${providers}</div>
        <a class="more" href="${helpDir}repo-chat.html">${t('showcase.more')}</a>
      </div>
      <figure class="shot reveal">${img('repo-chat.webp', t('feature.repo-chat.title'))}</figure>
    </div>
  </section>

  <section class="section">
    <div class="wrap split">
      <div>
        <h2 class="split-title">${t('feature.security.title')}</h2>
        <p class="sub">${t('feature.security.body')}</p>
        <pre class="terminal reveal" dir="ltr"><span>$</span> githuttbr .
<span>$</span> githuttbr ~/code/api -n "API"
<span>$</span> githuttbr blame src/api.ts -l 84
<span>$</span> githuttbr doctor</pre>
        <a class="more" href="${helpDir}security.html">${t('showcase.more')}</a>
      </div>
      <ul class="checks">
${checks}
      </ul>
    </div>
  </section>

  <section class="section alt">
    <div class="wrap split middle">
      <figure class="shot reveal">${img('clip-themes.webp', t('themes.title'))}</figure>
      <div>
        <h2 class="split-title">${t('themes.title')}</h2>
        <p class="sub">${t('themes.body')}</p>
      </div>
    </div>
  </section>

  <section class="section" id="get">
    <div class="wrap">
      <div class="honest reveal">
        <img src="${base}assets/githuttbr-mark.png" alt="" width="52" height="52" />
        <div>
          <h3>${t('honest.title')}</h3>
          <p>${t('honest.body')}</p>
        </div>
      </div>
      <header class="section-head center">
        <h2>${t('download.title')}</h2>
        <p class="sub">${t('download.sub', { version: pkg.version })}</p>
      </header>
      <div class="downloads">
${downloads}
      </div>
      <p class="sub small center">${t('download.cli', { cli: `${helpDir}cli.html` })}</p>
    </div>
  </section>

  <section class="section alt">
    <div class="wrap">
      <header class="section-head">
        <h2>${t('handbook.title', { pages: pages.length })}</h2>
        <p class="sub">${t('handbook.sub')}</p>
      </header>
      <div class="handbook">
${handbook}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="sponsor">
        <img src="${base}assets/githuttbr-mark.png" alt="" width="104" height="104" />
        <h2>${t('sponsor.title')}</h2>
        <p class="sub">${t('sponsor.body')}</p>
        <p><a class="btn primary" href="${SPONSOR}">${t('sponsor.cta')}</a></p>
      </div>
    </div>
  </section>
</main>
${footer(locale, switcher, depth)}
<script>
  (function () {
    // Point the main button at the file for whoever is reading, and pick out
    // their platform in the download list. Everything still resolves to the
    // latest release page if this never runs.
    var ua = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.userAgent
    var os = /Mac/i.test(ua) ? 'mac' : /Win/i.test(ua) ? 'win' : /Linux|X11/i.test(ua) && !/Android/i.test(navigator.userAgent) ? 'linux' : null
    var btn = document.querySelector('#download span')
    if (os && btn) {
      var label = { mac: 'macOS', win: 'Windows', linux: 'Linux' }[os]
      // Split around {os} instead of interpolating, so a language that puts the
      // platform first ("macOS 版をダウンロード") still reads correctly.
      btn.textContent = ${JSON.stringify(forOs[0])} + label + ${JSON.stringify(forOs[1] ?? '')}
      var card = document.querySelector('.dl[data-os="' + os + '"]')
      if (card) card.classList.add('yours')
    }

    // Installer names carry the version, so the build cannot know them for a
    // release that is still being published. Ask GitHub once; on any failure the
    // links stay on the release page, which always works.
    fetch('https://api.github.com/repos/${REPO}/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then(function (rel) {
        var files = (rel.assets || []).filter(function (a) { return !/\\.(blockmap|yml)$/.test(a.name) })
        document.querySelectorAll('[data-asset]').forEach(function (link) {
          var hit = files.find(function (a) { return a.name.indexOf(link.getAttribute('data-asset')) !== -1 })
          // Only ever a file on github.com: a download button must not become
          // a link to anywhere else, whatever the response holds.
          if (hit && /^https:\\/\\/github\\.com\\//.test(hit.browser_download_url)) link.href = hit.browser_download_url
        })
        var first = os && document.querySelector('.dl[data-os="' + os + '"] [data-asset]')
        if (first && /\\/download\\//.test(first.href)) document.getElementById('download').href = first.href
      })
      .catch(function () {})

    // Fade sections in as they scroll into view. Without JS (or with reduced
    // motion) they are simply there — the .js class gates the hidden state.
    var els = document.querySelectorAll('.reveal')
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
      }, { rootMargin: '0px 0px -60px 0px' })
      els.forEach(function (el) { io.observe(el) })
    } else {
      els.forEach(function (el) { el.classList.add('in') })
    }

    // The language menu closes when you click anywhere else, like a real menu.
    var menu = document.querySelector('.nav-lang')
    document.addEventListener('click', function (e) { if (menu && menu.open && !menu.contains(e.target)) menu.open = false })
  })()
</script>
`
}

// ── Handbook pages ──────────────────────────────────────────────────────────

function helpPage(page, locale = 'en', pageList = pages) {
  const depth = locale === 'en' ? 1 : 2
  const sidebar = sectionsOf(pageList)
    .map(
      (s) => `    <div class="side-group">
      <span class="side-title">${esc(s.category)}</span>
      ${s.pages
        .map((p) =>
          p.id === page.id
            ? `<a class="active" aria-current="page" href="${p.id}.html">${esc(p.title)}</a>`
            : `<a href="${p.id}.html">${esc(p.title)}</a>`
        )
        .join('\n      ')}
    </div>`
    )
    .join('\n')

  // The switcher stays on the page you are reading rather than dumping you at
  // the handbook index — changing language is not the same as starting over.
  const switcher = siteLocales
    .map((loc) => {
      const href =
        loc === 'en'
          ? `${'../'.repeat(depth - 1)}${page.id}.html`
          : `${'../'.repeat(depth - 1)}${loc}/${page.id}.html`
      const current = loc === locale ? ' aria-current="true"' : ''
      return `      <a${current} href="${href}" lang="${loc}">${esc(LOCALE_NAMES[loc] ?? loc)}</a>`
    })
    .join('\n')

  const t = strings(locale)
  const source = locale === 'en' ? `${page.id}.md` : `${locale}/${page.id}.md`
  const edit = locale === 'en' ? t('doc.edit') : t('doc.improve')

  return `${head(`${page.title} — ${t('doc.titleSuffix')}`, page.summary, depth, {
    lang: locale,
    dir: RTL_LOCALES.has(locale) ? 'rtl' : 'ltr',
    alternates: alternatesFor(page.id)
  })}
${nav(depth, locale)}
<div class="doc wrap">
  <aside class="side">
    <details class="side-nav" open>
      <summary>${t('nav.handbook')}</summary>
      <div class="side-inner">
    <input class="side-search" type="search" placeholder="${esc(t('doc.filter'))}" aria-label="${esc(t('doc.filterLabel'))}" />
${siteLocales.length > 1 ? `    <details class="side-lang">\n      <summary>${esc(LOCALE_NAMES[locale] ?? locale)}</summary>\n${switcher}\n    </details>` : ''}
${sidebar}
      </div>
    </details>
    <script>
      // On a phone the page list collapses above the article instead of pushing
      // it a screen down. Inline and synchronous, so it settles before first
      // paint and nothing shifts.
      (function () {
        var nav = document.querySelector('.side-nav')
        var narrow = window.matchMedia('(max-width: 899px)')
        var sync = function () { nav.open = !narrow.matches }
        sync()
        narrow.addEventListener('change', sync)
      })()
    </script>
  </aside>
  <main class="doc-body">
    <p class="crumb">${esc(page.category)}</p>
    <article class="prose">
${enhanceProse(marked.parse(siteLinks(page.body, depth)))}
    </article>
    <p class="edit"><a href="https://github.com/${REPO}/blob/main/docs/help/${source}">${edit}</a></p>
  </main>
</div>
${footer(locale, '', depth)}
<script>
  // Filter the sidebar. Deliberately dumb: no index, no fetch, no dependency.
  var search = document.querySelector('.side-search')
  if (search) {
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase()
      document.querySelectorAll('.side-group').forEach(function (group) {
        var any = false
        group.querySelectorAll('a').forEach(function (a) {
          var hit = !q || a.textContent.toLowerCase().indexOf(q) !== -1
          a.style.display = hit ? '' : 'none'
          any = any || hit
        })
        group.style.display = any ? '' : 'none'
      })
    })
  }
</script>
`
}

// ── Styles ──────────────────────────────────────────────────────────────────

// The dark palette, defined once: the handbook takes it from the reader's system
// theme, the landing page always (`html.dark`). Navy, indigo and cyan are the
// app's own dark theme, so the screenshots sit in a page of the same colour.
const DARK = `
    --accent: #6366f1;
    --accent-ink: #a5b4fc;
    --accent-2: #22d3ee;
    --bg: #0d1020;
    --surface: #161a36;
    --surface-2: #121630;
    --line: #262b52;
    --line-strong: #353b6e;
    --ink: #e7e9f6;
    --ink-2: #aeb2d4;
    --ink-3: #8287ad;
    --tint: color-mix(in oklab, var(--accent) 14%, var(--surface));
    --glow: color-mix(in oklab, var(--accent) 45%, transparent);
    --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.4);
    --shadow-md: 0 1px 2px rgb(0 0 0 / 0.3), 0 10px 30px -10px rgb(0 0 0 / 0.6);
    --shadow-lg: 0 2px 6px rgb(0 0 0 / 0.3), 0 40px 120px -30px rgb(99 102 241 / 0.45);`

const STYLES = `/* Plain modern CSS — custom properties, native nesting, color-mix(), logical
   properties. No preprocessor, so fixing a colour is editing this string. */

/* ── Tokens ─────────────────────────────────────────────────────────────── */

:root {
  color-scheme: light dark;

  /* The app's own accent (src/renderer/src/styles.css), and a deeper ink of it
     for text so links clear WCAG AA on white. */
  --accent: #6366f1;
  --accent-ink: #4f46e5;
  --accent-2: #0891b2;
  --on-accent: #fff;
  /* The mascot's warm orange — for the odd label that should not read as a link. */
  --capy: #f59e4b;
  --ok: #34d399;

  --bg: #fafafc;
  --surface: #ffffff;
  --surface-2: #f3f3f8;
  --line: #e4e4ee;
  --line-strong: #d3d3e0;
  --ink: #15151f;
  --ink-2: #474759;
  --ink-3: #66667a;

  --tint: color-mix(in oklab, var(--accent) 8%, var(--surface));
  --glow: color-mix(in oklab, var(--accent) 22%, transparent);

  --shadow-sm: 0 1px 2px rgb(20 20 40 / 0.06), 0 1px 1px rgb(20 20 40 / 0.04);
  --shadow-md: 0 1px 2px rgb(20 20 40 / 0.05), 0 8px 24px -8px rgb(20 20 40 / 0.12);
  --shadow-lg: 0 2px 6px rgb(20 20 40 / 0.05), 0 30px 70px -30px rgb(30 20 80 / 0.35);

  --radius-sm: 8px;
  --radius: 14px;
  --radius-lg: 20px;

  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Inter, Roboto,
    "Helvetica Neue", system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  --mono: ui-monospace, SFMono-Regular, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;

  /* A minor-third scale, fluid between phone and desktop. */
  --step--1: clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem);
  --step-0: clamp(1rem, 0.97rem + 0.15vw, 1.0625rem);
  --step-1: clamp(1.125rem, 1.08rem + 0.25vw, 1.25rem);
  --step-2: clamp(1.375rem, 1.25rem + 0.6vw, 1.75rem);
  --step-3: clamp(1.75rem, 1.5rem + 1.2vw, 2.375rem);
  --step-4: clamp(2.25rem, 1.6rem + 3.2vw, 4rem);

  --wrap: 1160px;
  --gutter: clamp(16px, 4vw, 32px);
  --nav-h: 60px;
}

/* Dark is a second palette, not an inversion: lifted surfaces, softer ink. */
@media (prefers-color-scheme: dark) {
  :root {${DARK}
  }
}
:root.dark {
  color-scheme: dark;${DARK}
}

/* ── Base ───────────────────────────────────────────────────────────────── */

*, *::before, *::after { box-sizing: border-box; }

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  scroll-behavior: smooth;
  scroll-padding-top: calc(var(--nav-h) + 16px);
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 400 var(--step-0) / 1.65 var(--sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

img, picture, video { max-width: 100%; height: auto; display: block; }

h1, h2, h3, h4 { line-height: 1.15; letter-spacing: -0.02em; font-weight: 650; text-wrap: balance; }
p, li { text-wrap: pretty; }
/* Japanese breaks at phrase boundaries rather than mid-word, where supported. */
:lang(ja) :where(h1, h2, h3, .lede, .sub) { word-break: auto-phrase; }

a {
  color: var(--accent-ink);
  text-decoration: none;
  text-underline-offset: 0.2em;
  text-decoration-thickness: 1px;
  &:hover { text-decoration: underline; }
}

:where(a, button, input, summary):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 6px;
}

::selection { background: color-mix(in oklab, var(--accent) 28%, transparent); }

code, kbd, pre { font-family: var(--mono); }
code {
  font-size: 0.875em;
  padding: 0.1em 0.4em;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--line);
}

/* Scrollbars that belong to the page rather than to the OS. */
* { scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }

.wrap {
  width: 100%;
  max-width: var(--wrap);
  margin-inline: auto;
  padding-inline: var(--gutter);
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 9px 18px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 600;
  font-size: 0.9375rem;
  line-height: 1.2;
  white-space: nowrap;
  transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s;

  &:hover { text-decoration: none; }
  svg { width: 18px; height: 18px; flex: none; }
  &.small { min-height: 34px; padding: 6px 14px; font-size: 0.875rem; }
  &.large { min-height: 48px; padding: 12px 24px; font-size: 1rem; }

  &.primary {
    color: var(--on-accent);
    background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 88%, white), var(--accent));
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.18) inset, 0 6px 18px -6px var(--glow);
    &:hover { background: color-mix(in oklab, var(--accent) 90%, black); transform: translateY(-1px); }
  }

  &.ghost {
    color: var(--ink);
    background: var(--surface);
    border-color: var(--line-strong);
    box-shadow: var(--shadow-sm);
    &:hover { border-color: color-mix(in oklab, var(--accent) 50%, var(--line-strong)); transform: translateY(-1px); }
  }
}

/* ── Header ─────────────────────────────────────────────────────────────── */

.nav {
  position: sticky;
  inset-block-start: 0;
  z-index: 20;
  background: color-mix(in oklab, var(--bg) 78%, transparent);
  backdrop-filter: saturate(1.6) blur(14px);
  -webkit-backdrop-filter: saturate(1.6) blur(14px);
  border-block-end: 1px solid color-mix(in oklab, var(--line) 80%, transparent);
}

.nav-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: var(--wrap);
  height: var(--nav-h);
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-weight: 700;
  font-size: 1.0625rem;
  letter-spacing: -0.01em;
  &:hover { text-decoration: none; }
  img { border-radius: 7px; }
}

.nav nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: auto;

  a:not(.btn) {
    padding: 6px 12px;
    border-radius: 999px;
    color: var(--ink-2);
    font-size: 0.9375rem;
    font-weight: 500;
    &:hover { color: var(--ink); background: var(--surface-2); text-decoration: none; }
  }
  .btn { margin-inline-start: 8px; }
}

@media (max-width: 719px) {
  .nav .nav-extra { display: none; }
}

/* The landing page's language menu: a globe and the current code, opening onto
   every locale by its own name. A <details>, so it works without JS. */
.nav-lang {
  position: relative;
  margin-inline-start: 4px;

  summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--ink-2);
    font: 600 0.75rem var(--mono);
    cursor: pointer;
    list-style: none;
    &::-webkit-details-marker { display: none; }
    &:hover { color: var(--ink); background: var(--surface-2); }
    svg { width: 16px; height: 16px; }
  }
  &[open] summary { color: var(--ink); border-color: var(--line-strong); }
}
.nav-lang-list {
  position: absolute;
  inset-block-start: calc(100% + 8px);
  inset-inline-end: 0;
  z-index: 30;
  display: grid;
  min-width: 200px;
  max-height: min(70vh, 520px);
  overflow-y: auto;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  box-shadow: var(--shadow-md);

  a {
    padding: 7px 12px !important;
    border-radius: 8px !important;
    color: var(--ink-2);
    font-size: 0.875rem !important;
    unicode-bidi: isolate;
    &[aria-current] { color: var(--accent-ink); background: var(--tint); font-weight: 600; }
  }
}

/* The landing page is dark whatever the system says, overscroll included. */
:root.dark { background: var(--bg); }

/* ── Hero ───────────────────────────────────────────────────────────────── */

.hero {
  position: relative;
  isolation: isolate;
  overflow: clip;
  padding-block: clamp(56px, 9vw, 112px) clamp(40px, 6vw, 72px);
  text-align: center;

  /* Two soft lights behind the headline — colour, not decoration. */
  &::before {
    content: "";
    position: absolute;
    inset: -20% -10% auto;
    height: 760px;
    z-index: -1;
    background:
      radial-gradient(50% 50% at 30% 30%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%),
      radial-gradient(40% 45% at 72% 40%, color-mix(in oklab, var(--accent-2) 14%, transparent), transparent 70%);
    filter: blur(20px);
    pointer-events: none;
  }
}

.hero-copy { max-width: 1040px; }

/* The capybara floats a little. It is the one moving thing above the fold. */
.hero-mascot {
  margin: 0 auto 18px;
  filter: drop-shadow(0 14px 30px color-mix(in oklab, var(--accent) 45%, transparent));
  animation: bob 5s ease-in-out infinite;
}
@keyframes bob { 50% { transform: translateY(-8px) rotate(-2deg); } }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 22px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent);
  background: color-mix(in oklab, var(--accent) 12%, transparent);
  color: var(--accent-ink);
  font-size: var(--step--1);
  font-weight: 500;
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 10px var(--ok); }
}

.hero h1 {
  margin: 0 0 20px;
  font-size: var(--step-4);
  line-height: 1.05;
  letter-spacing: -0.035em;
  font-weight: 700;

  em {
    font-style: normal;
    background: linear-gradient(100deg, var(--accent) 10%, color-mix(in oklab, var(--accent) 45%, var(--accent-2)) 90%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.lede {
  max-width: 640px;
  margin: 0 auto 32px;
  color: var(--ink-2);
  font-size: var(--step-1);
  line-height: 1.6;
}

.cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

.version {
  margin: 20px 0 0;
  color: var(--ink-3);
  font-size: var(--step--1);
  a { color: var(--ink-2); text-decoration: underline; text-decoration-color: var(--line-strong); }
  a:hover { color: var(--ink); }
}

/* The hero screenshot sits in a window: three dots and a title, so a reader sees
   an app before reading a word about it. */
.window {
  margin: 0;
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  img { width: 100%; }
}
.window-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  background: color-mix(in oklab, var(--surface-2) 70%, black);
  border-block-end: 1px solid var(--line);
  /* Traffic lights read left to right in every script. */
  direction: ltr;
  i { width: 11px; height: 11px; border-radius: 50%; }
  i:nth-child(1) { background: #f87171; }
  i:nth-child(2) { background: #fbbf24; }
  i:nth-child(3) { background: #34d399; }
  span { margin-inline-start: 10px; color: var(--ink-3); font: 0.75rem var(--mono); white-space: nowrap; overflow: hidden; }
}

.hero-shot {
  width: min(100% - 2 * var(--gutter), var(--wrap) - 2 * var(--gutter));
  margin: clamp(40px, 6vw, 64px) auto 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  margin-block-start: 48px;
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--line);
  @media (min-width: 760px) { grid-template-columns: repeat(4, 1fr); }
}
.stat {
  padding: 22px 16px;
  background: var(--surface-2);
  b { display: block; font-size: var(--step-3); font-weight: 700; color: var(--ink); line-height: 1.2; }
  span { color: var(--ink-2); font-size: var(--step--1); }
}

/* ── Sections ───────────────────────────────────────────────────────────── */

.section {
  padding-block: clamp(64px, 9vw, 112px);

  &.alt {
    background: var(--surface-2);
    border-block: 1px solid var(--line);
  }

  .frame { margin-block-start: clamp(40px, 5vw, 64px); }
}

.section-head {
  max-width: 720px;
  margin-block-end: clamp(32px, 4vw, 48px);

  h2 { margin: 0 0 12px; font-size: var(--step-3); }
  &.center { margin-inline: auto; text-align: center; }
}
.center { text-align: center; }

.sub {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--step-1);
  line-height: 1.6;

  &.small { margin-block-start: 24px; font-size: var(--step--1); color: var(--ink-3); }
}

/* ── What you get ───────────────────────────────────────────────────────── */

.two {
  display: grid;
  gap: 0 48px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
}

.ticks {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    position: relative;
    padding-block: 12px;
    padding-inline-start: 36px;
    border-block-end: 1px solid var(--line);
    color: var(--ink-2);

    /* A check drawn in CSS: a tinted disc with a mask, no icon font. */
    &::before {
      content: "";
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: 15px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: color-mix(in oklab, var(--accent) 14%, transparent);
    }
    &::after {
      content: "";
      position: absolute;
      inset-inline-start: 5px;
      inset-block-start: 20px;
      width: 12px;
      height: 12px;
      background: var(--accent-ink);
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 6.3 4.8 9 10 3.2' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 6.3 4.8 9 10 3.2' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    }
  }
}

/* ── Feature cards ──────────────────────────────────────────────────────── */

.grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;

  &:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
    border-color: color-mix(in oklab, var(--accent) 35%, var(--line));
    .card-shot img { transform: scale(1.025); }
  }
  &:focus-within { border-color: var(--accent); }

  h3 {
    margin: 0 0 8px;
    font-size: var(--step-1);
    a {
      color: var(--ink);
      /* The whole card is the link. */
      &::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
      &:hover { text-decoration: none; }
      &:focus-visible { outline: none; }
      &:focus-visible::after { outline: 2px solid var(--accent); outline-offset: -2px; }
    }
  }

  p { margin: 0; color: var(--ink-2); font-size: 0.9375rem; line-height: 1.6; }
}

/* Each shot is cropped to one band, anchored at its top corner, so cards keep
   a common rhythm whatever shape the screenshot is. */
.card-shot {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--surface-2);
  border-block-end: 1px solid var(--line);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top left;
    transition: transform 0.4s ease;
  }
}
[dir="rtl"] .card-shot img { object-position: top right; }

.card-body { position: relative; padding: 28px 22px 24px; flex: 1; }

/* The emoji sits on the seam between the shot and the text, like a badge. */
.card-icon {
  position: absolute;
  inset-block-start: -20px;
  inset-inline-start: 20px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-md);
  font-size: 20px;
  line-height: 1;
}

/* ── Downloads ──────────────────────────────────────────────────────────── */

.downloads {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
}

.dl {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 26px 22px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-sm);

  h3 { margin: 0; font-size: var(--step-2); }
  p { margin: 0; color: var(--ink-2); font-size: var(--step--1); }

  /* The reader's own platform, picked out by the inline script. The badge text
     is translated copy carried in data-badge. */
  &.yours {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent), 0 20px 50px -20px var(--glow);
    &::after {
      content: attr(data-badge);
      position: absolute;
      inset-block-start: -11px;
      inset-inline-end: 16px;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--accent);
      color: var(--on-accent);
      font: 600 0.6875rem var(--mono);
    }
  }
}
.dl-os {
  display: flex;
  align-items: center;
  gap: 12px;
  svg { width: 28px; height: 28px; color: var(--ink); flex: none; }
}
.dl-files { display: grid; gap: 8px; margin-block-start: 6px; }
.dl-file {
  justify-content: space-between;
  width: 100%;
  border-radius: 10px;
  small { font: 500 0.75rem var(--mono); opacity: 0.7; }
}
.dl-hint {
  margin-block-start: auto !important;
  padding-block-start: 8px;
  color: var(--ink-3) !important;
}

/* ── Showcase ───────────────────────────────────────────────────────────── */

.feature {
  display: grid;
  gap: 28px;
  align-items: center;
  margin-block-end: clamp(56px, 7vw, 88px);
  &:last-child { margin-block-end: 0; }
  > * { min-width: 0; }

  h3 { margin: 0 0 12px; font-size: var(--step-2); }
  p { margin: 0 0 14px; color: var(--ink-2); }

  @media (min-width: 900px) {
    grid-template-columns: 5fr 7fr;
    gap: 56px;
    &.flip { grid-template-columns: 7fr 5fr; }
    &.flip .feature-copy { order: 2; }
  }
}

/* A screenshot on its own: a hairline and a lifted shadow. */
.shot {
  margin: 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--shadow-md);
  img { width: 100%; }
}

/* "Read the handbook page" — an arrow that turns round in a right-to-left page. */
.more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.9375rem;
  &::after { content: "→"; transition: transform 0.15s; }
  &:hover::after { transform: translateX(3px); }
}
[dir="rtl"] .more::after { content: "←"; }
[dir="rtl"] .more:hover::after { transform: translateX(-3px); }

/* ── Hosts, providers ───────────────────────────────────────────────────── */

.hosts-head { margin-block-start: clamp(56px, 7vw, 88px); }

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
.chip {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--ink);
  font-size: 0.875rem;
  font-weight: 500;
  small { margin-inline-start: 6px; color: var(--capy); font-weight: 500; }
}

.providers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-block: 20px;
  span {
    padding: 4px 10px;
    border-radius: 7px;
    border: 1px solid color-mix(in oklab, var(--accent) 30%, transparent);
    background: color-mix(in oklab, var(--accent) 10%, transparent);
    color: var(--accent-ink);
    font: 500 0.8125rem var(--mono);
  }
}

/* ── Two-column sections ────────────────────────────────────────────────── */

.split {
  display: grid;
  gap: 40px;
  /* Grid items default to min-width:auto, so a <pre> would widen the column. */
  > * { min-width: 0; }
  .sub + .sub { margin-block-start: 14px; }
  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: start;
    &.middle { align-items: center; }
  }
}
.split-title { margin: 0 0 16px; font-size: var(--step-3); }

.terminal {
  margin: 24px 0;
  padding: 18px 20px;
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: color-mix(in oklab, var(--bg) 70%, black);
  color: var(--ink);
  font: 0.875rem / 1.8 var(--mono);
  text-align: left;
  span { color: var(--ok); }
}

.checks {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  li {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  svg { width: 22px; height: 22px; margin-block-start: 2px; color: var(--ok); }
  b { display: block; margin-block-end: 2px; color: var(--ink); font-weight: 600; }
  span { color: var(--ink-2); font-size: 0.9375rem; }
}

.honest {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 18px;
  margin-block-end: clamp(56px, 7vw, 88px);
  padding: 24px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in oklab, var(--capy) 40%, transparent);
  background: color-mix(in oklab, var(--capy) 7%, transparent);
  > * { min-width: 0; }
  h3 { margin: 0 0 8px; font-size: var(--step-1); }
  p { margin: 0; color: var(--ink-2); font-size: 0.9375rem; }
}

/* Sections fade in as they scroll into view — only when the script is there to
   reveal them, so a page without JS is never left blank. */
.js .reveal { opacity: 0; transform: translateY(18px); transition: opacity 0.6s ease, transform 0.6s ease; }
.js .reveal.in { opacity: 1; transform: none; }

/* ── Handbook index ─────────────────────────────────────────────────────── */

.handbook {
  display: grid;
  gap: 36px 32px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
}

.hb-col {
  h3 {
    margin: 0 0 10px;
    font-size: 0.75rem;
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
  a {
    display: block;
    padding-block: 4px;
    color: var(--ink-2);
    font-size: 0.9375rem;
    &:hover { color: var(--accent-ink); text-decoration: none; }
  }
}

/* ── Sponsor ────────────────────────────────────────────────────────────── */

.sponsor {
  max-width: 820px;
  margin-inline: auto;
  padding: clamp(32px, 5vw, 56px);
  text-align: center;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in oklab, var(--accent) 25%, var(--line));
  background:
    radial-gradient(80% 120% at 50% 0%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 70%),
    var(--surface);
  box-shadow: var(--shadow-md);

  h2 { margin: 0 0 12px; font-size: var(--step-3); }
  .sub { max-width: 620px; margin-inline: auto; }
  p:last-child { margin: 28px 0 0; }
  img { margin: 0 auto 16px; }
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

.foot {
  border-block-start: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink-3);
  font-size: var(--step--1);
}

.foot-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 32px;
  padding-block: 28px 40px;
}
.foot-credit {
  margin: 0;
  flex-basis: 100%;
  order: 3;
  font-size: 0.85em;
  color: var(--ink-3);
}

.foot-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  img { border-radius: 5px; flex: none; }
  a { color: var(--ink-2); }
}

.foot-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
  a { color: var(--ink-2); &:hover { color: var(--ink); } }
}

/* Sixteen endonyms, each in its own script — isolated so a right-to-left name
   cannot reorder its neighbours. */
.lang-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  padding-block: 28px;
  border-block-end: 1px solid var(--line);

  a {
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid transparent;
    color: var(--ink-3);
    font-size: var(--step--1);
    unicode-bidi: isolate;
    &:hover { color: var(--ink); background: var(--surface-2); text-decoration: none; }
    &[aria-current] {
      color: var(--accent-ink);
      background: var(--tint);
      border-color: color-mix(in oklab, var(--accent) 30%, transparent);
    }
  }
}

/* ── Handbook pages ─────────────────────────────────────────────────────── */

.doc {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  padding-block: 24px 80px;
}

@media (min-width: 900px) {
  .doc {
    grid-template-columns: 264px minmax(0, 1fr);
    gap: clamp(32px, 4vw, 64px);
    padding-block-start: 40px;
  }
  .side {
    position: sticky;
    inset-block-start: calc(var(--nav-h) + 24px);
    align-self: start;
    max-height: calc(100dvh - var(--nav-h) - 48px);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    padding-inline-end: 8px;
    /* Fade the last row out instead of cutting it mid-letter. */
    mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
  }
}

/* On a phone the sidebar is a collapsible card above the article. */
.side-nav {
  > summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-sm);
    font-weight: 600;
    cursor: pointer;
    list-style: none;
    &::-webkit-details-marker { display: none; }
    &::after {
      content: "";
      width: 8px;
      height: 8px;
      /* Physical sides on purpose: a down chevron points down in any script. */
      border-right: 2px solid var(--ink-3);
      border-bottom: 2px solid var(--ink-3);
      transform: rotate(45deg);
      transition: transform 0.2s;
    }
  }
  &[open] > summary::after { transform: rotate(-135deg); }
}

/* After the block above, so it wins: on a desktop the list is always shown. */
@media (min-width: 900px) {
  .side-nav > summary { display: none; }
}

@media (max-width: 899px) {
  .side-nav[open] .side-inner {
    margin-block-start: 8px;
    padding: 16px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--line);
    max-height: 70vh;
    overflow-y: auto;
  }
}

.side-search {
  width: 100%;
  margin-block-end: 12px;
  padding: 8px 12px;
  font: inherit;
  font-size: 0.875rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
  &::placeholder { color: var(--ink-3); }
  &:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 20%, transparent); }
}

.side-lang {
  margin-block-end: 20px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  overflow: hidden;

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 12px;
    font-size: 0.8125rem;
    color: var(--ink-2);
    cursor: pointer;
    list-style: none;
    &::-webkit-details-marker { display: none; }
    &::after { content: "▾"; color: var(--ink-3); }
  }
  &[open] summary { border-block-end: 1px solid var(--line); }
  &[open] summary::after { content: "▴"; }

  a {
    display: block;
    padding: 5px 12px;
    font-size: 0.8125rem;
    color: var(--ink-2);
    unicode-bidi: isolate;
    &:hover { color: var(--ink); background: var(--surface-2); text-decoration: none; }
    &[aria-current] { color: var(--accent-ink); font-weight: 600; }
  }
}

.side-group { margin-block-end: 20px; }

.side-title {
  display: block;
  margin-block-end: 6px;
  padding-inline: 10px;
  font-size: 0.6875rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.side-group a {
  display: block;
  padding: 5px 10px;
  border-radius: 8px;
  color: var(--ink-2);
  font-size: 0.875rem;
  line-height: 1.45;
  &:hover { background: var(--surface-2); color: var(--ink); text-decoration: none; }
  &.active {
    background: var(--tint);
    color: var(--accent-ink);
    font-weight: 600;
    box-shadow: inset 2px 0 0 var(--accent);
  }
}
[dir="rtl"] .side-group a.active { box-shadow: inset -2px 0 0 var(--accent); }

.doc-body { min-width: 0; }

.crumb {
  display: inline-block;
  margin: 0 0 14px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--accent-ink);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* Long-form reading: a ~70ch measure, a calm rhythm, headings that breathe. */
.prose {
  max-width: 72ch;
  color: var(--ink-2);
  font-size: var(--step-0);
  line-height: 1.75;
  /* A long URL or path in running text wraps instead of widening the page. */
  overflow-wrap: break-word;

  > :first-child { margin-block-start: 0; }
  :not(pre) > code { overflow-wrap: anywhere; }

  h1 { margin: 0 0 20px; font-size: var(--step-3); color: var(--ink); letter-spacing: -0.03em; }
  h2 {
    margin: 56px 0 14px;
    padding-block-start: 28px;
    border-block-start: 1px solid var(--line);
    font-size: var(--step-2);
    color: var(--ink);
  }
  /* The first section right under the title needs no rule above it. */
  h1 + h2 { margin-block-start: 32px; padding-block-start: 0; border-block-start: 0; }
  h3 { margin: 36px 0 10px; font-size: var(--step-1); color: var(--ink); }
  h4 { margin: 28px 0 8px; font-size: 1rem; color: var(--ink); }

  p, ul, ol { margin: 0 0 18px; }
  ul, ol { padding-inline-start: 1.4em; }
  li { margin-block: 6px; }
  li::marker { color: var(--ink-3); }
  strong { color: var(--ink); font-weight: 650; }

  a {
    text-decoration: underline;
    text-decoration-color: color-mix(in oklab, var(--accent-ink) 35%, transparent);
    &:hover { text-decoration-color: currentColor; }
  }

  hr { border: 0; border-block-start: 1px solid var(--line); margin: 40px 0; }

  pre {
    margin: 20px 0 24px;
    padding: 16px 20px;
    overflow-x: auto;
    border-radius: 12px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--ink);
    code { padding: 0; border: 0; background: none; font-size: inherit; }
  }

  kbd {
    display: inline-block;
    padding: 1px 7px;
    font-size: 0.8em;
    line-height: 1.5;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-block-end-width: 2px;
    border-radius: 6px;
  }

  img {
    margin: 24px 0;
    border-radius: 12px;
    border: 1px solid var(--line);
    box-shadow: var(--shadow-md);
  }

  /* Blockquotes are callouts. A leading bold word — "Beta.", "Note." — becomes
     the callout's label, in whatever language the page is in. */
  blockquote {
    margin: 24px 0;
    padding: 16px 20px;
    border-radius: 12px;
    background: var(--tint);
    border: 1px solid color-mix(in oklab, var(--accent) 22%, var(--line));
    border-inline-start: 3px solid var(--accent);
    color: var(--ink-2);

    p { margin: 0 0 10px; }
    > :last-child { margin-block-end: 0; }

    > p:first-child > strong:first-child {
      display: inline-block;
      margin-inline-end: 6px;
      padding: 0 8px;
      border-radius: 999px;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 0.75rem;
      line-height: 1.7;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      vertical-align: 0.1em;
    }
  }
}

/* Tables scroll inside their own box, never the page. */
.table-wrap {
  margin: 20px 0 28px;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);

  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; line-height: 1.55; }
  th, td {
    padding: 10px 14px;
    text-align: start;
    vertical-align: top;
    border-block-end: 1px solid var(--line);
  }
  th {
    background: var(--surface-2);
    color: var(--ink);
    font-weight: 600;
    white-space: nowrap;
  }
  tr:last-child td { border-block-end: 0; }
  tbody tr:hover td { background: color-mix(in oklab, var(--surface-2) 60%, transparent); }
}

.edit {
  max-width: 72ch;
  margin: 56px 0 0;
  padding-block-start: 20px;
  border-block-start: 1px solid var(--line);
  font-size: var(--step--1);
  a { color: var(--ink-3); &:hover { color: var(--accent-ink); } }
}

/* A right-to-left page mirrors its prose but not its code. */
[dir="rtl"] :where(pre, code, kbd) { direction: ltr; unicode-bidi: isolate; }
[dir="rtl"] pre { text-align: left; }

/* ── Small screens ──────────────────────────────────────────────────────── */

@media (max-width: 639px) {
  .cta .btn { flex: 1 1 100%; }
  .hero-mascot { width: 116px; height: 116px; }
  .foot-inner { flex-direction: column; align-items: flex-start; }
}

/* ── Motion ─────────────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
  .card:hover, .btn:hover { transform: none; }
  .hero-mascot { animation: none; }
  .js .reveal { opacity: 1; transform: none; }
  .card:hover .card-shot img { transform: none; }
}
`

// ── Build ───────────────────────────────────────────────────────────────────

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'help'), { recursive: true })
mkdirSync(join(OUT, 'assets'), { recursive: true })

writeFileSync(join(OUT, 'styles.css'), STYLES)
writeFileSync(join(OUT, 'index.html'), landing())
for (const page of pages) writeFileSync(join(OUT, 'help', `${page.id}.html`), helpPage(page))

// A landing page per language at /<locale>/. English keeps the root so no
// existing link, bookmark or search result moves.
for (const locale of siteLocales.filter((l) => l !== 'en')) {
  mkdirSync(join(OUT, locale), { recursive: true })
  writeFileSync(join(OUT, locale, 'index.html'), landing(locale))
}

// One handbook tree per translated locale, under help/<locale>/. English keeps
// the bare help/ path so no existing link or search result breaks.
for (const [locale, pageList] of localeSets) {
  mkdirSync(join(OUT, 'help', locale), { recursive: true })
  for (const page of pageList) {
    writeFileSync(join(OUT, 'help', locale, `${page.id}.html`), helpPage(page, locale, pageList))
  }
}

// Every screenshot the handbook and the landing can reference, plus the mark.
for (const file of readdirSync(SHOTS_DIR)) copyFileSync(join(SHOTS_DIR, file), join(OUT, 'assets', file))
copyFileSync(join(ROOT, 'docs/githuttbr-mark.png'), join(OUT, 'assets/githuttbr-mark.png'))
// The share card is a 1200x630 JPEG: the screenshots are WebP now, and LinkedIn
// and Facebook are unreliable with it. JPEG is the format every scraper agrees
// on, and a quarter of the PNG's bytes for a photo-like screenshot.
copyFileSync(join(ROOT, 'docs/og-image.jpg'), join(OUT, 'assets/og-image.jpg'))

// Pages would otherwise run the output through Jekyll, which drops _-prefixed
// files and can mangle raw HTML.
writeFileSync(join(OUT, '.nojekyll'), '')

const count = readdirSync(join(OUT, 'help')).filter((f) => f.endsWith('.html')).length
console.log(`✔ site: index + ${count} handbook pages → dist-site/`)
for (const [locale, done] of [...localeCoverage].sort()) {
  const site = coverage(locale)
  const full = done === count && site.done === site.total
  console.log(
    `  ${full ? '✔' : '·'} ${locale.padEnd(6)} handbook ${String(done).padStart(3)}/${count}` +
      `   site copy ${String(site.done).padStart(3)}/${site.total}`
  )
}

// A locale with site copy but no handbook would render a landing page whose
// every link leads back into English. Worth saying out loud.
const orphanCopy = Object.keys(SITE).filter((l) => l !== 'en' && !localeSets.has(l))
if (orphanCopy.length) console.log(`  ! site copy without a handbook: ${orphanCopy.join(', ')}`)
if (process.argv.includes('--serve')) {
  console.log(`  preview: npx serve ${existsSync(OUT) ? 'dist-site' : ''}`)
}
