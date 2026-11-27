import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { actionRequestOf, answerRepoChat, asksForAction, asksToChangeFiles, followUpOf, historyTurns, mentionsLastCommit, mentionedPaths, mentionsRepository, normalizeChatSources, repoRequestOf, typedAs } from '../src/main/repoChat'
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
    // Commit-message rules from Settings must not turn every reply into a commit.
    await answerRepoChat(repo, [{ role: 'user', content: 'Capital of France?' }], {
      ...cfg,
      customInstructions: 'Format: What changed. Why. How.'
    })
    expect(promptOf(bodies[0])).not.toMatch(/What changed/)
    const prompt = promptOf(bodies[0])
    expect(prompt).toMatch(/Answer whatever the user asks, on any subject/)
    // Neutral first: opening on "an assistant inside a Git client" made a small
    // model refuse anything else. Where it runs comes after, as a fact.
    expect(prompt).toMatch(/^You are a helpful, knowledgeable assistant/)
    expect(prompt).toMatch(/GitHuttBr/)
    expect(prompt).toMatch(/the repository's name, not the app's/)
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
    // The named file is read; the long file list stays out so it cannot bury it.
    expect(promptOf(bodies[0])).toMatch(/demo-main/)
    expect(promptOf(bodies[0])).not.toMatch(/Eligible tracked files:/)
  })
})

describe('file names as typed', () => {
  const tracked = ['package.json', 'examples/demo/package.json', 'src/app.ts', 'src/api.ts', 'README.md']

  it('forgives a slip in a longer name, and prefers the root copy', () => {
    expect(mentionedPaths('Qual a versão do packate.json', tracked)[0]).toBe('package.json')
    expect(mentionedPaths('Qual a versão do pakage.json', tracked)[0]).toBe('package.json')
    expect(mentionedPaths('Qual a versão no package.json?', tracked)).toEqual(['package.json', 'examples/demo/package.json'])
  })

  it('says which typed name was read as which file', () => {
    expect(typedAs('versão do packate.json', ['package.json'])).toEqual([
      'The user\'s "packate.json" is package.json, which was read below.'
    ])
    expect(typedAs('versão do package.json', ['package.json'])).toEqual([])
  })

  it('does not stretch an exact match, a short name or another extension', () => {
    expect(mentionedPaths('open app.ts', tracked)).toEqual(['src/app.ts'])
    expect(mentionedPaths('open apx.ts', tracked)).toEqual([])
    expect(mentionedPaths('package.yaml', tracked)).toEqual([])
  })
})

describe('questions never get actions to propose', () => {
  it('reads a question as a question', () => {
    for (const q of [
      'Qual a versão do pakage deste projeto',
      'o que é um commit?',
      'what does stash do?',
      'Qual a versão no package.json?',
      'Em qual branch eu estou?',
      'how do I rebase onto main?',
      'O que faz o useEffect?',
      'o que cria um índice no postgres?',
      'Explique o que muda entre let e const',
      'O que cria o arquivo package-lock.json?',
      'how do I remove a submodule?'
    ]) {
      expect(asksForAction(q), q).toBe(false)
    }
  })

  it('reads a request as a request', () => {
    for (const q of [
      'Faça commit das alterações',
      'faz um stash',
      'crie a branch feature/x',
      'commit the staged files',
      'Please push this branch',
      'pode dar um push?',
      'ignore os arquivos *.log',
      'corrija o typo no README.md',
      'pode criar o arquivo notas.txt?',
      'can you commit this?'
    ]) {
      expect(asksForAction(q), q).toBe(true)
    }
  })

  it('a question about the project carries no action schema', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([{ content: 'Version 1.5.0-main.', sourceIds: [] }])
    await answerRepoChat(repo, [{ role: 'user', content: 'Qual a versão do config deste projeto' }], {
      ...cfg,
      repoChatActions: true
    })
    const schema = JSON.stringify((bodies[0].response_format as { json_schema?: unknown } | undefined) ?? {})
    expect(schema).not.toMatch(/"actions"/)
    // "config" beside "deste projeto" reads config.json at the root.
    expect(promptOf(bodies[0])).toMatch(/demo-main/)
  })
})

