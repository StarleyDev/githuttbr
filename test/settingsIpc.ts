/**
 * Calls the real settings IPC handlers the way a renderer does: a
 * `settings:get` / `settings:unlock` reply is unwrapped to its settings, and
 * its generation is remembered per sender and sent with that sender's next
 * `settings:set` — the renderer's state is built from the last reply it got.
 * A save that passes its own generation (or options) is sent as given.
 */
type Handler = (...args: unknown[]) => unknown
type Event = { sender?: { id?: number } }

export function settingsIpc(
  handlers: Map<string, Handler>
): (event: Event, channel: string, ...args: unknown[]) => Promise<unknown> {
  const generations = new Map<number, number>()
  let registered: Handler | undefined
  return async (event, channel, ...args) => {
    // Handlers registered anew are a fresh main process: every window starts over.
    if (handlers.get('settings:set') !== registered) {
      registered = handlers.get('settings:set')
      generations.clear()
    }
    const sender = event.sender?.id ?? -1
    const sent = channel === 'settings:set' && args.length === 1 ? [args[0], generations.get(sender) ?? 0] : args
    const out = await handlers.get(channel)!(event, ...sent)
    const isReply = !!out && typeof out === 'object' && 'generation' in out && 'settings' in out
    if ((channel === 'settings:get' || channel === 'settings:unlock') && isReply) {
      const reply = out as { settings: unknown; generation: number }
      generations.set(sender, reply.generation)
      return reply.settings
    }
    return out
  }
}
