import { Check, ChevronDown, Loader2, Sparkles, Undo2, RotateCw, X } from 'lucide-react'
import { useSettingsStore } from '../stores/settings'
import { useUIStore, type MenuItem } from '../stores/ui'
import { useT, interp } from '../i18n'
import {
  defaultGenerationTarget,
  generationChoices,
  targetLabel
} from '../lib/commitGeneration'
import { useModelCatalogs } from './useModelCatalogs'
import type { CommitGeneration } from './useCommitGeneration'

/**
 * "✦" and, as its own control, "account · model ▾" — plus, on the same row,
 * the running time with Cancel, or Undo and Generate again once the text was
 * replaced. The ▾ menu picks an account and model for one generation only.
 */
export function CommitAIGenerate({ gen, disabled }: { gen: CommitGeneration; disabled: boolean }): React.JSX.Element {
  const t = useT()
  const ai = useSettingsStore((s) => s.activeAI())
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
              onClick: (): void => void gen.generateMessage({ accountId: choice.accountId, model })
            }))
          : [
              {
                label: t('composerAI.accountDefault'),
                onClick: (): void => void gen.generateMessage({ accountId: choice.accountId, model: '' })
              }
            ]
      }))
    ]
    openContextMenu(r.left, r.bottom + 4, items)
  }

  // Moving a slow run to another account is the app-wide slow prompt's job
  // (it appears at the same 30 s): a second "Use …" here did the same thing
  // by another route, and two buttons for one choice only confused.

  const doneTitle =
    state.phase === 'generated' ? interp(t('composerAI.generated'), { name: state.label, seconds: state.seconds }) : ''

  // One row: the ✦ action, who answers as its own picker, and — only while it matters — the
  // running time with Cancel, or Undo and Generate again. The button itself
  // shows the spinner, so nothing else repeats that the AI is writing.
  return (
    <div className="commit-ai">
      <div className="commit-ai-split">
        <button
          type="button"
          className="commit-ai-main"
          title={t('composer.generateWithAi')}
          aria-label={t('composerAI.generate')}
          disabled={disabled || busy}
          onClick={() => void gen.generateMessage()}
        >
          {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
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
        <>
          <span
            className="commit-ai-elapsed"
            role="status"
            title={interp(t('composerAI.generating'), { name: state.label, seconds: gen.elapsed })}
          >
            {interp(t('composerAI.elapsed'), { seconds: gen.elapsed })}
          </span>
          <button type="button" className="btn ghost small" onClick={gen.cancelGeneration}>
            <X size={12} /> {t('aiGuard.cancel')}
          </button>
        </>
      )}

      {state.phase === 'generated' && (
        <>
          <button
            type="button"
            className="commit-ai-icon undo"
            title={interp(t('composerAI.undoTitle'), { action: t('composerAI.undo'), details: doneTitle })}
            aria-label={t('composerAI.undo')}
            onClick={gen.undoGeneration}
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="commit-ai-icon again"
            title={t('composerAI.again')}
            aria-label={t('composerAI.again')}
            disabled={disabled}
            onClick={() => void gen.regenerateMessage()}
          >
            <RotateCw size={14} />
          </button>
          <span className="commit-ai-live" role="status">
            {doneTitle}
          </span>
        </>
      )}
    </div>
  )
}
