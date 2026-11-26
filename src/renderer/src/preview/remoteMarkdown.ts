import { Marked } from 'marked'
import createDOMPurify, { type Config, type DOMPurify } from 'dompurify'
import {
  applyRemoteElementPolicy,
  getGithubFenceLanguage,
  isAllowedRemoteUrl,
  RenderCache,
  REMOTE_ALLOWED_ATTR,
  REMOTE_ALLOWED_TAGS,
  REMOTE_FORBID_ATTR,
  REMOTE_FORBID_TAGS,
  REMOTE_URI,
  REMOTE_URI_SAFE_ATTR,
  resolveRemoteUrl,
  type RemoteContentContext
} from '../lib/remoteContent'

/**
 * Other people's Markdown — pull request and issue comments — to sanitized
 * HTML. A pipeline of its own, apart from renderMarkdown (preview/markdown.ts),
 * which serves the user's own files and is more generous: here the tag list is
 * explicit, the URL schemes are two, and images from a third party are held
 * back. The policy itself is lib/remoteContent.ts; this file wires it into
 * marked and DOMPurify.
 *
 * Highlighting is left to the component, and only for a fence that names its
 * language: auto-detection runs every grammar over the block, a cost a page of
 * other people's comments should not pay.
 */

// Its own instance, so its options never leak into renderMarkdown's. Comments
// keep their line breaks, as GitHub renders them and as the app showed them
// before they were rendered.
const remoteMarked = new Marked({ gfm: true, breaks: true })

/** The DOMPurify profile for remote content. Exported for the tests. */
export const REMOTE_PURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [...REMOTE_ALLOWED_TAGS],
  ALLOWED_ATTR: [...REMOTE_ALLOWED_ATTR],
  FORBID_TAGS: [...REMOTE_FORBID_TAGS],
  FORBID_ATTR: [...REMOTE_FORBID_ATTR],
  ALLOWED_URI_REGEXP: REMOTE_URI,
  // DOMPurify tests every attribute that is not "URI-safe" against the URI
  // pattern, so with one this strict a plain value (`type="checkbox"`,
  // `width="400"`) would be dropped. These hold no URL.
  ADD_URI_SAFE_ATTR: [...REMOTE_URI_SAFE_ATTR],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOW_SELF_CLOSE_IN_ATTR: false,
  SAFE_FOR_TEMPLATES: false,
  WHOLE_DOCUMENT: false
}

/** The context of the sanitize call running now — hooks are per instance, not per call. */
let current: RemoteContentContext = {}
let purifier: DOMPurify | null = null

function getPurifier(): DOMPurify {
  if (purifier) return purifier
  const p = createDOMPurify(window)
  p.addHook('uponSanitizeElement', (node, data) => {
    if (node.nodeType !== 1) return
    const el = node as Element
    // GitHub's fence: the language sits on a wrapper the tag list unwraps.
    if (data.tagName === 'div') {
      const lang = getGithubFenceLanguage(el.getAttribute('class'))
      const pre = lang ? el.querySelector(':scope > pre') : null
      if (pre) pre.setAttribute('class', `language-${lang}`)
    }
    // A video (a GitHub attachment) is not played here: it becomes a link to it,
    // rather than vanishing without a trace.
    if (data.tagName === 'video') {
      const src = resolveRemoteUrl(el.getAttribute('src') ?? '', current)
      if (src && isAllowedRemoteUrl(src, 'link')) {
        const a = el.ownerDocument.createElement('a')
        a.setAttribute('href', src)
        a.textContent = src
        el.replaceWith(a)
      }
    }
  })
  // Resolve before the scheme check, so a relative link survives it as an absolute one.
  p.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'href' || data.attrName === 'src') data.attrValue = resolveRemoteUrl(data.attrValue, current) ?? ''
  })
  p.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeType !== 1) return
    if (!applyRemoteElementPolicy(node as Element, current)) node.parentNode?.removeChild(node)
  })
  purifier = p
  return p
}

/** Sanitize a host's own rendering of a comment (GitHub's `body_html`) with the remote profile. */
export function sanitizeRemoteHtml(html: string, ctx: RemoteContentContext): string {
  const p = getPurifier()
  current = ctx
  try {
    return p.sanitize(html, REMOTE_PURIFY_CONFIG) as string
  } finally {
    current = {}
  }
}

/** A comment's Markdown as HTML, before sanitizing — never shown as it is. */
export function parseRemoteMarkdown(src: string): string {
  return remoteMarked.parse(src, { async: false }) as string
}

/** Render a comment's Markdown locally and sanitize it with the remote profile. */
export function renderRemoteMarkdown(src: string, ctx: RemoteContentContext): string {
  return sanitizeRemoteHtml(parseRemoteMarkdown(src), ctx)
}

// A page re-renders on every keystroke in its composer; a comment renders once.
const cache = new RenderCache<string>(400)

/**
 * A comment's sanitized HTML, memoized on its text and its context: the host's
 * rendering when there is one (GitHub), else the Markdown rendered here.
 */
export function getRemoteCommentHtml(body: string, bodyHtml: string | undefined, ctx: RemoteContentContext): string {
  const key = `${ctx.repoWebUrl ?? ''}\u0000${ctx.gitlab ? 1 : 0}${ctx.loadAllImages ? 1 : 0}${bodyHtml ? 'h' : 'm'}\u0000${bodyHtml ?? body}`
  const hit = cache.getValue(key)
  if (hit !== undefined) return hit
  const html = bodyHtml ? sanitizeRemoteHtml(bodyHtml, ctx) : renderRemoteMarkdown(body, ctx)
  cache.setValue(key, html)
  return html
}
