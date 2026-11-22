import { useMemo } from 'react'
import { renderMarkdown } from '../preview/markdown'
import { usePendingHighlight } from '../preview/pendingHighlight'

/** Markdown rendered to sanitized HTML, whose on-demand code fences upgrade
 *  even when their language lands before or after this mounts. */
export function MarkdownHtml({ markdown, className }: { markdown: string; className?: string }): React.JSX.Element {
  const html = useMemo(() => renderMarkdown(markdown), [markdown])
  const ref = usePendingHighlight(html)
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