describe('short follow-ups', () => {
  const asked = [
    { role: 'user' as const, content: 'Qual a versão do package.json do projeto?' },
    { role: 'assistant' as const, content: '4.59.1' }
  ]

  it('carry the question before them', () => {
    expect(followUpOf([...asked, { role: 'user', content: 'Tem certeza?' }])).toEqual([asked[0].content])
    expect(followUpOf([...asked, { role: 'user', content: 'Verifique' }])).toEqual([asked[0].content])
    expect(followUpOf([...asked, { role: 'user', content: 'Isso' }])).toEqual([asked[0].content])
    expect(followUpOf([...asked, { role: 'user', content: '?' }])).toEqual([asked[0].content])
    expect(
      followUpOf([
        ...asked,
        { role: 'user', content: 'Não foi exatamente a resposta que eu esperava' },
        { role: 'assistant', content: 'Quer que eu verifique?' },
        { role: 'user', content: 'Isso' }
      ])
    ).toEqual(['Não foi exatamente a resposta que eu esperava', asked[0].content])
    expect(followUpOf([...asked, { role: 'user', content: 'Me explique como funciona um motor a combustão por dentro' }])).toEqual([])
    expect(followUpOf([...asked, { role: 'user', content: 'Como é feito um rolamento?' }])).toEqual([])
  })

  it('"Tem certeza?" reads the file again, a new subject does not', async () => {
    const repo = cloneFixture('cherry-pick')
    const history = [
      { role: 'user' as const, content: 'Qual a versão do config.json do projeto?' },
      { role: 'assistant' as const, content: '1.5.0-main' }
    ]
    let model = scriptedModel([{ content: 'Sim, 1.5.0-main.', sourceIds: [] }])
    await answerRepoChat(repo, [...history, { role: 'user', content: 'Tem certeza?' }], cfg)
    expect(promptOf(model.bodies[0])).toMatch(/demo-main/)

    model = scriptedModel(['Um rolamento reduz o atrito.'])
    await answerRepoChat(repo, [...history, { role: 'user', content: 'Como é feito um rolamento?' }], cfg)
    expect(promptOf(model.bodies[0])).not.toMatch(/demo-main/)
  })
})

describe('the last commit', () => {
  it('is recognised in either language', () => {
    expect(mentionsLastCommit('Faça uma review do ultimo commit')).toBe(true)
    expect(mentionsLastCommit('Faça uma review do último commit!')).toBe(true)
    expect(mentionsLastCommit('Faça a review do ulimo commit')).toBe(true)
    expect(mentionsLastCommit('Revise a última alteração commit')).toBe(true)
    expect(mentionsLastCommit('review the last commit')).toBe(true)
    expect(mentionsLastCommit('o que mudou no HEAD?')).toBe(true)
    expect(mentionsLastCommit('review HEAD')).toBe(true)
    // The concept, not the commit: nothing to read.
    expect(mentionsLastCommit('o que é HEAD no git?')).toBe(false)
    expect(mentionsLastCommit('use your head')).toBe(false)
    expect(mentionsLastCommit('o que é um commit?')).toBe(false)
  })

  it('is read before the model answers', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([{ content: 'Looks fine.', sourceIds: [] }])
    const steps: RepoChatProgressStep[] = []
    await answerRepoChat(repo, [{ role: 'user', content: 'Faça uma review do ultimo commit' }], cfg, [], (s) => steps.push(s))
    expect(steps[0]).toEqual({ phase: 'reading', files: 1 })
    expect(promptOf(bodies[0])).toMatch(/Latest commit \(HEAD\) [0-9a-f]{10}/)
    expect(promptOf(bodies[0])).not.toMatch(/\] \(pinned by the user\)/)
  })
})

describe('when the JSON answer fails', () => {
  it('asks again in plain text instead of showing an error', async () => {
    const repo = cloneFixture('cherry-pick')
    // Empty text twice (the JSON try and its correction), then a plain answer.
    const { bodies } = scriptedModel([
      { content: '', sourceIds: [] },
      { content: '', sourceIds: [] },
      'O último commit adiciona um arquivo e está correto.'
    ])
    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'Faça a review do ulimo commit' }], cfg)
    expect(reply.content).toBe('O último commit adiciona um arquivo e está correto.')
    expect(reply.sources).toEqual([])
    expect(bodies).toHaveLength(3)
    expect(bodies[2].response_format).toBeUndefined()
    // The plain retry still carries the commit that was read.
    expect(promptOf(bodies[2])).toMatch(/Latest commit \(HEAD\)/)
    // One system message, first, in every call: some local chat templates
    // reject a second one, and the context rides inside it.
    for (const body of bodies) {
      const roles = (body.messages as { role: string }[]).map((m) => m.role)
      expect(roles.filter((r) => r === 'system')).toHaveLength(1)
      expect(roles[0]).toBe('system')
    }
  })
})

