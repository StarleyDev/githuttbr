import { useT } from '../i18n'
import { GITLAB_COM, gitlabServerBases } from '../../../shared/gitlabInstance'
import type { Profile } from '../../../shared/types'

/** `host[/path]` of a GitLab base, as the picker lists it. */
function label(base: string): string {
  const u = new URL(base)
  return `${u.host}${u.pathname.replace(/\/+$/, '')}`
}

/**
 * Which GitLab a provider-level call (clone browser, create a repository) goes
 * to: gitlab.com or one of the profile's self-managed servers. Renders nothing
 * when the profile has no servers — gitlab.com is then the only choice.
 */
export function GitlabServerSelect({
  profile,
  value,
  onChange
}: {
  profile: Profile
  value: string
  onChange: (base: string) => void
}): React.JSX.Element | null {
  const t = useT()
  const servers = gitlabServerBases([profile])
  if (servers.length === 0) return null
  return (
    <label className="repo-profile">
      <span>{t('modal.gitlabServer')}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {[GITLAB_COM, ...servers].map((base) => (
          <option key={base} value={base}>
            {label(base)}
          </option>
        ))}
      </select>
    </label>
  )
}
