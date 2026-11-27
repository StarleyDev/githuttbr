import { describe, it, expect } from 'vitest'
import {
  AI_ENGINE_FIELDS,
  AI_PERSONAL_FIELDS,
  aiEnginesEqual,
  effectiveAI,
  engineOf,
  ensureGeneralAI,
  personalOf,
  withAIPatch,
  withGeneralAI,
  withoutAISecretsSeed,
  withProfileOwnAI
} from '../src/shared/aiScope'
import { migrateAIConfig } from '../src/shared/aiAccounts'
import {
  GENERAL_AI_SECRETS_ID,
  applySecrets,
  extractSecrets,
  hasSettingsSecrets,
  pruneSecrets,
  reconcileSettledSave,
  secretOwnerIds,
  settleGeneralAI,
  stripSettingsSecrets,
  type SecretStore
} from '../src/shared/secrets'
import {
  defaultAIConfig,
  defaultProfile,
  defaultSettings,
  type AIConfig,
  type AppSettings,
  type Profile
} from '../src/shared/types'

// The general AI and the per-profile override: a profile uses one of them
// whole, how a pre-general (and a pre-4.60, behaviour-per-profile) settings
// file is brought forward, and that the general AI's keys get the same
// keychain/export treatment as a profile's.

function anthropicAI(key = 'sk-ant-1'): AIConfig {
  return {
    ...defaultAIConfig(),
    accounts: [
      { id: 'anthropic', label: 'Anthropic', provider: 'anthropic', endpoint: '', apiKey: key, model: 'claude-x' }
    ],
    defaultAccountId: 'anthropic'
  }
}

function profile(id: string, ai: AIConfig, extra: Partial<Profile> = {}): Profile {
  return { ...defaultProfile(), id, name: id, ai, ...extra }
}

/** A settings object as written before the general AI existed. */
function preGeneral(profiles: Profile[], activeProfileId: string): Omit<AppSettings, 'ai'> {
  const { ai: _ai, ...rest } = defaultSettings()
  void _ai
  return { ...rest, profiles, activeProfileId }
}

describe('engine / personal split', () => {
  it('classifies every AIConfig key exactly once', () => {
    const engine = new Set<string>(AI_ENGINE_FIELDS)
    const personal = new Set<string>(AI_PERSONAL_FIELDS)
    for (const key of engine) expect(personal.has(key), key).toBe(false)
    // Every key a default config carries, plus the optional ones it leaves out.
    const keys = new Set([
      ...Object.keys(defaultAIConfig()),
      'cli',
      'cliPath',
      'subscription',
      'cliCwd',
      'repoChatRemoteActions'
    ])
    for (const key of keys) expect(engine.has(key) || personal.has(key), key).toBe(true)
    expect(engine.size + personal.size).toBe(keys.size)
  })

  it('engineOf and personalOf split a config without overlap and rebuild it whole', () => {
    const ai = { ...anthropicAI(), cli: 'claude' as const, commitStyle: 'gitmoji' as const }
    const engine = engineOf(ai)
    const personal = personalOf(ai)
    expect(engine).not.toHaveProperty('commitStyle')
    expect(personal).not.toHaveProperty('accounts')
    expect({ ...personal, ...engine }).toEqual(ai)
  })
})

describe('effectiveAI', () => {
  const general = { ...anthropicAI(), commitStyle: 'gitmoji' as const, repoChatReadOnly: true }
  const own = { ...defaultAIConfig(), commitStyle: 'haiku' as const, customInstructions: 'be brief' }

  it('uses the whole general AI, engine and behaviour', () => {
    const p = profile('p', { ...own, cli: 'codex', repoChatReadOnly: false })
    const ai = effectiveAI({ ai: general }, p)
    expect(ai).toBe(general)
    expect(ai.accounts).toEqual(general.accounts)
    // Nothing left on the profile is read: not a stale engine field, and not a
    // style or a chat policy from before 4.60.
    expect(ai.cli).toBeUndefined()
    expect(ai.commitStyle).toBe('gitmoji')
    expect(ai.customInstructions).toBe('')
    expect(ai.repoChatReadOnly).toBe(true)
  })

  it('uses the profile’s own config when ownAI', () => {
    const p = profile('p', own, { ownAI: true })
    expect(effectiveAI({ ai: general }, p)).toBe(own)
  })
})