describe('a request to change something', () => {
  it('goes to the rounds that can propose it, never to the plain conversation', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([{ content: 'Commit proposed.', sourceIds: [] }])
    await answerRepoChat(repo, [{ role: 'user', content: 'faça commit das alterações' }], {
      ...cfg,
      repoChatActions: true
    })
    expect(bodies).toHaveLength(1)
    expect(bodies[0].response_format).toBeDefined()
    // File read-only mode is on by default: the model is told which setting to name.
    expect(promptOf(bodies[0])).toMatch(/"File read-only mode" setting \(Settings → AI → Repository chat\)/)
  })

  it('says itself that file changes are off, whatever the model wrote', async () => {
    const repo = cloneFixture('cherry-pick')
    const silent = scriptedModel([{ content: 'Criei o arquivo teste.txt.', sourceIds: [] }])
    const ask = 'Crie um arquivo na raiz chamado teste.txt com o texto olá mundo'
    const off = await answerRepoChat(repo, [{ role: 'user', content: ask }], { ...cfg, repoChatActions: true })
    expect(off.notice).toBe('file-read-only')
    // No model is asked, so none can claim the file was created.
    expect(off.content).toBe('')
    expect(silent.bodies).toHaveLength(0)

    scriptedModel([
      {
        content: 'Proposed.',
        sourceIds: [],
        actions: [{ type: 'write_file', path: 'teste.txt', content: 'olá mundo', mode: 'create', description: 'Create teste.txt' }]
      }
    ])
    const on = await answerRepoChat(repo, [{ role: 'user', content: ask }], { ...cfg, repoChatActions: true, repoChatReadOnly: false })
    expect(on.notice).toBeUndefined()

    scriptedModel([{ content: 'Stash proposed.', sourceIds: [] }])
    const git = await answerRepoChat(repo, [{ role: 'user', content: 'faça um stash' }], { ...cfg, repoChatActions: true })
    expect(git.notice).toBeUndefined()
  })

  it('knows a file change from a Git request', () => {
    expect(asksToChangeFiles('Crie um arquivo na raiz chamado teste.txt')).toBe(true)
    expect(asksToChangeFiles('edit README.md to add a line')).toBe(true)
    expect(asksToChangeFiles('apague o arquivo log.txt')).toBe(true)
    expect(asksToChangeFiles('faça um stash')).toBe(false)
    expect(asksToChangeFiles('crie a branch feature/x')).toBe(false)
  })

  it('the plain conversation is told it cannot change anything', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel(['Olá!'])
    await answerRepoChat(repo, [{ role: 'user', content: 'olá' }], cfg)
    expect(promptOf(bodies[0])).toMatch(/never say you created, edited, committed or ran something/)
  })
})

describe('a file request answered without the file', () => {
  it('is sent back once, and the second answer carries the action', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([
      { content: 'Criei o arquivo review.txt com a review.', sourceIds: [] },
      {
        content: 'Proponho criar review.txt com a review.',
        sourceIds: [],
        actions: [{ type: 'write_file', path: 'review.txt', content: 'ok', mode: 'create', description: 'Create review.txt' }]
      }
    ])
    const reply = await answerRepoChat(
      repo,
      [{ role: 'user', content: 'Faça a review do último commit e crie um arquivo review.txt na raiz com ela' }],
      { ...cfg, repoChatActions: true, repoChatReadOnly: false }
    )
    expect(bodies).toHaveLength(2)
    expect(promptOf(bodies[1])).toMatch(/Put it in "actions" as a write_file or edit_file action/)
    expect(reply.actions?.map((a) => a.type)).toEqual(['write_file'])
  })

  it('a second miss ends in the honest fallback, not a claimed file', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([
      { content: 'Criei o arquivo.', sourceIds: [] },
      { content: 'Criei o arquivo.', sourceIds: [] },
      'Não consegui preparar a criação do arquivo desta vez; reenvie o pedido.'
    ])
    const reply = await answerRepoChat(
      repo,
      [{ role: 'user', content: 'crie um arquivo notas.txt com o texto oi' }],
      { ...cfg, repoChatActions: true, repoChatReadOnly: false }
    )
    expect(bodies).toHaveLength(3)
    expect(bodies[2].response_format).toBeUndefined()
    expect(reply.actions ?? []).toEqual([])
    expect(reply.content).not.toMatch(/Criei o arquivo\./)
    // Said by the app, whatever the fallback wrote.
    expect(reply.notice).toBe('file-not-prepared')
  })
})

