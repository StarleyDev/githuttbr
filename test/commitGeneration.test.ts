import { describe, expect, it } from 'vitest'
import {
  IDLE,
  MENU_MODELS_PER_ACCOUNT,
  accountDefaultTarget,
  configForTarget,
  configLabel,
  defaultGenerationTarget,
  elapsedSeconds,
  fallbackAccount,
  generationChoices,
  nextGeneration,
  runningTag,
  targetLabel,
  type GenerationState
} from '../src/renderer/src/lib/commitGeneration'
import { newAccount } from '../src/shared/aiAccounts'
import { defaultAIConfig, type AIConfig, type ModelCatalog } from '../src/shared/types'

const ai = (): AIConfig => {
  const ollama = { ...newAccount([], 'ollama'), label: 'Laptop', model: 'qwen3' }
  const google = { ...newAccount([ollama], 'google'), label: 'Work Gemini', apiKey: 'k', model: 'gemini-2.5-flash' }
  const openai = { ...newAccount([ollama, google], 'openai'), label: 'No key', model: 'gpt-4o-mini' }
  return {
    ...defaultAIConfig(),
    accounts: [ollama, google, openai],
    defaultAccountId: 'ollama',
    assignments: { commit: { accountId: 'google', model: 'gemini-2.5-pro' } }
  }
}

const catalog = (models: string[]): ModelCatalog => ({ models, source: 'live', fetchedAt: 1 })

describe('who answers a generation', () => {
  it('defaults to the commit task’s own account and model', () => {
    expect(defaultGenerationTarget(ai())).toEqual({ accountId: 'google', model: 'gemini-2.5-pro' })
    expect(targetLabel(ai(), defaultGenerationTarget(ai()))).toBe('Work Gemini · gemini-2.5-pro')
  })

  it('a picked target changes this call only, not the settings it came from', () => {
    const settings = ai()
    const cfg = configForTarget(settings, { accountId: 'ollama', model: 'llama3' })
    expect(cfg).toMatchObject({ accountId: 'ollama', provider: 'ollama', model: 'llama3' })
    expect(settings.assignments?.commit).toEqual({ accountId: 'google', model: 'gemini-2.5-pro' })
    expect(configLabel(cfg)).toBe('Laptop · llama3')
  })

  it('an empty model means the account’s default; an unknown account means the task’s own', () => {
    expect(configForTarget(ai(), { accountId: 'ollama', model: '' }).model).toBe('qwen3')
    expect(configForTarget(ai(), { accountId: 'gone', model: 'x' })).toMatchObject({ accountId: 'google', model: 'gemini-2.5-pro' })
    expect(configForTarget(ai(), null).accountId).toBe('google')
  })

  it('the menu lists every account, its own model first, the catalogue after, capped', () => {
    const long = Array.from({ length: 12 }, (_, i) => `m${i}`)
    const choices = generationChoices(ai(), { ollama: catalog(['llama3', 'qwen3', ...long]) })
    expect(choices.map((c) => c.label)).toEqual(['Laptop', 'Work Gemini', 'No key'])
    expect(choices[0].models[0]).toBe('qwen3')
    expect(choices[0].models.filter((m) => m === 'qwen3')).toHaveLength(1)
    expect(choices[0].models).toHaveLength(MENU_MODELS_PER_ACCOUNT)
    // No catalogue yet: the account still offers its own model.
    expect(choices[1].models).toEqual(['gemini-2.5-flash'])
  })

  it('the fallback beside Cancel is another account that can make a call', () => {
    expect(fallbackAccount(ai(), 'google')?.id).toBe('ollama')
    expect(fallbackAccount(ai(), 'ollama')?.id).toBe('google')
    const alone = { ...ai(), accounts: [ai().accounts![0]] }
    expect(fallbackAccount(alone, 'ollama')).toBeNull()
    expect(accountDefaultTarget(ai(), 'ollama')).toEqual({ accountId: 'ollama', model: 'qwen3' })
  })

  it('counts whole seconds, never below zero', () => {
    expect(elapsedSeconds(1000, 1999)).toBe(0)
    expect(elapsedSeconds(1000, 13_500)).toBe(12)
    expect(elapsedSeconds(5000, 1000)).toBe(0)
  })
})

