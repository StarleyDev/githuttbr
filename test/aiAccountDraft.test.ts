import { describe, it, expect } from 'vitest'
import { defaultAIConfig, type AIAccount, type AIConfig, type ModelCatalog } from '../src/shared/types'
import { migrateAIConfig } from '../src/shared/aiAccounts'
import {
  accountStatus,
  changedFields,
  checkFingerprint,
  checkFromCatalog,
  checkFromDetection,
  checkFromError,
  checkFromSubscription,
  checkNeedsKey,
  checkPlanFor,
  commitDraft,
  isDraftDirty,
  readableReason,
  startEditDraft,
  startNewDraft
} from '../src/renderer/src/lib/aiAccountDraft'

const openai = (over: Partial<AIAccount> = {}): AIAccount => ({
  id: 'openai',
  label: 'OpenAI',
  provider: 'openai',
  endpoint: '',
  apiKey: 'sk-test-0000000000000000',
  model: 'gpt-4o-mini',
  ...over
})

const live = (models: string[]): ModelCatalog => ({ models, allModels: models, source: 'live', fetchedAt: 1 })

function config(accounts: AIAccount[], defaultAccountId = accounts[0].id): AIConfig {
  return { ...defaultAIConfig(), accounts, defaultAccountId }
}

describe('provider drafts', () => {
  it('a new draft is pending until committed and is not in the config', () => {
    const ai = config([openai()])
    const draft = startNewDraft(ai.accounts ?? [])
    expect(isDraftDirty(draft)).toBe(true)
    expect(ai.accounts).toHaveLength(1)
  })

  it('an edit is only pending while it differs from what is saved', () => {
    const saved = openai()
    const draft = startEditDraft(saved)
    expect(isDraftDirty(draft)).toBe(false)
    const typed = { ...draft, account: { ...draft.account, apiKey: 'sk-other' } }
    expect(isDraftDirty(typed)).toBe(true)
    expect([...changedFields(typed)]).toEqual(['apiKey'])
    const back = { ...typed, account: { ...typed.account, apiKey: saved.apiKey } }
    expect(isDraftDirty(back)).toBe(false)
    expect(isDraftDirty(null)).toBe(false)
  })

  it('treats a missing optional field and an empty one as the same', () => {
    const saved = openai()
    const draft = { original: saved, account: { ...saved, cliPath: '' } }
    expect(isDraftDirty(draft)).toBe(false)
  })

  it('commits a new draft under an id from its final provider', () => {
    const ai = config([openai()])
    const draft = startNewDraft(ai.accounts ?? [])
    draft.account = { ...draft.account, provider: 'ollama', label: 'Ollama', apiKey: '' }
    const { ai: next, accountId } = commitDraft(ai, draft)
    expect(accountId).toBe('ollama')
    expect(next.accounts?.map((a) => a.id)).toEqual(['openai', 'ollama'])
    expect(next.defaultAccountId).toBe('openai')
  })

  it('replaces the untouched keyless starter as the default', () => {
    const starter = migrateAIConfig({})
    expect(starter.accounts?.[0].id).toBe('default')
    const draft = startNewDraft(starter.accounts ?? [])
    draft.account = { ...draft.account, apiKey: 'sk-real-key-1234567890' }
    const { ai: next, accountId } = commitDraft(starter, draft)
    expect(next.defaultAccountId).toBe(accountId)
  })

  it('commits an edit in place, keeping the id and the default', () => {
    const ai = config([openai(), openai({ id: 'openai-2', label: 'Work' })])
    const draft = startEditDraft(ai.accounts![1])
    draft.account = { ...draft.account, id: 'ignored', model: 'gpt-4.1' }
    const { ai: next, accountId } = commitDraft(ai, draft)
    expect(accountId).toBe('openai-2')
    expect(next.accounts?.[1]).toMatchObject({ id: 'openai-2', model: 'gpt-4.1' })
    expect(next.defaultAccountId).toBe('openai')
  })
})

