import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  planPrCreated,
  PR_OPEN_AFTER_CREATE_KEY,
  readOpenAfterCreate,
  writeOpenAfterCreate,
  type PrefStore
} from '../src/renderer/src/lib/prCreated'

const shellApi = vi.hoisted(() => ({ openExternal: vi.fn(async () => undefined) }))
const ui = vi.hoisted(() => ({ toast: vi.fn() }))
const settings = vi.hoisted(() => ({ openPageTab: vi.fn(), settings: { language: 'en' } }))
const repo = vi.hoisted(() => ({ refreshPRs: vi.fn(async () => undefined) }))

vi.mock('../src/renderer/src/infrastructure/api', () => ({ shellApi }))
vi.mock('../src/renderer/src/stores/ui', () => ({ useUIStore: { getState: () => ui } }))
vi.mock('../src/renderer/src/stores/settings', () => ({ useSettingsStore: { getState: () => settings } }))
vi.mock('../src/renderer/src/stores/repo', () => ({ useRepoStore: { getState: () => repo } }))
vi.mock('../src/renderer/src/i18n', () => ({
  t: (key: string) => key,
  interp: (value: string, vars: Record<string, string | number>) => `${value} ${JSON.stringify(vars)}`
}))

import { announcePrCreated } from '../src/renderer/src/stores/prCreated'

function memStore(init: Record<string, string> = {}): PrefStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init))
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v)
  }
}

describe('open-after-create preference', () => {
  it('defaults to off', () => {
    expect(readOpenAfterCreate(memStore())).toBe(false)
    expect(readOpenAfterCreate(undefined)).toBe(false)
  })

  it('persists both choices', () => {
    const store = memStore()
    writeOpenAfterCreate(store, true)
    expect(store.data.get(PR_OPEN_AFTER_CREATE_KEY)).toBe('on')
    expect(readOpenAfterCreate(store)).toBe(true)
    writeOpenAfterCreate(store, false)
    expect(readOpenAfterCreate(store)).toBe(false)
  })

  it('treats unreadable or unwritable storage as off, without throwing', () => {
    const broken: PrefStore = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      }
    }
    expect(readOpenAfterCreate(broken)).toBe(false)
    expect(() => writeOpenAfterCreate(broken, true)).not.toThrow()
  })

  it('uses the githuttbr prefix', () => {
    expect(PR_OPEN_AFTER_CREATE_KEY.startsWith('githuttbr-')).toBe(true)
  })
})

describe('planPrCreated', () => {
  const res = { number: 42, url: 'https://example.test/pr/42' }

  it('stays in the app when the box is off', () => {
    const plan = planPrCreated(res, false)
    expect(plan.openUrl).toBeNull()
    expect(plan.notice).toEqual({ key: 'createPR.createdFollow', vars: { n: 42 } })
    expect(plan.metaFailed).toEqual([])
  })

  it('opens the PR and still says so when the box is on', () => {
    const plan = planPrCreated(res, true)
    expect(plan.openUrl).toBe(res.url)
    expect(plan.notice.key).toBe('createPR.createdFollow')
  })

  it('carries refused fields in both modes', () => {
    for (const open of [true, false]) {
      expect(planPrCreated({ ...res, metaFailed: ['labels', 'reviewers'] }, open).metaFailed).toEqual([
        'labels',
        'reviewers'
      ])
    }
  })
})

describe('announcePrCreated', () => {
  const ctx = { repoPath: '/repo', remoteUrl: 'https://example.test/o/r.git', title: 'Add thing' }

  beforeEach(() => {
    shellApi.openExternal.mockClear()
    ui.toast.mockClear()
    settings.openPageTab.mockClear()
    repo.refreshPRs.mockClear()
  })

  it('box off: no browser, a notice with an in-app action, and the list refetched', async () => {
    await announcePrCreated({ number: 7, url: 'https://example.test/pr/7' }, { ...ctx, openInBrowser: false })

    expect(shellApi.openExternal).not.toHaveBeenCalled()
    expect(repo.refreshPRs).toHaveBeenCalledWith('/repo', { silent: true })
    expect(ui.toast).toHaveBeenCalledTimes(1)
    const [kind, message, opts] = ui.toast.mock.calls[0]
    expect(kind).toBe('success')
    expect(message).toContain('createPR.createdFollow')
    expect(message).toContain('"n":7')
    expect(message).toContain('sidebar.pullRequests')
    expect(opts.action.label).toBe('createPR.viewInApp')

    opts.action.run()
    expect(settings.openPageTab).toHaveBeenCalledWith({
      type: 'pr',
      repoPath: '/repo',
      remoteUrl: ctx.remoteUrl,
      number: 7,
      title: 'Add thing'
    })
  })

  it('box on: opens the URL, plus the same notice and refetch', async () => {
    await announcePrCreated({ number: 8, url: 'https://example.test/pr/8' }, { ...ctx, openInBrowser: true })

    expect(shellApi.openExternal).toHaveBeenCalledWith('https://example.test/pr/8')
    expect(repo.refreshPRs).toHaveBeenCalledWith('/repo', { silent: true })
    expect(ui.toast.mock.calls[0][0]).toBe('success')
  })

  it('still warns about refused picks in either mode', async () => {
    for (const openInBrowser of [false, true]) {
      ui.toast.mockClear()
      await announcePrCreated(
        { number: 9, url: 'https://example.test/pr/9', metaFailed: ['reviewers', 'labels'] },
        { ...ctx, openInBrowser }
      )
      const warn = ui.toast.mock.calls.find((c) => c[0] === 'error')
      expect(warn?.[1]).toContain('createPR.createdMetaFailed')
      expect(warn?.[1]).toContain('createPR.reviewersLabel and createPR.labelsLabel')
    }
  })
})
