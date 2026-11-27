import { describe, expect, it } from 'vitest'
import { en } from '../src/renderer/src/i18n/en'
import { defaultAIConfig, type AIConfig, type CommitStyle } from '../src/shared/types'
import {
  FEATURED_COMMIT_STYLES,
  behaviourScopeLine,
  branchNameExample,
  chatCapabilities,
  chatSummary,
  commitPreview,
  commitStyleExample,
  conflictExample,
  fileEditsAllowed,
  isFeaturedCommitStyle,
  withFileEdits
} from '../src/renderer/src/lib/aiBehaviour'

const base: AIConfig = defaultAIConfig()
const ai = (patch: Partial<AIConfig>): AIConfig => ({ ...base, ...patch })
const STYLES: CommitStyle[] = ['auto', 'ticket', 'conventional', 'gitmoji', 'gitmoji-conventional', 'plain', 'caveman', 'haiku']

describe('commit style samples', () => {
  it('features conventional, gitmoji and ticket; the rest sit behind "More styles"', () => {
    expect(FEATURED_COMMIT_STYLES.map((s) => s.id)).toEqual(['conventional', 'gitmoji', 'ticket'])
    expect(STYLES.filter((s) => !isFeaturedCommitStyle(s))).toEqual(['auto', 'gitmoji-conventional', 'plain', 'caveman', 'haiku'])
  })

  it('writes each style the way the commit prompt asks for it', () => {
    expect(commitStyleExample('conventional')).toBe('feat(chat): add review')
    // The prompt wants the unicode emoji, never a :shortcode:.
    expect(commitStyleExample('gitmoji')).toBe('✨ add review')
    expect(commitStyleExample('ticket')).toBe('GH-42: add review')
    expect(commitStyleExample('haiku').split(' / ')).toHaveLength(3)
    for (const s of STYLES) expect(commitStyleExample(s)).not.toBe('')
  })

  it('previews the body and the co-author only when they are on', () => {
    const full = commitPreview(ai({ commitStyle: 'gitmoji', generateDescription: true, coAuthor: true }), 'A <a@b>')
    expect(full.split('\n')[0]).toBe('✨ add review')
    expect(full).toContain('\n\nCo-authored-by: A <a@b>')
    const bare = commitPreview(ai({ commitStyle: 'plain', generateDescription: false, coAuthor: false }), 'A <a@b>')
    expect(bare).toBe('add review')
  })

  it('has an example for every branch and conflict style', () => {
    expect(branchNameExample(undefined)).toBe('feature/add-provider-drafts')
    expect(branchNameExample('prefix/ticket-description')).toBe('feature/GH-42-add-provider-drafts')
    expect(branchNameExample('plain')).not.toContain('/')
    expect(conflictExample('commented')).toMatch(/^\/\/ merged:/)
    expect(conflictExample(undefined)).toBe(conflictExample('clean'))
  })
})

describe('repository chat permissions', () => {
  it('reads the stored fields with the defaults main/repoChat.ts uses', () => {
    const unset = ai({ repoChat: undefined, repoChatActions: undefined, repoChatReadOnly: undefined, repoChatRemoteActions: undefined, repoChatApproval: undefined })
    expect(chatCapabilities(unset)).toEqual({ chat: true, git: true, files: false, remote: false, approval: 'ask' })
    // No file or remote action exists without actions.
    expect(chatCapabilities(ai({ repoChatActions: false, repoChatReadOnly: false, repoChatRemoteActions: true }))).toMatchObject({
      git: false,
      files: false,
      remote: false
    })
  })

  it('shows "Create, edit and delete files" as the inverse of repoChatReadOnly, without changing what is stored', () => {
    expect(fileEditsAllowed(ai({ repoChatReadOnly: undefined }))).toBe(false)
    expect(fileEditsAllowed(ai({ repoChatReadOnly: true }))).toBe(false)
    expect(fileEditsAllowed(ai({ repoChatReadOnly: false }))).toBe(true)
    expect(withFileEdits(ai({ repoChatReadOnly: true }), true).repoChatReadOnly).toBe(false)
    expect(withFileEdits(ai({ repoChatReadOnly: false }), false).repoChatReadOnly).toBe(true)
    // Nothing else in the config moves.
    const before = ai({ repoChatReadOnly: true, customInstructions: 'x' })
    const { repoChatReadOnly: _a, ...rest } = withFileEdits(before, true)
    const { repoChatReadOnly: _b, ...restBefore } = before
    expect(rest).toEqual(restBefore)
  })

  it('sums up what the chat can do now', () => {
    expect(chatSummary(ai({ repoChat: false }))).toEqual({ key: 'aiBehaviour.chatOff', abilities: [] })
    expect(chatSummary(ai({ repoChatActions: false }))).toEqual({ key: 'aiBehaviour.chatCanOnly', abilities: ['aiBehaviour.canRead'] })
    expect(chatSummary(ai({ repoChatActions: true, repoChatReadOnly: false, repoChatApproval: 'ask' }))).toEqual({
      key: 'aiBehaviour.chatCan',
      abilities: ['aiBehaviour.canRead', 'aiBehaviour.canGit', 'aiBehaviour.canFiles'],
      approval: 'aiBehaviour.approvalAsk'
    })
    const all = chatSummary(ai({ repoChatReadOnly: false, repoChatRemoteActions: true, repoChatApproval: 'auto-all' }))
    expect(all.abilities).toContain('aiBehaviour.canRemote')
    expect(all.approval).toBe('aiBehaviour.approvalAll')
    // Every key it can hand back exists, with the placeholders the renderer fills.
    expect(en['aiBehaviour.chatCan']).toContain('{abilities}')
    expect(en['aiBehaviour.chatCan']).toContain('{approval}')
  })
})

describe('behaviour scope line', () => {
  const profiles = [
    { id: 'a', name: 'Work', ownAI: true },
    { id: 'b', name: 'Personal' },
    { id: 'c', name: 'Side', ownAI: false }
  ]
  it('names the profiles that follow the general AI', () => {
    expect(behaviourScopeLine('general', profiles)).toEqual({ key: 'settings.aiBehaviourScopeGeneral', profiles: ['Personal', 'Side'] })
    expect(behaviourScopeLine('general', [profiles[0]])?.key).toBe('settings.aiBehaviourScopeGeneralNobody')
  })
  it("names the profile whose own AI is on screen, and nothing for onboarding", () => {
    expect(behaviourScopeLine('profile:a', profiles)).toEqual({ key: 'settings.aiBehaviourScopeOwn', profile: 'Work', profiles: ['Work'] })
    expect(behaviourScopeLine(undefined, profiles)).toBeNull()
    expect(behaviourScopeLine('profile:gone', profiles)).toBeNull()
  })
})
