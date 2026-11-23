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
// The handbook is upstream's text, branded at display time exactly as the app
// does it (src/renderer/src/help/pages.ts). A plain TypeScript module with
// nothing but erasable types, so Node loads it without a build step.
import { brandText } from '../src/shared/brand.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HELP_DIR = join(ROOT, 'docs/help')
const SHOTS_DIR = join(ROOT, 'docs/screenshots')
const OUT = join(ROOT, 'dist-site')

const REPO = 'StarleyDev/githuttbr'
const SITE_URL = 'https://starleydev.github.io/githuttbr'
// The project this fork is built from. Its handbook pages link to it for
// feedback; on the fork's site that feedback belongs to the fork instead.
const UPSTREAM_REPO = 'MyAppDesk/gitcito'
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

/** Flat `key: value` front matter — the same shape the app parses. Branded as
 *  a whole, before parsing, so title, summary, keywords and body all match. */
function parsePage(file) {
  const src = brandText(readFileSync(join(HELP_DIR, file), 'utf8'))
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
    .replaceAll(`https://github.com/${UPSTREAM_REPO}/issues`, `https://github.com/${REPO}/issues`)
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
  const { lang = 'en', dir = 'ltr', alternates = '' } = opts
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${SITE_URL}/assets/og-image.jpg" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" content="#fafafc" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0c0d16" media="(prefers-color-scheme: dark)" />
<link rel="icon" href="${base}assets/githuttbr-mark.png" />
<link rel="stylesheet" href="${base}styles.css" />
${alternates}</head>
<body>`
}

/**
 * `depth` is how deep the page sits under the site root, `home` the locale's
 * own root — an English reader clicking the logo should not land in Japanese,
 * and a Japanese reader should not land in English.
 */
const nav = (depth, locale = 'en') => {
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
    <p class="foot-credit">${t('foot.credit').replace('{upstream}', `<a href="https://github.com/${UPSTREAM_REPO}">Gitcito</a>`)}</p>
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

// The landing page's headline cards, in display order. Each id is a handbook
// page; the card's title and body live in `site-i18n/` as `feature.<id>.*`.
const FEATURES = [
  { icon: '🔀', id: 'hosting' },
  { icon: '🛡️', id: 'recovery' },
  { icon: '✏️', id: 'commit-edit' },
  { icon: '🔑', id: 'ai' },
  { icon: '💬', id: 'repo-chat' },
  { icon: '🎛️', id: 'mission-control' },
  { icon: '⌨️', id: 'cli' },
  { icon: '🌍', id: 'languages' },
  { icon: '🔐', id: 'security' }
]

// The OS names are proper nouns and stay; only the note beside each is copy.
const DOWNLOADS = [
  { os: 'macOS', noteKey: 'download.macNote', match: 'mac' },
  { os: 'Windows', noteKey: 'download.winNote', match: 'win' },
  { os: 'Linux', noteKey: 'download.linuxNote', match: 'linux' }
]

// A feature card shows the handbook page's own screenshot. The file is named
// after the page id, bar the one case where the page covers more than its shot.
const CARD_SHOT = { security: 'secret-masking', recovery: 'snapshots', ai: 'settings-ai', cli: 'cli-edit', hosting: 'create-pr' }

/** The card's screenshot, or null when there is none to show. */
function cardShot(id) {
  const name = `${CARD_SHOT[id] ?? id}.webp`
  return existsSync(join(SHOTS_DIR, name)) ? name : null
}

function landing(locale = 'en') {
  const t = strings(locale)
  const forOs = t('download.forOs').split('{os}')
  const depth = locale === 'en' ? 0 : 1
  const base = '../'.repeat(depth)
  // The handbook a card links to is the one in the reader's language.
  const helpDir = locale === 'en' ? `${base}help/` : `${base}help/${locale}/`
  const pageList = locale === 'en' ? pages : (localeSets.get(locale) ?? pages)

  const cards = FEATURES.map((f) => {
    const shot = cardShot(f.id)
    const title = t(`feature.${f.id}.title`)
    // The title's link stretches over the whole card (see `.card h3 a::after`),
    // so the screenshot needs no second link to the same page.
    const figure = shot
      ? `\n      <div class="card-shot"><img src="${base}assets/${shot}"${dims(shot)} alt="${esc(title)}" loading="lazy" decoding="async" /></div>`
      : ''
    return `    <article class="card">${figure}
      <div class="card-body">
        <span class="card-icon" aria-hidden="true">${f.icon}</span>
        <h3><a href="${helpDir}${f.id}.html">${title}</a></h3>
        <p>${t(`feature.${f.id}.body`)}</p>
      </div>
    </article>`
  }).join('\n')

  const downloads = DOWNLOADS.map(
    (d) => `      <a class="dl" href="${LATEST}" data-os="${d.match}">
        <strong>${d.os}</strong>
        <span>${t(d.noteKey)}</span>
      </a>`
  ).join('\n')

  const handbook = sectionsOf(pageList)
    .map(
      (s) => `      <div class="hb-col">
        <h3>${esc(s.category)}</h3>
        ${s.pages.map((p) => `<a href="${helpDir}${p.id}.html">${esc(p.title)}</a>`).join('\n        ')}
      </div>`
    )
    .join('\n')

  const ordinary = (keys) =>
    keys.map((k) => `        <li>${t(`ordinary.${k}`)}</li>`).join('\n')

  const shotImg = (name, alt) =>
    `<img src="${base}assets/${name}"${dims(name)} alt="${esc(alt)}" loading="lazy" decoding="async" />`

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
    alternates: alternatesForHome()
  })}
${nav(depth, locale)}
<main>
  <section class="hero">
    <div class="wrap hero-copy">
      <img class="hero-mark" src="${base}assets/githuttbr-mark.png" alt="" width="72" height="72" />
      <h1>${t('hero.title')}</h1>
      <p class="lede">${t('hero.lede')}</p>
      <div class="cta">
        <a class="btn primary large" href="${LATEST}" id="download">${t('hero.download')}</a>
        <a class="btn ghost large" href="${helpDir}getting-started.html">${t('nav.handbook')}</a>
      </div>
      <p class="version">${t('hero.terms', { version: pkg.version })} · <a href="https://github.com/${REPO}">${t('hero.source')}</a></p>
    </div>
    <figure class="frame hero-shot">
      <!-- The app ships both themes; the page shows the one the reader is in. -->
      <picture>
        <source media="(prefers-color-scheme: light)" srcset="${base}assets/graph-light.webp" />
        <img src="${base}assets/graph-dark.webp"${dims('graph-dark.webp')} alt="${esc(t('hero.graphAlt'))}" fetchpriority="high" decoding="async" />
      </picture>
    </figure>
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
      <figure class="frame">${shotImg('conflict-resolver.webp', t('ordinary.conflictAlt'))}</figure>
    </div>
  </section>

  <section class="section alt">
    <div class="wrap">
      <header class="section-head">
        <h2>${t('features.title')}</h2>
        <p class="sub">${t('features.sub')}</p>
      </header>
      <div class="grid">
${cards}
      </div>
    </div>
  </section>

  <section class="section" id="get">
    <div class="wrap">
      <header class="section-head">
        <h2>${t('download.title')}</h2>
        <p class="sub">${t('download.sub', { version: pkg.version })}</p>
      </header>
      <div class="downloads">
${downloads}
      </div>
      <p class="sub small">${t('download.cli', { cli: `${helpDir}cli.html` })}</p>
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
        <h2>${t('sponsor.title')}</h2>
        <p class="sub">${t('sponsor.body')}</p>
        <p><a class="btn primary" href="${SPONSOR}">${t('sponsor.cta')}</a></p>
      </div>
    </div>
  </section>
</main>
${footer(locale, switcher, depth)}
<script>
  // Point the main button at the file for whoever is reading, and highlight
  // their platform in the download list. Everything still resolves to the
  // latest release page if this never runs.
  (function () {
    var ua = navigator.userAgent
    var os = /Mac/i.test(ua) ? 'mac' : /Win/i.test(ua) ? 'win' : /Linux|X11/i.test(ua) ? 'linux' : null
    if (!os) return
    var label = { mac: 'macOS', win: 'Windows', linux: 'Linux' }[os]
    var btn = document.getElementById('download')
    // Split around {os} instead of interpolating, so a language that puts the
    // platform first ("macOS 版をダウンロード") still reads correctly.
    if (btn) btn.textContent = ${JSON.stringify(forOs[0])} + label + ${JSON.stringify(forOs[1] ?? '')}
    var card = document.querySelector('.dl[data-os="' + os + '"]')
    if (card) card.classList.add('yours')
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

const STYLES = `/* Plain modern CSS — custom properties, native nesting, color-mix(), logical
   properties. No preprocessor, so fixing a colour is editing this string. */

/* ── Tokens ─────────────────────────────────────────────────────────────── */

:root {
  color-scheme: light dark;

  /* The app's own accent (src/renderer/src/styles.css), and a deeper ink of it
     for text so links clear WCAG AA on white. */
  --accent: #6c5ce7;
  --accent-ink: #5343d0;
  --accent-2: #0ea5b7;
  --on-accent: #fff;

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
  :root {
    --accent: #7c6cf0;
    --accent-ink: #b3a9ff;
    --accent-2: #4fd1e0;
    --bg: #0c0d16;
    --surface: #13141f;
    --surface-2: #1a1b29;
    --line: #262838;
    --line-strong: #33364a;
    --ink: #ececf4;
    --ink-2: #b4b6c8;
    --ink-3: #8c8fa6;
    --tint: color-mix(in oklab, var(--accent) 12%, var(--surface));
    --glow: color-mix(in oklab, var(--accent) 30%, transparent);
    --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.4);
    --shadow-md: 0 1px 2px rgb(0 0 0 / 0.3), 0 10px 30px -10px rgb(0 0 0 / 0.6);
    --shadow-lg: 0 2px 6px rgb(0 0 0 / 0.3), 0 40px 90px -30px rgb(0 0 0 / 0.85);
  }
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

.hero-mark {
  margin: 0 auto 28px;
  border-radius: 18px;
  box-shadow: var(--shadow-md);
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

/* A screenshot in a frame: a hairline, a lifted shadow, a rounded corner. */
.frame {
  margin: 0;
  padding: 6px;
  border-radius: var(--radius-lg);
  background: color-mix(in oklab, var(--surface) 70%, transparent);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-lg);

  img {
    width: 100%;
    border-radius: calc(var(--radius-lg) - 6px);
    border: 1px solid color-mix(in oklab, var(--line) 70%, transparent);
  }
}

.hero-shot {
  width: min(100% - 2 * var(--gutter), var(--wrap) - 2 * var(--gutter));
  margin: clamp(40px, 6vw, 72px) auto 0;
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
}

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
  gap: 4px;
  padding: 22px 24px;
  padding-inline-end: 56px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-sm);
  color: var(--ink);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;

  strong { font-size: var(--step-1); font-weight: 650; }
  span { color: var(--ink-3); font-size: var(--step--1); }

  /* A download arrow, masked so it takes the text colour. */
  &::after {
    content: "";
    position: absolute;
    inset-inline-end: 22px;
    inset-block-start: 50%;
    width: 20px;
    height: 20px;
    margin-block-start: -10px;
    background: var(--ink-3);
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M10 3v10m-4-4 4 4 4-4M4 16h12' fill='none' stroke='%23000' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M10 3v10m-4-4 4 4 4-4M4 16h12' fill='none' stroke='%23000' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  &:hover {
    text-decoration: none;
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: color-mix(in oklab, var(--accent) 40%, var(--line));
    &::after { background: var(--accent-ink); }
  }

  /* The reader's own platform, picked out by the inline script. */
  &.yours {
    background: var(--tint);
    border-color: color-mix(in oklab, var(--accent) 60%, var(--line));
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 16%, transparent), var(--shadow-sm);
    &::after { background: var(--accent-ink); }
  }
}

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
  .hero-shot { padding: 4px; border-radius: 14px; }
  .hero-shot img { border-radius: 10px; }
  .frame { padding: 4px; border-radius: 14px; }
  .frame img { border-radius: 10px; }
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
  .card:hover, .dl:hover, .btn:hover { transform: none; }
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
