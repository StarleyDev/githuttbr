import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, type ReactNode } from 'react'
import {
  applyRemoteElementPolicy,
  BLOCKED_SRC_ATTR,
  getAnchorReference,
  getGithubFenceLanguage,
  getImageDomain,
  isAllowedRemoteUrl,
  isHostImage,
  RenderCache,
  REMOTE_ALLOWED_TAGS,
  resolveRemoteUrl,
  type PolicyElement,
  type RemoteContentContext
} from '../src/renderer/src/lib/remoteContent'
import { convertRemoteTree, type RemoteImageParts, type RemoteNode } from '../src/renderer/src/lib/remoteTree'
import { parseRemoteMarkdown, REMOTE_PURIFY_CONFIG } from '../src/renderer/src/preview/remoteMarkdown'
import { withCommentBody } from '../src/renderer/src/lib/commentEdit'
import type { AutolinkOptions } from '../src/renderer/src/lib/autolink'
import type { PrDetail } from '../src/shared/types'

// Other people's comments, rendered: the sanitizer profile, the URL and image
// policy, and the walk that turns the sanitized tree into React. The suite has
// no DOM, so the DOMPurify run itself is not exercised here; what it is
// configured with, and every rule its hooks apply, are.

const GH: RemoteContentContext = { repoWebUrl: 'https://github.com/example/app' }
const GL: RemoteContentContext = { repoWebUrl: 'https://gitlab.example.org/group/proj', gitlab: true }

/** A DOM element as the policy sees it. */
function fakeEl(nodeName: string, attrs: Record<string, string>): PolicyElement & { attrs: Record<string, string> } {
  const a = { ...attrs }
  return {
    nodeName: nodeName.toUpperCase(),
    attrs: a,
    getAttribute: (n) => (n in a ? a[n] : null),
    setAttribute: (n, v) => {
      a[n] = v
    },
    removeAttribute: (n) => {
      delete a[n]
    }
  }
}

describe('remote comments — the sanitizer profile', () => {
  const tags = REMOTE_PURIFY_CONFIG.ALLOWED_TAGS as string[]
  const forbidden = REMOTE_PURIFY_CONFIG.FORBID_TAGS as string[]
  const attrs = REMOTE_PURIFY_CONFIG.ALLOWED_ATTR as string[]

  it('keeps an explicit list of tags, and forbids scripts, frames, style, forms, svg, math and dialog', () => {
    for (const t of ['p', 'h1', 'h6', 'strong', 'em', 'del', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'table',
      'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'details', 'summary', 'kbd', 'sup', 'sub', 'hr', 'br', 'input']) {
      expect(tags).toContain(t)
    }
    for (const t of ['script', 'iframe', 'style', 'form', 'textarea', 'select', 'button', 'svg', 'math', 'dialog', 'object', 'embed']) {
      expect(forbidden).toContain(t)
      expect(tags).not.toContain(t)
    }
    expect(tags).toEqual([...REMOTE_ALLOWED_TAGS])
  })

  it('allows no event handler, no style attribute and no data-/aria- attributes', () => {
    expect(attrs.some((a) => /^on/i.test(a))).toBe(false)
    expect(attrs).not.toContain('style')
    expect(REMOTE_PURIFY_CONFIG.FORBID_ATTR).toContain('style')
    expect(REMOTE_PURIFY_CONFIG.ALLOW_DATA_ATTR).toBe(false)
    expect(REMOTE_PURIFY_CONFIG.ALLOW_UNKNOWN_PROTOCOLS).toBe(false)
  })

  it('exempts the plain-value attributes from the scheme check — never href or src', () => {
    // DOMPurify checks every other attribute against ALLOWED_URI_REGEXP, so a
    // task list's type="checkbox" would vanish without this.
    const safe = REMOTE_PURIFY_CONFIG.ADD_URI_SAFE_ATTR as string[]
    for (const a of ['type', 'checked', 'disabled', 'width', 'height', 'align', 'start']) expect(safe).toContain(a)
    expect(safe).not.toContain('href')
    expect(safe).not.toContain('src')
    for (const a of safe) expect(attrs).toContain(a)
  })

  it('lets through http(s) and mailto only', () => {
    const re = REMOTE_PURIFY_CONFIG.ALLOWED_URI_REGEXP as RegExp
    for (const ok of ['https://example.org/a', 'http://example.org', 'mailto:a@example.org']) expect(re.test(ok)).toBe(true)
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'data:image/png;base64,AA',
      'vbscript:x', 'file:///etc/passwd', 'blob:https://example.org/1']) {
      expect(re.test(bad)).toBe(false)
      expect(isAllowedRemoteUrl(bad, 'link')).toBe(false)
      expect(isAllowedRemoteUrl(bad, 'image')).toBe(false)
    }
    expect(isAllowedRemoteUrl('mailto:a@example.org', 'image')).toBe(false)
  })
})

