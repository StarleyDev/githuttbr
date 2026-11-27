import { RELEASE_TONES, type ReleaseNoteTiers, type ReleaseTone } from '../../../shared/types'
import { useSettingsStore } from '../stores/settings'
import { useT, type TranslationKey } from '../i18n'
import { normalizeReleaseTiers } from '../lib/missionControl'
import { NumberField } from './NumberField'

const TONE_LABEL: Record<ReleaseTone, TranslationKey> = {
  muted: 'settings.releaseTone.muted',
  accent: 'settings.releaseTone.accent',
  green: 'settings.releaseTone.green',
  yellow: 'settings.releaseTone.yellow',
  red: 'settings.releaseTone.red',
  purple: 'settings.releaseTone.purple'
}

interface TierRow {
  labelKey: TranslationKey
  /** The row's upper count and how to change it; the last row has none. */
  count?: { value: number; min: number; set: (n: number) => void }
}

/**
 * Settings → Git & sync: the colours of Mission Control's "N commits since the
 * tag", in three tiers by count. Colours are theme tokens, offered as swatches,
 * so a pick follows the theme in light and dark.
 */
export function ReleaseTierSettings(): React.JSX.Element {
  const t = useT()
  const raw = useSettingsStore((s) => s.settings.missionReleaseTiers)
  const update = useSettingsStore((s) => s.update)
  const tiers = normalizeReleaseTiers(raw)
  const save = (next: ReleaseNoteTiers): void =>
    update((s) => ({ ...s, missionReleaseTiers: normalizeReleaseTiers(next) }))

  const rows: TierRow[] = [
    {
      labelKey: 'settings.releaseTierFresh',
      // Raising the first count past the second carries the second along.
      count: {
        value: tiers.warnAfter,
        min: 0,
        set: (n) => save({ ...tiers, warnAfter: n, alertAfter: Math.max(n, tiers.alertAfter) })
      }
    },
    {
      labelKey: 'settings.releaseTierDue',
      count: { value: tiers.alertAfter, min: tiers.warnAfter, set: (n) => save({ ...tiers, alertAfter: n }) }
    },
    { labelKey: 'settings.releaseTierOverdue' }
  ]

  const pick = (tier: number, tone: ReleaseTone): void => {
    const tones: ReleaseNoteTiers['tones'] = [...tiers.tones]
    tones[tier] = tone
    save({ ...tiers, tones })
  }

  return (
    <div className="settings-field">
      <span className="settings-field-label">{t('settings.missionReleaseTiers')}</span>
      <span className="settings-hint">{t('settings.missionReleaseTiersHint')}</span>
      <div className="release-tiers">
        {rows.map((row, tier) => (
          <div key={row.labelKey} className="release-tier">
            <span className="release-tier-label">{t(row.labelKey)}</span>
            {row.count ? (
              <NumberField
                min={row.count.min}
                max={999}
                value={row.count.value}
                ariaLabel={t(row.labelKey)}
                onChange={row.count.set}
              />
            ) : (
              <span className="release-tier-gap" />
            )}
            <div className="release-tones" role="radiogroup" aria-label={t(row.labelKey)}>
              {RELEASE_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  role="radio"
                  aria-checked={tiers.tones[tier] === tone}
                  aria-label={t(TONE_LABEL[tone])}
                  title={t(TONE_LABEL[tone])}
                  className={`release-tone${tiers.tones[tier] === tone ? ' on' : ''}`}
                  data-tone={tone}
                  onClick={() => pick(tier, tone)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
