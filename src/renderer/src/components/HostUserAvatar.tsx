import { useState } from 'react'

/**
 * A person on the PR host — a face when the host gave one, the initial
 * otherwise. Shared by the PR detail page and the PR list, so one author looks
 * the same in both. `avatars` maps a login to its picture; only an https one is
 * ever drawn.
 */
export function HostUserAvatar({
  login,
  avatars,
  url: direct,
  size = 18,
  title
}: {
  login: string
  avatars?: Record<string, string>
  /** The picture itself, when the caller already has it. */
  url?: string
  size?: number
  title?: string
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const raw = direct ?? avatars?.[login]
  const url = raw && /^https:\/\//i.test(raw) ? raw : undefined
  const style = { width: size, height: size, fontSize: Math.round(size * 0.5) }
  if (url && !failed) {
    return <img className="prp-avatar" src={url} alt="" style={style} title={title} onError={() => setFailed(true)} draggable={false} />
  }
  return (
    <span className="prp-avatar prp-avatar-fallback" style={style} title={title}>
      {login.charAt(0).toUpperCase()}
    </span>
  )
}
