import { describe, it, expect } from 'vitest'
import {
  BACKUPS_KEPT,
  LAST_UNSAFE_ROLLBACK_VERSION,
  backupFileName,
  backupsToPrune,
  isOfferedAfterRollback,
  isPastRollback,
  isRollbackSafe,
  parseBackupFileName,
  previousVersions,
  releaseDownloadUrl,
  releaseSummary,
  rollbackOnArrival,
  sortBackups,
  versionChange
} from '../src/shared/rollback'
import {
  SETTINGS_FORMAT,
  changedSettingsKeys,
  isSecretShapedKey,
  keysUnknownTo,
  restoredSettings,
  unknownSettingsKeys,
  withUnknownKeys
} from '../src/shared/settingsFormat'
import { defaultSettings, type SettingsBackup } from '../src/shared/types'

// Going back a version (Settings → About): which versions qualify, which
// updates stay hidden after, how the settings copies are named and kept, and
// the settings-file rule that makes it safe — unknown keys survive an older
// build's save, credentials never do.

describe('rollback eligibility', () => {
  it('refuses every version up to the last one without unknown-key preservation', () => {
    expect(isRollbackSafe(LAST_UNSAFE_ROLLBACK_VERSION)).toBe(false)
    expect(isRollbackSafe('4.49.3')).toBe(false)
    expect(isRollbackSafe('3.0.0')).toBe(false)
    expect(isRollbackSafe('4.50.1')).toBe(true)
    expect(isRollbackSafe('4.51.0')).toBe(true)
    expect(isRollbackSafe('5.0.0')).toBe(true)
  })

  it('lists older published versions only, newest first, without drafts or pre-releases', () => {
    const list = previousVersions(
      [
        { tag_name: 'v4.53.0', body: 'newer', html_url: 'u53', published_at: '2026-11-20T00:00:00Z' },
        { tag_name: 'v4.52.0', body: 'current', html_url: 'u52' },
        { tag_name: 'v4.50.0', body: '## Features\n\n- feat(x): Electron 45 (#12)', html_url: 'u50', published_at: '2026-11-01T00:00:00Z' },
        { tag_name: 'v4.51.0', body: '* **Rollback** of versions', html_url: 'u51', published_at: '2026-11-10T00:00:00Z' },
        { tag_name: 'v4.51.1-rc.1', prerelease: true },
        { tag_name: 'v4.49.0', draft: true },
        { tag_name: 'nightly' },
        { tag_name: 'v4.51.0', body: 'duplicate' }
      ],
      '4.52.0'
    )
    expect(list.map((r) => r.version)).toEqual(['4.51.0', '4.50.0'])
    expect(list[0]).toEqual({ version: '4.51.0', publishedAt: '2026-11-10T00:00:00Z', summary: 'Rollback of versions', url: 'u51' })
    expect(list[1].summary).toBe('Electron 45')
  })

  it('summarises release notes in one readable line', () => {
    expect(releaseSummary('# Title\n\n---\n\n- [Notes](https://x) for you')).toBe('Notes for you')
    expect(releaseSummary(null)).toBe('')
    expect(releaseSummary('![badge](x)\n\n1. fix: crash on start (abc1234)')).toBe('crash on start')
    expect(releaseSummary('a'.repeat(300), 20)).toHaveLength(20)
  })

  it('points the updater at the release’s own download folder', () => {
    expect(releaseDownloadUrl('owner/app', 'v4.51.0')).toBe('https://github.com/owner/app/releases/download/v4.51.0/')
    expect(releaseDownloadUrl('owner/app', '4.51.0')).toBe('https://github.com/owner/app/releases/download/v4.51.0/')
  })
})

