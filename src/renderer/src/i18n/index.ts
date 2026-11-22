import { useEffect } from 'react'
import type { Language } from '../../../shared/types'
import { useSettingsStore } from '../stores/settings'
import type { TranslationKey } from './en'
import { isLocaleLoaded, loadLocale, lookup, useLocaleStore } from './loader'
import { brandText } from '../../../shared/brand'

export type { TranslationKey }

// The dictionaries themselves live in `loader.ts`: English eagerly, every other
// locale as its own chunk fetched on demand.
export { loadLocale, isLocaleLoaded } from './loader'

/**
 * Every language in its own name — someone hunting for Korean is scanning for
 * 한국어, not for the word "Korean" in a language they are trying to leave.
 * Ordered by endonym, which sorts each script into its own block.
 */
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'it', label: 'Italiano' },
  { id: 'nl', label: 'Nederlands' },
  { id: 'pl', label: 'Polski' },
  { id: 'pt-BR', label: 'Português (Brasil)' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'ru', label: 'Русский' },
  { id: 'uk', label: 'Українська' },
  { id: 'ar', label: 'العربية' },
  { id: 'he', label: 'עברית' },
  { id: 'ja', label: '日本語' },
  { id: 'zh-CN', label: '简体中文' },
  { id: 'ko', label: '한국어' }
]

/**
 * `key` in `lang`. A `lang` whose dictionary has not been loaded yet (see
 * `loadLocale`) reads as English — it neither throws nor shows the bare key.
 * Boot and the language picker both load before switching, so in practice this
 * is only hit by a caller racing a switch made some other way.
 */
export function translate(lang: Language, key: TranslationKey): string {
  // The dictionaries keep upstream's wording; the product name is applied here.
  return brandText(lookup(lang, key))
}

/** Simple string interpolation — replaces {key} tokens with values. */
// Re-exported so the hundreds of `import { interp } from '../i18n'` keep working.
export { interp } from './interp'

export { isRtl } from './direction'

/** Non-reactive translator (for use outside React render). */
export function t(key: TranslationKey): string {
  const lang = useSettingsStore.getState().settings.language ?? 'en'
  // English until the dictionary lands; asking starts the (deduplicated) load.
  if (!isLocaleLoaded(lang)) void loadLocale(lang)
  return translate(lang, key)
}

/**
 * The language whose dictionary is actually on screen: the chosen one once it
 * has loaded, English before. Effects that bake translated text into something
 * outside React (the native menu, measured widths) depend on this rather than
 * on `settings.language`, so they re-run when the strings really change.
 */
export function useUiLanguage(): Language {
  const lang = useSettingsStore((s) => s.settings.language ?? 'en')
  const ready = useLocaleStore((s) => !!s.loaded[lang])
  useEffect(() => {
    if (!ready) void loadLocale(lang)
  }, [lang, ready])
  return ready ? lang : 'en'
}

/** Reactive hook: re-renders when the language setting changes or its dictionary arrives. */
export function useT(): (key: TranslationKey) => string {
  const lang = useUiLanguage()
  return (key: TranslationKey) => translate(lang, key)
}