describe('citations', () => {
  const evidence = [{ id: 'E1', path: 'package.json', startLine: 1, endLine: 5, text: '{}' }]

  it('keeps known ids, maps a cited path to its excerpt, drops the rest', () => {
    expect(normalizeChatSources({ content: 'x', sourceIds: ['E1', 'package.json', 'test/other.test.ts', 7] }, evidence)).toEqual({
      content: 'x',
      sourceIds: ['E1']
    })
    expect(normalizeChatSources({ content: 'x' }, evidence)).toEqual({ content: 'x', sourceIds: [] })
  })

  it('a reply without text, or with text as a list, is not an error', () => {
    expect(normalizeChatSources({ sourceIds: [], needMore: { commits: ['abc1234'] } }, evidence)).toMatchObject({ content: '' })
    expect(normalizeChatSources({ content: ['a', 'b'], sourceIds: [] }, evidence)).toMatchObject({ content: 'a\nb' })
  })

  it('an invented citation no longer costs the user the answer', async () => {
    const repo = cloneFixture('cherry-pick')
    scriptedModel([{ content: 'The version is 1.5.0-main.', sourceIds: ['test/cloneLinkedAccount.test.ts'] }])
    const reply = await answerRepoChat(repo, [{ role: 'user', content: 'Qual a versão no config.json?' }], cfg)
    expect(reply.content).toBe('The version is 1.5.0-main.')
    expect(reply.sources).toEqual([])
  })
})

describe('asking for the repository', () => {
  it('reads @repo, and the repository name a small model writes instead', () => {
    expect(repoRequestOf('@repo the file list', 'my-app')).toBe('the file list')
    expect(repoRequestOf('`@my-app config.json`', 'my-app')).toBe('config.json')
    expect(repoRequestOf('@repository', 'my-app')).toBe('the repository')
  })

  it('reads a short "repo …" reply that dropped the @', () => {
    expect(repoRequestOf('repo package.json', 'my-app')).toBe('package.json')
    expect(repoRequestOf('Repositories are where Git keeps history, and this one has a long story to tell you.', 'my-app')).toBeNull()
  })

  it('does not mistake an answer for a request', () => {
    expect(repoRequestOf('Paris is the capital of France.', 'my-app')).toBeNull()
    expect(repoRequestOf('Mention someone with @name in a PR.', 'my-app')).toBeNull()
    expect(repoRequestOf('no @repo here', 'my-app')).toBeNull()
  })
})

