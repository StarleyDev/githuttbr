import { describe, it, expect, afterEach } from 'vitest'
import { createTestRepoWatch, holdRepoWatches, isRepoWatchHeld, noteRepoChange } from '../src/main/watcher'

// The Files tab's quiet fetch holds the repository's watch while it runs. A
// timed mute deafened the repo for 22 s after a 1 s fetch and dropped what the
// user changed meanwhile; a hold lasts exactly as long as the fetch, and what
// arrived during it is sent once, after.

const REPO = '/repos/hold-test'
const cleanups: Array<() => void> = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
})

function watchOf(path = REPO): { notified: boolean[]; state: ReturnType<typeof createTestRepoWatch>['state'] } {
  const notified: boolean[] = []
  const w = createTestRepoWatch(path, (light) => notified.push(light))
  cleanups.push(w.dispose)
  return { notified, state: w.state }
}

describe('holding a repository’s watch during main’s own git write', () => {
  it('passes changes through when nothing holds it', () => {
    const { state } = watchOf()
    expect(noteRepoChange(state, false)).toBe('go')
  })

  it('sends nothing on release when nothing changed during the hold', () => {
    const { notified } = watchOf()
    const release = holdRepoWatches(REPO)
    expect(isRepoWatchHeld(REPO)).toBe(true)
    release()
    expect(isRepoWatchHeld(REPO)).toBe(false)
    expect(notified).toEqual([])
  })

  it('owes edits made during the hold and sends them as one light refresh on release', () => {
    const { notified, state } = watchOf()
    const release = holdRepoWatches(REPO)
    expect(noteRepoChange(state, false)).toBe('held')
    expect(noteRepoChange(state, false)).toBe('held')
    release()
    expect(notified).toEqual([true])
    // The hold is over: the next change goes through as usual.
    expect(noteRepoChange(state, false)).toBe('go')
  })

  it('a .git change during the hold makes the owed refresh a full one', () => {
    const { notified, state } = watchOf()
    const release = holdRepoWatches(REPO)
    noteRepoChange(state, false)
    noteRepoChange(state, true)
    release()
    expect(notified).toEqual([false])
  })

  it('overlapping holds: only the last release ends it, and a second release is harmless', () => {
    const { notified, state } = watchOf()
    const a = holdRepoWatches(REPO)
    const b = holdRepoWatches(REPO)
    noteRepoChange(state, false)
    a()
    a()
    expect(isRepoWatchHeld(REPO)).toBe(true)
    expect(notified).toEqual([])
    b()
    expect(notified).toEqual([true])
  })

  it('holds one repository only', () => {
    const other = watchOf('/repos/other')
    const release = holdRepoWatches(REPO)
    expect(noteRepoChange(other.state, false)).toBe('go')
    release()
  })
})
