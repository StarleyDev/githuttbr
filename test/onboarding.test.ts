import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { defaultAIConfig, type DetectedCli } from '../src/shared/types'
import { accountFor } from '../src/shared/aiAccounts'
import { accountRowRole } from '../src/renderer/src/lib/aiAccountDraft'
import {
  LOCAL_SERVERS,
  ONBOARDING_STEPS,
  accountForChoice,
  addAccountInUse,
  answeredInSeconds,
  isStepFilled,
  stepEyebrow,
  stepStates,
  subscriptionCliOf,
  withListedModel,
  type OnboardingProgress
} from '../src/renderer/src/lib/onboarding'

const empty: OnboardingProgress = { gitName: '', gitEmail: '', hasHostAccount: false, aiAccountId: null }
const filled: OnboardingProgress = {
  gitName: 'Sam Example',
  gitEmail: 'sam@example.com',
  hasHostAccount: true,
  aiAccountId: 'cli'
}

describe('onboarding steps', () => {
  it('lists the steps with a feature behind them, AI included, ending on Done', () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual(['identity', 'accounts', 'ai', 'appearance', 'done'])
    expect(ONBOARDING_STEPS.find((s) => s.id === 'ai')?.optional).toBe(true)
    expect(ONBOARDING_STEPS.find((s) => s.id === 'identity')?.optional).toBe(false)
  })

  it('starts with nothing current on the welcome screen', () => {
    expect(stepStates(-1, empty)).toEqual(['todo', 'todo', 'todo', 'todo', 'todo'])
  })

  it('checks a passed step only when it was filled in', () => {
    expect(stepStates(3, filled)).toEqual(['done', 'done', 'done', 'current', 'todo'])
    expect(stepStates(3, empty)).toEqual(['skipped', 'skipped', 'skipped', 'current', 'todo'])
  })

  it('needs both name and email for the identity, ignoring blanks', () => {
    expect(isStepFilled('identity', { ...empty, gitName: 'Sam', gitEmail: '  ' })).toBe(false)
    expect(isStepFilled('identity', { ...empty, gitName: 'Sam', gitEmail: 'sam@example.com' })).toBe(true)
  })

  it('counts the AI step as filled only once an account was saved', () => {
    expect(isStepFilled('ai', empty)).toBe(false)
    expect(isStepFilled('ai', { ...empty, aiAccountId: 'openai' })).toBe(true)
  })

  it('numbers the eyebrow from one and marks optional steps', () => {
    expect(stepEyebrow(0)).toEqual({ key: 'onboarding.eyebrow', vars: { n: 1, total: 5 } })
    expect(stepEyebrow(2)).toEqual({ key: 'onboarding.eyebrowOptional', vars: { n: 3, total: 5 } })
  })
})

