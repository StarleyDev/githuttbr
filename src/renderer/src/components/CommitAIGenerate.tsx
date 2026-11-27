import { Check, ChevronDown, Loader2, Sparkles, Undo2, RotateCw, X } from 'lucide-react'
import { useSettingsStore } from '../stores/settings'
import { useUIStore, type MenuItem } from '../stores/ui'
import { useT, interp } from '../i18n'
import { accountLabel } from '../../../shared/aiAccounts'
import {
  SLOW_GENERATION_SECONDS,
  accountDefaultTarget,
  defaultGenerationTarget,
  fallbackAccount,
  generationChoices,
  targetLabel
} from '../lib/commitGeneration'
import { useModelCatalogs } from './useModelCatalogs'
import type { CommitGeneration } from './useCommitGeneration'

/**
 * "✦ Generate with AI | account · model ▾" plus what follows it in place:
 * the running line with Cancel, and the Undo banner once text was replaced.
 * The ▾ menu picks an account and model for one generation only.
 */
export function CommitAIGenerate({ gen, disabled }: { gen: CommitGeneration; disabled: boolean }): React.JSX.Element {
  const t = useT()
  const ai = useSettingsStore((s) => s.activeAI())
  const keysKnown = useSettingsStore((s) => s.unlocked)
  const { catalogs } = useModelCatalogs(ai)
  const openContextMenu = useUIStore((s) => s.openContextMenu)
  const target = defaultGenerationTarget(ai)
  const label = targetLabel(ai, target)
  const { state } = gen
  const busy = state.phase === 'generating'

  const openTargets = (e: React.MouseEvent): void => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const items: MenuItem[] = [
      { label: t('composerAI.onceOnly'), disabled: true },
      { separator: true },
      ...generationChoices(ai, catalogs).map((choice) => ({
        label: choice.label,
        submenu: choice.models.length
          ? choice.models.map((model) => ({
              label: model,
              icon:
                target?.accountId === choice.accountId && target.model === model ? <Check size={13} /> : undefined,
              onClick: (): void => void gen.generate({ accountId: choice.accountId, model })
            }))
          : [
              {
                label: t('composerAI.accountDefault'),
                onClick: (): void => void gen.generate({ accountId: choice.accountId, model: '' })
              }
            ]
      }))
    ]
    openContextMenu(r.left, r.bottom + 4, items)
  }

  const fallback = busy && gen.elapsed >= SLOW_GENERATION_SECONDS ? fallbackAccount(ai, state.accountId, keysKnown) : null

  return (
    <div className="commit-ai">
      <div className="commit-ai-split">
        <button
          type="button"
          className="commit-ai-main"
          title={t('composer.generateWithAi')}
          disabled={disabled || busy}
          onClick={() => void gen.generate()}
        >
          {busy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
          <span>{t('composerAI.generate')}</span>
        </button>
        <button
          type="button"
          className="commit-ai-target"
          title={t('composerAI.pickTitle')}
          aria-haspopup="menu"
          disabled={disabled || busy || !label}
          onClick={openTargets}
        >
          <span className="commit-ai-target-label">{label || t('composerAI.noAccount')}</span>
          <ChevronDown size={12} />
        </button>
      </div>

      {state.phase === 'generating' && (
        <div className="commit-ai-status" role="status">
          <Loader2 size={13} className="spin" />
          <span className="commit-ai-status-text">
            {interp(t('composerAI.generating'), { name: state.label, seconds: gen.elapsed })}
          </span>
          {fallback && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => void gen.generate(accountDefaultTarget(ai, fallback.id))}
            >
              {interp(t('aiGuard.useOther'), { name: accountLabel(fallback) })}
            </button>
          )}
          <button type="button" className="btn ghost small" onClick={gen.cancel}>
            <X size={12} /> {t('aiGuard.cancel')}
          </button>
        </div>
      )}

      {state.phase === 'generated' && (
        <div className="commit-ai-status done" role="status">
          <Sparkles size={13} />
          <span className="commit-ai-status-text">
            {interp(t('composerAI.generated'), { name: state.label, seconds: state.seconds })}
          </span>
          <button type="button" className="btn ghost small" onClick={gen.undo}>
            <Undo2 size={12} /> {t('composerAI.undo')}
          </button>
          <button type="button" className="btn ghost small" disabled={disabled} onClick={() => void gen.regenerate()}>
            <RotateCw size={12} /> {t('composerAI.again')}
          </button>
        </div>
      )}
    </div>
  )
}
