import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../src/renderer/src/i18n/en'
import { ptBR } from '../src/renderer/src/i18n/pt-BR'
import {
  SETTINGS_INDEX,
  countSettingsByPage,
  normalizeSearchText,
  searchSettings,
  type SettingsTextReader
} from '../src/renderer/src/lib/settingsSearch'

const ROOT = join(__dirname, '..')
const COMPONENTS = join(ROOT, 'src/renderer/src/components')

/** The panel's reader: the UI language first, then English (deduped). */
const reader =
  (local: Record<string, string>): SettingsTextReader =>
  (key) => {
    const l = local[key]
    const e = (en as Record<string, string>)[key]
    return l === e ? [l] : [l, e]
  }
const inEnglish = reader(en as Record<string, string>)
const inPortuguese = reader(ptBR as Record<string, string>)
const keys = (q: string, r: SettingsTextReader): string[] => searchSettings(q, r).map((e) => e.key)

describe('settings search', () => {
  it('finds nothing for an empty or blank query', () => {
    expect(searchSettings('', inEnglish)).toEqual([])
    expect(searchSettings('   ', inEnglish)).toEqual([])
  })

  it('ignores case, accents and extra spaces', () => {
    expect(normalizeSearchText('  Configuração   do  Código ')).toBe('configuracao do codigo')
    // "codigo" without the accent still finds the code font size in Portuguese.
    expect(keys('fonte do codigo', inPortuguese)[0]).toBe('settings.codeFontSize')
  })

  it('needs every word, so more words narrow the list', () => {
    const font = keys('font', inEnglish)
    const terminalFont = keys('terminal font', inEnglish)
    expect(terminalFont.length).toBeLessThan(font.length)
    expect(terminalFont).toEqual(expect.arrayContaining(['settings.terminalFontSize', 'settings.terminalFontFamily']))
    expect(terminalFont).not.toContain('settings.codeFontSize')
  })

  it('answers in English too, whatever the interface language', () => {
    // Someone using the app in Portuguese who types the English word.
    expect(keys('font size', inPortuguese)).toEqual(
      expect.arrayContaining(['settings.codeFontSize', 'settings.terminalFontSize'])
    )
  })

  it('ranks a label that starts with the query above one that only mentions it', () => {
    const hits = keys('terminal', inEnglish)
    const first = en[hits[0] as keyof typeof en] as string
    expect(normalizeSearchText(first).startsWith('terminal')).toBe(true)
  })

  it("matches a page's name, so the page's settings come up", () => {
    const pages = new Set(searchSettings('layout', inEnglish).map((e) => e.page))
    expect(pages.has('layout')).toBe(true)
  })

  it('counts matches per page for the sidebar', () => {
    const counts = countSettingsByPage(searchSettings('terminal', inEnglish))
    expect(counts.layout).toBeGreaterThan(0)
    expect(counts.themes).toBeGreaterThan(0)
    expect(counts.profile).toBeUndefined()
  })
})

describe('settings index', () => {
  it('lists each setting once per page', () => {
    const seen = SETTINGS_INDEX.map((e) => `${e.page}:${e.key}`)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('puts a tab only on the Themes page', () => {
    for (const e of SETTINGS_INDEX) if (e.tab) expect(e.page).toBe('themes')
  })

  // The guard with teeth: a labelled setting added to a Settings screen but not
  // to the index is a setting the search can never find.
  it('covers every labelled setting the Settings screens render', () => {
    const files = [
      'SettingsPanel.tsx',
      'EnvironmentSettings.tsx',
      'GithubEnterpriseSettings.tsx',
      'GitlabServersSettings.tsx',
      'BitbucketServerSettings.tsx',
      'ProfileAvatarSettings.tsx',
      'AboutSettingsPage.tsx'
    ]
    // Only what a Settings page actually renders: SettingsPanel.tsx also hosts
    // sections the per-repository settings dialog uses, which this search does
    // not cover. So: split the files into components, then walk from each page.
    const bodies = new Map<string, string>()
    for (const f of files) {
      const src = readFileSync(join(COMPONENTS, f), 'utf8')
      const marks = [...src.matchAll(/^(?:export )?function ([A-Z]\w*)/gm)]
      marks.forEach((m, i) => bodies.set(m[1], src.slice(m.index, marks[i + 1]?.index ?? src.length)))
    }
    const pageRoots = [
      'ProfilePage',
      'IntegrationsPage',
      'AIPage',
      'ThemesPage',
      'GeneralPage',
      'LayoutPage',
      'WorkspacesPage',
      'SecurityPage',
      'ShortcutsPage',
      'DataPage',
      'EnvironmentPage',
      'AboutSettingsPage'
    ]
    const rendered = new Set<string>()
    const stack = [...pageRoots]
    while (stack.length) {
      const name = stack.pop() as string
      const body = bodies.get(name)
      if (!body || rendered.has(name)) continue
      rendered.add(name)
      for (const m of body.matchAll(/<([A-Z]\w*)[\s/>]/g)) stack.push(m[1])
    }
    expect(rendered.size).toBeGreaterThan(pageRoots.length)

    const patterns = [
      // A toggle card's title.
      /className="settings-toggle-copy">\s*<strong>\{t\('([\w.-]+)'\)\}<\/strong>/g,
      // A field's label.
      /settings-field-label">\{t\('([\w.-]+)'\)\}<\/span>/g,
      // A section heading — the panel's own <h4>s, with or without an icon.
      /<h4[^>]*>\s*(?:<[A-Z]\w*[^>]*\/>\s*)?\{t\('([\w.-]+)'\)\}/g,
      // A control with no visible label, tagged for the search instead.
      /data-setting="([\w.-]+)"/g
    ]
    const indexed = new Set(SETTINGS_INDEX.map((e) => e.key as string))
    const missing: string[] = []
    for (const name of rendered) {
      const body = bodies.get(name) as string
      for (const p of patterns) {
        for (const m of body.matchAll(p)) if (!indexed.has(m[1])) missing.push(`${name}: ${m[1]}`)
      }
    }
    expect([...new Set(missing)]).toEqual([])
  })
})