describe('onboarding AI cards', () => {
  const cli = (binary: DetectedCli['binary'], label: string): DetectedCli => ({ binary, label, path: `/opt/bin/${binary}` })

  it('offers Claude Code before Codex, and never a CLI without a subscription', () => {
    expect(subscriptionCliOf([cli('codex', 'Codex'), cli('claude', 'Claude Code')])?.binary).toBe('claude')
    expect(subscriptionCliOf([cli('codex', 'Codex')])?.binary).toBe('codex')
    expect(subscriptionCliOf([cli('gemini', 'Gemini CLI'), cli('devin', 'Devin')])).toBeNull()
    expect(subscriptionCliOf([])).toBeNull()
  })

  it('maps "My subscription" to a subscription CLI account, as Settings adds it', () => {
    const a = accountForChoice([], { kind: 'subscription', cli: 'codex', path: '', label: 'ChatGPT (Codex)' })
    expect(a).toMatchObject({ provider: 'cli', cli: 'codex', subscription: true, cliPath: '', label: 'ChatGPT (Codex)' })
  })

  it('maps "API key" to the provider with the key trimmed', () => {
    const a = accountForChoice([], { kind: 'api-key', provider: 'anthropic', apiKey: '  sk-test  ' })
    expect(a).toMatchObject({ provider: 'anthropic', apiKey: 'sk-test' })
    expect(a.endpoint).toBe('https://api.anthropic.com')
  })

  it('maps "On my computer" to Ollama, or LM Studio as an OpenAI-compatible server', () => {
    const ollama = accountForChoice([], { kind: 'local', server: 'ollama', endpoint: LOCAL_SERVERS.ollama.endpoint })
    expect(ollama).toMatchObject({ provider: 'ollama', label: 'Ollama', apiKey: '' })
    const lm = accountForChoice([], { kind: 'local', server: 'lmstudio', endpoint: '  ' })
    expect(lm).toMatchObject({ provider: 'custom', label: 'LM Studio', endpoint: 'http://localhost:1234/v1' })
    const moved = accountForChoice([], { kind: 'local', server: 'lmstudio', endpoint: 'http://127.0.0.1:4321/v1' })
    expect(moved.endpoint).toBe('http://127.0.0.1:4321/v1')
  })

  it('keeps a listed model and falls back to the first one listed', () => {
    const a = accountForChoice([], { kind: 'local', server: 'ollama', endpoint: '' })
    expect(withListedModel(a, [a.model, 'qwen2.5']).model).toBe(a.model)
    expect(withListedModel(a, ['qwen2.5', 'phi4']).model).toBe('qwen2.5')
    expect(withListedModel(a, []).model).toBe(a.model)
  })

  it('saves the account in use, so Settings shows it as the one in use', () => {
    const base = defaultAIConfig()
    const account = accountForChoice(base.accounts, { kind: 'subscription', cli: 'claude', path: '', label: 'Claude' })
    const { ai, accountId } = addAccountInUse({ ...base, enabled: false }, account)
    expect(ai.enabled).toBe(true)
    expect(ai.defaultAccountId).toBe(accountId)
    expect(accountFor(ai)?.id).toBe(accountId)
    expect(accountRowRole(ai, accountId)).toBe('in-use')
  })

  it('puts the new account in use even when another one already answers', () => {
    const base = defaultAIConfig()
    const first = addAccountInUse(base, accountForChoice(base.accounts, { kind: 'api-key', provider: 'openai', apiKey: 'k1' }))
    const second = addAccountInUse(
      first.ai,
      accountForChoice(first.ai.accounts, { kind: 'local', server: 'ollama', endpoint: '' })
    )
    expect(second.accountId).not.toBe(first.accountId)
    expect(accountRowRole(second.ai, second.accountId)).toBe('in-use')
    expect(accountRowRole(second.ai, first.accountId)).toBe('use')
  })

  it('fixing the key after saving updates that account instead of adding a second one', () => {
    const base = defaultAIConfig()
    const first = addAccountInUse(base, accountForChoice(base.accounts, { kind: 'api-key', provider: 'openai', apiKey: 'wrong' }))
    const count = first.ai.accounts?.length ?? 0
    const fixed = addAccountInUse(
      first.ai,
      accountForChoice(first.ai.accounts, { kind: 'api-key', provider: 'openai', apiKey: 'right' }),
      first.accountId
    )
    expect(fixed.accountId).toBe(first.accountId)
    expect(fixed.ai.accounts).toHaveLength(count)
    expect(fixed.ai.accounts?.find((a) => a.id === first.accountId)?.apiKey).toBe('right')
    expect(accountRowRole(fixed.ai, fixed.accountId)).toBe('in-use')
  })

  it('reports whole seconds, never zero', () => {
    expect(answeredInSeconds(0)).toBe(1)
    expect(answeredInSeconds(2600)).toBe(3)
    expect(answeredInSeconds(3400)).toBe(3)
  })
})

describe('onboarding copy', () => {
  // The brand was once written in lower case in every locale's welcome title.
  it('spells the product name GitHuttBr in every locale', () => {
    const dir = join(__dirname, '../src/renderer/src/i18n')
    const locales = readdirSync(dir).filter((f) => /^[a-z]{2}(-[A-Z]{2})?\.ts$/.test(f))
    expect(locales.length).toBeGreaterThanOrEqual(16)
    for (const file of locales) {
      const src = readFileSync(join(dir, file), 'utf8')
      const lines = src.split('\n').filter((l) => /^\s*'onboarding\./.test(l))
      expect(lines.length, file).toBeGreaterThan(0)
      for (const line of lines) expect(line, `${file}: ${line.trim()}`).not.toMatch(/(?<![.\w])githuttbr\b/)
      expect(src, file).toMatch(/'onboarding\.welcomeTitle': '[^']*GitHuttBr/)
    }
  })
})
