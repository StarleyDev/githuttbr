import { useEffect } from 'react'
import { Hourglass, PlugZap } from 'lucide-react'
import { aiApi, setAIGuardDeps } from '../infrastructure/api'
import { otherAccounts } from '../lib/aiGuard'
import { accountLabel } from '../../../shared/aiAccounts'
import { useAIPromptStore, type AIPrompt } from '../stores/aiPrompt'
import { useSettingsStore } from '../stores/settings'
import { useT, interp } from '../i18n'

/**
 * The decision a long or dead AI call needs from the user, whatever surface
 * started it: keep waiting, move the same request to another account, or stop.
 */
export function AIRequestPrompt(): React.JSX.Element | null {
  const t = useT()
  const prompts = useAIPromptStore((s) => s.prompts)
  const showSlow = useAIPromptStore((s) => s.showSlow)
  const dropSlow = useAIPromptStore((s) => s.dropSlow)
  const askUnreachable = useAIPromptStore((s) => s.askUnreachable)

  // Every guarded AI call answers through these from now on.
  useEffect(() => {
    setAIGuardDeps({
      askUnreachable,
      cancelledMessage: () => t('aiGuard.cancelled'),
      unreachableMessage: (label) => interp(t('aiGuard.unreachable'), { name: label })
    })
    return () => setAIGuardDeps(null)
  }, [askUnreachable, t])

  useEffect(
    () =>
      aiApi.onRequestEvent((event) => {
        if (event.type === 'slow') showSlow(event.id, event.label, event.accountId)
        else dropSlow(event.id)
      }),
    [showSlow, dropSlow]
  )

  if (!prompts.length) return null
  return (
    <div className="ai-prompts" role="region">
      {prompts.map((prompt) => (
        <PromptCard key={prompt.key} prompt={prompt} />
      ))}
    </div>
  )
}

function PromptCard({ prompt }: { prompt: AIPrompt }): React.JSX.Element {
  const t = useT()
  const ai = useSettingsStore((s) => s.activeAI())
  const dismiss = useAIPromptStore((s) => s.dismiss)

  if (prompt.kind === 'unreachable') {
    return (
      <div className="toast toast-error ai-prompt" role="alert">
        <PlugZap size={16} />
        <div className="toast-body">
          <span className="toast-msg">{interp(t('aiGuard.unreachable'), { name: prompt.label })}</span>
          <div className="ai-prompt-actions">
            {prompt.others.slice(0, 3).map((account) => (
              <button key={account.id} className="btn small" onClick={() => prompt.resolve(account.id)}>
                {interp(t('aiGuard.useOther'), { name: accountLabel(account) })}
              </button>
            ))}
            <button className="btn ghost small" onClick={() => prompt.resolve(null)}>
              {t('aiGuard.cancel')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const answer = (choice: Parameters<typeof aiApi.answerSlow>[1]): void => {
    dismiss(prompt.key)
    void aiApi.answerSlow(prompt.requestId, choice)
  }
  const others = otherAccounts(ai, prompt.accountId).slice(0, 2)
  return (
    <div className="toast toast-info ai-prompt" role="status">
      <Hourglass size={16} />
      <div className="toast-body">
        <span className="toast-msg">{interp(t('aiGuard.slow'), { name: prompt.label })}</span>
        <div className="ai-prompt-actions">
          <button className="btn small" onClick={() => answer({ kind: 'wait' })}>
            {t('aiGuard.keepWaiting')}
          </button>
          {others.map((account) => (
            <button
              key={account.id}
              className="btn ghost small"
              onClick={() => answer({ kind: 'switch', accountId: account.id })}
            >
              {interp(t('aiGuard.useOther'), { name: accountLabel(account) })}
            </button>
          ))}
          <button className="btn ghost small" onClick={() => answer({ kind: 'cancel' })}>
            {t('aiGuard.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
