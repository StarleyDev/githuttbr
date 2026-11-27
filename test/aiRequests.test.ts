import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AI_CANCELLED,
  AI_UNREACHABLE,
  answerSlowAIRequest,
  cancelAIRequestsByTag,
  inflightAIRequestCount,
  runWithAIRequestTag,
  serverAnswers,
  setAIRequestListener,
  trackAIRequest
} from '../src/main/aiRequests'
import { callModel } from '../src/main/aiTransport'
import { aiOutcome, configForAccount, guardAI, otherAccounts, type GuardDeps } from '../src/renderer/src/lib/aiGuard'
import { newAccount, resolveAI } from '../src/shared/aiAccounts'
import { defaultAIConfig, type AIConfig, type AIRequestEvent } from '../src/shared/types'

const events: AIRequestEvent[] = []
setAIRequestListener((e) => events.push(e))
afterEach(() => {
  events.length = 0
  vi.useRealTimers()
})

/** A call that only ends when its signal aborts. */
const hang = (signal: AbortSignal): Promise<string> =>
  new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('a model call in flight', () => {
  it('announces a slow call, then ends it when the user cancels', async () => {
    const call = trackAIRequest({ label: 'Ollama', accountId: 'ollama', slowMs: 20 }, hang)
    await sleep(40)
    const slow = events.find((e) => e.type === 'slow')
    expect(slow).toMatchObject({ type: 'slow', label: 'Ollama', accountId: 'ollama' })
    answerSlowAIRequest((slow as { id: number }).id, { kind: 'cancel' })
    await expect(call).rejects.toThrow(AI_CANCELLED)
    expect(events.at(-1)).toEqual({ type: 'done', id: (slow as { id: number }).id })
    expect(inflightAIRequestCount()).toBe(0)
  })

  it('"keep waiting" leaves the call running', async () => {
    let finish!: (v: string) => void
    const call = trackAIRequest({ label: 'Ollama', accountId: 'ollama', slowMs: 20 }, () => new Promise<string>((r) => (finish = r)))
    await sleep(40)
    const slow = events.find((e) => e.type === 'slow') as { id: number }
    answerSlowAIRequest(slow.id, { kind: 'wait' })
    finish('answer')
    await expect(call).resolves.toBe('answer')
  })

  it('a switch ends the call with the account to move to', async () => {
    const call = trackAIRequest({ label: 'Ollama', accountId: 'ollama', slowMs: 20 }, hang)
    await sleep(40)
    const slow = events.find((e) => e.type === 'slow') as { id: number }
    answerSlowAIRequest(slow.id, { kind: 'switch', accountId: 'google' })
    await expect(call).rejects.toThrow('[ai:switch:google]')
  })

  it('ends a call to a local server that stopped answering, without waiting for the timeout', async () => {
    const call = trackAIRequest(
      { label: 'Ollama', accountId: 'ollama', probeUrl: 'http://127.0.0.1:1/v1/models', probe: async () => false },
      hang
    )
    await expect(call).rejects.toThrow(AI_UNREACHABLE)
  }, 15_000)

  it('keeps a call whose server still answers the probe', async () => {
    let finish!: (v: string) => void
    const call = trackAIRequest(
      { label: 'Ollama', accountId: 'ollama', probeUrl: 'http://x/models', probe: async () => true },
      () => new Promise<string>((r) => (finish = r))
    )
    await sleep(8_000)
    finish('still here')
    await expect(call).resolves.toBe('still here')
  }, 15_000)
})

describe('cancelling a job by its tag', () => {
  it('ends the call in flight for that tag, and only that one', async () => {
    let finishOther!: (v: string) => void
    const mine = runWithAIRequestTag('w1:commit-1', () => trackAIRequest({ label: 'Ollama', accountId: 'ollama' }, hang))
    const other = runWithAIRequestTag('w1:commit-2', () =>
      trackAIRequest({ label: 'Ollama', accountId: 'ollama' }, () => new Promise<string>((r) => (finishOther = r)))
    )
    await sleep(5)
    cancelAIRequestsByTag('w1:commit-1')
    await expect(mine).rejects.toThrow(AI_CANCELLED)
    finishOther('answer')
    await expect(other).resolves.toBe('answer')
    expect(inflightAIRequestCount()).toBe(0)
  })

  it('a cancel between two calls of a job refuses the next one', async () => {
    let second = false
    const job = runWithAIRequestTag('w1:commit-3', async () => {
      await trackAIRequest({ label: 'Ollama', accountId: 'ollama' }, async () => 'first')
      await sleep(10)
      second = true
      return trackAIRequest({ label: 'Ollama', accountId: 'ollama' }, async () => 'second')
    })
    await sleep(2)
    cancelAIRequestsByTag('w1:commit-3')
    await expect(job).rejects.toThrow(AI_CANCELLED)
    expect(second).toBe(true)
    expect(inflightAIRequestCount()).toBe(0)
  })

  it('a cancel for a job that already ended, or never ran, leaves nothing behind', async () => {
    await runWithAIRequestTag('w1:commit-4', () => trackAIRequest({ label: 'Ollama', accountId: 'ollama' }, async () => 'ok'))
    cancelAIRequestsByTag('w1:commit-4')
    cancelAIRequestsByTag('w1:never')
    // The same tag reused later runs normally: the late cancel did not stick.
    await expect(
      runWithAIRequestTag('w1:commit-4', () => trackAIRequest({ label: 'Ollama', accountId: 'ollama' }, async () => 'again'))
    ).resolves.toBe('again')
  })

  it('a call outside any job ignores every tag', async () => {
    let finish!: (v: string) => void
    const call = trackAIRequest({ label: 'Ollama', accountId: 'ollama' }, () => new Promise<string>((r) => (finish = r)))
    cancelAIRequestsByTag('w1:commit-1')
    finish('free')
    await expect(call).resolves.toBe('free')
  })
})

