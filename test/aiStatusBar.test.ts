import { describe, it, expect } from 'vitest'
import {
  defaultAIConfig,
  defaultProfile,
  defaultSettings,
  type AIAccount,
  type AIConfig,
  type AppSettings,
  type ModelCatalog
} from '../src/shared/types'
import { effectiveAI, withAIPatch } from '../src/shared/aiScope'
import {
  aiStatusView,
  cliDetectedFor,
  inUsePatch,
  needsCliDetection,
  statusBarAccountStatus
} from '../src/renderer/src/lib/aiStatusBar'

const openai = (over: Partial<AIAccount> = {}): AIAccount => ({
  id: 'openai',
  label: 'Work key',
  provider: 'openai',
  endpoint: '',
  apiKey: 'sk-test-0000000000000000',
  model: 'gpt-4o-mini',
  ...over
})

const ollama = (over: Partial<AIAccount> = {}): AIAccount => ({
  id: 'ollama',
  label: '',
  provider: 'ollama',
  endpoint: '',
  apiKey: '',
  model: '',
  ...over
})

const config = (accounts: AIAccount[], over: Partial<AIConfig> = {}): AIConfig => ({
  ...defaultAIConfig(),
  accounts,
  defaultAccountId: accounts[0]?.id ?? '',
  ...over
})

const live: ModelCatalog = { models: ['gpt-4o-mini'], allModels: ['gpt-4o-mini'], source: 'live', fetchedAt: 1 }
const failed: ModelCatalog = {
  models: [],
  allModels: [],
  source: 'fallback',
  fetchedAt: null,
  error: 'Could not list models (401): { "error": { "message": "Incorrect API key" } }'
}

const inputs = { catalogs: {}, clis: [], keysKnown: true }

describe('aiStatusView', () => {
  it('shows nothing when AI is off or there is no account', () => {
    expect(aiStatusView(config([openai()], { enabled: false }), {}, inputs)).toBeNull()
    expect(aiStatusView(config([]), {}, inputs)).toBeNull()
  })

  it('names the scope the profile reads its AI from', () => {
    expect(aiStatusView(config([openai()]), {}, inputs)?.scope).toBe('general')
    expect(aiStatusView(config([openai()]), { ownAI: true }, inputs)?.scope).toBe('own')
  })

  it('lists every account, the default one marked in use', () => {
    const ai = config([openai(), ollama()], { defaultAccountId: 'ollama' })
    const view = aiStatusView(ai, {}, { ...inputs, catalogs: { openai: live } })
    expect(view?.inUse.id).toBe('ollama')
    expect(view?.rows.map((r) => [r.id, r.role])).toEqual([
      ['openai', 'use'],
      ['ollama', 'in-use']
    ])
    // A blank label and model fall back to the preset's, never an empty row.
    expect(view?.rows[1].label).not.toBe('')
    expect(view?.rows[1].model).not.toBe('')
    expect(view?.rows[0]).toMatchObject({ label: 'Work key', model: 'gpt-4o-mini', status: { status: 'ready' } })
  })

  it('marks the first account in use when the default points at nothing', () => {
    const view = aiStatusView(config([openai(), ollama()], { defaultAccountId: 'gone' }), {}, inputs)
    expect(view?.inUse.id).toBe('openai')
  })
})

describe('statusBarAccountStatus', () => {
  it('derives the dot from the catalog already fetched', () => {
    expect(statusBarAccountStatus(openai(), undefined, [], true).status).toBe('unchecked')
    expect(statusBarAccountStatus(openai(), live, [], true).status).toBe('ready')
    const failing = statusBarAccountStatus(openai(), failed, [], true)
    expect(failing.status).toBe('failing')
    expect(failing.detail).toContain('Incorrect API key')
  })

  it('says no key only when the keys are actually loaded', () => {
    const keyless = openai({ apiKey: '' })
    expect(statusBarAccountStatus(keyless, undefined, [], true).status).toBe('no-key')
    // Locked settings carry no keys at all; the listing main ran with the stored one decides.
    expect(statusBarAccountStatus(keyless, undefined, [], false).status).toBe('unchecked')
    expect(statusBarAccountStatus(keyless, live, [], false).status).toBe('ready')
    expect(statusBarAccountStatus(keyless, failed, [], false).status).toBe('failing')
  })

  it('reads a plain CLI account from the detection', () => {
    const cli = openai({ id: 'cli', provider: 'cli', apiKey: '', cli: 'claude' })
    const found = [{ binary: 'claude' as const, label: 'Claude Code', path: '/usr/bin/claude' }]
    expect(statusBarAccountStatus(cli, undefined, found, true).status).toBe('ready')
    expect(statusBarAccountStatus(cli, undefined, [], true).status).toBe('failing')
    expect(statusBarAccountStatus(cli, undefined, null, true).status).toBe('unchecked')
  })
})

describe('cliDetectedFor / needsCliDetection', () => {
  it('only asks for detection when a plain CLI account exists', () => {
    expect(needsCliDetection(config([openai()]))).toBe(false)
    expect(needsCliDetection(config([openai({ id: 'cli', provider: 'cli', cli: 'codex' })]))).toBe(true)
    // A subscription or a custom path cannot be told from PATH.
    expect(cliDetectedFor(openai({ provider: 'cli', subscription: true }), [])).toBeUndefined()
    expect(cliDetectedFor(openai({ provider: 'cli', cliPath: '/opt/claude' }), [])).toBeUndefined()
  })
})

describe('inUsePatch', () => {
  it('patches only the default, and nothing for the account already in use', () => {
    const ai = config([openai(), ollama()])
    expect(inUsePatch(ai, 'ollama')).toEqual({ defaultAccountId: 'ollama' })
    expect(inUsePatch(ai, 'openai')).toBeNull()
    expect(inUsePatch(ai, 'missing')).toBeNull()
  })

  it('lands where the profile reads its AI: general, or its own', () => {
    const general = config([openai(), ollama()])
    const own = config([openai({ id: 'mine' }), ollama()], { defaultAccountId: 'mine' })
    const base = defaultSettings()
    const settings: AppSettings = {
      ...base,
      ai: general,
      profiles: [
        { ...defaultProfile(), id: 'shared', name: 'Shared' },
        { ...defaultProfile(), id: 'work', name: 'Work', ownAI: true, ai: own }
      ]
    }

    const onShared = withAIPatch(settings, 'shared', inUsePatch(general, 'ollama') ?? {})
    expect(onShared.ai.defaultAccountId).toBe('ollama')
    expect(onShared.profiles[1].ai.defaultAccountId).toBe('mine')

    const onWork = withAIPatch(settings, 'work', inUsePatch(own, 'ollama') ?? {})
    expect(onWork.ai.defaultAccountId).toBe('openai')
    expect(effectiveAI(onWork, onWork.profiles[1]).defaultAccountId).toBe('ollama')
  })
})
