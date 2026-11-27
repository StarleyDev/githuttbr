import { describe, it, expect } from 'vitest'
import type { AIAccount, ModelCatalog } from '../src/shared/types'
import { accountInitial, accountSummaryParts, endpointForList } from '../src/renderer/src/lib/aiAccountSummary'

const account = (over: Partial<AIAccount>): AIAccount => ({
  id: 'a',
  label: '',
  provider: 'openai',
  endpoint: '',
  apiKey: '',
  model: '',
  ...over
})

const catalog = (count: number, source: ModelCatalog['source'] = 'live'): ModelCatalog => ({
  models: Array.from({ length: count }, (_, i) => `m${i}`),
  source,
  fetchedAt: 1
})

describe('provider row summary', () => {
  it('a CLI account names its command and its model', () => {
    expect(accountSummaryParts(account({ provider: 'cli', cli: 'claude', model: 'sonnet', subscription: true }))).toEqual([
      { text: 'CLI claude' },
      { text: 'sonnet' }
    ])
  })

  it('a CLI on its default model leaves the model out, and defaults to claude', () => {
    expect(accountSummaryParts(account({ provider: 'cli', model: '' }))).toEqual([{ text: 'CLI claude' }])
    expect(accountSummaryParts(account({ provider: 'cli', cli: 'gemini', model: '' }))).toEqual([{ text: 'CLI gemini' }])
  })

  it('a hosted API shows its model and the listed count once the provider listed them', () => {
    const google = account({ provider: 'google', model: 'gemini-3.5-flash-lite' })
    expect(accountSummaryParts(google, catalog(41))).toEqual([
      { text: 'gemini-3.5-flash-lite' },
      { key: 'settings.accountModelCount', vars: { count: '41' } }
    ])
    expect(accountSummaryParts(google, catalog(41, 'cache'))[1]).toEqual({
      key: 'settings.accountModelCount',
      vars: { count: '41' }
    })
  })

  it('the bundled list is not a count, and no list shows only the model', () => {
    const openai = account({ model: 'gpt-4o-mini' })
    expect(accountSummaryParts(openai)).toEqual([{ text: 'gpt-4o-mini' }])
    expect(accountSummaryParts(openai, catalog(4, 'fallback'))).toEqual([{ text: 'gpt-4o-mini' }])
    expect(accountSummaryParts(openai, catalog(0))).toEqual([{ text: 'gpt-4o-mini' }])
  })

  it('an empty model falls back to the provider default', () => {
    expect(accountSummaryParts(account({ provider: 'mistral', model: '' }))).toEqual([{ text: 'mistral-small-latest' }])
  })

  it('a local server shows its address without /v1, then the model', () => {
    expect(
      accountSummaryParts(account({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'qwen3:8b' }))
    ).toEqual([{ text: 'http://localhost:11434' }, { text: 'qwen3:8b' }])
    // No endpoint of its own: the preset address.
    expect(accountSummaryParts(account({ provider: 'ollama', model: 'llama3.2' }))).toEqual([
      { text: 'http://localhost:11434' },
      { text: 'llama3.2' }
    ])
  })

  it('a custom server never shows a model count, and skips what it lacks', () => {
    expect(
      accountSummaryParts(account({ provider: 'custom', endpoint: 'http://10.0.0.2:8000/v1/', model: 'qwen' }), catalog(9))
    ).toEqual([{ text: 'http://10.0.0.2:8000' }, { text: 'qwen' }])
    expect(accountSummaryParts(account({ provider: 'custom' }))).toEqual([])
  })

  it('endpointForList strips only the trailing version', () => {
    expect(endpointForList('https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api')
    expect(endpointForList('http://host/v1beta/openai')).toBe('http://host/v1beta/openai')
    expect(endpointForList('  http://host:1/  ')).toBe('http://host:1')
  })
})

describe('provider row avatar', () => {
  it('uses the provider name, or the command for a CLI', () => {
    expect(accountInitial(account({ provider: 'google' }))).toBe('G')
    expect(accountInitial(account({ provider: 'ollama' }))).toBe('O')
    expect(accountInitial(account({ provider: 'cli', cli: 'codex' }))).toBe('C')
    expect(accountInitial(account({ provider: 'cli', cli: 'devin' }))).toBe('D')
  })
})