describe('remote comments — relative links', () => {
  it('resolve against the repository, or against the server for a /path', () => {
    expect(resolveRemoteUrl('docs/setup.md', GH)).toBe('https://github.com/example/app/docs/setup.md')
    expect(resolveRemoteUrl('./blob/main/a.ts', GH)).toBe('https://github.com/example/app/blob/main/a.ts')
    expect(resolveRemoteUrl('/other/repo', GH)).toBe('https://github.com/other/repo')
    expect(resolveRemoteUrl('//cdn.example.net/x.png', GH)).toBe('https://cdn.example.net/x.png')
  })

  it('GitLab uploads belong to the project', () => {
    expect(resolveRemoteUrl('/uploads/abc/shot.png', GL)).toBe('https://gitlab.example.org/group/proj/uploads/abc/shot.png')
    expect(resolveRemoteUrl('/group/other', GL)).toBe('https://gitlab.example.org/group/other')
  })

  it('a bare fragment, or nothing to resolve against, gives no link', () => {
    expect(resolveRemoteUrl('#section', GH)).toBeNull()
    expect(resolveRemoteUrl('docs/a.md', {})).toBeNull()
    expect(resolveRemoteUrl('   ', GH)).toBeNull()
  })

  it('a scheme hidden behind control characters is still a scheme — and still refused', () => {
    const url = resolveRemoteUrl('java\tscript:alert(1)', GH)
    expect(url).toBe('javascript:alert(1)')
    expect(isAllowedRemoteUrl(url!, 'link')).toBe(false)
  })
})