describe('the generation banner', () => {
  const mine = { summary: 'wip', description: 'my notes' }
  const fromAI = { summary: 'feat: add login', description: '- validate input' }
  const start = (state: GenerationState, tag: string, current = mine): GenerationState =>
    nextGeneration(state, { type: 'start', tag, startedAt: 1000, label: 'Work Gemini · gemini-2.5-pro', accountId: 'google', current })

  it('runs, then offers Undo with the text from before and how long it took', () => {
    const running = start(IDLE, 'a')
    expect(runningTag(running)).toBe('a')
    const done = nextGeneration(running, { type: 'finish', tag: 'a', finishedAt: 8_400, generated: fromAI })
    expect(done).toEqual({ phase: 'generated', label: 'Work Gemini · gemini-2.5-pro', seconds: 7, previous: mine, generated: fromAI })
    expect(runningTag(done)).toBeNull()
  })

  it('a cancelled generation ignores its late answer and late failure', () => {
    const cancelled = nextGeneration(start(IDLE, 'a'), { type: 'cancel' })
    expect(cancelled).toBe(IDLE)
    expect(nextGeneration(cancelled, { type: 'finish', tag: 'a', finishedAt: 2000, generated: fromAI })).toBe(IDLE)
    // A newer generation is not finished, failed or relabelled by the old one's events.
    const newer = start(cancelled, 'b')
    expect(nextGeneration(newer, { type: 'finish', tag: 'a', finishedAt: 2000, generated: fromAI })).toBe(newer)
    expect(nextGeneration(newer, { type: 'fail', tag: 'a' })).toBe(newer)
    expect(nextGeneration(newer, { type: 'attempt', tag: 'a', label: 'x', accountId: 'x' })).toBe(newer)
  })

  it('a move to another account relabels the running line and the banner', () => {
    const moved = nextGeneration(start(IDLE, 'a'), { type: 'attempt', tag: 'a', label: 'Laptop · qwen3', accountId: 'ollama' })
    expect(moved).toMatchObject({ label: 'Laptop · qwen3', accountId: 'ollama' })
    expect(nextGeneration(moved, { type: 'finish', tag: 'a', finishedAt: 3000, generated: fromAI })).toMatchObject({
      label: 'Laptop · qwen3'
    })
  })

  it('"Generate again" keeps the user’s own text as what Undo restores', () => {
    const first = nextGeneration(start(IDLE, 'a'), { type: 'finish', tag: 'a', finishedAt: 2000, generated: fromAI })
    const again = start(first, 'b', fromAI)
    const second = nextGeneration(again, { type: 'finish', tag: 'b', finishedAt: 3000, generated: { summary: 'fix: y', description: '' } })
    expect(second.phase === 'generated' && second.previous).toEqual(mine)
  })

  it('goes away on an edit, a commit, an undo or a dismiss — but not on its own text', () => {
    const done = nextGeneration(start(IDLE, 'a'), { type: 'finish', tag: 'a', finishedAt: 2000, generated: fromAI })
    expect(nextGeneration(done, { type: 'edit', current: fromAI })).toBe(done)
    expect(nextGeneration(done, { type: 'edit', current: { ...fromAI, summary: 'feat: add login!' } })).toBe(IDLE)
    expect(nextGeneration(done, { type: 'commit' })).toBe(IDLE)
    expect(nextGeneration(done, { type: 'undo' })).toBe(IDLE)
    expect(nextGeneration(done, { type: 'dismiss' })).toBe(IDLE)
    // Typing while a generation runs does not end it.
    const running = start(IDLE, 'c')
    expect(nextGeneration(running, { type: 'edit', current: { summary: 'x', description: '' } })).toBe(running)
  })

  it('a failure ends the run without a banner', () => {
    expect(nextGeneration(start(IDLE, 'a'), { type: 'fail', tag: 'a' })).toBe(IDLE)
  })
})
