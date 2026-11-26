import { memo, useMemo, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { interp, useT } from '../i18n'
import { useSettingsStore } from '../stores/settings'
import type { AutolinkOptions } from '../lib/autolink'
import { canLoadLanguage, escapeHtml, highlightCode, isLanguageReady } from '../lib/highlight'
import { getImageDomain } from '../lib/remoteContent'
import { convertRemoteTree, type RemoteImageParts } from '../lib/remoteTree'
import { getRemoteCommentHtml } from '../preview/remoteMarkdown'
import { PENDING_ATTR, usePendingHighlight } from '../preview/pendingHighlight'

/**
 * A pull request or issue comment, rendered: its Markdown (or, on GitHub, the
 * host's own rendering) through the remote profile (preview/remoteMarkdown.ts),
 * then turned into React elements (lib/remoteTree.tsx) so references keep their
 * hover cards and third-party images wait for a click.
 *
 * Typing stays cheap: the HTML is cached per text, the element tree is memoized
 * on it, and the component on its props — a keystroke in the composer renders
 * none of this again.
 */
export const RemoteMarkdown = memo(function RemoteMarkdown({
  body,
  bodyHtml,
  repoWebUrl,
  linkOptions
}: {
  body: string
  /** The host's rendering of `body`, when it sent one (GitHub). */
  bodyHtml?: string
  repoWebUrl: string | undefined
  linkOptions?: AutolinkOptions
}): React.JSX.Element {
  const loadAllImages = useSettingsStore((s) => s.settings.commentImagesFromOtherSites)
  const gitlab = !!linkOptions?.gitlab
  const html = useMemo(
    () => getRemoteCommentHtml(body, bodyHtml, { repoWebUrl, gitlab, loadAllImages }),
    [body, bodyHtml, repoWebUrl, gitlab, loadAllImages]
  )
  const tree = useMemo(() => {
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    return convertRemoteTree(tpl.content, { repoWebUrl, linkOptions, renderImage, renderCode })
  }, [html, repoWebUrl, linkOptions])
  // A fence whose language is not loaded yet is highlighted in place once it is.
  const pendingRef = usePendingHighlight(html)
  return (
    <div ref={pendingRef} className="md-preview md-remote">
      {tree}
    </div>
  )
})

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
