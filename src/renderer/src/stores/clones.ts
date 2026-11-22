import { create } from 'zustand'
import type { CloneOptions, CloneProgress } from '../../../shared/types'
import { gitApi } from '../infrastructure/api'
import { interp, t } from '../i18n'
import { useUIStore } from './ui'

export interface CloneTask {
  id: string
  /** The folder name — what the tray and the toasts call it. */
  name: string
  url: string
  progress: CloneProgress | null
  /** Waiting for a slot: a batch clones a few at a time, not all at once. */
  queued: boolean
  cancelling: boolean
  /** Shown inside the clone dialog right now, so the floating tray leaves it out. */
  attached: boolean
}

export interface CloneRequest {
  parentDir: string
  url: string
  name: string
  opts: Omit<CloneOptions, 'cloneId'>
  /** Runs once the clone lands, whether or not the dialog is still open. */
  onDone: (path: string) => void
}

interface ClonesState {
  tasks: CloneTask[]
  /** Queue a clone that outlives the dialog. Returns its id straight away.
   *  `attached: false` sends it to the tray at once — a batch has no single
   *  clone for the dialog to follow. */
  start(req: CloneRequest, opts?: { attached?: boolean }): string
  cancel(id: string): void
  attach(id: string, attached: boolean): void
}

/** Enough to keep the network busy; more only makes every clone in a batch slower. */
const MAX_PARALLEL = 3

const uid = (): string => `clone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const patchTask = (id: string, patch: Partial<CloneTask>): void =>
  useClonesStore.setState((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))

const dropTask = (id: string): void =>
  useClonesStore.setState((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) }))

/** Requests still waiting for a slot, in the order they were queued. */
const pending = new Map<string, CloneRequest>()

// One listener for the app's lifetime: the clone outlives every component that
// could own a subscription, which is the whole point of this store.
let unsubscribe: (() => void) | null = null
const listen = (): void => {
  if (unsubscribe) return
  unsubscribe = gitApi.onCloneProgress((p) => {
    if (p.cloneId) patchTask(p.cloneId, { progress: p })
  })
}

const toast = (kind: 'success' | 'error' | 'info', message: string): void =>
  useUIStore.getState().toast(kind, message)

function run(id: string, req: CloneRequest): void {
  patchTask(id, { queued: false })
  void gitApi
    .clone(req.parentDir, req.url, req.name, { ...req.opts, cloneId: id })
    .then((path) => {
      dropTask(id)
      req.onDone(path)
      toast('success', interp(t('clone.done'), { name: req.name }))
    })
    .catch((e: unknown) => {
      // Read before dropping: the flag is the only reliable signal, the error text is git's.
      const cancelled = useClonesStore.getState().tasks.find((x) => x.id === id)?.cancelling
      dropTask(id)
      if (cancelled) toast('info', interp(t('clone.cancelled'), { name: req.name }))
      else toast('error', e instanceof Error ? e.message : String(e))
    })
    .finally(pump)
}

/** Start queued clones while there are free slots. */
function pump(): void {
  const running = useClonesStore.getState().tasks.filter((x) => !x.queued).length
  let free = MAX_PARALLEL - running
  for (const [id, req] of pending) {
    if (free <= 0) break
    pending.delete(id)
    free--
    run(id, req)
  }
}

export const useClonesStore = create<ClonesState>((set, get) => ({
  tasks: [],

  start: (req, opts) => {
    listen()
    const id = uid()
    set((s) => ({
      tasks: [
        ...s.tasks,
        {
          id,
          name: req.name,
          url: req.url,
          progress: null,
          queued: true,
          cancelling: false,
          attached: opts?.attached ?? true
        }
      ]
    }))
    pending.set(id, req)
    pump()
    return id
  },

  cancel: (id) => {
    const task = get().tasks.find((x) => x.id === id)
    if (!task || task.cancelling) return
    // Never started: nothing on disk, nothing to tell main about.
    if (pending.delete(id)) {
      dropTask(id)
      toast('info', interp(t('clone.cancelled'), { name: task.name }))
      return
    }
    patchTask(id, { cancelling: true })
    // False means it finished in the meantime; the clone's own settle cleans up.
    void gitApi.cancelClone(id).catch(() => patchTask(id, { cancelling: false }))
  },

  attach: (id, attached) => patchTask(id, { attached })
}))
