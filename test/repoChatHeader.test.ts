import { describe, expect, it } from 'vitest'
import { en } from '../src/renderer/src/i18n/en'
import { defaultAIConfig, type AIAccount, type AIConfig, type ModelCatalog } from '../src/shared/types'
import {
  CHAT_APPROVALS,
  approvalPillKey,
  chatBaseBranch,
  chatCapabilityTags,
  chatModelMenu,
  chatModelPill,
  chatStarterPrompts,
  isChatModelChosen,
  withChatModel
} from '../src/renderer/src/lib/repoChatHeader'

const openai: AIAccount = { id: 'openai', label: 'Work', provider: 'openai', apiKey: 'sk-test-key-1234567890', model: 'gpt-4o' }
const ollama: AIAccount = { id: 'ollama', label: 'Local', provider: 'ollama', model: 'llama3' }
const base: AIConfig = { ...defaultAIConfig(), accounts: [openai, ollama], defaultAccountId: 'openai' }
const ai = (patch: Partial<AIConfig>): AIConfig => ({ ...base, ...patch })
const live = (models: string[]): ModelCatalog => ({ models, source: 'live' }) as ModelCatalog

describe('chat model pill', () => {
  it('follows the profile model when the chat has no assignment of its own', () => {
    const pill = chatModelPill(base, {})
    expect(pill).toMatchObject({ account: 'Work', model: 'gpt-4o', followsDefault: true, status: 'unchecked' })
  })

  it('shows the assigned account and model, with the status from the fetched list', () => {
    const pill = chatModelPill(ai({ assignments: { chat: { accountId: 'ollama', model: 'qwen2' } } }), {
      ollama: live(['llama3', 'qwen2'])
    })
    expect(pill).toMatchObject({ account: 'Local', model: 'qwen2', followsDefault: false, status: 'ready' })
  })

  it('says "No key" for an account that needs one and has none', () => {
    const keyless = { ...openai, apiKey: '' }
    expect(chatModelPill(ai({ accounts: [keyless] }), {}).status).toBe('no-key')
  })

  it('does not call a key missing before Settings has decrypted the keys', () => {
    const locked = { ...openai, apiKey: '' }
    expect(chatModelPill(ai({ accounts: [locked] }), {}, false).status).toBe('unchecked')
    expect(chatModelPill(ai({ accounts: [locked] }), { openai: live(['gpt-4o']) }, false).status).toBe('ready')
  })

  it('treats an assignment to a deleted account as following the default', () => {
    const pill = chatModelPill(ai({ assignments: { chat: { accountId: 'gone', model: 'x' } } }), {})
    expect(pill.followsDefault).toBe(true)
    expect(pill.account).toBe('Work')
  })
})

describe('chat model menu', () => {
  it('groups models per account, each group with its status', () => {
    const groups = chatModelMenu(base, { openai: live(['gpt-4o', 'gpt-4o-mini']) })
    expect(groups.map((g) => [g.accountId, g.status])).toEqual([
      ['openai', 'ready'],
      ['ollama', 'unchecked']
    ])
    expect(groups[0].models).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })

  it('marks the default row only without an assignment, and an assigned row exactly', () => {
    expect(isChatModelChosen(base, '', '')).toBe(true)
    const assigned = ai({ assignments: { chat: { accountId: 'openai', model: 'gpt-4o-mini' } } })
    expect(isChatModelChosen(assigned, '', '')).toBe(false)
    expect(isChatModelChosen(assigned, 'openai', 'gpt-4o-mini')).toBe(true)
    expect(isChatModelChosen(assigned, 'openai', 'gpt-4o')).toBe(false)
  })

  it('writes the same assignments the old select did, keeping other tasks', () => {
    const start = ai({ assignments: { review: { accountId: 'ollama', model: 'llama3' } } })
    expect(withChatModel(start, 'openai', 'gpt-4o-mini')).toEqual({
      review: { accountId: 'ollama', model: 'llama3' },
      chat: { accountId: 'openai', model: 'gpt-4o-mini' }
    })
    const assigned = ai({ assignments: { chat: { accountId: 'openai', model: 'gpt-4o' } } })
    expect(withChatModel(assigned, '', '')).toEqual({})
  })
})

describe('capabilities pill', () => {
  it('reads only when actions are off', () => {
    expect(chatCapabilityTags(ai({ repoChatActions: false, repoChatReadOnly: false }))).toEqual(['chat.canRead'])
  })

  it('adds Git by default; files and remote only when opted into', () => {
    expect(chatCapabilityTags(base)).toEqual(['chat.canRead', 'chat.canGit'])
    expect(chatCapabilityTags(ai({ repoChatReadOnly: false, repoChatRemoteActions: true }))).toEqual([
      'chat.canRead',
      'chat.canGit',
      'chat.canFiles',
      'chat.canRemote'
    ])
  })

  it('every tag is a dictionary key', () => {
    for (const key of ['chat.canRead', 'chat.canGit', 'chat.canFiles', 'chat.canRemote'] as const) {
      expect(en[key]).toBeTruthy()
    }
  })
})

describe('approval pill', () => {
  it('names the current mode, defaulting to asking', () => {
    expect(approvalPillKey(base)).toBe('chat.approvalPillAsk')
    expect(approvalPillKey(ai({ repoChatApproval: 'auto-safe' }))).toBe('chat.approvalPillSafe')
    expect(approvalPillKey(ai({ repoChatApproval: 'auto-all' }))).toBe('chat.approvalPillAll')
  })

  it('offers the three modes in order, every key in the dictionary', () => {
    expect(CHAT_APPROVALS.map((a) => a.id)).toEqual(['ask', 'auto-safe', 'auto-all'])
    for (const a of CHAT_APPROVALS) for (const key of [a.pillKey, a.key, a.hint]) expect(en[key]).toBeTruthy()
  })
})

describe('empty-state starters', () => {
  it('compares against the local default branch, else a remote one, else main', () => {
    expect(chatBaseBranch({ locals: [{ name: 'feature' }, { name: 'master' }], remotes: [] })).toBe('master')
    expect(chatBaseBranch({ locals: [{ name: 'feature' }], remotes: [{ name: 'main' }] })).toBe('main')
    expect(chatBaseBranch({ locals: [{ name: 'feature' }], remotes: [{ name: 'master' }] })).toBe('master')
    expect(chatBaseBranch({ locals: [{ name: 'feature' }], remotes: [] })).toBe('main')
    expect(chatBaseBranch(undefined)).toBe('main')
  })

  it('offers review, since-base and PR description, the base filled in', () => {
    const starters = chatStarterPrompts('develop')
    expect(starters.map((s) => s.key)).toEqual(['chat.starterReview', 'chat.starterSinceBase', 'chat.starterPrDescription'])
    expect(starters[1].vars).toEqual({ base: 'develop' })
    expect(en['chat.starterSinceBase']).toContain('{base}')
  })
})