describe('connection checks', () => {
  it('plans a test by account type', () => {
    expect(checkPlanFor(openai())).toBe('list')
    expect(checkPlanFor(openai({ apiKey: '' }))).toBe('needs-key')
    expect(checkPlanFor(openai({ provider: 'ollama', apiKey: '' }))).toBe('list')
    expect(checkPlanFor(openai({ provider: 'cli', cli: 'codex', subscription: true }))).toBe('subscription')
    expect(checkPlanFor(openai({ provider: 'cli', cli: 'gemini' }))).toBe('detect')
    // Only Codex and Claude have a subscription probe.
    expect(checkPlanFor(openai({ provider: 'cli', cli: 'gemini', subscription: true }))).toBe('detect')
  })

  it('only a live list proves the connection', () => {
    const account = openai()
    expect(checkFromCatalog(account, live(['a', 'b']))).toMatchObject({ ok: true, models: 2 })
    const failed = checkFromCatalog(account, {
      models: [],
      source: 'cache',
      fetchedAt: 1,
      error: 'Could not list models (401): bad key'
    })
    expect(failed).toMatchObject({ ok: false, detail: 'Could not list models (401): bad key' })
  })

  it('maps subscription and detection results to translated reasons', () => {
    const cli = openai({ provider: 'cli', cli: 'claude', subscription: true, apiKey: '' })
    expect(checkFromSubscription(cli, 'connected').ok).toBe(true)
    expect(checkFromSubscription(cli, 'login')).toMatchObject({ ok: false, reasonKey: 'settings.accountCheckLogin' })
    expect(checkFromSubscription(cli, 'missing')).toMatchObject({ reasonKey: 'settings.cliNotFound' })
    expect(checkFromDetection(cli, false)).toMatchObject({ ok: false, reasonKey: 'settings.cliNotFound' })
    expect(checkNeedsKey(openai({ apiKey: '' }))).toMatchObject({ ok: false, reasonKey: 'settings.accountNeedsKey' })
  })

  it('a fingerprint changes with the key itself, not only its presence', () => {
    expect(checkFingerprint(openai())).not.toBe(checkFingerprint(openai({ apiKey: 'sk-test-1111111111111111' })))
    expect(checkFingerprint(openai())).not.toContain('sk-test')
  })
})

describe('error text shown to the user', () => {
  it('masks the account key even when the provider echoes it', () => {
    const key = 'my-private-key-value'
    const text = readableReason(`Invalid key ${key} provided`, [key])
    expect(text).not.toContain(key)
    expect(text).toContain('***')
  })

  it('masks key shapes and key query parameters', () => {
    expect(readableReason('Incorrect API key: sk-proj-abcdefghijklmnop1234')).not.toContain('abcdefghijklmnop')
    expect(readableReason('at https://x.example/v1/models?key=AIzaSyA1234567890abcdefghij')).not.toContain('AIzaSy')
    expect(readableReason('https://h.example/?api_key=secret123&x=1')).toBe('https://h.example/?api_key=***&x=1')
  })

  it('a thrown error goes through the same masking', () => {
    const account = openai({ apiKey: 'plain-secret-token' })
    const check = checkFromError(account, new Error('boom plain-secret-token'))
    expect(check).toMatchObject({ ok: false })
    expect(check.ok === false && check.detail).toBe('boom ***')
  })

  it('lifts the message out of a JSON error body, even one cut short', () => {
    const body = 'Could not list models (401): { "error": { "message": "Incorrect API key provided: sk-demo-***xx. You can find'
    expect(readableReason(body)).toBe('Could not list models (401): Incorrect API key provided: sk-demo-***xx. You can find')
    expect(readableReason('Could not list models (500): {"detail":"down"}')).toBe('Could not list models (500): {"detail":"down"}')
  })

  it('collapses whitespace and bounds the length', () => {
    expect(readableReason('a\n\n  b')).toBe('a b')
    expect(readableReason('x'.repeat(1000)).length).toBeLessThanOrEqual(300)
  })
})

describe('account status', () => {
  it('a required key that is missing wins over everything', () => {
    const account = openai({ apiKey: '' })
    expect(accountStatus(account, live(['a']), undefined).status).toBe('no-key')
  })

  it('derives from the fetched list when nothing was tested', () => {
    const account = openai()
    expect(accountStatus(account, undefined, undefined).status).toBe('unchecked')
    expect(accountStatus(account, live(['a']), undefined).status).toBe('ready')
    expect(accountStatus(account, { ...live(['a']), source: 'cache' }, undefined).status).toBe('ready')
    const down = accountStatus(account, { models: ['a'], source: 'fallback', fetchedAt: null, error: 'Could not reach x' }, undefined)
    expect(down).toEqual({ status: 'failing', detail: 'Could not reach x' })
  })

  it('a check of the same connection overrides the list', () => {
    const account = openai()
    const failed = checkFromError(account, new Error('refused'))
    expect(accountStatus(account, live(['a']), failed)).toMatchObject({ status: 'failing', detail: 'refused' })
    // Once the key changes, the old check no longer describes the account.
    const changed = openai({ apiKey: 'sk-test-2222222222222222' })
    expect(accountStatus(changed, live(['a']), failed).status).toBe('ready')
  })

  it('a CLI is judged by its check or by finding the command, never by its bundled list', () => {
    const plain = openai({ provider: 'cli', cli: 'gemini', apiKey: '' })
    expect(accountStatus(plain, live(['x']), undefined, undefined).status).toBe('unchecked')
    expect(accountStatus(plain, live(['x']), undefined, true).status).toBe('ready')
    expect(accountStatus(plain, live(['x']), undefined, false)).toMatchObject({ status: 'failing', reasonKey: 'settings.cliNotFound' })
    const plan = openai({ provider: 'cli', cli: 'codex', subscription: true, apiKey: '' })
    expect(accountStatus(plan, live(['x']), undefined, true).status).toBe('unchecked')
    expect(accountStatus(plan, undefined, checkFromSubscription(plan, 'connected')).status).toBe('ready')
  })
})
