/**
 * Every model call in flight, so a slow or dead one is never a silent wait.
 *
 * - **Slow:** after `slowMs` without an answer the renderer is told, and the
 *   user picks: keep waiting, switch to another account, or cancel. Thinking
 *   models legitimately take minutes, so nothing is cut off on a timer.
 * - **Dead:** a local server (Ollama, LM Studio, llama.cpp…) that is closed
 *   mid-request may leave the socket waiting for Node's five-minute limit. While
 *   a call to a local endpoint runs, the server is probed; any HTTP answer, even
 *   a 404, means alive, and two refused probes in a row end the call at once.
 *
 * The outcome reaches the renderer as a tagged error message — `[ai:cancelled]`,
 * `[ai:switch:<accountId>]`, `[ai:unreachable]` — because an Error crossing IPC
 * keeps only its message.
 */

import type { AIRequestEvent, AISlowChoice } from '../shared/types'

interface Inflight {
  controller: AbortController
  arm: (ms: number) => void
  stop: () => void
}

export const AI_SLOW_MS = 30_000
/** After "keep waiting", ask again only after this much longer. */
export const AI_SLOW_AGAIN_MS = 60_000
const PROBE_FIRST_MS = 3_000
const PROBE_EVERY_MS = 4_000
const PROBE_TIMEOUT_MS = 3_000
const PROBE_FAILURES_TO_GIVE_UP = 2

const inflight = new Map<number, Inflight>()
let nextId = 1
let listener: (event: AIRequestEvent) => void = () => undefined

export function setAIRequestListener(fn: (event: AIRequestEvent) => void): void {
  listener = fn
}

export const AI_CANCELLED = '[ai:cancelled]'
export const AI_UNREACHABLE = '[ai:unreachable]'
export const aiSwitchTag = (accountId: string): string => `[ai:switch:${accountId}]`

export interface TrackOptions {
  /** Shown to the user: "Ollama", "My work Gemini". */
  label: string
  accountId: string
  /** Set for a local endpoint: probed while the call runs. */
  probeUrl?: string
  slowMs?: number
  /** Injectable for tests. */
  probe?: (url: string) => Promise<boolean>
}

/**
 * False only when the connection itself fails — refused or dropped, the closed
 * server. Any HTTP answer, even a 404, is alive, and so is a probe that merely
 * times out: a single-slot local server busy generating may be slow to answer
 * it, and that is the slow case the user decides, not a dead one.
 */
export async function serverAnswers(url: string): Promise<boolean> {
  try {
    await fetch(url, { method: 'GET', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return true
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    return name === 'TimeoutError' || name === 'AbortError'
  }
}

/**
 * Runs one model call under watch. `run` must pass the signal on to its fetch
 * or child process so aborting really stops the work, not just the wait.
 */
export async function trackAIRequest<T>(
  options: TrackOptions,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const id = nextId++
  const controller = new AbortController()
  let slowTimer: ReturnType<typeof setTimeout> | undefined
  let probeTimer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  let announced = false

  const arm = (ms: number): void => {
    if (slowTimer) clearTimeout(slowTimer)
    slowTimer = setTimeout(() => {
      announced = true
      listener({ type: 'slow', id, label: options.label, accountId: options.accountId })
    }, ms)
  }
  const probe = options.probe ?? serverAnswers
  const schedule = (ms: number): void => {
    if (!options.probeUrl) return
    probeTimer = setTimeout(async () => {
      const alive = await probe(options.probeUrl as string)
      if (controller.signal.aborted) return
      failures = alive ? 0 : failures + 1
      if (failures >= PROBE_FAILURES_TO_GIVE_UP) {
        controller.abort(new Error(`${AI_UNREACHABLE} ${options.label} stopped responding.`))
        return
      }
      schedule(PROBE_EVERY_MS)
    }, ms)
  }
  const stop = (): void => {
    if (slowTimer) clearTimeout(slowTimer)
    if (probeTimer) clearTimeout(probeTimer)
  }

  inflight.set(id, { controller, arm, stop })
  arm(options.slowMs ?? AI_SLOW_MS)
  schedule(PROBE_FIRST_MS)

  // The call may ignore the signal (a library that does not take one): the
  // race still settles the promise the moment the user or the probe gives up.
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true })
  })
  try {
    return await Promise.race([run(controller.signal), aborted])
  } catch (err) {
    // An abort surfaces from fetch as a generic AbortError; report why instead.
    if (controller.signal.aborted) throw controller.signal.reason
    throw err
  } finally {
    stop()
    inflight.delete(id)
    if (announced) listener({ type: 'done', id })
  }
}

/** The user's answer to a "taking longer" prompt. */
export function answerSlowAIRequest(id: number, choice: AISlowChoice): void {
  const request = inflight.get(id)
  if (!request) return
  if (choice.kind === 'wait') request.arm(AI_SLOW_AGAIN_MS)
  else if (choice.kind === 'cancel') request.controller.abort(new Error(`${AI_CANCELLED} Cancelled.`))
  else request.controller.abort(new Error(`${aiSwitchTag(choice.accountId)} Switching account.`))
}

export function inflightAIRequestCount(): number {
  return inflight.size
}
