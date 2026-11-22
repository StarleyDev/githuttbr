import { create } from 'zustand'
import type { Language } from '../../../shared/types'
import { en, type Dict, type TranslationKey } from './en'

/**
 * Every locale but English is fetched on demand: together they are megabytes of
 * source, and a user reads one. Each `import()` becomes its own chunk, so start-up
 * pays for English (the reference and the fallback, always present) plus the
 * active language, which the settings store awaits before the first render.
 *
 * Kept apart from `index.ts` so the settings store can import it without pulling
 * the store back in through `useT`.
 */
const dictionaries: Record<Exclude<Language, 'en'>, () => Promise<Dict>> = {
  es: () => import('./es').then((m) => m.es),
  de: () => import('./de').then((m) => m.de),
  fr: () => import('./fr').then((m) => m.fr),
  'pt-BR': () => import('./pt-BR').then((m) => m.ptBR),
  it: () => import('./it').then((m) => m.it),
  nl: () => import('./nl').then((m) => m.nl),
  pl: () => import('./pl').then((m) => m.pl),
  tr: () => import('./tr').then((m) => m.tr),
  ru: () => import('./ru').then((m) => m.ru),
  uk: () => import('./uk').then((m) => m.uk),
  'zh-CN': () => import('./zh-CN').then((m) => m.zhCN),
  ja: () => import('./ja').then((m) => m.ja),
  ko: () => import('./ko').then((m) => m.ko),
  ar: () => import('./ar').then((m) => m.ar),
  he: () => import('./he').then((m) => m.he)
}

/** The dictionaries in memory. A store, so `useT` re-renders when one arrives. */
export const useLocaleStore = create<{ loaded: Partial<Record<Language, Dict>> }>(() => ({
  loaded: { en }
}))

const pending = new Map<Language, Promise<void>>()

export function isLocaleLoaded(lang: Language): boolean {
  return !!useLocaleStore.getState().loaded[lang]
}

/**
 * Load `lang`'s dictionary once; concurrent callers share the same request.
 * Never rejects: a failed chunk is logged and the UI stays on English rather
 * than blocking boot, and the next call retries.
 */
export function loadLocale(lang: Language): Promise<void> {
  if (isLocaleLoaded(lang)) return Promise.resolve()
  const load = (dictionaries as Partial<Record<Language, () => Promise<Dict>>>)[lang]
  if (!load) return Promise.resolve()
  let p = pending.get(lang)
  if (!p) {
    p = load()
      .then((dict) => {
        useLocaleStore.setState((s) => ({ loaded: { ...s.loaded, [lang]: dict } }))
      })
      .catch((err: unknown) => {
        console.error(`[i18n] failed to load locale ${lang}`, err)
      })
      .finally(() => pending.delete(lang))
    pending.set(lang, p)
  }
  return p
}

/**
 * The raw (unbranded) string for `key` in `lang`. A locale that is not loaded
 * yet reads as English — never as the bare key — so a caller that races a
 * language switch shows correct copy in the wrong language for a moment, not
 * gibberish. Falls back to the key itself only if English lacks it too.
 */
export function lookup(lang: Language, key: TranslationKey): string {
  const { loaded } = useLocaleStore.getState()
  return loaded[lang]?.[key] ?? en[key] ?? key
}
