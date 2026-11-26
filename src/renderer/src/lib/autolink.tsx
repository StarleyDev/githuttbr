import type { ReactNode } from 'react'
import type { ReferenceQuery, RepoConfigLink } from '../../../shared/types'
import { ticketSegments } from './repoConfig'
import { azureOrgOf, workItemUrl } from './workItem'

/** Convert a git remote URL (ssh or https) to its web base, or undefined. */
export function remoteWebUrl(url?: string): string | undefined {
  if (!url) return undefined
  const m = /^(?:git@|https?:\/\/(?:[^@/]+@)?)([^:/]+)[:/](.+?)(?:\.git)?\/?$/.exec(url.trim())
  if (m) return `https://${m[1]}/${m[2]}`
  return url.startsWith('http') ? url.replace(/\.git$/, '') : undefined
}

/** A host blob/permalink URL for `file` at commit `sha`. Handles GitHub/Gitea,
 *  GitLab (`/-/blob`) and Bitbucket (`/src`); other hosts fall back to GitHub
 *  style. Returns undefined when the remote isn't a recognisable web host. */
export function filePermalink(remoteUrl: string | undefined, sha: string, file: string): string | undefined {
  const base = remoteWebUrl(remoteUrl)
  if (!base) return undefined
  const path = file.split('/').map(encodeURIComponent).join('/')
  const host = base.replace(/^https:\/\//, '').split('/')[0]
  if (host.includes('gitlab')) return `${base}/-/blob/${sha}/${path}`
  if (host.includes('bitbucket')) return `${base}/src/${sha}/${path}`
  return `${base}/blob/${sha}/${path}`
}

// `AB#123` first, so its `#123` is not taken as an issue on its own.
const TOKEN = /(\bAB#\d+)|(#\d+)|(\B@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?)|(\B!\d+)/g

/** A reference link autolink made, handed to `renderReference` to dress. */
export interface ReferenceLinkParts {
  key: number
  href: string
  text: string
}

export interface AutolinkOptions {
  /** The remote is on GitLab: `!123` links to its merge request. */
  gitlab?: boolean
  /**
   * Render an issue / pull request / work item link — the hover card wraps it
   * (components/ReferenceLink.tsx). Not called for `@user` or tracker links.
   * Absent, the link is a plain `<a>`.
   */
  renderReference?: (q: ReferenceQuery, link: ReferenceLinkParts) => ReactNode
}

/**
 * Turn `#123` issue/PR refs and `@user` mentions in free text into links to the
 * hosting provider, and any token the repository's `.githuttbr.json` describes
 * into a link to its tracker. Plain http(s) URLs in the text are left to the
 * app's global external-link handler.
 *
 * Tracker patterns win where both could match: they are the repository's own
 * statement about what its commit text means.
 */
export function autolink(
  text: string,
  repoWebUrl?: string,
  tickets?: RepoConfigLink[],
  options?: AutolinkOptions
): ReactNode {
  if (tickets?.length) {
    const segments = ticketSegments(text, tickets)
    if (segments.length > 1 || segments[0]?.href) {
      return segments.map((seg, i) =>
        seg.href ? (
          <a key={i} href={seg.href} title={seg.label ?? seg.href}>
            {seg.text}
          </a>
        ) : (
          <span key={i}>{hostLinks(seg.text, repoWebUrl, options)}</span>
        )
      )
    }
  }
  return hostLinks(text, repoWebUrl, options)
}

/**
 * `#123` and `@user`, linked to the hosting provider. On Azure DevOps `#123` is a
 * work item, not an issue, and `AB#123` — Azure Boards' own mention — is one
 * everywhere the organization is known.
 */
function hostLinks(text: string, repoWebUrl?: string, options?: AutolinkOptions): ReactNode {
  if (!text || !repoWebUrl) return text
  let origin: string
  try {
    origin = new URL(repoWebUrl).origin
  } catch {
    return text
  }
  const azureOrg = azureOrgOf(repoWebUrl)
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  let i = 0
  const reference = (q: ReferenceQuery, href: string, label: string): ReactNode => {
    const key = i++
    return options?.renderReference ? (
      options.renderReference(q, { key, href, text: label })
    ) : (
      <a key={key} href={href}>
        {label}
      </a>
    )
  }
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) {
      // AB#123 — a work item. Without a known Azure org it stays text.
      const n = Number(m[1].slice(3))
      out.push(azureOrg ? reference({ sigil: 'AB#', id: n }, workItemUrl(azureOrg, n), m[1]) : m[1])
    } else if (m[2]) {
      const n = Number(m[2].slice(1))
      // On Azure `#123` is the work item `AB#123` names: one card, one cache entry.
      out.push(
        azureOrg
          ? reference({ sigil: 'AB#', id: n }, workItemUrl(azureOrg, n), m[2])
          : reference({ sigil: '#', id: n }, `${repoWebUrl}/issues/${n}`, m[2])
      )
    } else if (m[4]) {
      // `!123` is a GitLab merge request; elsewhere it is just punctuation.
      const n = Number(m[4].slice(1))
      out.push(options?.gitlab ? reference({ sigil: '!', id: n }, `${repoWebUrl}/-/merge_requests/${n}`, m[4]) : m[4])
    } else {
      const user = m[3].slice(1)
      out.push(
        <a key={i++} href={`${origin}/${user}`}>
          {m[3]}
        </a>
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length ? out : text
}
