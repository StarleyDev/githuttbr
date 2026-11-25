import { describe, it, expect } from 'vitest'
import { cancelPlan, downloadLanded, switchEnded } from '../src/main/rollbackDecisions'

// A version switch in the updater: which download may install on quit. The
// failure this guards: a cancel after the last byte still stages the older
// version, and quitting would install it with no rollback record behind it.

describe('a finished download', () => {
  it('of the running switch waits for rollback:install, never quits into it', () => {
    expect(downloadLanded('rollback')).toEqual({ route: 'rollback', abandoned: null, autoInstallOnAppQuit: false })
  })

  it('of a cancelled switch is dropped and marked abandoned, install on quit off', () => {
    expect(downloadLanded('abandoned')).toEqual({ route: 'drop', abandoned: true, autoInstallOnAppQuit: false })
  })

  it('of a normal update replaces an abandoned one and may install on quit again', () => {
    expect(downloadLanded('update')).toEqual({ route: 'update', abandoned: false, autoInstallOnAppQuit: true })
  })
})

describe('ending a switch', () => {
  it('leaves install on quit on when nothing finished downloading', () => {
    for (const status of ['idle', 'checking', 'downloading', 'error'] as const) {
      expect(switchEnded(status, false)).toEqual({ abandoned: false, autoInstallOnAppQuit: true })
    }
  })

  it('turns it off for a finished download left behind, and keeps it off', () => {
    expect(switchEnded('downloaded', false)).toEqual({ abandoned: true, autoInstallOnAppQuit: false })
    expect(switchEnded('checking', true)).toEqual({ abandoned: true, autoInstallOnAppQuit: false })
  })
})

describe('a cancel', () => {
  it('drains a transfer that may still be settling, and checks the feed once it has', () => {
    expect(cancelPlan('checking')).toEqual({ drain: true, recheckNow: false })
    expect(cancelPlan('downloading')).toEqual({ drain: true, recheckNow: false })
  })

  it('checks the normal feed at once when nothing is moving', () => {
    expect(cancelPlan('downloaded')).toEqual({ drain: false, recheckNow: true })
    expect(cancelPlan('error')).toEqual({ drain: false, recheckNow: true })
  })
})
