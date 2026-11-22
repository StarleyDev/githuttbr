import { useEffect, useState } from 'react'
import { ExternalLink, Plus, Server, Trash2 } from 'lucide-react'
import { hostingApi, shellApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { useT, interp, type TranslationKey } from '../i18n'
import { readableError } from '../lib/gitErrorHint'
import {
  bitbucketServerTokenUrl,
  bitbucketServerUrlProblem,
  normalizeBitbucketServerUrl,
  type BitbucketServerUrlProblem
} from '../../../shared/bitbucketServer'
import type { BitbucketServerHost, ConnectedAccount, Profile } from '../../../shared/types'

const PROBLEM: Record<BitbucketServerUrlProblem, TranslationKey> = {
  invalid: 'settings.bbsInvalid',
  http: 'settings.bbsInvalidHttp',
  path: 'settings.bbsInvalidPath',
  credentials: 'settings.bbsInvalidCredentials',
  cloud: 'settings.bbsInvalidCloud'
}

/** `host/context` — what a person recognises the server by. A saved address that no longer parses (an import, a hand-edited settings file) is shown as it is. */
function serverName(url: string): string {
  const base = normalizeBitbucketServerUrl(url)
  return base ? base.replace(/^https:\/\//, '') : url
}

/**
 * Settings → Integrations → Bitbucket: the profile's Bitbucket Data Centers.
 * Each server keeps its own HTTP access token, saved through the same keychain
 * path as every other token (shared/secrets.ts files it under the server's
 * base), and the main process only ever sends it to that server.
 */
export function BitbucketServerSettings({
  profile,
  edit
}: {
  profile: Profile
  edit: (p: Partial<Profile>) => void
}): React.JSX.Element {
  const t = useT()
  const hosts = profile.bitbucketServers ?? []
  const [draft, setDraft] = useState('')
  const problem = draft.trim() ? bitbucketServerUrlProblem(draft) : null
  const base = draft.trim() && !problem ? normalizeBitbucketServerUrl(draft) : null
  const duplicate = !!base && hosts.some((h) => normalizeBitbucketServerUrl(h.url) === base)

  const add = (): void => {
    if (!base || duplicate) return
    edit({ bitbucketServers: [...hosts, { url: base, token: '' }] })
    setDraft('')
  }

  const update = (url: string, patch: Partial<BitbucketServerHost>): void =>
    edit({ bitbucketServers: hosts.map((h) => (h.url === url ? { ...h, ...patch } : h)) })

  const remove = (host: BitbucketServerHost): void => {
    const name = serverName(host.url)
    useUIStore.getState().openDialog({
      kind: 'confirm',
      title: interp(t('settings.bbsRemoveTitle'), { host: name }),
      message: interp(t('settings.bbsRemoveConfirm'), { host: name }),
      danger: true,
      confirmLabel: t('settings.bbsRemove'),
      onConfirm: () => edit({ bitbucketServers: hosts.filter((h) => h.url !== host.url) })
    })
  }

  return (
    <div className="ghes-section bbs-section">
      <h4>
        <Server size={14} /> {t('settings.bbsTitle')}
      </h4>
      <p className="settings-hint">{t('settings.bbsIntro')}</p>

      {hosts.length === 0 && <p className="settings-hint ghes-empty">{t('settings.bbsEmpty')}</p>}
      {hosts.map((h) =>
        normalizeBitbucketServerUrl(h.url) ? (
          <BitbucketServerRow key={h.url} host={h} onChange={(patch) => update(h.url, patch)} onRemove={() => remove(h)} />
        ) : (
          // Nothing is ever sent to an address that does not normalise; it can only be removed.
          <div className="ghes-row" key={h.url}>
            <div className="ghes-row-head">
              <span className="ghes-host">{h.url}</span>
              <span className="conn-status">{t('settings.bbsInvalid')}</span>
              <button className="btn ghost small danger" type="button" onClick={() => remove(h)} title={t('settings.bbsRemove')}>
                <Trash2 size={13} /> {t('settings.bbsRemove')}
              </button>
            </div>
          </div>
        )
      )}

      <label>
        {t('settings.bbsUrl')}
        <span className="ghes-add">
          <input
            type="text"
            value={draft}
            placeholder={t('settings.bbsUrlPlaceholder')}
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
            <Plus size={13} /> {t('settings.bbsAdd')}
          </button>
        </span>
        {problem || duplicate ? (
          <span className="connected-account-error">{t(duplicate ? 'settings.bbsDuplicate' : PROBLEM[problem!])}</span>
        ) : (
          <span className="settings-hint">{t('settings.bbsUrlHint')}</span>
        )}
      </label>
    </div>
  )
}

/** One server: its address, its token, the user name git sends, and who the token signs in as. */
function BitbucketServerRow({
  host,
  onChange,
  onRemove
}: {
  host: BitbucketServerHost
  onChange: (patch: Partial<BitbucketServerHost>) => void
  onRemove: () => void
}): React.JSX.Element {
  const t = useT()
  const name = serverName(host.url)
  const [account, setAccount] = useState<ConnectedAccount | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Asked only with this server's own token, never interactively — and only
  // once typing has paused, so a half-typed token is not sent at every key.
  useEffect(() => {
    let alive = true
    setAccount(null)
    setError(null)
    if (!host.token.trim()) return
    const timer = setTimeout(() => {
      void hostingApi
        .whoAmI('bitbucket', host.token, host.url, false)
        .then((info) => alive && setAccount(info))
        .catch((err: Error) => alive && setError(err.message))
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [host.url, host.token])

  const username = host.username ?? ''
  return (
    <div className="ghes-row">
      <div className="ghes-row-head">
        <span className="ghes-host">{name}</span>
        {account ? (
          <span className="conn-status connected">
            <span className="conn-pulse" />
            {interp(t('settings.bbsConnectedAs'), { login: account.login })}
          </span>
        ) : (
          <span className="conn-status">{t('settings.notConnected')}</span>
        )}
        <button className="btn ghost small danger" type="button" onClick={onRemove} title={t('settings.bbsRemove')}>
          <Trash2 size={13} /> {t('settings.bbsRemove')}
        </button>
      </div>
      <label>
        {t('settings.bbsToken')}
        <input type="password" value={host.token} onChange={(e) => onChange({ token: e.target.value })} />
        <span className="settings-hint">{interp(t('settings.bbsTokenHint'), { host: name })}</span>
      </label>
      <label>
        {t('settings.bbsUsername')}
        <span className="ghes-add">
          <input type="text" value={username} onChange={(e) => onChange({ username: e.target.value })} />
          {account && !username.trim() && (
            <button className="btn small" type="button" onClick={() => onChange({ username: account.login })}>
              {interp(t('settings.bbsUseLogin'), { login: account.login })}
            </button>
          )}
        </span>
        <span className="settings-hint">{t('settings.bbsUsernameHint')}</span>
      </label>
      {error && <span className="connected-account-error">{readableError(error, t, interp)}</span>}
      <button
        className="link-btn"
        type="button"
        onClick={() => void shellApi.openExternal(bitbucketServerTokenUrl(host.url))}
      >
        <ExternalLink size={12} /> {interp(t('settings.bbsCreateToken'), { host: name })}
      </button>
    </div>
  )
}