describe('the version left is not offered again', () => {
  const rollback = { from: '4.52.0', to: '4.51.0', at: '2026-11-25T00:00:00Z' }

  it('hides the version left and anything older, offers anything newer', () => {
    expect(isOfferedAfterRollback('4.52.0', rollback)).toBe(false)
    expect(isOfferedAfterRollback('4.51.5', rollback)).toBe(false)
    expect(isOfferedAfterRollback('4.52.1', rollback)).toBe(true)
    expect(isOfferedAfterRollback('5.0.0', rollback)).toBe(true)
  })

  it('offers everything when there was no rollback', () => {
    expect(isOfferedAfterRollback('4.52.0', undefined)).toBe(true)
  })

  it('tells going back from updating, from the last version seen', () => {
    expect(versionChange(undefined, '4.51.0')).toBeNull()
    expect(versionChange('4.51.0', '4.51.0')).toBeNull()
    expect(versionChange('4.52.0', '4.51.0')).toEqual({ kind: 'back', from: '4.52.0', to: '4.51.0' })
    expect(versionChange('4.51.0', '4.52.1')).toEqual({ kind: 'forward', from: '4.51.0', to: '4.52.1' })
  })

  it('keeps the record the switching build wrote, and makes one for a switch by hand', () => {
    const written = { ...rollback, backup: 'b.json', showNotes: true }
    expect(rollbackOnArrival(written, { from: '4.52.0', to: '4.51.0' }, 'now')).toBe(written)
    // Installed by hand: no copy, no notes — but the version left is still held back.
    expect(rollbackOnArrival(undefined, { from: '4.53.0', to: '4.51.0' }, 'now')).toEqual({
      from: '4.53.0',
      to: '4.51.0',
      at: 'now'
    })
    // An older record of another switch is replaced.
    expect(rollbackOnArrival(written, { from: '4.53.0', to: '4.52.0' }, 'now').from).toBe('4.53.0')
  })

  it('is over once a version newer than the one gone back to runs', () => {
    expect(isPastRollback(rollback, '4.51.0')).toBe(false)
    expect(isPastRollback(rollback, '4.52.1')).toBe(true)
    expect(isPastRollback(undefined, '9.0.0')).toBe(false)
  })
})

describe('settings copies', () => {
  const at = (iso: string, reason: SettingsBackup['reason'] = 'update'): SettingsBackup =>
    parseBackupFileName(backupFileName('4.51.0', '4.52.0', reason, iso)) as SettingsBackup

  it('round-trips the version, target, reason and time through the file name', () => {
    const name = backupFileName('4.52.0', '4.51.0', 'rollback', '2026-11-25T10:04:05.120Z')
    expect(name).toBe('settings-4.52.0-to-4.51.0-rollback-20261125T100405120Z.json')
    expect(parseBackupFileName(name)).toEqual({
      name,
      version: '4.52.0',
      target: '4.51.0',
      reason: 'rollback',
      createdAt: '2026-11-25T10:04:05.120Z'
    })
  })

  it('ignores any other file, and never accepts a path', () => {
    expect(parseBackupFileName('notes.txt')).toBeNull()
    expect(parseBackupFileName('../settings-4.52.0-to-4.51.0-rollback-20261125T100405120Z.json')).toBeNull()
    expect(parseBackupFileName('settings-4.52.0-to-4.51.0-other-20261125T100405120Z.json')).toBeNull()
  })

  it(`keeps the newest ${BACKUPS_KEPT} and the one a pending rollback points at`, () => {
    const all = [1, 2, 3, 4, 5, 6, 7].map((d) => at(`2026-11-0${d}T00:00:00.000Z`))
    expect(sortBackups(all)[0].createdAt).toBe('2026-11-07T00:00:00.000Z')
    const prune = backupsToPrune(all)
    expect(prune).toHaveLength(2)
    expect(prune).toEqual([all[1].name, all[0].name])
    expect(backupsToPrune(all, BACKUPS_KEPT, all[0].name)).toEqual([all[1].name])
    expect(backupsToPrune(all.slice(0, 3))).toEqual([])
  })
})

