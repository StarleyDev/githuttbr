/**
 * The rules for showing other people's comments — pull request and issue
 * bodies a host hands back — as rendered Markdown. Pure: no DOM, no IPC, so the
 * policy is tested on its own (test/remoteContent.test.ts). The pipeline that
 * applies it is preview/remoteMarkdown.ts.
 *
 * The content is untrusted. Anyone who can comment on a repository can put
 * anything in a comment, so this profile is deliberately narrower than the one
 * for the user's own files (preview/markdown.ts): an explicit tag list, links
 * and images on http(s) only, no inline style, no target, and images from a
 * site other than the host's own held back until clicked — a remote image is a
 * request the comment's author can watch, and it carries this machine's IP.
 */

/** Tags a rendered comment may keep. Anything else is unwrapped (its text stays) or, for the forbidden ones, dropped with its content. */
export const REMOTE_ALLOWED_TAGS: readonly string[] = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'del', 's', 'code', 'pre', 'blockquote', 'kbd', 'sup', 'sub',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img', 'details', 'summary',
  // Task lists only: any other input is removed by the element policy.
  'input'
]

/** Dropped outright, never unwrapped — form controls, embeds, foreign markup, style. */
export const REMOTE_FORBID_TAGS: readonly string[] = [
  'style', 'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'svg', 'math', 'dialog',
  'form', 'button', 'select', 'option', 'textarea', 'link', 'meta', 'base', 'template', 'noscript'
]

/** Attributes a kept tag may carry. `class` survives only as a code block's `language-*` (the element policy). */
export const REMOTE_ALLOWED_ATTR: readonly string[] = [
  'href', 'src', 'alt', 'title', 'width', 'height', 'align', 'start', 'colspan', 'rowspan',
  'type', 'checked', 'disabled', 'open', 'class'
]

/** Allowed attributes that never hold a URL — exempt from the scheme check. */
export const REMOTE_URI_SAFE_ATTR: readonly string[] = [
  'alt', 'title', 'width', 'height', 'align', 'start', 'colspan', 'rowspan', 'type', 'checked', 'disabled', 'open', 'class'
]

export const REMOTE_FORBID_ATTR: readonly string[] = ['style', 'target', 'srcset', 'id', 'name']

/** Links and images: http(s) and mailto, nothing else — no `javascript:`, no `data:`, no `file:`. */
export const REMOTE_URI = /^(?:https?|mailto):/i
const IMAGE_URI = /^https?:/i

/** Where a comment is shown: the repository its relative links and own images belong to. */
export interface RemoteContentContext {
  /** The repository's web address (`https://github.com/owner/repo`); absent, relative links are dropped. */
  repoWebUrl?: string
  /** GitLab: `/uploads/…` is relative to the project, not the server. */
  gitlab?: boolean
  /** Settings → Security: images from any site load without a click. */
  loadAllImages?: boolean
}

/** Marks an image held back for a click: the address moves here, off `src`. */
export const BLOCKED_SRC_ATTR = 'data-blocked-src'

const SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * A comment's link or image address made absolute, the way the host resolves
 * it on its own page: `/path` against the server, GitLab's `/uploads/…` against
 * the project, anything else relative against the repository. Null when it
 * cannot point anywhere useful — a bare `#fragment`, or no repository to
 * resolve against. A scheme is kept as written: whether it is allowed is
 * `isAllowedRemoteUrl`'s decision, not this one's.
 */
