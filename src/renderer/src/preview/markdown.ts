import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { canLoadLanguage, highlightAuto, highlightCode, isLanguageReady, loadLanguage } from '../lib/highlight'

// GitHub-ish defaults: hard line breaks off, GFM on (tables, autolinks, etc).
marked.setOptions({ gfm: true, breaks: false })

/** Sanitize arbitrary HTML (converted .docx or spreadsheet) for dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}

// DOMPurify's default URI filter, extended with `file:`. In the packaged app
// the window is loaded via file://, so bundled images resolve to absolute
// file:// URLs which the default filter would strip. Only used for trusted,
// bundled content (the handbook) — never for repo files or AI output.
const URI_WITH_FILE =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|file):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i

/** Render markdown to sanitized HTML, with syntax-highlighted code blocks.
 *  Output is safe to pass to dangerouslySetInnerHTML — DOMPurify strips any
 *  scripts/handlers (matters since AI output and repo files are untrusted).
 *  `allowFileMedia` must only be set for content bundled with the app. */
export function renderMarkdown(src: string, opts?: { allowFileMedia?: boolean }): string {
  const raw = marked.parse(src, { async: false }) as string
  const clean = DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target'],
    ...(opts?.allowFileMedia ? { ALLOWED_URI_REGEXP: URI_WITH_FILE } : {})
  })
  // Highlight fenced code after sanitizing (operates on a detached fragment).
  const tpl = document.createElement('template')
  tpl.innerHTML = clean
  const pending = new Set<string>()
  tpl.content.querySelectorAll('pre code').forEach((el) => {
    const lang = [...el.classList].find((c) => c.startsWith('language-'))?.slice(9)
    const text = el.textContent || ''
    if (lang && isLanguageReady(lang)) {
      el.innerHTML = highlightCode(text, lang)
    } else if (lang && canLoadLanguage(lang)) {
      // Rendered plain now, upgraded in place once the language chunk lands.
      el.setAttribute(PENDING_ATTR, lang)
      pending.add(lang)
      return
    } else {
      el.innerHTML = highlightAuto(text)
    }
    el.classList.add('hljs')
  })
  for (const lang of pending) void loadLanguage(lang).then((ok) => upgradePending(lang, ok))
  return tpl.innerHTML
}

const PENDING_ATTR = 'data-hl-pending'

/** Highlight the blocks renderMarkdown left plain for `lang`, wherever they
 *  were mounted. They sit inside dangerouslySetInnerHTML, which React never
 *  diffs, so editing them in place is safe; a later re-render produces fresh
 *  markup that the now-registered language highlights directly. A block that
 *  is not in the document yet simply stays plain until its next render. */
function upgradePending(lang: string, ok: boolean): void {
  document.querySelectorAll(`code[${PENDING_ATTR}]`).forEach((el) => {
    if (el.getAttribute(PENDING_ATTR) !== lang) return
    const text = el.textContent || ''
    el.innerHTML = ok ? highlightCode(text, lang) : highlightAuto(text)
    el.removeAttribute(PENDING_ATTR)
    el.classList.add('hljs')
  })
}
