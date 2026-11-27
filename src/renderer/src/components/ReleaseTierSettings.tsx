import { RELEASE_TONES, isCustomReleaseTone, type ReleaseNoteTiers, type ReleaseTone, type ReleaseToneName } from '../../../shared/types'
import { useSettingsStore } from '../stores/settings'
import { useT, type TranslationKey } from '../i18n'
import { normalizeReleaseTiers } from '../lib/missionControl'
import { NumberField } from './NumberField'

const TONE_LABEL: Record<ReleaseToneName, TranslationKey> = {
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

/** What the custom swatch opens on when the range has no colour of its own yet. */
const CUSTOM_START = '#4f8cff'

/**
 * Settings → Themes: the colours of Mission Control's "N commits since the
 * tag", in ranges by count — one row per range, the last one open-ended.
 * Colours are theme tokens, offered as swatches, so a pick follows the theme
 * in light and dark; the last swatch opens the system colour picker for a
 * colour of one's own, which stays as picked in every theme.
 */
export function ReleaseTierSettings(): React.JSX.Element {
  const t = useT()
  const raw = useSettingsStore((s) => s.settings.missionReleaseTiers)
  const update = useSettingsStore((s) => s.update)
  const tiers = normalizeReleaseTiers(raw)
  const save = (next: ReleaseNoteTiers): void =>
    update((s) => ({ ...s, missionReleaseTiers: normalizeReleaseTiers(next) }))

  // One row per limit, then the open-ended last range. Raising a limit past the
  // next ones carries them along, so the ranges never cross.
  const rows: TierRow[] = [
    ...tiers.limits.map(
      (value, i): TierRow => ({
        labelKey: i === 0 ? 'settings.releaseTierFresh' : 'settings.releaseTierDue',
        count: {
          value,
          min: i === 0 ? 0 : tiers.limits[i - 1],
          set: (n) =>
            save({ ...tiers, limits: tiers.limits.map((limit, j) => (j === i ? n : j > i ? Math.max(limit, n) : limit)) })
        }
      })
    ),
    { labelKey: 'settings.releaseTierOverdue' }
  ]

  const pick = (tier: number, tone: ReleaseTone): void => {
    const tones = [...tiers.tones]
    tones[tier] = tone
    save({ ...tiers, tones })
  }

  return (
    <div className="release-tiers-section" data-setting="settings.missionReleaseTiers">
      <h4 style={{ marginTop: 16 }}>{t('settings.missionReleaseTiers')}</h4>
      <p className="settings-hint">{t('settings.missionReleaseTiersHint')}</p>
      <div className="release-tiers">
        {rows.map((row, tier) => (
          <div key={tier} className="release-tier">
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
              {/* A colour of one's own: the native picker behind a swatch. */}
              <label
                className={`release-tone release-tone-custom${isCustomReleaseTone(tiers.tones[tier]) ? ' on' : ''}`}
                title={t('settings.releaseTone.custom')}
                style={isCustomReleaseTone(tiers.tones[tier]) ? { background: tiers.tones[tier] } : undefined}
              >
                <input
                  type="color"
                  aria-label={t('settings.releaseTone.custom')}
                  value={isCustomReleaseTone(tiers.tones[tier]) ? tiers.tones[tier] : CUSTOM_START}
                  onChange={(e) => pick(tier, e.target.value as ReleaseTone)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
