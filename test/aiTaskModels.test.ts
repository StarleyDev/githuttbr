import { describe, expect, it } from 'vitest'
import { assignFeatureAccount, assignFeatureModel, modelFor, newAccount, resolveAI } from '../src/shared/aiAccounts'
import { defaultAIConfig, type AIConfig } from '../src/shared/types'

/** A Google account as the default, plus a local Ollama one. */
function twoAccounts(): AIConfig {
  const google = { ...newAccount([], 'google'), model: 'gemini-2.5-flash' }
  const ollama = { ...newAccount([google], 'ollama'), model: 'llama3.2' }
  return { ...defaultAIConfig(), accounts: [google, ollama], defaultAccountId: google.id, assignments: {} }
}

describe('model per task', () => {
  it('moving a task to another account takes that account’s default model', () => {
    let ai = twoAccounts()
    ai = { ...ai, assignments: assignFeatureModel(ai, 'chat', 'gemini-2.5-pro') }
    ai = { ...ai, assignments: assignFeatureAccount(ai, 'chat', 'ollama') }
    expect(ai.assignments.chat).toEqual({ accountId: 'ollama', model: '' })
    expect(modelFor(ai, 'chat')).toBe('llama3.2')
    expect(resolveAI(ai, 'chat').provider).toBe('ollama')
  })

  it('back to "default provider" drops the row entirely', () => {
    let ai = twoAccounts()
    ai = { ...ai, assignments: assignFeatureAccount(ai, 'chat', 'ollama') }
    ai = { ...ai, assignments: assignFeatureAccount(ai, 'chat', '') }
    expect(ai.assignments.chat).toBeUndefined()
  })

  it('a row left on the default follows a change of default account', () => {
    const ai = { ...twoAccounts(), defaultAccountId: 'ollama' }
    expect(resolveAI(ai, 'commit').provider).toBe('ollama')
    expect(modelFor(ai, 'commit')).toBe('llama3.2')
  })

  it('picking a model on a default row pins the account the model belongs to', () => {
    let ai = twoAccounts()
    ai = { ...ai, assignments: assignFeatureModel(ai, 'review', 'gemini-2.5-pro') }
    expect(ai.assignments.review).toEqual({ accountId: 'google', model: 'gemini-2.5-pro' })
    // A later default switch does not hand a Gemini model name to Ollama.
    ai = { ...ai, defaultAccountId: 'ollama' }
    expect(resolveAI(ai, 'review').provider).toBe('google')
  })

  it('clearing the model of a default row removes the row', () => {
    let ai = twoAccounts()
    ai = { ...ai, assignments: assignFeatureModel(ai, 'wiki', '') }
    expect(ai.assignments.wiki).toBeUndefined()
  })
})