describe('aiEnginesEqual', () => {
  it('ignores personal fields and cliCwd, not keys', () => {
    const a = anthropicAI()
    expect(aiEnginesEqual(a, { ...a, commitStyle: 'haiku', cliCwd: '/repo' })).toBe(true)
    expect(aiEnginesEqual(a, anthropicAI('sk-ant-2'))).toBe(false)
    expect(aiEnginesEqual(a, anthropicAI('sk-ant-2'), { ignoreKeys: true })).toBe(true)
  })

  it('treats a pre-accounts config as its migrated self', () => {
    const legacy = { provider: 'openai', apiKey: 'sk-1', model: 'gpt-4o-mini', endpoint: '' } as Partial<AIConfig>
    expect(aiEnginesEqual(legacy, migrateAIConfig(legacy))).toBe(true)
  })
})

describe('ensureGeneralAI (migration)', () => {
  it('one profile: its engine becomes the general AI, no exception', () => {
    const out = ensureGeneralAI(preGeneral([profile('a', anthropicAI())], 'a'))
    expect(out.ai.accounts).toEqual(anthropicAI().accounts)
    expect(out.profiles[0].ownAI).toBeUndefined()
    expect(out.aiSecretsFrom).toBe('a')
  })

  it('two identical profiles: no exception', () => {
    const out = ensureGeneralAI(preGeneral([profile('a', anthropicAI()), profile('b', anthropicAI())], 'a'))
    expect(out.profiles.map((p) => p.ownAI)).toEqual([undefined, undefined])
  })

  it('two different profiles: the non-active one keeps its own AI', () => {
    const out = ensureGeneralAI(preGeneral([profile('a', anthropicAI()), profile('b', defaultAIConfig())], 'b'))
    expect(out.ai.defaultAccountId).toBe('default')
    expect(out.profiles.find((p) => p.id === 'a')?.ownAI).toBe(true)
    expect(out.profiles.find((p) => p.id === 'b')?.ownAI).toBeUndefined()
    // Lossless: the exception still has its whole engine.
    expect(out.profiles.find((p) => p.id === 'a')?.ai.accounts).toEqual(anthropicAI().accounts)
  })

  it('personal differences alone are no exception', () => {
    const b = { ...anthropicAI(), commitStyle: 'haiku' as const }
    const out = ensureGeneralAI(preGeneral([profile('a', anthropicAI()), profile('b', b)], 'a'))
    expect(out.profiles[1].ownAI).toBeUndefined()
  })

  it('is idempotent', () => {
    const once = ensureGeneralAI(preGeneral([profile('a', anthropicAI()), profile('b', defaultAIConfig())], 'b'))
    const twice = ensureGeneralAI(once)
    expect(twice).toEqual(once)
  })

  it('the general AI built from the active profile takes its behaviour too', () => {
    const a = { ...anthropicAI(), commitStyle: 'haiku' as const, customInstructions: 'be brief' }
    const out = ensureGeneralAI(preGeneral([profile('a', a)], 'a'))
    expect(out.ai.commitStyle).toBe('haiku')
    expect(out.ai.customInstructions).toBe('be brief')
    expect(out.aiBehaviourShared).toBe(true)
  })

  it('a pre-accounts active profile still yields an account-model general AI', () => {
    const legacy = { ...defaultAIConfig(), accounts: [] as AIConfig['accounts'], provider: 'anthropic' as const, apiKey: 'sk-ant-9' }
    const out = ensureGeneralAI(preGeneral([profile('a', legacy)], 'a'))
    expect(out.ai.accounts).toHaveLength(1)
    expect(out.ai.accounts[0]).toMatchObject({ provider: 'anthropic', apiKey: 'sk-ant-9' })
  })

  it('new installs start with a general AI', () => {
    expect(defaultSettings().ai).toEqual(defaultAIConfig())
  })
})