describe('remote comments — the element policy', () => {
  it('a link loses target, gets rel, and is resolved', () => {
    const a = fakeEl('a', { href: 'docs/a.md', target: '_blank', rel: 'opener' })
    expect(applyRemoteElementPolicy(a, GH)).toBe(true)
    expect(a.attrs).toEqual({ href: 'https://github.com/example/app/docs/a.md', rel: 'noopener noreferrer' })
  })

  it('javascript: and data: links lose their href', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,x', ' javascript:alert(1)']) {
      const a = fakeEl('a', { href })
      applyRemoteElementPolicy(a, GH)
      expect(a.attrs.href).toBeUndefined()
    }
  })

  it('style and stray classes go; a code block keeps its language', () => {
    const p = fakeEl('p', { style: 'color:red', class: 'x' })
    applyRemoteElementPolicy(p, GH)
    expect(p.attrs).toEqual({})
    const code = fakeEl('code', { class: 'foo language-ts bar' })
    applyRemoteElementPolicy(code, GH)
    expect(code.attrs).toEqual({ class: 'language-ts' })
  })

  it('an image from another site is held back; the host’s own loads', () => {
    const third = fakeEl('img', { src: 'https://tracker.example.net/pixel.png', alt: 'x' })
    applyRemoteElementPolicy(third, GH)
    expect(third.attrs.src).toBeUndefined()
    expect(third.attrs[BLOCKED_SRC_ATTR]).toBe('https://tracker.example.net/pixel.png')
    expect(third.attrs.referrerpolicy).toBe('no-referrer')
    expect(third.attrs.loading).toBe('lazy')

    for (const src of [
      'https://github.com/user-attachments/assets/0f1e2d3c',
      'https://camo.githubusercontent.com/abc/def',
      'https://private-user-images.githubusercontent.com/1/2.png?jwt=x'
    ]) {
      const img = fakeEl('img', { src })
      applyRemoteElementPolicy(img, GH)
      expect(img.attrs.src).toBe(src)
      expect(img.attrs[BLOCKED_SRC_ATTR]).toBeUndefined()
    }
  })

  it('the setting lets every image load', () => {
    const img = fakeEl('img', { src: 'https://tracker.example.net/pixel.png' })
    applyRemoteElementPolicy(img, { ...GH, loadAllImages: true })
    expect(img.attrs.src).toBe('https://tracker.example.net/pixel.png')
  })

  it('a data: or javascript: image is dropped, not held', () => {
    for (const src of ['data:image/svg+xml,<svg onload=alert(1)>', 'javascript:alert(1)']) {
      const img = fakeEl('img', { src })
      applyRemoteElementPolicy(img, GH)
      expect(img.attrs.src).toBeUndefined()
      expect(img.attrs[BLOCKED_SRC_ATTR]).toBeUndefined()
    }
  })

  it('a task-list checkbox is disabled; any other input goes', () => {
    const box = fakeEl('input', { type: 'checkbox', checked: '' })
    expect(applyRemoteElementPolicy(box, GH)).toBe(true)
    expect(box.attrs.disabled).toBe('')
    expect(applyRemoteElementPolicy(fakeEl('input', { type: 'text' }), GH)).toBe(false)
    expect(applyRemoteElementPolicy(fakeEl('input', {}), GH)).toBe(false)
  })
})

describe('remote comments — which images are the host’s', () => {
  it('github.com: attachments, *.githubusercontent.com (camo too) and its assets', () => {
    expect(isHostImage('https://github.com/user-attachments/assets/1', GH)).toBe(true)
    expect(isHostImage('https://github.com/example/app/raw/main/a.png', GH)).toBe(false)
    expect(isHostImage('https://user-images.githubusercontent.com/1.png', GH)).toBe(true)
    expect(isHostImage('https://github.githubassets.com/images/icons/emoji/unicode/1f44d.png', GH)).toBe(true)
    expect(isHostImage('https://evilgithubusercontent.com/1.png', GH)).toBe(false)
    expect(isHostImage('https://githubusercontent.com.example.net/1.png', GH)).toBe(false)
    expect(isHostImage('http://camo.githubusercontent.com/1', GH)).toBe(false)
  })

  it('any other host: its own web address only', () => {
    expect(isHostImage('https://gitlab.example.org/group/proj/uploads/a/b.png', GL)).toBe(true)
    expect(isHostImage('https://cdn.gitlab.example.org/b.png', GL)).toBe(false)
    expect(isHostImage('https://github.com/user-attachments/assets/1', GL)).toBe(false)
    expect(isHostImage('https://example.org/x.png', {})).toBe(false)
  })

  it('names the domain for the placeholder', () => {
    expect(getImageDomain('https://Tracker.Example.net:8443/a.png?x=1')).toBe('tracker.example.net')
  })
})

