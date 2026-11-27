import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatCompleteJson, validateJsonReply } from '../src/main/ai'
import { aiErrorMessage } from '../src/main/aiTransport'
import { migrateAIConfig } from '../src/shared/aiAccounts'
import type { AIProvider } from '../src/shared/types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AI JSON validation', () => {
  it('awaits an asynchronous semantic validator', async () => {
    const result = await validateJsonReply<{ value: string }>('{"value":"x"}', {
      name: 'async_test',
      schema: { type: 'object' },
      validate: async (value) =>
        (value as { value?: string }).value === 'x' ? [] : ['value must be x']
    })
    expect(result).toEqual({ value: { value: 'x' }, errors: [] })
  })

  it('returns parse errors without invoking semantic validation', async () => {
    let called = false
    const result = await validateJsonReply('not json', {
      name: 'parse_test',
      schema: {},
      validate: () => {
        called = true
        return []
      }
    })
    expect(called).toBe(false)
    expect(result.errors[0]).toContain('not valid JSON')
  })

  it('accepts valid JSON after a self-hosted model think block', async () => {
    const result = await validateJsonReply<{ value: string }>(
      '<think>We need produce one object.</think>\n```json\n{"value":"x"}\n```',
      {
        name: 'thinking_test',
        schema: { type: 'object' },
        validate: () => []
      }
    )
    expect(result).toEqual({ value: { value: 'x' }, errors: [] })
  })

  it('bounds structured output and disables thinking for a custom endpoint', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({
      provider: 'custom',
      endpoint: 'http://127.0.0.1:8000/v1',
      model: 'default'
    })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'bounded_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: 2048
    })

    expect(bodies).toHaveLength(1)
    expect(bodies[0].max_tokens).toBe(2048)
    expect(bodies[0].chat_template_kwargs).toEqual({ enable_thinking: false })
  })

  it('does not send the self-hosted thinking toggle to OpenAI', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({
      provider: 'openai',
      endpoint: 'http://127.0.0.1:8000/v1',
      apiKey: 'test-key',
      model: 'gpt-test'
    })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'hosted_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: 256
    })

    expect(bodies).toHaveLength(1)
    expect(bodies[0].chat_template_kwargs).toBeUndefined()
    expect(bodies[0].max_tokens).toBe(256)
  })

  it.each(['o3-mini', 'gpt-5-mini'])('uses max_completion_tokens for reasoning model %s', async (model) => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({
      provider: 'openai',
      endpoint: 'http://127.0.0.1:8000/v1',
      apiKey: 'test-key',
      model
    })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'reasoning_model_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: 256
    })

    expect(bodies).toHaveLength(1)
    expect(bodies[0].max_completion_tokens).toBe(256)
    expect(bodies[0].max_tokens).toBeUndefined()
  })

  it.each([
    { requested: 99999.9, expected: 8192 },
    { requested: -4.2, expected: 1 },
    { requested: Number.NaN, expected: 8192 }
  ])('sanitizes Anthropic max_tokens $requested to $expected', async ({ requested, expected }) => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return new Response('{"content":[{"type":"text","text":"{\\"value\\":\\"x\\"}"}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({
      provider: 'anthropic',
      endpoint: 'http://127.0.0.1:8000',
      apiKey: 'test-key',
      model: 'claude-test'
    })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'anthropic_token_limit_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: requested
    })

    expect(bodies).toHaveLength(1)
    expect(bodies[0].max_tokens).toBe(expected)
  })

  it('can start in prompt-only JSON mode for an unreliable self-hosted schema adapter', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({
      provider: 'custom',
      endpoint: 'http://127.0.0.1:8000/v1',
      model: 'default'
    })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'prompt_only_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: 1024,
      nativeStructuredOutput: false
    })

    expect(bodies).toHaveLength(1)
    expect(bodies[0].response_format).toBeUndefined()
    expect(bodies[0].chat_template_kwargs).toEqual({ enable_thinking: false })
    expect(bodies[0].max_tokens).toBe(1024)
  })

  it('retries without the thinking toggle when a strict custom gateway rejects it', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        bodies.push(body)
        if (bodies.length === 1) {
          return new Response('unknown field chat_template_kwargs', { status: 400 })
        }
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({
      provider: 'custom',
      endpoint: 'http://127.0.0.1:8000/v1',
      model: 'default'
    })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'fallback_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: 256
    })

    expect(bodies).toHaveLength(2)
    expect(bodies[0].chat_template_kwargs).toEqual({ enable_thinking: false })
    expect(bodies[1].chat_template_kwargs).toBeUndefined()
    expect(bodies[1].max_tokens).toBe(256)
  })

  it('retries without the thinking toggle when LiteLLM rejects it with a 500', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        if (bodies.length === 1) {
          return new Response(
            JSON.stringify({
              error: {
                message:
                  "litellm.InternalServerError: InternalServerError: Custom_openaiException - AsyncCompletions.create() got an unexpected keyword argument 'chat_template_kwargs'."
              }
            }),
            { status: 500 }
          )
        }
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({ provider: 'custom', endpoint: 'http://127.0.0.1:4000/v1', model: 'default' })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'litellm_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: 256
    })

    expect(bodies).toHaveLength(2)
    expect(bodies[1].chat_template_kwargs).toBeUndefined()
  })

  it('reports the provider message rather than a cut-off JSON body', () => {
    const message = `upstream said no ${'x'.repeat(400)} — the useful end`
    const reported = aiErrorMessage(500, JSON.stringify({ error: { message } }))
    expect(reported).toBe(`AI request failed (500): ${message}`)
    expect(aiErrorMessage(502, 'Bad gateway')).toBe('AI request failed (502): Bad gateway')
    expect(aiErrorMessage(400, JSON.stringify({ error: 'model not found' }))).toBe(
      'AI request failed (400): model not found'
    )
    expect(aiErrorMessage(500, 'y'.repeat(5000)).length).toBeLessThan(1600)
  })

  it('falls back to prompt-only JSON when Gemini finds the schema too complex', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        bodies.push(body)
        if (bodies.length === 1) {
          // Google's OpenAI-compatible surface answers with an array.
          return new Response(
            JSON.stringify([
              {
                error: {
                  code: 400,
                  message:
                    'The specified schema produces a constraint that has too many states for serving. Typical causes of this error are schemas with lots of text (for example, very long property or enum names).',
                  status: 'INVALID_ARGUMENT'
                }
              }
            ]),
            { status: 400, headers: { 'content-type': 'application/json' } }
          )
        }
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({ provider: 'google', apiKey: 'test-key', model: 'gemini-2.5-flash' })
    const value = await chatCompleteJson<{ value: string }>(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'gemini_schema_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: 1024
    })

    expect(value).toEqual({ value: 'x' })
    expect(bodies).toHaveLength(2)
    expect(bodies[0].response_format).toBeDefined()
    expect(bodies[1].response_format).toBeUndefined()
  })

  // One stub server: the first call answers with `status`/`body`, the next one succeeds.
  const rejectFirst = (status: number, body: unknown): Record<string, unknown>[] => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        if (bodies.length === 1) {
          return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
        }
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )
    return bodies
  }
  const askJson = (provider: AIProvider): Promise<unknown> =>
    chatCompleteJson(
      migrateAIConfig({ provider, apiKey: 'test-key', model: 'some-model', endpoint: 'http://127.0.0.1:4000/v1' }),
      [{ role: 'user', content: 'Return JSON.' }],
      'test',
      { name: 'provider_test', schema: { type: 'object' }, validate: () => [], maxTokens: 256 }
    )

  it.each([
    ['groq', 400, { error: { message: 'This model does not support response format `json_schema`.' } }],
    ['mistral', 422, { detail: [{ msg: 'Value error, unsupported keyword maxItems', type: 'value_error' }] }],
    ['openrouter', 400, { error: { message: 'Provider returned error', code: 400 } }],
    ['openai', 400, { error: { message: "Invalid schema for response_format 'x': 'oneOf' is not permitted." } }]
  ])('%s: a %i to the schema request is retried once without it', async (provider, status, body) => {
    const bodies = rejectFirst(status as number, body)
    await expect(askJson(provider as AIProvider)).resolves.toEqual({ value: 'x' })
    expect(bodies).toHaveLength(2)
    expect(bodies[0].response_format).toBeDefined()
    expect(bodies[1].response_format).toBeUndefined()
  })

  it.each([
    [401, { error: { message: 'Invalid API key' } }],
    [404, { error: { message: 'The model `some-model` does not exist' } }],
    [429, { error: { message: 'Rate limit reached' } }]
  ])('a %i is reported as is, without a second call', async (status, body) => {
    const bodies = rejectFirst(status as number, body)
    await expect(askJson('openai')).rejects.toThrow(new RegExp(`failed \\(${status}\\)`))
    expect(bodies).toHaveLength(1)
  })

  it('falls back to prompt-only JSON when native structured validation is exhausted', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        bodies.push(body)
        if (bodies.length === 1) {
          return new Response(
            JSON.stringify({
              error: {
                message: 'DiffusionGemma failed to produce a schema-valid structured response after 3 attempt(s)',
                type: 'structured_output_validation_error',
                code: 502
              }
            }),
            { status: 502, headers: { 'content-type': 'application/json' } }
          )
        }
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({
      provider: 'custom',
      endpoint: 'http://127.0.0.1:8000/v1',
      model: 'default'
    })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'validation_fallback_test',
      schema: { type: 'object' },
      validate: () => [],
      maxTokens: 4096
    })

    expect(bodies).toHaveLength(2)
    expect(bodies[0].response_format).toBeDefined()
    expect(bodies[1].response_format).toBeUndefined()
    expect(bodies[1].chat_template_kwargs).toEqual({ enable_thinking: false })
    expect(bodies[1].max_tokens).toBe(4096)
  })

  it('also drops native structured output when a correction attempt exhausts it', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        bodies.push(body)
        if (bodies.length === 1) {
          return new Response('{"choices":[{"message":{"content":"{}"}}]}', {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (bodies.length === 2) {
          return new Response(
            '{"error":{"message":"DiffusionGemma failed to produce a schema-valid structured response after 3 attempt(s)","type":"structured_output_validation_error","code":502}}',
            { status: 502, headers: { 'content-type': 'application/json' } }
          )
        }
        return new Response('{"choices":[{"message":{"content":"{\\"value\\":\\"x\\"}"}}]}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )

    const cfg = migrateAIConfig({
      provider: 'custom',
      endpoint: 'http://127.0.0.1:8000/v1',
      model: 'default'
    })
    await chatCompleteJson(cfg, [{ role: 'user', content: 'Return JSON.' }], 'test', {
      name: 'correction_fallback_test',
      schema: { type: 'object' },
      validate: (value) =>
        (value as { value?: string }).value === 'x' ? [] : ['value must equal x'],
      maxTokens: 512
    })

    expect(bodies).toHaveLength(3)
    expect(bodies[0].response_format).toBeDefined()
    expect(bodies[1].response_format).toBeDefined()
    expect(bodies[2].response_format).toBeUndefined()
    expect(bodies[2].max_tokens).toBe(512)
  })
})
