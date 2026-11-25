import { RotateCw } from 'lucide-react'
import { useT, interp } from '../i18n'
import { readableError } from '../lib/gitErrorHint'
import type { TokenCheckFailure } from '../../../shared/tokenCheck'

/**
 * Why a token check found no account, under the token's field. A refusal and
 * an unreachable server read very differently on purpose: one means "replace
 * this token", the other "nothing is known yet". Either way the token stays
 * saved — a check never deletes what the user typed.
 */
export function TokenCheckNotice({
  failure,
  provider,
  onRetry
}: {
  failure: TokenCheckFailure
  /** The host's name as the tab or row shows it — "GitHub", a GHES address, … */
  provider: string
  onRetry: () => void
}): React.JSX.Element {
  const t = useT()
  const detail = readableError(failure.message, t, interp)
  if (failure.kind === 'refused') {
    return (
      <div className="token-check token-check-refused" role="alert">
        <span>{interp(t('settings.tokenRefused'), { provider })}</span>
        {detail && <span className="token-check-detail">{detail}</span>}
      </div>
    )
  }
  if (failure.kind === 'unreachable') {
    return (
      <div className="token-check token-check-unreachable" role="status">
        <span>{interp(t('settings.tokenUnreachable'), { server: failure.server || provider })}</span>
        {detail && <span className="token-check-detail">{detail}</span>}
        <button className="btn ghost small" type="button" onClick={onRetry}>
          <RotateCw size={12} /> {t('settings.tokenCheckRetry')}
        </button>
      </div>
    )
  }
  return <span className="connected-account-error">{detail}</span>
}