describe('moving the behaviour onto the general AI (4.60, once)', () => {
  // A file from 4.5x: a general AI with only an engine that counts, and the
  // behaviour on each profile.
  const before = (): AppSettings => {
    const s: AppSettings = {
      ...defaultSettings(),
      ai: anthropicAI('sk-general'),
      profiles: [
        profile('default', { ...defaultAIConfig(), commitStyle: 'gitmoji' }),
        profile('work', { ...defaultAIConfig(), commitStyle: 'haiku', customInstructions: 'cite tickets', repoChatReadOnly: false }),
        profile('own', { ...anthropicAI('sk-own'), commitStyle: 'caveman', customInstructions: 'own rules' }, { ownAI: true })
      ],
      activeProfileId: 'work'
    }
    delete s.aiBehaviourShared
    return s
  }

  it('copies the active profile’s behaviour onto the general AI and sets the marker', () => {
    const out = ensureGeneralAI(before())
    expect(out.aiBehaviourShared).toBe(true)
    expect(out.ai.commitStyle).toBe('haiku')
    expect(out.ai.customInstructions).toBe('cite tickets')
    expect(out.ai.repoChatReadOnly).toBe(false)
    // Every profile on the general AI now writes the same way.
    expect(effectiveAI(out, out.profiles[0]).commitStyle).toBe('haiku')
  })

  it('keeps the general engine and its keys', () => {
    const out = ensureGeneralAI(before())
    expect(engineOf(out.ai)).toEqual(engineOf(migrateAIConfig(anthropicAI('sk-general'))))
    expect(out.ai.accounts[0].apiKey).toBe('sk-general')
    expect(extractSecrets(out)[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-general' } })
    expect(extractSecrets(out)['own']).toEqual({ aiKeys: { anthropic: 'sk-own' } })
  })

  it('leaves profiles with their own AI untouched, and every profile’s stored values in place', () => {
    const b = before()
    const out = ensureGeneralAI(b)
    expect(out.profiles).toEqual(b.profiles)
    const own = out.profiles.find((p) => p.id === 'own')!
    expect(effectiveAI(out, own).commitStyle).toBe('caveman')
    expect(effectiveAI(out, own).customInstructions).toBe('own rules')
  })

  it('is idempotent: a second read never copies again', () => {
    const once = ensureGeneralAI(before())
    expect(ensureGeneralAI(once)).toEqual(once)
    // Edited since, then switched to another profile: still the edited values.
    const edited = withGeneralAI(once, { commitStyle: 'conventional' })
    const switched = { ...edited, activeProfileId: 'default' }
    expect(ensureGeneralAI(switched).ai.commitStyle).toBe('conventional')
  })

  it('with the active profile on its own AI, takes the default profile’s', () => {
    const out = ensureGeneralAI({ ...before(), activeProfileId: 'own' })
    expect(out.ai.commitStyle).toBe('gitmoji')
  })

  it('without a default profile on the general AI, takes the first one that is', () => {
    const b = before()
    const s = { ...b, activeProfileId: 'own', profiles: b.profiles.filter((p) => p.id !== 'default') }
    expect(ensureGeneralAI(s).ai.commitStyle).toBe('haiku')
  })

  it('with every profile on its own AI, takes the active one’s', () => {
    const b = before()
    const s = { ...b, activeProfileId: 'own', profiles: b.profiles.map((p) => ({ ...p, ownAI: true })) }
    expect(ensureGeneralAI(s).ai.commitStyle).toBe('caveman')
  })

  it('survives a strip / apply round trip through the keychain store', () => {
    const out = ensureGeneralAI(before())
    const store = extractSecrets(out)
    const back = applySecrets(stripSettingsSecrets(out), store)
    expect(back.aiBehaviourShared).toBe(true)
    expect(back.ai.commitStyle).toBe('haiku')
    expect(back.ai.accounts[0].apiKey).toBe('sk-general')
    expect(back.profiles.find((p) => p.id === 'own')?.ai.accounts[0].apiKey).toBe('sk-own')
  })
})

describe('writes', () => {
  const base = (): AppSettings => ({
    ...defaultSettings(),
    ai: anthropicAI(),
    profiles: [profile('g', defaultAIConfig()), profile('o', defaultAIConfig(), { ownAI: true })],
    activeProfileId: 'g'
  })

  it('saveAIFor on a general profile: everything to settings.ai, nothing to the profile', () => {
    const before = base()
    const out = withAIPatch(before, 'g', { enabled: false, defaultAccountId: 'x', commitStyle: 'haiku' })
    expect(out.ai.enabled).toBe(false)
    expect(out.ai.defaultAccountId).toBe('x')
    expect(out.ai.commitStyle).toBe('haiku')
    expect(out.profiles).toBe(before.profiles)
    // Read back where it was written.
    expect(effectiveAI(out, out.profiles[0]).commitStyle).toBe('haiku')
  })

  it('a behaviour change on a general profile reaches every profile on the general AI', () => {
    const s = { ...base(), profiles: [...base().profiles, profile('g2', defaultAIConfig())] }
    const out = withAIPatch(s, 'g', { repoChatApproval: 'auto-all' })
    const g2 = out.profiles.find((p) => p.id === 'g2')!
    expect(effectiveAI(out, g2).repoChatApproval).toBe('auto-all')
    const o = out.profiles.find((p) => p.id === 'o')!
    expect(effectiveAI(out, o).repoChatApproval).not.toBe('auto-all')
  })

  it('saveAIFor on an own-AI profile: everything to the profile', () => {
    const out = withAIPatch(base(), 'o', { enabled: false, commitStyle: 'haiku' })
    expect(out.ai).toEqual(base().ai)
    const o = out.profiles.find((p) => p.id === 'o')!
    expect(o.ai.enabled).toBe(false)
    expect(o.ai.commitStyle).toBe('haiku')
  })

  it('saveAIFor on an own-AI profile leaves the general AI as it was', () => {
    const before = base()
    expect(withAIPatch(before, 'o', { coAuthor: false, assignments: {} }).ai).toBe(before.ai)
  })

  it('an empty patch changes nothing', () => {
    const before = base()
    expect(withAIPatch(before, 'g', {})).toBe(before)
  })

  it('saveAIFor on an unknown profile changes nothing', () => {
    const before = base()
    expect(withAIPatch(before, 'nope', { enabled: false })).toBe(before)
  })

  it('saveGeneralAI writes the whole config, behaviour included', () => {
    const out = withGeneralAI(base(), { ...defaultAIConfig(), commitStyle: 'haiku' })
    expect(out.ai.defaultAccountId).toBe('default')
    expect(out.ai.commitStyle).toBe('haiku')
  })

  it('turning own AI on starts from a copy of the whole general AI', () => {
    // A value left on the profile from before is not what it starts with.
    const s = { ...withGeneralAI(base(), { commitStyle: 'haiku', customInstructions: 'general' }) }
    s.profiles = s.profiles.map((p) => (p.id === 'g' ? { ...p, ai: { ...p.ai, commitStyle: 'caveman' } } : p))
    const out = withProfileOwnAI(s, 'g', true, defaultAIConfig())
    const g = out.profiles.find((p) => p.id === 'g')!
    expect(g.ownAI).toBe(true)
    expect(g.ai).toEqual(s.ai)
    expect(g.ai).not.toBe(s.ai)
    expect(effectiveAI(out, g).commitStyle).toBe('haiku')
    expect(effectiveAI(out, g).accounts).toEqual(anthropicAI().accounts)
    // Its own edits from then on stay its own.
    const edited = withAIPatch(out, 'g', { commitStyle: 'conventional' })
    expect(edited.ai.commitStyle).toBe('haiku')
    expect(edited.profiles.find((p) => p.id === 'g')!.ai.commitStyle).toBe('conventional')
  })

  it('turning own AI off drops its whole config, so its keys leave the store', () => {
    const s = withAIPatch(base(), 'o', {
      accounts: anthropicAI().accounts,
      defaultAccountId: 'anthropic',
      commitStyle: 'haiku'
    })
    const out = withProfileOwnAI(s, 'o', false, defaultAIConfig())
    const o = out.profiles.find((p) => p.id === 'o')!
    expect(o.ownAI).toBeUndefined()
    expect(o.ai).toEqual(defaultAIConfig())
    expect(extractSecrets(out)['o']).toBeUndefined()
    // It now reads the general AI, behaviour included.
    expect(effectiveAI(out, o)).toBe(out.ai)
  })
})

describe('general AI secrets', () => {
  const settings = (): AppSettings => ({
    ...defaultSettings(),
    ai: anthropicAI('sk-general'),
    profiles: [profile('a', defaultAIConfig())],
    activeProfileId: 'a'
  })

  it('files the general AI’s keys under their own entry', () => {
    const store = extractSecrets(settings())
    expect(store[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-general' } })
    expect(hasSettingsSecrets(settings())).toBe(true)
  })

  it('strips them for the file and for an export without the opt-in', () => {
    const stripped = stripSettingsSecrets(settings())
    expect(stripped.ai.accounts[0].apiKey).toBe('')
    expect(stripped.ai.apiKey).toBe('')
    expect(JSON.stringify(stripped)).not.toContain('sk-general')
    expect(hasSettingsSecrets(stripped)).toBe(false)
  })

  it('never adds a general AI to a raw import that has none', () => {
    const { ai: _ai, ...raw } = settings()
    void _ai
    expect('ai' in stripSettingsSecrets(raw as AppSettings)).toBe(false)
  })

  it('restores them from the store', () => {
    const store = extractSecrets(settings())
    const back = applySecrets(stripSettingsSecrets(settings()), store)
    expect(back.ai.accounts[0].apiKey).toBe('sk-general')
  })

  it('no profile list prunes the general entry', () => {
    const store = extractSecrets(settings())
    expect(pruneSecrets(store, ['a'], settings().profiles)[GENERAL_AI_SECRETS_ID]).toBeDefined()
  })

  it('seeds from the profile the general AI was built from, until it has its own entry', () => {
    const migrated = ensureGeneralAI(preGeneral([profile('a', anthropicAI())], 'a'))
    // The key was in the keychain under the profile, so the file has none.
    const store = { a: { aiKeys: { anthropic: 'sk-from-a' } } }
    const back = applySecrets(stripSettingsSecrets(migrated), store)
    expect(back.ai.accounts[0].apiKey).toBe('sk-from-a')
    // Once it has its own entry, the seed is not read.
    const own = applySecrets(stripSettingsSecrets(migrated), {
      ...store,
      [GENERAL_AI_SECRETS_ID]: { aiKeys: { anthropic: 'sk-own' } }
    })
    expect(own.ai.accounts[0].apiKey).toBe('sk-own')
  })

  it('gives a profile its own AI back when only an encrypted key told it apart', () => {
    // Both read alike from the file: their keys were encrypted.
    const migrated = ensureGeneralAI(
      preGeneral([profile('a', anthropicAI('')), profile('b', anthropicAI('')), profile('c', defaultAIConfig())], 'a')
    )
    expect(migrated.profiles.find((p) => p.id === 'b')?.ownAI).toBeUndefined()
    const store = {
      a: { aiKeys: { anthropic: 'sk-a' } },
      b: { aiKeys: { anthropic: 'sk-b' } }
    }
    const back = applySecrets(stripSettingsSecrets(migrated), store)
    expect(back.profiles.find((p) => p.id === 'b')?.ownAI).toBe(true)
    expect(back.profiles.find((p) => p.id === 'b')?.ai.accounts[0].apiKey).toBe('sk-b')
    // Same key: same engine, still the general AI.
    const same = applySecrets(stripSettingsSecrets(migrated), { ...store, b: { aiKeys: { anthropic: 'sk-a' } } })
    expect(same.profiles.find((p) => p.id === 'b')?.ownAI).toBeUndefined()
    // A profile with no keys of its own is never moved off the general AI.
    expect(back.profiles.find((p) => p.id === 'a')?.ownAI).toBeUndefined()
  })

  it('a profile added after the migration stays on the general AI', () => {
    const migrated = ensureGeneralAI(preGeneral([profile('a', anthropicAI(''))], 'a'))
    const withNew = { ...migrated, profiles: [...migrated.profiles, profile('n', defaultAIConfig())] }
    const back = applySecrets(withNew, { a: { aiKeys: { anthropic: 'sk-a' } } })
    expect(back.profiles.find((p) => p.id === 'n')?.ownAI).toBeUndefined()
  })
})

describe('settling the general AI (first decrypted read)', () => {
  // a is active and the source; b differs only by an encrypted key; c is plainly different.
  const migrated = (): AppSettings =>
    ensureGeneralAI(
      preGeneral(
        [profile('a', anthropicAI('')), profile('b', anthropicAI('')), profile('c', defaultAIConfig())],
        'a'
      )
    )
  const store = (): SecretStore => ({
    a: { aiKeys: { anthropic: 'sk-a' }, githubToken: 'ghp_a' },
    b: { aiKeys: { anthropic: 'sk-b' } },
    c: { aiKeys: { default: 'sk-c' } }
  })

  it('gives the general AI its own entry, persists the exceptions and drops the old engines', () => {
    const before = migrated()
    expect(before.profiles.find((p) => p.id === 'c')?.ownAI).toBe(true)
    const out = settleGeneralAI(before, store(), defaultAIConfig())
    expect(out.settings.aiSecretsFrom).toBeUndefined()
    expect(out.store[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-a' } })
    expect(out.settings.profiles.find((p) => p.id === 'b')?.ownAI).toBe(true)
    // a stays on the general AI: its old engine and its AI key go, its other tokens stay.
    const a = out.settings.profiles.find((p) => p.id === 'a')!
    expect(a.ownAI).toBeUndefined()
    expect(a.ai.accounts).toEqual(defaultAIConfig().accounts)
    expect(out.store.a).toEqual({ githubToken: 'ghp_a' })
    // Exceptions keep their keys.
    expect(out.store.b).toEqual({ aiKeys: { anthropic: 'sk-b' } })
    expect(out.store.c).toEqual({ aiKeys: { default: 'sk-c' } })
  })

  it('is a no-op once settled', () => {
    const once = settleGeneralAI(migrated(), store(), defaultAIConfig())
    expect(settleGeneralAI(once.settings, once.store, defaultAIConfig())).toEqual(once)
  })

  it('keeps an existing general entry', () => {
    const out = settleGeneralAI(
      migrated(),
      { ...store(), [GENERAL_AI_SECRETS_ID]: { aiKeys: { anthropic: 'sk-new' } } },
      defaultAIConfig()
    )
    expect(out.store[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-new' } })
  })

  it('a deleted source profile still hands over its key, then its entry loses it', () => {
    const s = migrated()
    const withoutA = { ...s, profiles: s.profiles.filter((p) => p.id !== 'a'), activeProfileId: 'b' }
    // Pruning while the seed is pending keeps the deleted source's entry.
    const pruned = pruneSecrets(store(), secretOwnerIds(withoutA), withoutA.profiles)
    expect(pruned.a?.aiKeys).toEqual({ anthropic: 'sk-a' })
    const out = settleGeneralAI(withoutA, pruned, defaultAIConfig())
    expect(out.store[GENERAL_AI_SECRETS_ID]).toEqual({ aiKeys: { anthropic: 'sk-a' } })
    expect(out.store.a).toEqual({ githubToken: 'ghp_a' })
    // Measured against the general AI built from it: b still had a key of its own.
    expect(out.settings.profiles.find((p) => p.id === 'b')?.ownAI).toBe(true)
  })

  it('measures against the source profile, not a general AI edited while locked', () => {
    const s = migrated()
    const edited = withAIPatch(s, 'a', { assignments: { chat: { accountId: 'anthropic', model: 'claude-y' } } })
    const back = applySecrets(edited, store())
    expect(back.profiles.find((p) => p.id === 'b')?.ownAI).toBe(true)
    const out = settleGeneralAI(edited, store(), defaultAIConfig())
    expect(out.settings.profiles.find((p) => p.id === 'b')?.ownAI).toBe(true)
  })

  it('after settling and clearing the general key, no store entry still holds the old key', () => {
    const out = settleGeneralAI(migrated(), store(), defaultAIConfig())
    const cleared = { ...out.settings, ai: stripSettingsSecrets(out.settings).ai }
    const next = extractSecrets(applySecrets(cleared, { ...out.store, [GENERAL_AI_SECRETS_ID]: {} }))
    expect(JSON.stringify(next)).not.toContain('sk-a')
    expect(JSON.stringify(out.store)).toContain('sk-a') // only under the general entry
    expect(Object.entries(out.store).filter(([, v]) => JSON.stringify(v).includes('sk-a')).map(([k]) => k)).toEqual([
      GENERAL_AI_SECRETS_ID
    ])
  })

  it('a save from before the settle cannot undo it', () => {
    const stale = migrated()
    const disk = settleGeneralAI(stale, store(), defaultAIConfig()).settings
    const out = reconcileSettledSave(stale, disk, defaultAIConfig())
    expect(out.aiSecretsFrom).toBeUndefined()
    expect(out.profiles.find((p) => p.id === 'b')?.ownAI).toBe(true)
    expect(out.profiles.find((p) => p.id === 'a')?.ai.accounts).toEqual(defaultAIConfig().accounts)
  })

  it('the file keep-list never seeds the general AI nor decides ownAI', () => {
    const back = applySecrets(migrated(), store(), { seed: false })
    expect(back.ai.accounts[0].apiKey).toBe('')
    expect(back.profiles.find((p) => p.id === 'b')?.ownAI).toBeUndefined()
  })

  it('exports drop the seed', () => {
    expect('aiSecretsFrom' in withoutAISecretsSeed(migrated())).toBe(false)
  })
})
