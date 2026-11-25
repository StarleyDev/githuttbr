import { useEffect, useState } from 'react'
import { ExternalLink, Plus, Server, Trash2, Unplug } from 'lucide-react'
import { hostingApi, shellApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { useT, interp, type TranslationKey } from '../i18n'
import type { TokenCheckFailure } from '../../../shared/tokenCheck'
import { TokenCheckNotice } from './TokenCheckNotice'
import {
  gitlabServerUrlProblem,
  gitlabTokenUrl,
  normalizeGitlabServerUrl,
  normalizeInstanceUrl,
  type GitlabServerUrlProblem
} from '../../../shared/gitlabInstance'
import { serverDisplayAddress } from '../../../shared/serverAddress'
import type { ConnectedAccount, GitlabServer, Profile } from '../../../shared/types'

const PROBLEM: Record<GitlabServerUrlProblem, TranslationKey> = {
  invalid: 'settings.gitlabServerInvalid',
  http: 'settings.gitlabServerInvalidHttp',
  credentials: 'settings.gitlabServerInvalidCredentials',
  query: 'settings.gitlabServerInvalidQuery',
  gitlabCom: 'settings.gitlabServerInvalidGitlabCom'
}

/**
 * `host[/path]` — what a row is called. The path matters: two GitLabs can share
 * a host. A saved address that no longer parses (an import, a hand-edited
 * settings file) is shown without any credentials it carries, instead of
 * reaching `new URL` and throwing.
 */
function serverName(url: string): string {
  const base = normalizeInstanceUrl(url)
  return base ? base.replace(/^https:\/\//, '') : serverDisplayAddress(url)
}

/**
 * Settings → Integrations → GitLab: the profile's self-managed servers. Each
 * keeps its own token — saved through the same keychain path as every other
 * token (shared/secrets.ts files it under the server's address) — and the main
 * process only ever sends it to that server. gitlab.com's token is the field
 * above this list and never reaches any of them.
 */
export function GitlabServersSettings({
  profile,
  edit
}: {
  profile: Profile
  edit: (p: Partial<Profile>) => void
}): React.JSX.Element {
  const t = useT()
  const servers = profile.gitlabServers ?? []
  const [draft, setDraft] = useState('')
  const problem = draft.trim() ? gitlabServerUrlProblem(draft) : null
  const base = draft.trim() && !problem ? normalizeGitlabServerUrl(draft) : null
  const duplicate = !!base && servers.some((s) => normalizeInstanceUrl(s.url) === base)

  const add = (): void => {
    if (!base || duplicate) return
    edit({ gitlabServers: [...servers, { url: base, token: '' }] })
    setDraft('')
  }

  const update = (url: string, patch: Partial<GitlabServer>): void =>
    edit({ gitlabServers: servers.map((s) => (s.url === url ? { ...s, ...patch } : s)) })

  const remove = (server: GitlabServer): void => {
    const name = serverName(server.url)
    useUIStore.getState().openDialog({
      kind: 'confirm',
      title: interp(t('settings.gitlabServerRemoveTitle'), { host: name }),
      message: interp(t('settings.gitlabServerRemoveConfirm'), { host: name }),
      danger: true,
      confirmLabel: t('settings.gitlabServerRemove'),
      onConfirm: () => edit({ gitlabServers: servers.filter((s) => s.url !== server.url) })
    })
  }

  // Only a link carried over from a one-instance profile can be here; letting go
  // of it leaves the login itself in git's helper (or gh), as on the main tab.
  const unlink = (server: GitlabServer): void => {
    const link = server.link
    if (!link) return
    useUIStore.getState().openDialog({
      kind: 'confirm',
      title: interp(t('settings.disconnectTitle'), { provider: serverName(server.url) }),
      message: interp(t(link.source === 'gh' ? 'settings.disconnectLinkGh' : 'settings.disconnectLinkGit'), {
        login: link.login
      }),
      danger: true,
      confirmLabel: t('settings.disconnect'),
      onConfirm: () => update(server.url, { link: undefined })
    })
  }

  return (
    <div className="ghes-section">
      <h4>
        <Server size={14} /> {t('settings.gitlabServersTitle')}
      </h4>
      <p className="settings-hint">{t('settings.gitlabServersIntro')}</p>

      {servers.length === 0 && <p className="settings-hint ghes-empty">{t('settings.gitlabServersEmpty')}</p>}
      {servers.map((s) =>
        normalizeInstanceUrl(s.url) ? (
          <GitlabServerRow
            key={s.url}
            server={s}
            onToken={(token) => update(s.url, { token })}
            onUnlink={() => unlink(s)}
            onRemove={() => remove(s)}
          />
        ) : (
          // Nothing is ever sent to an address that does not normalise; it can only be removed.
          <div className="ghes-row" key={s.url}>
            <div className="ghes-row-head">
              <span className="ghes-host">{serverName(s.url)}</span>
              <span className="conn-status">{t(PROBLEM[gitlabServerUrlProblem(s.url) ?? 'invalid'])}</span>
              <button className="btn ghost small danger" type="button" onClick={() => remove(s)} title={t('settings.gitlabServerRemove')}>
                <Trash2 size={13} /> {t('settings.gitlabServerRemove')}
              </button>
            </div>
          </div>
        )
      )}

      <label>
        {t('settings.gitlabServerUrl')}
        <span className="ghes-add">
          <input
            type="text"
            value={draft}
            placeholder={t('settings.gitlabServerUrlPlaceholder')}
            aria-invalid={!!problem || duplicate}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
          />
          <button className="btn small" type="button" disabled={!base || duplicate} onClick={add}>
            <Plus size={13} /> {t('settings.gitlabServerAdd')}
          </button>
        </span>
        {(problem || duplicate) && (
          <span className="connected-account-error">
            {t(duplicate ? 'settings.gitlabServerDuplicate' : PROBLEM[problem!])}
          </span>
        )}
      </label>
    </div>
  )
}

/** One server: its address, its token, and who that token signs in as. */
function GitlabServerRow({
  server,
  onToken,
  onUnlink,
  onRemove
}: {
  server: GitlabServer
  onToken: (token: string) => void
  onUnlink: () => void
  onRemove: () => void
}): React.JSX.Element {
  const t = useT()
  const name = serverName(server.url)
  const [account, setAccount] = useState<ConnectedAccount | null>(null)
  const [failure, setFailure] = useState<TokenCheckFailure | null>(null)
  // Bumped by Retry, to run the check again for the same token.
  const [checkRun, setCheckRun] = useState(0)
  const linkKey = server.link ? `${server.link.source}:${server.link.login}` : ''

  // Asked only with this server's own credential, never interactively: opening
  // Settings must not pop a sign-in window for every server in the list. The
  // issuer is the row's own base, so main refuses to send it anywhere else.
  useEffect(() => {
    let alive = true
    setAccount(null)
    setFailure(null)
    if (!server.token.trim() && !server.link) return
    const timer = setTimeout(() => {
      void hostingApi
        .checkToken('gitlab', server.token, server.url, false, server.link, server.url)
        .then((result) => {
          if (!alive) return
          if (result.ok) setAccount(result.account)
          // Refused or not, the token stays in its field: replacing it is the user's call.
          else setFailure(result.failure)
        })
        .catch((err: Error) => alive && setFailure({ kind: 'error', message: err.message }))
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // linkKey stands for the link: a new object with the same account is no reason to re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.url, server.token, linkKey, checkRun])

  return (
    <div className="ghes-row">
      <div className="ghes-row-head">
        <span className="ghes-host">{name}</span>
        {account ? (
          <span className="conn-status connected">
            <span className="conn-pulse" />
            {interp(t('settings.gitlabServerConnectedAs'), { login: account.login })}
          </span>
        ) : (
          <span className="conn-status">{t('settings.notConnected')}</span>
        )}
        <button className="btn ghost small danger" type="button" onClick={onRemove} title={t('settings.gitlabServerRemove')}>
          <Trash2 size={13} /> {t('settings.gitlabServerRemove')}
        </button>
      </div>
      {server.link && (
        <div className="connected-account-source">
          <span className="settings-hint">{interp(t('settings.gitlabServerLinked'), { login: server.link.login })}</span>
          <button className="btn ghost small danger" type="button" onClick={onUnlink}>
            <Unplug size={13} /> {t('settings.disconnect')}
          </button>
        </div>
      )}
      <label>
        {t('settings.pat')}
        <input type="password" value={server.token} placeholder="glpat-…" onChange={(e) => onToken(e.target.value)} />
        <span className="settings-hint">{interp(t('settings.gitlabServerTokenHint'), { host: name })}</span>
      </label>
      {failure && <TokenCheckNotice failure={failure} provider={name} onRetry={() => setCheckRun((n) => n + 1)} />}
      <button className="link-btn" type="button" onClick={() => void shellApi.openExternal(gitlabTokenUrl(server.url))}>
        <ExternalLink size={12} /> {interp(t('settings.gitlabServerCreateToken'), { host: name })}
      </button>
    </div>
  )
}
