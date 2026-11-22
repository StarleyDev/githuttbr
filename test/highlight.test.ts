import { describe, it, expect } from 'vitest'
import {
  EAGER_LANGUAGES,
  ON_DEMAND_ALIASES,
  canLoadLanguage,
  guessLanguage,
  highlightAuto,
  highlightCode,
  isLanguageReady,
  languageModuleFor,
  loadLanguage
} from '../src/renderer/src/lib/highlight'

// Every extension guessLanguage knows. Its callers highlight synchronously, so
// each target has to be in the eager set — a lazy one would render plain.
const MAPPED_FILES = [
  'a.js', 'a.jsx', 'a.mjs', 'a.cjs', 'a.ts', 'a.tsx', 'a.py', 'a.rb', 'a.go', 'a.rs', 'a.java', 'a.cpp',
  'a.cc', 'a.c', 'a.h', 'a.cs', 'a.php', 'a.swift', 'a.kt', 'a.scala', 'a.sh', 'a.bash', 'a.zsh', 'a.json',
  'a.xml', 'a.html', 'a.htm', 'a.vue', 'a.css', 'a.scss', 'a.less', 'a.md', 'a.markdown', 'a.yml', 'a.yaml',
  'a.toml', 'a.ini', 'a.sql', 'a.r', 'a.dart', 'a.lua', 'a.pl', 'Dockerfile', 'Makefile'
]

describe('highlight — language choice', () => {
  it('maps extensions case-insensitively, and unknown ones to nothing', () => {
    expect(guessLanguage('src/App.TSX')).toBe('typescript')
    expect(guessLanguage('index.html')).toBe('xml')
    expect(guessLanguage('Cargo.toml')).toBe('ini')
    expect(guessLanguage('Dockerfile')).toBe('dockerfile')
    expect(guessLanguage('notes.weird')).toBe('')
    expect(guessLanguage('')).toBe('')
  })

  it('maps only to languages that are registered at startup', () => {
    for (const f of MAPPED_FILES) {
      const lang = guessLanguage(f)
      expect(lang, f).not.toBe('')
      expect(isLanguageReady(lang), `${f} → ${lang}`).toBe(true)
    }
  })

  it('resolves eager aliases without loading anything', () => {
    for (const alias of ['js', 'ts', 'tsx', 'sh', 'zsh', 'console', 'html', 'yml', 'toml', 'py', 'rb', 'text']) {
      expect(isLanguageReady(alias), alias).toBe(true)
    }
  })

  it('finds the language file for a name or an on-demand alias', () => {
    const available = new Set(['haskell', 'powershell', 'elixir'])
    expect(languageModuleFor('haskell', available)).toBe('haskell')
    expect(languageModuleFor('  Haskell ', available)).toBe('haskell')
    expect(languageModuleFor('hs', available)).toBe('haskell')
    expect(languageModuleFor('ps1', available)).toBe('powershell')
    expect(languageModuleFor('exs', available)).toBe('elixir')
    expect(languageModuleFor('clj', available)).toBeNull()
    expect(languageModuleFor('nope', available)).toBeNull()
    expect(languageModuleFor('', available)).toBeNull()
  })

  it('points every on-demand alias at a language file that exists', () => {
    for (const [alias, target] of Object.entries(ON_DEMAND_ALIASES)) {
      expect(EAGER_LANGUAGES.includes(target), `${alias} → ${target} is eager`).toBe(false)
      expect(canLoadLanguage(alias), `${alias} → ${target}`).toBe(true)
    }
  })
})

describe('highlight — rendering', () => {
  it('colours a registered language', () => {
    expect(highlightCode('const a = 1', 'javascript')).toContain('hljs-keyword')
    expect(highlightCode('def f(): pass', 'py')).toContain('hljs-keyword')
  })

  it('falls back to escaped plain text and never throws', () => {
    expect(highlightCode('<b> & </b>', 'no-such-language')).toBe('&lt;b&gt; &amp; &lt;/b&gt;')
    expect(highlightCode('<b>', '')).toBe('&lt;b&gt;')
    expect(highlightCode('', 'javascript')).toBe('')
    expect(() => highlightAuto('<<<>>> ;;; {{{')).not.toThrow()
    expect(highlightAuto('<script>')).not.toContain('<script>')
  })

  it('renders a lazy language plain until it is loaded, then colours it', async () => {
    expect(isLanguageReady('haskell')).toBe(false)
    expect(canLoadLanguage('hs')).toBe(true)
    expect(highlightCode('module Main where', 'haskell')).toBe('module Main where')
    await expect(loadLanguage('hs')).resolves.toBe(true)
    expect(isLanguageReady('haskell')).toBe(true)
    expect(canLoadLanguage('hs')).toBe(false)
    expect(highlightCode('module Main where', 'haskell')).toContain('hljs-keyword')
  })

  it('resolves false for a language no file provides', async () => {
    expect(canLoadLanguage('klingon')).toBe(false)
    await expect(loadLanguage('klingon')).resolves.toBe(false)
    await expect(loadLanguage('')).resolves.toBe(false)
  })
})