describe('chat turns', () => {
  it('leaves out a reply that was only the app\'s note', () => {
    expect(
      historyTurns([
        { role: 'user', content: 'crie teste.txt' },
        { role: 'assistant', content: '' },
        { role: 'user', content: 'Onde você criou?' }
      ])
    ).toEqual([
      { role: 'user', content: 'crie teste.txt' },
      { role: 'user', content: 'Onde você criou?' }
    ])
  })

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

describe('"crie o arquivo" after a generated text, with file changes on', () => {
  const text = 'Kq3vLm8pRt2sWb7nKc4dZf9gHj1yUe6aPo0iTr5wQs8xMv3bNl6kJh2cGd7fSe1rAt4yUi9oPw0qLz5xCv2bNm7kJh4gFd8sAe3'
  const refusal =
    'Como estou rodando dentro de um ambiente isolado, não consigo criar o arquivo arquivo.txt. Copie o texto acima.'
  const conversation = [
    { role: 'user' as const, content: 'gere um texto aleatório de 100 caracteres' },
    { role: 'assistant' as const, content: text },
    { role: 'user' as const, content: 'pode ser esse' },
    { role: 'assistant' as const, content: text },
    { role: 'user' as const, content: 'crie o arquivo' }
  ]
  const on = { ...cfg, repoChatActions: true, repoChatReadOnly: false }
  const write = {
    content: 'Proposed arquivo.txt.',
    sourceIds: [],
    actions: [{ type: 'write_file', path: 'arquivo.txt', content: text, mode: 'create', description: 'Create arquivo.txt' }]
  }

  it('sends the file actions, says they are on, and carries the text to write', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([write])
    const reply = await answerRepoChat(repo, conversation, on)

    expect(bodies).toHaveLength(1)
    const schema = JSON.stringify(bodies[0].response_format)
    expect(schema).toMatch(/write_file/)
    const prompt = promptOf(bodies[0])
    // Told outright: Gemini, given only the schema, answered "I run in an isolated environment".
    expect(prompt).toMatch(/File changes are turned on for this repository/)
    expect(prompt).toMatch(/text you wrote in an earlier reply/)
    // The earlier reply is a real assistant turn, and the request is the last thing read.
    const sent = bodies[0].messages as { role: string; content: string }[]
    expect(sent).toContainEqual({ role: 'assistant', content: text })
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'crie o arquivo' })
    expect(reply.actions).toEqual([expect.objectContaining({ type: 'write_file', path: 'arquivo.txt', content: text })])
  })

  it('never tells the model the files are off when they are on', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([write])
    await answerRepoChat(repo, conversation, on)
    expect(promptOf(bodies[0])).not.toMatch(/File read-only mode/)
  })

  it('"Tem sim eu dei acesso" goes back to the rounds that can propose the file', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([write])
    const insisted = [...conversation, { role: 'assistant' as const, content: refusal }, { role: 'user' as const, content: 'Tem sim eu dei acesso' }]
    const reply = await answerRepoChat(repo, insisted, on)

    expect(bodies).toHaveLength(1)
    // Not the plain conversation, which is told it cannot change anything.
    expect(bodies[0].response_format).toBeDefined()
    expect(promptOf(bodies[0])).not.toMatch(/You cannot change anything from here/)
    expect(promptOf(bodies[0])).toMatch(/if an earlier reply in this conversation said so, it was wrong/)
    expect(reply.actions?.[0]).toMatchObject({ type: 'write_file', path: 'arquivo.txt' })
  })

  it('in File read-only mode the insistence is still refused by the app, with no model asked', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([write])
    const insisted = [...conversation, { role: 'assistant' as const, content: refusal }, { role: 'user' as const, content: 'Tem sim eu dei acesso' }]
    const reply = await answerRepoChat(repo, insisted, { ...cfg, repoChatActions: true })
    expect(reply.notice).toBe('file-read-only')
    expect(bodies).toHaveLength(0)
  })

  it('a failed JSON answer is not turned into "I have no access"', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel([
      { content: '', sourceIds: [] },
      { content: '', sourceIds: [] },
      'Não consegui preparar a alteração desta vez; envie o pedido de novo.'
    ])
    const reply = await answerRepoChat(repo, conversation, on)
    expect(bodies).toHaveLength(3)
    expect(bodies[2].response_format).toBeUndefined()
    expect(promptOf(bodies[2])).toMatch(/this reply could not carry a proposal/)
    expect(promptOf(bodies[2])).toMatch(/do not say you lack access/)
    expect(reply.actions).toBeUndefined()
  })

  it('a plain question after a request never inherits it', async () => {
    const repo = cloneFixture('cherry-pick')
    const { bodies } = scriptedModel(['Chama-se arquivo.txt.'])
    await answerRepoChat(repo, [...conversation, { role: 'assistant' as const, content: 'Proposed.' }, { role: 'user' as const, content: 'qual o nome dele?' }], on)
    expect(bodies[0].response_format).toBeUndefined()
  })
})

describe('the request a reply insists on', () => {
  const request = { role: 'user' as const, content: 'crie o arquivo' }
  const refusal = { role: 'assistant' as const, content: 'Não consigo.' }
  const after = (content: string) => [request, refusal, { role: 'user' as const, content }]

  it('is inherited by an insistence or a go-ahead', () => {
    for (const reply of ['Tem sim eu dei acesso', 'eu dei acesso', 'sim', 'pode sim', 'você pode sim', 'I gave you access', 'go ahead', 'Já habilitei']) {
      expect(actionRequestOf(after(reply)), reply).toBe('crie o arquivo')
    }
  })

  it('reaches back over an earlier insistence', () => {
    const twice = [...after('Tem sim eu dei acesso'), refusal, { role: 'user' as const, content: 'eu liberei o acesso' }]
    expect(actionRequestOf(twice)).toBe('crie o arquivo')
  })

  it('is not inherited by a question, a thank-you or a new subject', () => {
    for (const reply of ['qual o nome dele?', 'obrigado', 'ok', 'e o que é um commit', 'explique o arquivo config.json para mim agora mesmo por favor']) {
      expect(actionRequestOf(after(reply)), reply).toBeNull()
    }
    expect(actionRequestOf([{ role: 'user', content: 'Tem sim eu dei acesso' }])).toBeNull()
  })

  it('is the latest message itself when that asks', () => {
    expect(actionRequestOf(after('faça um stash'))).toBe('faça um stash')
  })
})

describe('code in an answer is not a request for the repository', () => {
  it('ignores an annotation inside a fenced block', () => {
    const answer = 'Use a repository bean:\n\n```java\n@Repository\npublic interface Users {}\n```'
    expect(repoRequestOf(answer, 'my-app')).toBeNull()
    expect(repoRequestOf('@repo package.json', 'my-app')).toBe('package.json')
  })
})
