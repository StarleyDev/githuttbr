import { createElement, Fragment, type ReactNode } from 'react'
import { autolink, type AutolinkOptions } from './autolink'
import { BLOCKED_SRC_ATTR, getAnchorReference, isAllowedRemoteUrl, REMOTE_ALLOWED_TAGS } from './remoteContent'

/**
 * A sanitized comment (preview/remoteMarkdown.ts) as React elements, rather
 * than HTML set on a node. Two things need it: a `#12` / `!12` / `AB#12` /
 * `@user` in the text becomes the same link autolink makes — with its hover
 * card — and an image from another site becomes a component with a click to
 * load it. Text inside a link or code is never touched.
 *
 * Works on the slice of the DOM it reads, so the walk is tested on a fake tree.
 * Only the tags and attributes the remote profile keeps are read, whatever the
 * tree holds.
 */

/** The slice of a DOM node the walk reads. */
export interface RemoteNode {
  readonly nodeType: number
  readonly nodeName: string
  readonly textContent: string | null
  readonly childNodes: ArrayLike<RemoteNode>
  getAttribute?(name: string): string | null
  hasAttribute?(name: string): boolean
}

export interface RemoteImageParts {
  key: number
  src: string
  alt: string
  title?: string
  width?: number
  height?: number
  /** From another site, and not allowed to load until clicked. */
  blocked: boolean
}

export interface RemoteTreeOptions {
  repoWebUrl?: string
  linkOptions?: AutolinkOptions
  renderImage: (img: RemoteImageParts) => ReactNode
  /** A fenced block's content; `lang` only when the fence named one. */
  renderCode: (code: { text: string; lang: string | null }) => ReactNode
}

const ALLOWED = new Set(REMOTE_ALLOWED_TAGS)
const VOID = new Set(['br', 'hr'])
const ALIGN = new Set(['left', 'center', 'right'])
const LANG = /^language-([\w+#.-]{1,40})$/

const attr = (n: RemoteNode, name: string): string | null => n.getAttribute?.(name) ?? null
const has = (n: RemoteNode, name: string): boolean => n.hasAttribute?.(name) ?? attr(n, name) !== null
const tagOf = (n: RemoteNode): string => n.nodeName.toLowerCase()
const children = (n: RemoteNode): RemoteNode[] => Array.from(n.childNodes)

function intAttr(n: RemoteNode, name: string, max: number): number | undefined {
  const v = Number(attr(n, name))
  return Number.isInteger(v) && v > 0 && v <= max ? v : undefined
}

function languageOf(n: RemoteNode | undefined): string | null {
  return n ? (LANG.exec(attr(n, 'class') ?? '')?.[1] ?? null) : null
}

/** Convert a sanitized fragment's children. */
export function convertRemoteTree(root: RemoteNode, opts: RemoteTreeOptions): ReactNode[] {
  const walk = { opts, key: 0 }
  return convertChildren(root, walk, false, 0)
}

interface Walk {
  opts: RemoteTreeOptions
  key: number
}

/** Deeper than this, a subtree is shown as its text: the walk recurses, and so does React. */
export const REMOTE_TREE_DEPTH_MAX = 64

function convertChildren(parent: RemoteNode, w: Walk, plain: boolean, depth: number): ReactNode[] {
  if (depth > REMOTE_TREE_DEPTH_MAX) return [parent.textContent ?? '']
  const out: ReactNode[] = []
  for (const child of children(parent)) {
    const node = convertNode(child, w, plain, depth)
    if (node !== null && node !== undefined && node !== '') out.push(node)
  }
  return out
}

/** `plain`: inside a link or code — text shows as it is, never autolinked. */
function convertNode(node: RemoteNode, w: Walk, plain: boolean, depth: number): ReactNode {
  const { opts } = w
  if (node.nodeType === 3) {
    const text = node.textContent ?? ''
    if (plain || !text.trim()) return text
    return <Fragment key={w.key++}>{autolink(text, opts.repoWebUrl, undefined, opts.linkOptions)}</Fragment>
  }
  if (node.nodeType !== 1) return null
  const tag = tagOf(node)
  // The sanitizer removed anything else; unwrapping here is only a second fence.
  if (!ALLOWED.has(tag)) return <Fragment key={w.key++}>{convertChildren(node, w, plain, depth + 1)}</Fragment>
  const key = w.key++
  switch (tag) {
    case 'a': {
      const raw = attr(node, 'href')
      const href = raw && isAllowedRemoteUrl(raw, 'link') ? raw : undefined
      const text = node.textContent ?? ''
      // The host's own `#12` link (GitHub): the card a local `#12` gets.
      const onlyText = children(node).every((c) => c.nodeType === 3)
      const ref = href && onlyText ? getAnchorReference(text, href, opts.repoWebUrl) : null
      if (ref && href && opts.linkOptions?.renderReference) {
        return opts.linkOptions.renderReference(ref, { key, href, text: text.trim() })
      }
      return (
        <a key={key} href={href} rel="noopener noreferrer" title={attr(node, 'title') ?? undefined}>
          {convertChildren(node, w, true, depth + 1)}
        </a>
      )
    }
    case 'img': {
      const src = attr(node, 'src')
      const held = attr(node, BLOCKED_SRC_ATTR)
      const alt = attr(node, 'alt') ?? ''
      const url = src && isAllowedRemoteUrl(src, 'image') ? src : held && isAllowedRemoteUrl(held, 'image') ? held : null
      if (!url) return alt || null
      return opts.renderImage({
        key,
        src: url,
        alt,
        title: attr(node, 'title') ?? undefined,
        width: intAttr(node, 'width', 4096),
        height: intAttr(node, 'height', 4096),
        blocked: url !== src
      })
    }
    case 'input':
      // Task lists only, and never clickable: ticking it here would change nothing on the host.
      if ((attr(node, 'type') ?? '').toLowerCase() !== 'checkbox') return null
      return <input key={key} type="checkbox" checked={has(node, 'checked')} disabled readOnly />
    case 'pre': {
      const code = children(node).find((c) => c.nodeType === 1 && tagOf(c) === 'code')
      return <pre key={key}>{opts.renderCode({ text: node.textContent ?? '', lang: languageOf(code) ?? languageOf(node) })}</pre>
    }
    case 'code':
      return <code key={key}>{node.textContent}</code>
    case 'details':
      return (
        <details key={key} open={has(node, 'open') || undefined}>
          {convertChildren(node, w, plain, depth + 1)}
        </details>
      )
    case 'ol':
      return (
        <ol key={key} start={intAttr(node, 'start', 1_000_000)}>
          {convertChildren(node, w, plain, depth + 1)}
        </ol>
      )
    case 'th':
    case 'td': {
      const align = (attr(node, 'align') ?? '').toLowerCase()
      return createElement(
        tag,
        {
          key,
          style: ALIGN.has(align) ? { textAlign: align as 'left' | 'center' | 'right' } : undefined,
          colSpan: intAttr(node, 'colspan', 100),
          rowSpan: intAttr(node, 'rowspan', 100)
        },
        ...convertChildren(node, w, plain, depth + 1)
      )
    }
    default:
      return VOID.has(tag) ? createElement(tag, { key }) : createElement(tag, { key }, ...convertChildren(node, w, plain, depth + 1))
  }
}
