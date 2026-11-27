import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { answerRepoChat, historyTurns, mentionedPaths, mentionsRepository, repoRequestOf } from '../src/main/repoChat'
import { migrateAIConfig } from '../src/shared/aiAccounts'
import type { RepoChatProgressStep } from '../src/shared/types'
import { chatProgressLabel } from '../src/renderer/src/lib/repoChatContext'
import { cloneFixture, cleanupFixtures } from './fixtures'

afterAll(() => cleanupFixtures())
afterEach(() => vi.unstubAllGlobals())

const cfg = migrateAIConfig({ provider: 'custom', endpoint: 'http://127.0.0.1:4000/v1', model: 'default' })

/** A model that replies with each canned reply in turn — a string as plain
 *  text, an object as JSON — recording what it was sent. */
function scriptedModel(replies: unknown[]): { bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      const reply = replies[Math.min(bodies.length - 1, replies.length - 1)]
      const content = typeof reply === 'string' ? reply : JSON.stringify(reply)
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
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
  it('answers a greeting in one plain-text call, reading nothing', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel(['Olá! Como posso ajudar?'])
    const steps: RepoChatProgressStep[] = []

    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'olá' }], cfg, [], (s) => steps.push(s))

    expect(reply.content).toBe('Olá! Como posso ajudar?')
    expect(bodies).toHaveLength(1)
    // Plain text, like the terminal: no JSON format to bend a small model's
    // accents, and a conversational temperature.
    expect(bodies[0].response_format).toBeUndefined()
    expect(bodies[0].temperature).toBe(0.6)
    // The question is the last thing the model reads, as its own turn.
    const sent = bodies[0].messages as { role: string; content: string }[]
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'olá' })
    expect(steps).toEqual([{ phase: 'thinking' }])
  })

  it('sends only the message: a neutral assistant, the repository as one line', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel(['Paris.'])
    await answerRepoChat(repo, [{ role: 'user', content: 'Capital of France?' }], cfg)
    const prompt = promptOf(bodies[0])
    expect(prompt).toMatch(/Answer whatever the user asks, on any subject/)
    expect(prompt).not.toMatch(/Git client/)
    expect(prompt).not.toMatch(/Eligible tracked files:/)
    expect(prompt).not.toMatch(/Staged|Unstaged|Untracked files/)
    expect(prompt).toMatch(/Nothing from it has been read/)
  })

  it('opens the repository only when the reply asks for it with @repo', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel(['@repo the list of files', { content: 'Two files are tracked.', sourceIds: [] }])
    const steps: RepoChatProgressStep[] = []
    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'What files are here?' }], cfg, [], (st) => steps.push(st))
    expect(reply.content).toBe('Two files are tracked.')
    expect(bodies).toHaveLength(2)
    expect(promptOf(bodies[0])).not.toMatch(/Eligible tracked files:/)
    expect(promptOf(bodies[1])).toMatch(/Eligible tracked files:[\s\S]*config\.json/)
    expect(bodies[1].temperature).toBe(0.2)
    expect(steps).toEqual([{ phase: 'thinking' }, { phase: 'reading', files: 0 }, { phase: 'thinking' }])
  })

  it('reads a file the question names before the first call', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([{ content: 'config.json names the package demo-main.', sourceIds: [] }])
    const steps: RepoChatProgressStep[] = []

    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'What is in config.json?' }], cfg, [], (s) => steps.push(s))

    expect(reply.content).toBe('config.json names the package demo-main.')
    expect(bodies).toHaveLength(1)
    expect(steps).toEqual([{ phase: 'reading', files: 1 }, { phase: 'thinking' }])
    // The file's own contents went out, not just its name in a list.
    expect(promptOf(bodies[0])).toMatch(/demo-main/)
  })

  it('reads what the model asks for, then answers from it', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([
      '@repo the log',
      { content: 'Looking.', sourceIds: [], needMore: { paths: ['log.txt'], searches: [], commits: [] } },
      { content: 'The log has entries.', sourceIds: [] }
    ])
    const steps: RepoChatProgressStep[] = []
    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'What does the log say?' }], cfg, [], (s) => steps.push(s))
    expect(reply.content).toBe('The log has entries.')
    expect(bodies).toHaveLength(3)
    expect(steps).toEqual([
      { phase: 'thinking' },
      { phase: 'reading', files: 0 },
      { phase: 'thinking' },
      { phase: 'reading', files: 1 },
      { phase: 'thinking' }
    ])
  })

  it('drops a thinking model\'s reasoning from a plain answer', async () => {
    const repo = cloneFixture('cherry-pick')
    scriptedModel(['<think>the user greets me</think>\nOlá!'])
    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'olá' }], cfg)
    expect(reply.content).toBe('Olá!')
  })
})

describe('a message that names the repository', () => {
  const tracked = ['config.json', 'src/app/main.ts', 'log.txt']

  it('opens it for a tracked file named outright or "this repository"', () => {
    expect(mentionsRepository('O que tem no arquivo config.json?', tracked)).toBe(true)
    expect(mentionsRepository('explain main.ts', tracked)).toBe(true)
    expect(mentionsRepository('Tem alguma alteração não commitada?', tracked)).toBe(true)
    expect(mentionsRepository('Quais arquivos existem neste repositório?', tracked)).toBe(true)
    expect(mentionsRepository('summarize my changes', tracked)).toBe(true)
  })

  it('leaves general questions alone, even about code', () => {
    expect(mentionsRepository('olá', tracked)).toBe(false)
    expect(mentionsRepository('Qual a capital da França?', tracked)).toBe(false)
    expect(mentionsRepository('o que é um rebase?', tracked)).toBe(false)
    expect(mentionsRepository('how do I parse a package.json in node?', tracked)).toBe(false)
    expect(mentionedPaths('o que tem em config.json e main.ts?', tracked)).toEqual(['config.json', 'src/app/main.ts'])
  })

  it('goes straight to the grounded rounds, without the plain-text call', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([{ content: 'It holds settings.', sourceIds: [] }])
    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'O que tem no config.json?' }], cfg)
    expect(reply.content).toBe('It holds settings.')
    expect(bodies).toHaveLength(1)
    expect(promptOf(bodies[0])).toMatch(/Eligible tracked files:/)
  })
})

describe('asking for the repository', () => {
  it('reads @repo, and the repository name a small model writes instead', () => {
    expect(repoRequestOf('@repo the file list', 'my-app')).toBe('the file list')
    expect(repoRequestOf('`@my-app config.json`', 'my-app')).toBe('config.json')
    expect(repoRequestOf('@repository', 'my-app')).toBe('the repository')
  })

  it('does not mistake an answer for a request', () => {
    expect(repoRequestOf('Paris is the capital of France.', 'my-app')).toBeNull()
    expect(repoRequestOf('Mention someone with @name in a PR.', 'my-app')).toBeNull()
    expect(repoRequestOf('no @repo here', 'my-app')).toBeNull()
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
