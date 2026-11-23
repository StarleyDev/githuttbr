import { useEffect, useState } from 'react'
import { ExternalLink, Plus, Server, Trash2 } from 'lucide-react'
import { hostingApi, shellApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { useT, interp, type TranslationKey } from '../i18n'
import { readableError } from '../lib/gitErrorHint'
import {
  githubEnterpriseUrlProblem,
  githubTokenUrl,
  normalizeGithubEnterpriseUrl,
  type GithubEnterpriseUrlProblem
} from '../../../shared/githubEnterprise'
import { serverDisplayAddress } from '../../../shared/serverAddress'
import type { ConnectedAccount, GithubEnterpriseHost, Profile } from '../../../shared/types'

const PROBLEM: Record<GithubEnterpriseUrlProblem, TranslationKey> = {
  invalid: 'settings.ghesInvalid',
  http: 'settings.ghesInvalidHttp',
  path: 'settings.ghesInvalidPath',
  credentials: 'settings.ghesInvalidCredentials',
  githubCom: 'settings.ghesInvalidGithubCom',
  gheCom: 'settings.ghesInvalidGheCom'
}

/**
 * What a row is called: its host. A saved address that no longer parses (an
 * import, a hand-edited settings file) is shown without any credentials it
 * carries — never handed to `new URL`, which would throw and take the whole
 * Integrations page down with it.
 */
function hostName(url: string): string {
  const base = normalizeGithubEnterpriseUrl(url)
  return base ? base.replace(/^https:\/\//, '') : serverDisplayAddress(url)
}

/**
 * Settings → Integrations → GitHub: the profile's GitHub Enterprise Servers.
 * Each server keeps its own token — saved through the same keychain path as
 * every other token (shared/secrets.ts files it under the server's address) —
 * and the main process only ever sends it to that server.
 */
export function GithubEnterpriseSettings({
  profile,
  edit
}: {
  profile: Profile
  edit: (p: Partial<Profile>) => void
}): React.JSX.Element {
  const t = useT()
  const hosts = profile.githubEnterprise ?? []
  const [draft, setDraft] = useState('')
  const problem = draft.trim() ? githubEnterpriseUrlProblem(draft) : null
  const base = draft.trim() && !problem ? normalizeGithubEnterpriseUrl(draft) : null
  const duplicate = !!base && hosts.some((h) => normalizeGithubEnterpriseUrl(h.url) === base)

  const add = (): void => {
    if (!base || duplicate) return
    edit({ githubEnterprise: [...hosts, { url: base, token: '' }] })
    setDraft('')
  }

  const setToken = (url: string, token: string): void =>
    edit({ githubEnterprise: hosts.map((h) => (h.url === url ? { ...h, token } : h)) })

  const remove = (host: GithubEnterpriseHost): void => {
    const name = hostName(host.url)
    useUIStore.getState().openDialog({
      kind: 'confirm',
      title: interp(t('settings.ghesRemoveTitle'), { host: name }),
      message: interp(t('settings.ghesRemoveConfirm'), { host: name }),
      danger: true,
      confirmLabel: t('settings.ghesRemove'),
      onConfirm: () => edit({ githubEnterprise: hosts.filter((h) => h.url !== host.url) })
    })
  }

  return (
    <div className="ghes-section">
      <h4>
        <Server size={14} /> {t('settings.ghesTitle')}
      </h4>
      <p className="settings-hint">{t('settings.ghesIntro')}</p>

      {hosts.length === 0 && <p className="settings-hint ghes-empty">{t('settings.ghesEmpty')}</p>}
      {hosts.map((h) =>
        normalizeGithubEnterpriseUrl(h.url) ? (
          <GithubEnterpriseRow key={h.url} host={h} onToken={(v) => setToken(h.url, v)} onRemove={() => remove(h)} />
        ) : (
          // Nothing is ever sent to an address that does not normalise; it can only be removed.
          <div className="ghes-row" key={h.url}>
            <div className="ghes-row-head">
              <span className="ghes-host">{hostName(h.url)}</span>
              <span className="conn-status">{t(PROBLEM[githubEnterpriseUrlProblem(h.url) ?? 'invalid'])}</span>
              <button className="btn ghost small danger" type="button" onClick={() => remove(h)} title={t('settings.ghesRemove')}>
                <Trash2 size={13} /> {t('settings.ghesRemove')}
              </button>
            </div>
          </div>
        )
      )}

      <label>
        {t('settings.ghesUrl')}
        <span className="ghes-add">
          <input
            type="text"
            value={draft}
            placeholder={t('settings.ghesUrlPlaceholder')}
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
            <Plus size={13} /> {t('settings.ghesAdd')}
          </button>
        </span>
        {(problem || duplicate) && (
          <span className="connected-account-error">{t(duplicate ? 'settings.ghesDuplicate' : PROBLEM[problem!])}</span>
        )}
      </label>
    </div>
  )
}

/** One server: its address, its token, and who that token signs in as. */
function GithubEnterpriseRow({
  host,
  onToken,
  onRemove
}: {
  host: GithubEnterpriseHost
  onToken: (token: string) => void
  onRemove: () => void
}): React.JSX.Element {
  const t = useT()
  const name = hostName(host.url)
  const [account, setAccount] = useState<ConnectedAccount | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Asked only with this server's own token, never interactively: opening
  // Settings must not pop a sign-in window for every server in the list.
  useEffect(() => {
    let alive = true
    setAccount(null)
    setError(null)
    if (!host.token.trim()) return
    const timer = setTimeout(() => {
      void hostingApi
        .whoAmI('github', host.token, host.url, false)
        .then((info) => alive && setAccount(info))
        .catch((err: Error) => alive && setError(err.message))
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [host.url, host.token])

  return (
    <div className="ghes-row">
      <div className="ghes-row-head">
        <span className="ghes-host">{name}</span>
        {account ? (
          <span className="conn-status connected">
            <span className="conn-pulse" />
            {interp(t('settings.ghesConnectedAs'), { login: account.login })}
          </span>
        ) : (
          <span className="conn-status">{t('settings.notConnected')}</span>
        )}
        <button className="btn ghost small danger" type="button" onClick={onRemove} title={t('settings.ghesRemove')}>
          <Trash2 size={13} /> {t('settings.ghesRemove')}
        </button>
      </div>
      <label>
        {t('settings.pat')}
        <input type="password" value={host.token} onChange={(e) => onToken(e.target.value)} />
        <span className="settings-hint">{interp(t('settings.ghesTokenHint'), { host: name })}</span>
      </label>
      {error && <span className="connected-account-error">{readableError(error, t, interp)}</span>}
      <button className="link-btn" type="button" onClick={() => void shellApi.openExternal(githubTokenUrl(host.url))}>
        <ExternalLink size={12} /> {interp(t('settings.ghesCreateToken'), { host: name })}
      </button>
    </div>
  )
}
