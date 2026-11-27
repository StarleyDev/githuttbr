import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { answerRepoChat, historyTurns } from '../src/main/repoChat'
import { migrateAIConfig } from '../src/shared/aiAccounts'
import type { RepoChatProgressStep } from '../src/shared/types'
import { chatProgressLabel } from '../src/renderer/src/lib/repoChatContext'
import { cloneFixture, cleanupFixtures } from './fixtures'

afterAll(() => cleanupFixtures())
afterEach(() => vi.unstubAllGlobals())

const cfg = migrateAIConfig({ provider: 'custom', endpoint: 'http://127.0.0.1:4000/v1', model: 'default' })

/** A model that replies with each canned JSON object in turn, recording what it was sent. */
function scriptedModel(replies: unknown[]): { bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      const reply = replies[Math.min(bodies.length - 1, replies.length - 1)]
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })
  )
  return { bodies }
}

const promptOf = (body: Record<string, unknown>): string =>
  (body.messages as { content: string }[]).map((m) => m.content).join('\n')

describe('repository chat flow', () => {
  it('answers a greeting in one call, reading nothing', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([{ content: 'Olá! Como posso ajudar?', sourceIds: [] }])
    const steps: RepoChatProgressStep[] = []

    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'olá' }], cfg, [], (s) => steps.push(s))

    expect(reply.content).toBe('Olá! Como posso ajudar?')
    expect(bodies).toHaveLength(1)
    // The question is the last thing the model reads, as its own turn; the
    // repository context and its file list come before it, marked as reference.
    const sent = bodies[0].messages as { role: string; content: string }[]
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'olá' })
    expect(sent.filter((m) => m.role === 'system').map((m) => m.content).join('\n')).toMatch(/reference only/)
    expect(steps).toEqual([{ phase: 'thinking' }])
  })

  it('tells the model it may answer anything, not only about the repository', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([{ content: 'Paris.', sourceIds: [] }])
    await answerRepoChat(repo, [{ role: 'user', content: 'Capital of France?' }], cfg)
    const prompt = promptOf(bodies[0])
    expect(prompt).toMatch(/They may ask anything/)
    expect(prompt).toMatch(/do not steer them toward the repository/)
    // Like any chat: the message goes out with the repository's name only —
    // no file list, no Git state, nothing the user did not ask for.
    expect(prompt).not.toMatch(/Eligible tracked files:/)
    expect(prompt).not.toMatch(/Staged|Unstaged|Untracked files/)
    expect(prompt).toMatch(/Nothing from it has been read yet/)
  })

  it('shows the state and file list only once the model asks for the overview', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([
      { content: 'Looking.', sourceIds: [], needMore: { overview: true } },
      { content: 'Two files are tracked.', sourceIds: [] }
    ])
    const steps: RepoChatProgressStep[] = []
    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'What files are here?' }], cfg, [], (st) => steps.push(st))
    expect(reply.content).toBe('Two files are tracked.')
    expect(bodies).toHaveLength(2)
    expect(promptOf(bodies[0])).not.toMatch(/Eligible tracked files:/)
    expect(promptOf(bodies[1])).toMatch(/Eligible tracked files:[\s\S]*config\.json/)
    expect(steps).toEqual([{ phase: 'thinking' }, { phase: 'reading', files: 0 }, { phase: 'thinking' }])
  })

  it('reads the files a repository question asks for, then answers from them', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([
      { content: 'Looking.', sourceIds: [], needMore: { paths: ['config.json'], searches: [], commits: [] } },
      { content: 'config.json holds the settings.', sourceIds: [] }
    ])
    const steps: RepoChatProgressStep[] = []

    const reply = await answerRepoChat(
      repo,
      [{ role: 'user', content: 'What is in config.json?' }],
      cfg,
      [],
      (s) => steps.push(s)
    )

    expect(reply.content).toBe('config.json holds the settings.')
    expect(bodies).toHaveLength(2)
    expect(steps).toEqual([{ phase: 'thinking' }, { phase: 'reading', files: 1 }, { phase: 'thinking' }])
    expect(promptOf(bodies[1])).toMatch(/config\.json/)
  })
})

describe('chat turns', () => {
  it('keeps the order, newest last, and never opens with the assistant', () => {
    expect(
      historyTurns([
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' }
      ])
    ).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' }
    ])
    const long = 'x'.repeat(15_000)
    const clipped = historyTurns([
      { role: 'user', content: long },
      { role: 'assistant', content: long },
      { role: 'user', content: 'last' }
    ])
    expect(clipped[0].role).toBe('user')
    expect(clipped.at(-1)).toEqual({ role: 'user', content: 'last' })
  })
})

describe('chat waiting line', () => {
  it('says thinking, reading N files or searching — never "reading the repository" for a greeting', () => {
    expect(chatProgressLabel(null)).toEqual({ key: 'chat.thinking' })
    expect(chatProgressLabel({ phase: 'thinking' })).toEqual({ key: 'chat.thinking' })
    expect(chatProgressLabel({ phase: 'reading', files: 3 })).toEqual({ key: 'chat.readingFiles', vars: { count: 3 } })
    expect(chatProgressLabel({ phase: 'reading', files: 0 })).toEqual({ key: 'chat.searchingRepo' })
  })
})
