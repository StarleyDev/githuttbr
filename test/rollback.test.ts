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
  holdsSecret,
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

  it('names a pre-release version so it can be read back', () => {
    const name = backupFileName('v4.52.0-rc.1', '4.51.0-beta-2+build.7', 'update', '2026-11-25T10:04:05.120Z')
    expect(parseBackupFileName(name)).toMatchObject({ version: '4.52.0-rc.1', target: '4.51.0-beta.2', reason: 'update' })
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

  it('drops a whole unknown key that holds a credential, at any depth, and such a profile field', () => {
    const onDisk = {
      ...base,
      futureHostToken: 'ghp_secret',
      futureServers: [{ url: 'https://h', token: 'x', label: 'h' }],
      futureMirror: 'https://user:pw@mirror.example/repo',
      profiles: [{ ...base.profiles[0], newHostToken: 'tok', newHostUrl: 'https://n', newHost: { password: 'p', user: 'u' } }]
    }
    const out = withUnknownKeys({ ...base, profiles: onDisk.profiles }, onDisk) as Record<string, unknown>
    const text = JSON.stringify(out)
    expect(out.futureHostToken).toBeUndefined()
    // Never half an object: the whole key goes.
    expect(out.futureServers).toBeUndefined()
    expect(out.futureMirror).toBeUndefined()
    for (const secret of ['ghp_secret', '"tok"', '"p"', '"x"', 'pw@']) expect(text).not.toContain(secret)
    const profile = (out.profiles as Record<string, unknown>[])[0]
    expect(profile.newHostUrl).toBe('https://n')
    expect(profile.newHost).toBeUndefined()
    expect(profile.newHostToken).toBeUndefined()
    // Known fields are main's business: left exactly as they came.
    expect(profile.githubToken).toBe(base.profiles[0].githubToken)
  })

  it('keeps harmless keys that only sound like credentials, unchanged', () => {
    const onDisk = {
      ...base,
      tokenColors: { keyword: '#f00' },
      maxTokens: 4096,
      showTokenUsage: true,
      cookieConsent: 'yes',
      emptyToken: '',
      launch: { password: true, label: 'Ask' },
      mirror: 'https://mirror.example/repo'
    }
    const out = withUnknownKeys({ ...base }, onDisk) as Record<string, unknown>
    for (const k of ['tokenColors', 'maxTokens', 'showTokenUsage', 'cookieConsent', 'emptyToken', 'launch', 'mirror']) {
      expect(out[k]).toEqual((onDisk as Record<string, unknown>)[k])
    }
  })

  it('recognises credential names by their ending, not ordinary ones', () => {
    for (const k of ['githubToken', 'clientSecret', 'password', 'api_key', 'privateKey', 'sessionCookie', 'githubPat', 'pat', 'basicAuth', 'jwt', 'accessKey', 'sshKey', 'signingKey']) {
      expect(isSecretShapedKey(k), k).toBe(true)
    }
    // `maxTokens` is a credential name by its ending; its number is what keeps it (see below).
    for (const k of ['graphCompactMode', 'sortKey', 'hotkeys', 'authorColors', 'tokenColors', 'cookieConsent', 'compat', 'path']) {
      expect(isSecretShapedKey(k), k).toBe(false)
    }
  })

  it('finds a credential in a value only when it is one', () => {
    expect(holdsSecret('password', true)).toBe(false)
    expect(holdsSecret('password', 'hunter2')).toBe(true)
    expect(holdsSecret('servers', [{ url: 'https://h?private_token=x' }])).toBe(true)
    expect(holdsSecret('servers', [{ url: 'https://h/path' }])).toBe(false)
    expect(holdsSecret('docs', 'https://example.com/help#install')).toBe(false)
    expect(holdsSecret('docs', 'https://example.com/help?ref=settings&page=2')).toBe(false)
    expect(holdsSecret('mirror', 'https://u:pw@example.com/repo')).toBe(true)
    expect(holdsSecret('upload', 'https://s3.example/b?X-Amz-Signature=abc')).toBe(true)
    expect(holdsSecret('feed', 'https://h/feed?access_token=abc')).toBe(true)
    // An enum-like value under a credential name is dropped too: conservative by design.
    expect(holdsSecret('auth', 'oauth')).toBe(true)
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

  it('ignores key order, fields only now has, and column ids an older build does not know', () => {
    const before = {
      graphColumns: { graph: true, author: false },
      graphColumnOrder: ['graph', 'deployment', 'author', 'date'],
      profiles: [{ id: 'p', name: 'Me' }],
      favouriteRepos: ['/a', '/b']
    }
    const after = {
      graphColumns: { author: false, graph: true, addedLater: true },
      graphColumnOrder: ['graph', 'author', 'date'],
      profiles: [{ name: 'Me', id: 'p', olderDefault: '' }],
      favouriteRepos: ['/a', '/b']
    }
    expect(changedSettingsKeys(before, after)).toEqual([])
    expect(changedSettingsKeys(before, { ...after, graphColumnOrder: ['author', 'graph', 'date'] })).toEqual(['graphColumnOrder'])
    expect(changedSettingsKeys(before, { ...after, profiles: [{ id: 'p', name: 'Other' }] })).toEqual(['profiles'])
  })

  it('counts what was removed: an entry, a field, a whole key', () => {
    const before = { favouriteRepos: ['/a', '/b'], shortcuts: { push: 'mod+p', pull: 'mod+l' }, repoAliases: { '/a': 'A' } }
    expect(changedSettingsKeys(before, { ...before, favouriteRepos: ['/a'] })).toEqual(['favouriteRepos'])
    expect(changedSettingsKeys(before, { ...before, favouriteRepos: ['/a', '/b', '/c'] })).toEqual(['favouriteRepos'])
    expect(changedSettingsKeys(before, { ...before, shortcuts: { push: 'mod+p' } })).toEqual(['shortcuts'])
    const { repoAliases: _gone, ...withoutAliases } = before
    void _gone
    expect(changedSettingsKeys(before, withoutAliases)).toEqual(['repoAliases'])
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

  it('keeps profiles and servers added since the copy, whose tokens are filed under them', () => {
    const old = {
      activeProfileId: 'a',
      profiles: [{ id: 'a', name: 'Old name', githubEnterprise: [{ url: 'https://ghe.one', token: '' }] }]
    }
    const now = {
      activeProfileId: 'b',
      profiles: [
        { id: 'a', name: 'New name', githubEnterprise: [{ url: 'https://ghe.one', token: '' }, { url: 'https://ghe.two', token: '' }] },
        { id: 'b', name: 'Added later' }
      ]
    }
    const out = restoredSettings(old, now) as { activeProfileId: string; profiles: { id: string; name: string; githubEnterprise?: { url: string }[] }[] }
    expect(out.profiles.map((p) => p.id)).toEqual(['a', 'b'])
    expect(out.profiles[0].name).toBe('Old name')
    expect(out.profiles[0].githubEnterprise?.map((h) => h.url)).toEqual(['https://ghe.one', 'https://ghe.two'])
    expect(out.activeProfileId).toBe('a')
  })

  it('matches servers by address however spelled, and keeps AI accounts created since', () => {
    const old = {
      ai: { accounts: [{ id: 'g1', label: 'old' }] },
      profiles: [{ id: 'a', gitlabServers: [{ url: 'https://GL.example/', token: '' }], ai: { accounts: [{ id: 'x', label: 'old' }] } }]
    }
    const now = {
      ai: { accounts: [{ id: 'g1', label: 'new' }, { id: 'g2', label: 'later' }] },
      profiles: [
        {
          id: 'a',
          gitlabServers: [{ url: 'https://gl.example', token: '' }, { url: 'https://gl2.example', token: '' }],
          ai: { accounts: [{ id: 'x', label: 'new' }, { id: 'y', label: 'later' }] }
        }
      ]
    }
    const out = restoredSettings(old, now) as {
      ai: { accounts: { id: string; label: string }[] }
      profiles: { gitlabServers: { url: string }[]; ai: { accounts: { id: string; label: string }[] } }[]
    }
    expect(out.profiles[0].gitlabServers.map((h) => h.url)).toEqual(['https://GL.example/', 'https://gl2.example'])
    expect(out.profiles[0].ai.accounts).toEqual([{ id: 'x', label: 'old' }, { id: 'y', label: 'later' }])
    expect(out.ai.accounts).toEqual([{ id: 'g1', label: 'old' }, { id: 'g2', label: 'later' }])
  })

  it('keeps today’s profiles when the copy has none', () => {
    const now = { profiles: [{ id: 'a' }], activeProfileId: 'a' }
    expect(restoredSettings({ language: 'en' }, now)).toMatchObject({ profiles: [{ id: 'a' }], activeProfileId: 'a' })
  })
})
