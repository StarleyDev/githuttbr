import { Component, createContext, memo, useContext, useMemo, useState, type ReactNode } from 'react'
import { ImageOff } from 'lucide-react'
import { interp, useT, type TranslationKey } from '../i18n'
import { useSettingsStore } from '../stores/settings'
import { autolink, type AutolinkOptions } from '../lib/autolink'
import { canLoadLanguage, escapeHtml, highlightCode, isLanguageReady } from '../lib/highlight'
import { getImageDomain } from '../lib/remoteContent'
import { convertRemoteTree, type RemoteImageParts } from '../lib/remoteTree'
import { getRemoteCommentRender, type RemoteCommentRender } from '../preview/remoteMarkdown'
import { PENDING_ATTR, usePendingHighlight } from '../preview/pendingHighlight'

/**
 * A pull request or issue comment, rendered: its Markdown (or, on GitHub, the
 * host's own rendering) through the remote profile (preview/remoteMarkdown.ts),
 * then turned into React elements (lib/remoteTree.tsx) so references keep their
 * hover cards and third-party images wait for a click.
 *
 * Typing stays cheap: the result is cached per text, the element tree is
 * memoized on it, and the component on its props — a keystroke in the composer
 * renders none of this again.
 *
 * Nothing in a comment can take the page down: one too long or too intricate to
 * parse on the UI thread is shown as text with a note, and anything that still
 * throws while rendering is caught here, per comment, and shown as text too.
 */
interface RemoteMarkdownProps {
  body: string
  /** The host's rendering of `body`, when it sent one (GitHub). */
  bodyHtml?: string
  repoWebUrl: string | undefined
  linkOptions?: AutolinkOptions
}

export const RemoteMarkdown = memo(function RemoteMarkdown(props: RemoteMarkdownProps): React.JSX.Element {
  // Keyed on the text, so a comment that failed once is tried again when it changes.
  return (
    <RemoteMarkdownBoundary key={props.bodyHtml ?? props.body} fallback={<RemoteText {...props} reason="tooComplex" />}>
      <RenderedComment {...props} />
    </RemoteMarkdownBoundary>
  )
})

/** Where the comment boxes of a page preview their text the way it will be shown once posted. */
export interface RemotePreviewScope {
  repoWebUrl: string | undefined
  linkOptions?: AutolinkOptions
}

const PreviewScopeContext = createContext<RemotePreviewScope | null>(null)

/**
 * Comment boxes under this preview through RemoteMarkdown — the profile, the
 * image policy and the line breaks the posted comment will get — instead of the
 * generous renderer for the user's own files.
 */
export function RemotePreviewProvider({
  repoWebUrl,
  linkOptions,
  children
}: RemotePreviewScope & { children: ReactNode }): React.JSX.Element {
  const value = useMemo(() => ({ repoWebUrl, linkOptions }), [repoWebUrl, linkOptions])
  return <PreviewScopeContext.Provider value={value}>{children}</PreviewScopeContext.Provider>
}

/** The page's preview scope, or null where a box writes something else (a new PR's description). */
export function useRemotePreviewScope(): RemotePreviewScope | null {
  return useContext(PreviewScopeContext)
}

function RenderedComment({ body, bodyHtml, repoWebUrl, linkOptions }: RemoteMarkdownProps): React.JSX.Element {
  const loadAllImages = useSettingsStore((s) => s.settings.commentImagesFromOtherSites)
  const gitlab = !!linkOptions?.gitlab
  const rendered: RemoteCommentRender = useMemo(
    () => getRemoteCommentRender(body, bodyHtml, { repoWebUrl, gitlab, loadAllImages }),
    [body, bodyHtml, repoWebUrl, gitlab, loadAllImages]
  )
  const html = rendered.kind === 'html' ? rendered.html : null
  const tree = useMemo(() => {
    if (html === null) return null
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    return convertRemoteTree(tpl.content, { repoWebUrl, linkOptions, renderImage, renderCode })
  }, [html, repoWebUrl, linkOptions])
  // A fence whose language is not loaded yet is highlighted in place once it is.
  const pendingRef = usePendingHighlight(html)
  if (rendered.kind === 'text') {
    return <RemoteText body={body} repoWebUrl={repoWebUrl} linkOptions={linkOptions} reason={rendered.reason} />
  }
  return (
    <div ref={pendingRef} className="md-preview md-remote">
      {tree}
    </div>
  )
}

const TEXT_NOTE: Record<'tooLong' | 'tooComplex', TranslationKey> = {
  tooLong: 'remoteMarkdown.tooLong',
  tooComplex: 'remoteMarkdown.tooComplex'
}

/** The comment as it was shown before comments were rendered: its text, links made, and why. */
function RemoteText({
  body,
  repoWebUrl,
  linkOptions,
  reason
}: RemoteMarkdownProps & { reason: 'tooLong' | 'tooComplex' }): React.JSX.Element {
  const t = useT()
  return (
    <div className="md-remote md-remote-text">
      <p className="md-remote-note">{t(TEXT_NOTE[reason])}</p>
      <div className="md-remote-plain">{autolink(body, repoWebUrl, undefined, linkOptions)}</div>
    </div>
  )
}

/** Catches a render that throws, for one comment — the rest of the page stays. */
class RemoteMarkdownBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  componentDidCatch(err: unknown): void {
    console.warn('[remoteMarkdown] comment shown as text after a render error:', err instanceof Error ? err.name : 'error')
  }
  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const renderImage = (img: RemoteImageParts): React.ReactNode =>
  img.blocked ? <BlockedImage key={img.key} img={img} /> : <RemoteImage key={img.key} img={img} />

/**
 * A fence: highlighted when it names a language the app has, plain otherwise.
 * Never auto-detected — that runs every grammar over the block, a cost a page
 * of other people's comments should not pay.
 */
function renderCode({ text, lang }: { text: string; lang: string | null }): React.ReactNode {
  const body = text.replace(/\n$/, '')
  if (lang && isLanguageReady(lang)) {
    return <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightCode(body, lang) }} />
  }
  const pending = lang && canLoadLanguage(lang) ? { [PENDING_ATTR]: lang } : {}
  return <code {...pending} dangerouslySetInnerHTML={{ __html: escapeHtml(body) }} />
}

function RemoteImage({ img }: { img: RemoteImageParts }): React.JSX.Element {
  return (
    <img
      src={img.src}
      alt={img.alt}
      title={img.title}
      width={img.width}
      height={img.height}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="md-remote-img"
    />
  )
}

/**
 * An image from a site other than the host's: nothing is requested until it is
 * clicked. The click loads this one image, and never follows a link around it.
 */
function BlockedImage({ img }: { img: RemoteImageParts }): React.JSX.Element {
  const t = useT()
  const [shown, setShown] = useState(false)
  if (shown) return <RemoteImage img={img} />
  return (
    <button
      type="button"
      className="md-remote-img-blocked"
      title={img.src}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setShown(true)
      }}
    >
      <ImageOff size={13} aria-hidden="true" />
      <span>{interp(t('remoteImage.blocked'), { domain: getImageDomain(img.src) })}</span>
      {img.alt && <span className="md-remote-img-alt">{img.alt}</span>}
    </button>
  )
}