describe('settings format: unknown keys survive, credentials do not', () => {
  const base = { ...defaultSettings(), onboardingCompleted: true }

  it('knows every key this build writes', () => {
    expect(unknownSettingsKeys(base)).toEqual([])
    expect(unknownSettingsKeys({ ...base, graphCompactMode: true })).toEqual(['graphCompactMode'])
  })

  it('writes back a newer build’s keys the save never carried', () => {
    const onDisk = { ...base, graphCompactMode: true, terminalFontLigatures: { on: true, set: 'calt' } }
    const out = withUnknownKeys({ ...base, codeFontSize: 15 }, onDisk) as Record<string, unknown>
    expect(out.graphCompactMode).toBe(true)
    expect(out.terminalFontLigatures).toEqual({ on: true, set: 'calt' })
    expect(out.codeFontSize).toBe(15)
    expect(out.settingsFormat).toBe(SETTINGS_FORMAT)
  })

  it('lets a save change an unknown key it does carry', () => {
    const out = withUnknownKeys({ ...base, graphCompactMode: false } as typeof base, { ...base, graphCompactMode: true })
    expect((out as Record<string, unknown>).graphCompactMode).toBe(false)
  })

  it('never carries a credential-shaped unknown key, at any depth, nor in a profile', () => {
    const onDisk = {
      ...base,
      futureHostToken: 'ghp_secret',
      futureServers: [{ url: 'https://h', token: 'x', apiKey: 'y', label: 'h' }],
      profiles: [{ ...base.profiles[0], newHostToken: 'tok', newHostUrl: 'https://n', newHost: { password: 'p', user: 'u' } }]
    }
    const out = withUnknownKeys({ ...base, profiles: onDisk.profiles }, onDisk) as Record<string, unknown>
    const text = JSON.stringify(out)
    expect(out.futureHostToken).toBeUndefined()
    expect(out.futureServers).toEqual([{ url: 'https://h', label: 'h' }])
    for (const secret of ['ghp_secret', '"tok"', '"p"', '"x"', '"y"']) expect(text).not.toContain(secret)
    const profile = (out.profiles as Record<string, unknown>[])[0]
    expect(profile.newHostUrl).toBe('https://n')
    expect(profile.newHost).toEqual({ user: 'u' })
    // Known fields are main's business: left exactly as they came.
    expect(profile.githubToken).toBe(base.profiles[0].githubToken)
  })

  it('recognises credential names, not ordinary ones', () => {
    for (const k of ['githubToken', 'clientSecret', 'password', 'api_key', 'privateKey', 'sessionCookie']) {
      expect(isSecretShapedKey(k)).toBe(true)
    }
    for (const k of ['graphCompactMode', 'sortKey', 'hotkeys', 'authorColors']) expect(isSecretShapedKey(k)).toBe(false)
  })

  it('names only keys added by a format the target predates', () => {
    // Format 1 adds none: every safe target knows every key this build has.
    expect(keysUnknownTo('4.51.0', { ...base, graphCompactMode: 1 })).toEqual([])
  })
})

describe('comparing and restoring a copy', () => {
  const copy = { language: 'en', codeFontSize: 13, tabs: [{ id: 'a' }], lastSeenVersion: '4.52.0', versionRollback: { from: 'x' } }

  it('counts changed preferences, not what is open nor the app’s bookkeeping', () => {
    const now = { language: 'de', codeFontSize: 13, tabs: [{ id: 'b' }], lastSeenVersion: '4.51.0', addedByNewer: 1 }
    expect(changedSettingsKeys(copy, now)).toEqual(['language'])
    expect(changedSettingsKeys(copy, { ...copy })).toEqual([])
  })

  it('restores the copy’s preferences and keeps the session as it is now', () => {
    const now = { language: 'de', codeFontSize: 15, tabs: [{ id: 'b' }], lastSeenVersion: '4.53.0' }
    expect(restoredSettings(copy, now)).toEqual({
      language: 'en',
      codeFontSize: 13,
      tabs: [{ id: 'b' }],
      lastSeenVersion: '4.53.0'
    })
  })
})