export function resolveRemoteUrl(raw: string, ctx: RemoteContentContext): string | null {
  // Control characters hide a scheme (`java\tscript:`) from a naive check; the
  // URL parser drops them too, so they go before the scheme is read.
  // eslint-disable-next-line no-control-regex
  const url = raw.trim().replace(/[\x00-\x1f\x7f]+/g, '').replace(/ /g, '%20')
  if (!url || url.startsWith('#')) return null
  if (SCHEME.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (!ctx.repoWebUrl) return null
  let base: URL
  try {
    base = new URL(ctx.repoWebUrl.replace(/\/+$/, '') + '/')
  } catch {
    return null
  }
  try {
    if (ctx.gitlab && url.startsWith('/uploads/')) return new URL(url.slice(1), base).href
    return new URL(url, url.startsWith('/') ? base.origin : base).href
  } catch {
    return null
  }
}

/** Whether a resolved address may stay on a link (`link`) or an image (`image`). */
export function isAllowedRemoteUrl(url: string, kind: 'link' | 'image'): boolean {
  return (kind === 'image' ? IMAGE_URI : REMOTE_URI).test(url)
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Whether an image comes from the host itself, and so may load without a click.
 * The host already knows this user reads the pull request; a third party does
 * not. On github.com that is its attachments, `*.githubusercontent.com` (which
 * includes camo, the proxy GitHub puts in front of every third-party image in
 * its own rendering) and its asset domain; elsewhere, the host's own web
 * address. https only: a plain-http image is seen by anyone on the network.
 */
export function isHostImage(src: string, ctx: RemoteContentContext): boolean {
  if (!/^https:/i.test(src)) return false
  const img = hostOf(src)
  const repo = ctx.repoWebUrl ? hostOf(ctx.repoWebUrl) : null
  if (!img || !repo) return false
  if (repo === 'github.com') {
    if (img === 'github.com') return new URL(src).pathname.startsWith('/user-attachments/')
    return img.endsWith('.githubusercontent.com') || img.endsWith('.githubassets.com')
  }
  return img === repo
}

/** The domain a held-back image would be read from, for its placeholder. */
export function getImageDomain(src: string): string {
  return hostOf(src) ?? src
}

/** The slice of a DOM element the element policy touches — so it runs on a fake in tests. */
export interface PolicyElement {
  readonly nodeName: string
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

const LANG = /^language-([\w+#.-]{1,40})$/

/**
 * What runs on every kept element once its attributes are sanitized. Returns
 * false when the element must go (an input that is not a task-list checkbox).
 *
 * - links: resolved, http(s)/mailto only, no `target`, `rel="noopener noreferrer"`;
 * - images: resolved, http(s) only, `referrerpolicy="no-referrer"`, lazy, and
 *   held back (`data-blocked-src`) unless from the host or the user allows all;
 * - checkboxes: disabled — ticking one here would change nothing on the host;
 * - `class`: only a code block's `language-*`.
 */
export function applyRemoteElementPolicy(el: PolicyElement, ctx: RemoteContentContext): boolean {
  const tag = el.nodeName.toLowerCase()
  const cls = el.getAttribute('class')
  el.removeAttribute('class')
  if (cls && (tag === 'code' || tag === 'pre')) {
    const lang = cls.split(/\s+/).map((c) => LANG.exec(c)?.[1]).find(Boolean)
    if (lang) el.setAttribute('class', `language-${lang}`)
  }
  el.removeAttribute('target')
  el.removeAttribute('style')
  if (tag === 'a') {
    const raw = el.getAttribute('href')
    const href = raw === null ? null : resolveRemoteUrl(raw, ctx)
    if (href && isAllowedRemoteUrl(href, 'link')) el.setAttribute('href', href)
    else el.removeAttribute('href')
    el.setAttribute('rel', 'noopener noreferrer')
  } else el.removeAttribute('href')
  if (tag === 'img') {
    const raw = el.getAttribute('src')
    const src = raw === null ? null : resolveRemoteUrl(raw, ctx)
    el.removeAttribute('src')
    if (src && isAllowedRemoteUrl(src, 'image')) {
      el.setAttribute(ctx.loadAllImages || isHostImage(src, ctx) ? 'src' : BLOCKED_SRC_ATTR, src)
    }
    el.setAttribute('referrerpolicy', 'no-referrer')
    el.setAttribute('loading', 'lazy')
  } else el.removeAttribute('src')
  if (tag === 'input') {
    if ((el.getAttribute('type') ?? '').toLowerCase() !== 'checkbox') return false
    el.setAttribute('disabled', '')
  }
  return true
}

/**
 * GitHub's rendering puts a fence's language on a wrapper
 * (`<div class="highlight highlight-source-ts">`) the tag list unwraps. Read it
 * first, so the block can still be highlighted. Null when it names none.
 */
export function getGithubFenceLanguage(className: string | null): string | null {
  const m = /(?:^|\s)highlight-source-([\w+#.-]{1,40})(?:\s|$)/.exec(className ?? '')
  return m ? m[1] : null
}

/** A reference a link stands for: the shape a hover card is asked about. */
export interface AnchorReference {
  sigil: '#' | '!'
  id: number
}

/**
 * GitHub links `#12` itself in its rendering, so the text never reaches the
 * reference autolinker. A link whose text is `#12` and that points at this
 * repository's issue or pull request 12 is that reference: it gets the card.
 */
export function getAnchorReference(text: string, href: string, repoWebUrl: string | undefined): AnchorReference | null {
  if (!repoWebUrl) return null
  const m = /^#(\d+)$/.exec(text.trim())
  if (!m) return null
  const base = repoWebUrl.replace(/\/+$/, '').toLowerCase()
  const target = href.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase()
  const id = Number(m[1])
  return target === `${base}/issues/${id}` || target === `${base}/pull/${id}` ? { sigil: '#', id } : null
}

/** A cache of rendered comments, keyed by what produced them — oldest out first. */
export class RenderCache<V> {
  private readonly map = new Map<string, V>()
  constructor(private readonly max: number) {}
  getValue(key: string): V | undefined {
    const v = this.map.get(key)
    if (v === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }
  setValue(key: string, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string)
  }
  get size(): number {
    return this.map.size
  }
}