describe('remote comments — Markdown', () => {
  it('task lists render as checkboxes, and line breaks are kept', () => {
    const html = parseRemoteMarkdown('- [ ] todo\n- [x] done\n\nline one\nline two')
    expect(html.match(/<input[^>]*type="checkbox"/g)).toHaveLength(2)
    expect(html).toMatch(/<input[^>]*checked/)
    expect(html).toContain('line one<br>line two')
  })

  it('a fence keeps its language as a class, for the highlighter to pick up', () => {
    expect(parseRemoteMarkdown('```ts\nconst a = 1\n```')).toContain('class="language-ts"')
  })

  it('GitHub’s fence language is read off its wrapper', () => {
    expect(getGithubFenceLanguage('highlight highlight-source-ts notranslate')).toBe('ts')
    expect(getGithubFenceLanguage('highlight')).toBeNull()
    expect(getGithubFenceLanguage(null)).toBeNull()
  })
})

// ── The walk to React ────────────────────────────────────────────────────────

const text = (t: string): RemoteNode => ({ nodeType: 3, nodeName: '#text', textContent: t, childNodes: [] })
function el(tag: string, attrs: Record<string, string>, ...kids: RemoteNode[]): RemoteNode {
  return {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    textContent: kids.map((k) => k.textContent).join(''),
    childNodes: kids,
    getAttribute: (n) => (n in attrs ? attrs[n] : null),
    hasAttribute: (n) => n in attrs
  }
}
const root = (...kids: RemoteNode[]): RemoteNode => el('#fragment', {}, ...kids)

function render(tree: RemoteNode, linkOptions?: AutolinkOptions) {
  const images: RemoteImageParts[] = []
  const nodes = convertRemoteTree(tree, {
    repoWebUrl: GH.repoWebUrl,
    linkOptions,
    renderImage: (img) => {
      images.push(img)
      return createElement('i', { key: img.key, 'data-img': img.blocked ? 'held' : 'shown' })
    },
    renderCode: ({ text: t, lang }) => createElement('code', { 'data-lang': lang ?? '' }, t)
  })
  return { html: renderToStaticMarkup(createElement('div', null, ...(nodes as ReactNode[]))), images }
}

describe('remote comments — references survive rendering', () => {
  const cards = (): { opts: AutolinkOptions; refs: Array<{ sigil: string; id: number }> } => {
    const refs: Array<{ sigil: string; id: number }> = []
    return {
      refs,
      opts: {
        renderReference: vi.fn((q, link) => {
          refs.push({ sigil: q.sigil, id: q.id })
          return createElement('a', { key: link.key, className: 'ref-link', href: link.href }, link.text)
        })
      }
    }
  }

  it('#12 and @user in text become links; inside code and links they stay text', () => {
    const { opts, refs } = cards()
    const { html } = render(
      root(
        el('p', {}, text('see #12 and @alba'), el('code', {}, text('#13')), el('a', { href: 'https://example.org' }, text('#14'))),
        el('pre', {}, el('code', { class: 'language-ts' }, text('// #15')))
      ),
      opts
    )
    expect(refs).toEqual([{ sigil: '#', id: 12 }])
    expect(html).toContain('<a class="ref-link" href="https://github.com/example/app/issues/12">#12</a>')
    expect(html).toContain('<a href="https://github.com/alba">@alba</a>')
    expect(html).toContain('<code>#13</code>')
    expect(html).toContain('<code data-lang="ts">// #15</code>')
  })

  it('GitHub’s own #12 link gets the card', () => {
    const { opts, refs } = cards()
    render(root(el('p', {}, el('a', { href: 'https://github.com/example/app/pull/12', rel: 'x' }, text('#12')))), opts)
    expect(refs).toEqual([{ sigil: '#', id: 12 }])
    expect(getAnchorReference('#12', 'https://github.com/other/app/issues/12', GH.repoWebUrl)).toBeNull()
    expect(getAnchorReference('#12', 'https://github.com/example/app/issues/13', GH.repoWebUrl)).toBeNull()
    expect(getAnchorReference('#12', 'https://github.com/example/app/issues/12#issuecomment-1', GH.repoWebUrl)).toEqual({ sigil: '#', id: 12 })
  })
})

