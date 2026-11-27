import { useEffect, useState } from 'react'
import { Loader2, Plug } from 'lucide-react'
import { AzureLogo, BitbucketLogo, ForgejoLogo, GithubLogo, GitlabLogo } from './HostLogos'
import { hostingApi } from '../infrastructure/api'
import { useT, type TranslationKey } from '../i18n'
import { useAccountChecksStore } from '../stores/accountChecks'
import { tokenMatchesInstance } from '../../../shared/gitlabInstance'
import type { ConnectedAccount, Profile, RepoHost } from '../../../shared/types'
import type { TokenCheckFailureKind } from '../../../shared/tokenCheck'

type HostRow = {
  id: RepoHost
  label: string
  icon: React.ComponentType<{ size?: number }>
  field: 'githubToken' | 'azureToken' | 'gitlabToken' | 'bitbucketToken' | 'forgejoToken'
}

/** The same hosts, in the same order, as the Connected accounts page's tabs. */
const HOSTS: HostRow[] = [
  { id: 'github', label: 'GitHub', icon: GithubLogo, field: 'githubToken' },
  { id: 'azure', label: 'Azure DevOps', icon: AzureLogo, field: 'azureToken' },
  { id: 'gitlab', label: 'GitLab', icon: GitlabLogo, field: 'gitlabToken' },
  { id: 'bitbucket', label: 'Bitbucket', icon: BitbucketLogo, field: 'bitbucketToken' },
  { id: 'forgejo', label: 'Forgejo', icon: ForgejoLogo, field: 'forgejoToken' }
]

type RowState =
  | { kind: 'none' }
  | { kind: 'checking' }
  | { kind: 'connected'; account: ConnectedAccount }
  | { kind: 'failed'; failure: TokenCheckFailureKind }

const FAILURE_KEY: Record<TokenCheckFailureKind, TranslationKey> = {
  refused: 'settings.accountRefused',
  error: 'settings.accountRefused',
  unreachable: 'settings.accountUnreachable'
}

/** What a host check needs from the profile: the token for the right server, and its scope. */
function checkArgs(profile: Profile, host: RepoHost): { token: string; org?: string; issuer?: string } {
  const raw = profile[HOSTS.find((h) => h.id === host)?.field ?? 'githubToken'] ?? ''
  if (host === 'azure') return { token: raw, org: profile.azureOrg?.trim() || undefined }
  if (host === 'gitlab') {
    const issuer = profile.gitlabTokenIssuer
    return { token: tokenMatchesInstance('gitlab', undefined, issuer) ? raw : '', issuer }
  }
  if (host === 'forgejo') {
    const issuer = profile.forgejoTokenIssuer
    const org = profile.forgejoUrl?.trim() || undefined
    return { token: tokenMatchesInstance('forgejo', org, issuer) ? raw : '', org, issuer }
  }
  return { token: raw }
}

/**
 * Settings → Profile & identity: one line per host saying whether this profile
 * is signed in there, with the way to fix it on the Connected accounts page.
 * The checks are quiet (never a sign-in window), run once per opening and per
 * token change, and are what the side menu's warning count reads.
 */
export function ProfileAccountsSummary({
  profile,
  onOpenAccounts
}: {
  profile: Profile
  onOpenAccounts: (host: RepoHost) => void
}): React.JSX.Element {
  const t = useT()
  const setAccountCheck = useAccountChecksStore((s) => s.setAccountCheck)
  const [rows, setRows] = useState<Partial<Record<RepoHost, RowState>>>({})
  const keys = HOSTS.map((h) => {
    const a = checkArgs(profile, h.id)
    return `${a.token}|${a.org ?? ''}|${profile.links?.[h.id]?.login ?? ''}`
  }).join(',')

  useEffect(() => {
    let alive = true
    const initial: Partial<Record<RepoHost, RowState>> = {}
    for (const h of HOSTS) {
      const { token, org, issuer } = checkArgs(profile, h.id)
      const link = profile.links?.[h.id]
      // Azure answers nothing without its organization; that is the page's to ask for.
      if ((!token && !link) || (h.id === 'azure' && !org)) {
        initial[h.id] = { kind: 'none' }
        setAccountCheck(profile.id, h.id, null)
        continue
      }
      initial[h.id] = { kind: 'checking' }
      void hostingApi
        .checkToken(h.id, token, org, false, link, issuer)
        .then((result) => {
          if (!alive) return
          if (!result.ok) {
            setAccountCheck(profile.id, h.id, result.failure.kind)
            setRows((cur) => ({ ...cur, [h.id]: { kind: 'failed', failure: result.failure.kind } }))
            return
          }
          setAccountCheck(profile.id, h.id, null)
          setRows((cur) => ({
            ...cur,
            [h.id]: result.account ? { kind: 'connected', account: result.account } : { kind: 'none' }
          }))
        })
        .catch(() => {
          if (alive) setRows((cur) => ({ ...cur, [h.id]: { kind: 'failed', failure: 'error' } }))
        })
    }
    setRows(initial)
    return () => {
      alive = false
    }
    // `keys` stands for the tokens, scopes and links: the profile object changes on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, keys])

  return (
    <ul className="settings-accounts-summary">
      {HOSTS.map((h) => {
        const row = rows[h.id] ?? { kind: 'none' }
        const Icon = h.icon
        const who =
          row.kind === 'connected'
            ? h.id === 'azure' && profile.azureOrg
              ? `${row.account.login} · ${profile.azureOrg}`
              : row.account.login
            : ''
        return (
          <li key={h.id} className="settings-accounts-row">
            <Icon size={14} />
            <span className="settings-accounts-host">{h.label}</span>
            <span className="settings-accounts-who">{who}</span>
            {row.kind === 'checking' ? (
              <span className="settings-pill">
                <Loader2 size={11} className="spin" /> {t('settings.accountChecking')}
              </span>
            ) : row.kind === 'connected' ? (
              <span className="settings-pill ok">{t('settings.accountConnected')}</span>
            ) : row.kind === 'failed' ? (
              <span className={`settings-pill ${row.failure === 'unreachable' ? 'warn' : 'bad'}`}>
                {t(FAILURE_KEY[row.failure])}
              </span>
            ) : (
              <span className="settings-pill">{t('settings.accountNotConnected')}</span>
            )}
            {(row.kind === 'none' || row.kind === 'failed') && (
              <button className="btn ghost small" type="button" onClick={() => onOpenAccounts(h.id)}>
                <Plug size={12} /> {t(row.kind === 'none' ? 'settings.accountConnect' : 'settings.accountRenew')}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
