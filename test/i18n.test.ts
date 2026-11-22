import { describe, it, expect, beforeEach, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Language } from '../src/shared/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const I18N_DIR = join(ROOT, 'src/renderer/src/i18n')

/**
 * One dictionary file per locale; `en.ts` is the reference the rest match.
 * The directory also holds plumbing (`index.ts`, `interp.ts`) — a locale is a
 * two-letter code, which keeps helpers from being mistaken for a language.
 */
const LOCALES = readdirSync(I18N_DIR)
  .filter((f) => /^[a-z]{2}(-[A-Za-z]{2,4})?\.ts$/.test(f))
  .map((f) => f.replace(/\.ts$/, ''))

const source = (locale: string): string => readFileSync(join(I18N_DIR, `${locale}.ts`), 'utf8')

/** Keys declared in a dictionary object literal, in source order. */
function keysOf(src: string): string[] {
  return [...src.matchAll(/^ {2}['"]([^'"]+)['"]:/gm)].map((m) => m[1])
}

/** Key → the set of {placeholder} names its value interpolates. */
function placeholdersOf(src: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const m of src.matchAll(/^ {2}['"]([^'"]+)['"]: ['"](.*?)['"],?$/gm)) {
    out.set(m[1], new Set([...m[2].matchAll(/\{(\w+)\}/g)].map((v) => v[1])))
  }
  return out
}

describe('i18n', () => {
  it('has no hardcoded user-facing strings in the renderer', () => {
    // Throws (and prints every offending file:line) when the guard fails.
    execFileSync('node', [join(ROOT, 'scripts/check-i18n.mjs')], { stdio: 'pipe' })
  })

  it('ships at least the English reference locale', () => {
    expect(LOCALES).toContain('en')
    expect(keysOf(source('en')).length).toBeGreaterThan(0)
  })

  it.each(LOCALES)('%s declares no duplicate keys', (locale) => {
    const keys = keysOf(source(locale))
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s covers exactly the English keys', (locale) => {
    // `Dict = typeof en` already catches missing keys at compile time; this also
    // catches stale keys a locale kept after English dropped them.
    expect([...keysOf(source(locale))].sort()).toEqual([...keysOf(source('en'))].sort())
  })

  it.each(LOCALES.filter((l) => l !== 'en'))(
    '%s keeps every {placeholder} the English string uses',
    (locale) => {
      const en = placeholdersOf(source('en'))
      const other = placeholdersOf(source(locale))
      const mismatched: string[] = []
      for (const [key, expected] of en) {
        const actual = other.get(key)
        if (!actual) continue
        if ([...expected].sort().join(',') !== [...actual].sort().join(',')) mismatched.push(key)
      }
      expect(mismatched).toEqual([])
    }
  )
})

describe('locale loading', () => {
  // Fresh module state per test: the loader caches what it has fetched.
  beforeEach(() => vi.resetModules())
  const loader = (): Promise<typeof import('../src/renderer/src/i18n/loader')> =>
    import('../src/renderer/src/i18n/loader')

  it('starts with English only, and reads an unloaded locale as English', async () => {
    const { isLocaleLoaded, lookup } = await loader()
    const { en } = await import('../src/renderer/src/i18n/en')
    expect(isLocaleLoaded('en')).toBe(true)
    expect(isLocaleLoaded('de')).toBe(false)
    expect(lookup('de', 'settings.language')).toBe(en['settings.language'])
  })

  it('translates in the locale once it has loaded', async () => {
    const { isLocaleLoaded, loadLocale, lookup } = await loader()
    const { de } = await import('../src/renderer/src/i18n/de')
    await loadLocale('de')
    expect(isLocaleLoaded('de')).toBe(true)
    expect(lookup('de', 'settings.language')).toBe(de['settings.language'])
    expect(de['settings.language']).not.toBe(lookup('en', 'settings.language'))
  })

  it('shares one request between concurrent loads and resolves at once when cached', async () => {
    const { loadLocale, useLocaleStore } = await loader()
    const sizes: number[] = []
    const unsub = useLocaleStore.subscribe((s) => sizes.push(Object.keys(s.loaded).length))
    await Promise.all([loadLocale('ja'), loadLocale('ja')])
    await loadLocale('ja')
    await loadLocale('en')
    unsub()
    // Exactly one store update: English plus Japanese.
    expect(sizes).toEqual([2])
  })

  // The loader map is typed against `Language`; this catches a locale file on
  // disk that was never wired in, which the type alone cannot see.
  it.each(LOCALES.filter((l) => l !== 'en'))('has a loader wired for %s', async (locale) => {
    const { isLocaleLoaded, loadLocale } = await loader()
    await loadLocale(locale as Language)
    expect(isLocaleLoaded(locale as Language)).toBe(true)
  })
})