describe('remote comments — the walk only builds what the profile allows', () => {
  it('images: held back ones reach the placeholder; a bad scheme renders as its alt text', () => {
    const { html, images } = render(
      root(
        el('img', { [BLOCKED_SRC_ATTR]: 'https://tracker.example.net/p.png', alt: 'chart' }),
        el('img', { src: 'https://github.com/user-attachments/assets/1', alt: 'shot', width: '400', height: '99999' }),
        el('img', { src: 'javascript:alert(1)', alt: 'nope' })
      )
    )
    expect(images.map((i) => [i.src, i.blocked])).toEqual([
      ['https://tracker.example.net/p.png', true],
      ['https://github.com/user-attachments/assets/1', false]
    ])
    expect(images[1].width).toBe(400)
    expect(images[1].height).toBeUndefined()
    expect(html).toContain('nope')
    expect(html).not.toContain('javascript')
  })

  it('a checkbox is always disabled; links carry rel, never target or a bad href', () => {
    const { html } = render(
      root(
        el('ul', {}, el('li', {}, el('input', { type: 'checkbox', checked: '' }), text(' done'))),
        el('a', { href: 'javascript:alert(1)', target: '_blank' }, text('x')),
        el('a', { href: 'https://example.org/', onclick: 'alert(1)' }, text('y'))
      )
    )
    expect(html).toMatch(/<input type="checkbox" disabled=""[^>]*checked=""\/>/)
    expect(html).not.toContain('javascript')
    expect(html).not.toContain('target')
    expect(html).not.toContain('onclick')
    expect(html).toContain('<a href="https://example.org/" rel="noopener noreferrer">y</a>')
  })

  it('a tag outside the list is unwrapped — its text shown, escaped, never the tag', () => {
    const { html } = render(root(el('script', {}, text('alert(1)')), el('style', {}, text('p{}')), el('iframe', { src: 'https://example.org' })))
    expect(html).not.toMatch(/<script|<style|<iframe/)
    expect(html).toContain('alert(1)')
  })

  it('table cells keep a known alignment only', () => {
    const { html } = render(root(el('table', {}, el('tbody', {}, el('tr', {}, el('td', { align: 'center' }, text('a')), el('td', { align: 'x;color:red' }, text('b')))))))
    expect(html).toContain('<td style="text-align:center">a</td>')
    expect(html).toContain('<td>b</td>')
  })
})

describe('remote comments — memo and edits', () => {
  it('the render cache drops the oldest entry first, and a read keeps an entry fresh', () => {
    const c = new RenderCache<string>(2)
    c.setValue('a', '1')
    c.setValue('b', '2')
    expect(c.getValue('a')).toBe('1')
    c.setValue('c', '3')
    expect(c.getValue('b')).toBeUndefined()
    expect(c.getValue('a')).toBe('1')
    expect(c.size).toBe(2)
  })

  it('an edited comment drops the host’s rendering of its old text', () => {
    const h = { id: 1, kind: 'conversation' as const }
    const pr = {
      comments: [{ author: 'a', body: 'old', bodyHtml: '<p>old</p>', createdAt: '', handle: h }],
      reviewThreads: [{ path: 'a', line: 1, diffHunk: '', rootId: 2, comments: [
        { id: 2, author: 'a', body: 'old', bodyHtml: '<p>old</p>', createdAt: '', handle: { id: 2, kind: 'review' as const } }
      ] }]
    } as unknown as PrDetail
    const next = withCommentBody(withCommentBody(pr, h, 'new'), { id: 2, kind: 'review' }, 'newer')
    expect(next.comments[0]).toMatchObject({ body: 'new', edited: true })
    expect(next.comments[0].bodyHtml).toBeUndefined()
    expect(next.reviewThreads[0].comments[0]).toMatchObject({ body: 'newer', edited: true })
    expect(next.reviewThreads[0].comments[0].bodyHtml).toBeUndefined()
  })
})
