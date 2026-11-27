import { describe, expect, it } from 'vitest'
import { accountConnectionKey, newAccount } from '../src/shared/aiAccounts'

describe('model list key', () => {
  const ollama = newAccount([], 'ollama')

  it('changes when the provider of the same account changes', () => {
    const anthropic = { ...ollama, provider: 'anthropic' as const, endpoint: '' }
    expect(accountConnectionKey(anthropic)).not.toBe(accountConnectionKey(ollama))
  })

  it('changes with the endpoint, and when a needed key is added', () => {
    expect(accountConnectionKey({ ...ollama, endpoint: 'http://127.0.0.1:1234/v1' })).not.toBe(accountConnectionKey(ollama))
    const openai = newAccount([], 'openai')
    expect(accountConnectionKey({ ...openai, apiKey: 'sk-1' })).not.toBe(accountConnectionKey(openai))
  })

  it('does not change while the key is being typed, nor with the label or model', () => {
    const openai = { ...newAccount([], 'openai'), apiKey: 'sk-1' }
    expect(accountConnectionKey({ ...openai, apiKey: 'sk-12' })).toBe(accountConnectionKey(openai))
    expect(accountConnectionKey({ ...openai, label: 'Work', model: 'gpt-x' })).toBe(accountConnectionKey(openai))
  })

  it('never carries the key itself', () => {
    const openai = { ...newAccount([], 'openai'), apiKey: 'sk-secret-value' }
    expect(accountConnectionKey(openai)).not.toContain('sk-secret-value')
  })
})