describe('probing a local server', () => {
  let server: Server | null = null
  afterEach(() => server?.close())

  it('any HTTP answer is alive; a refused connection is not', async () => {
    server = createServer((_req, res) => {
      res.statusCode = 404
      res.end()
    })
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r))
    const { port } = server.address() as AddressInfo
    expect(await serverAnswers(`http://127.0.0.1:${port}/v1/models`)).toBe(true)
    expect(await serverAnswers('http://127.0.0.1:1/v1/models')).toBe(false)
  })

  it('a closed Ollama is reported as unreachable at once', async () => {
    const cfg: AIConfig = resolveAI({
      ...defaultAIConfig(),
      accounts: [{ ...newAccount([], 'ollama'), endpoint: 'http://127.0.0.1:1/v1' }],
      defaultAccountId: 'ollama'
    })
    await expect(callModel(cfg, [{ role: 'user', content: 'hi' }], 0.2)).rejects.toThrow(AI_UNREACHABLE)
  })
})

describe('the renderer guard', () => {
  const ai = (): AIConfig => {
    const ollama = { ...newAccount([], 'ollama'), model: 'qwen3' }
    const google = { ...newAccount([ollama], 'google'), apiKey: 'k', model: 'gemini-2.5-flash' }
    return resolveAI({ ...defaultAIConfig(), accounts: [ollama, google], defaultAccountId: 'ollama' })
  }
  const deps = (pick: string | null): GuardDeps => ({
    askUnreachable: vi.fn(async () => pick),
    cancelledMessage: () => 'cancelled',
    unreachableMessage: (label) => `${label} down`
  })

  it('reads the outcome tags', () => {
    expect(aiOutcome(new Error("Error invoking remote method 'ai:x': Error: [ai:cancelled] Cancelled."))).toEqual({ kind: 'cancelled' })
    expect(aiOutcome(new Error('[ai:switch:google] Switching'))).toEqual({ kind: 'switch', accountId: 'google' })
    expect(aiOutcome(new Error('[ai:unreachable] gone'))).toEqual({ kind: 'unreachable' })
    expect(aiOutcome(new Error('AI request failed (500): boom'))).toBeNull()
  })

  it('a switch re-runs the same call on the other account', async () => {
    const seen: string[] = []
    const result = await guardAI(
      ai(),
      async (c) => {
        seen.push(`${c.provider}:${c.model}`)
        if (c.provider === 'ollama') throw new Error('[ai:switch:google] Switching')
        return 'ok'
      },
      deps(null)
    )
    expect(result).toBe('ok')
    expect(seen).toEqual(['ollama:qwen3', 'google:gemini-2.5-flash'])
  })

  it('a dead local server offers the other accounts, and uses the one picked', async () => {
    const d = deps('google')
    const result = await guardAI(
      ai(),
      async (c) => {
        if (c.provider === 'ollama') throw new Error('[ai:unreachable] gone')
        return c.provider
      },
      d
    )
    expect(result).toBe('google')
    expect(d.askUnreachable).toHaveBeenCalledWith('Ollama (local)', [expect.objectContaining({ id: 'google' })])
  })

  it('with nothing picked, or nothing to pick, the failure says which account is down', async () => {
    const fail = async (): Promise<never> => {
      throw new Error('[ai:unreachable] gone')
    }
    await expect(guardAI(ai(), fail, deps(null))).rejects.toThrow('Ollama (local) down')
    const alone = resolveAI({ ...defaultAIConfig(), accounts: [newAccount([], 'ollama')], defaultAccountId: 'ollama' })
    await expect(guardAI(alone, fail, deps('x'))).rejects.toThrow('Ollama (local) down')
  })

  it('a cancel ends with a plain message; other errors pass through untouched', async () => {
    await expect(guardAI(ai(), async () => { throw new Error('[ai:cancelled] x') }, deps(null))).rejects.toThrow('cancelled')
    await expect(guardAI(ai(), async () => { throw new Error('AI request failed (401): bad key') }, deps(null))).rejects.toThrow('401')
  })

  it('only accounts that can make a call are offered, and a switch keeps the working directory', () => {
    const base = ai()
    const withoutKey = { ...base, accounts: [...(base.accounts ?? []), newAccount(base.accounts ?? [], 'openai')] }
    expect(otherAccounts(withoutKey).map((a) => a.id)).toEqual(['google'])
    expect(configForAccount({ ...base, cliCwd: '/repo' }, 'google').cliCwd).toBe('/repo')
  })
})
