import { describe, it, expect, vi, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import { SETTINGS_FORMAT } from '../src/shared/settingsFormat'
import { backupFileName, BACKUPS_KEPT } from '../src/shared/rollback'
import { bootLoaded, settingsIpc } from './settingsIpc'

// The settings half of going back a version, against the real handlers: a
// save keeps the keys a newer build wrote (but never a credential among them),
// and the copies taken before a switch hold no token, are kept to the newest
// few, and restore preferences without touching what is open.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-settings-backups-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false, getVersion: () => '4.52.0' },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: { showItemInFolder: () => undefined, openPath: async () => '' },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString().slice(4)
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const settingsFile = (): string => join(dir, 'githuttbr-settings.json')
const backupDir = (): string => join(dir, 'settings-backups')
const onDisk = (): Record<string, unknown> => JSON.parse(readFileSync(settingsFile(), 'utf8')) as Record<string, unknown>
const ipc = settingsIpc(handlers)
const call = (channel: string, ...args: unknown[]): Promise<unknown> => ipc({ sender: { id: 1 } }, channel, ...args)

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultSettings().profiles[0], id: 'p', ...over })
const settingsWith = (over: Record<string, unknown> = {}): AppSettings =>
  ({ ...defaultSettings(), onboardingCompleted: true, profiles: [profileWith({})], ...over }) as AppSettings

async function restart(file: Record<string, unknown>): Promise<typeof import('../src/main/settingsBackups')> {
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true, recursive: true })
  // Declined: no keychain in play, tokens stay in memory — the copies must hold none either way.
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
  writeFileSync(settingsFile(), JSON.stringify(file))
  vi.resetModules()
  handlers.clear()
  const settings = await import('../src/main/settings')
  settings.registerSettingsHandlers()
  const backups = await import('../src/main/settingsBackups')
  backups.registerSettingsBackupHandlers()
  await bootLoaded(handlers)
  return backups
}

describe('a save from this build', () => {
  it('keeps the keys a newer build wrote, and stamps the format', async () => {
    await restart({ ...settingsWith(), graphCompactMode: true, terminalFontLigatures: { on: true } })
    // A renderer that never held them — an older shape, an import — saves.
    const s = (await call('settings:get')) as AppSettings & Record<string, unknown>
    expect(s.graphCompactMode).toBe(true)
    const { graphCompactMode: _a, terminalFontLigatures: _b, ...older } = s
    void _a
    void _b
    await call('settings:set', { ...older, codeFontSize: 17 })
    const file = onDisk()
    expect(file.graphCompactMode).toBe(true)
    expect(file.terminalFontLigatures).toEqual({ on: true })
    expect(file.codeFontSize).toBe(17)
    expect(file.settingsFormat).toBe(SETTINGS_FORMAT)
  })

  it('drops a newer build’s credential-shaped key instead of keeping it in plain text', async () => {
    await restart({
      ...settingsWith(),
      futureHostToken: 'fht_secret',
      futureServers: [{ url: 'https://srv', token: 'srv_secret' }],
      profiles: [{ ...profileWith({}), newHostToken: 'nh_secret', newHostUrl: 'https://nh' }]
    })
    const s = (await call('settings:get')) as AppSettings
    await call('settings:set', { ...s, codeFontSize: 16 })
    const text = readFileSync(settingsFile(), 'utf8')
    for (const secret of ['fht_secret', 'srv_secret', 'nh_secret']) expect(text).not.toContain(secret)
    expect(onDisk().futureServers).toEqual([{ url: 'https://srv' }])
    expect((onDisk().profiles as Record<string, unknown>[])[0].newHostUrl).toBe('https://nh')
  })
})

describe('settings copies', () => {
  it('copy the settings without any token, even one still in the file in plain text', async () => {
    const backups = await restart({ ...settingsWith({ language: 'de' }), profiles: [profileWith({ githubToken: 'ghp_plain' })] })
    const made = await backups.backupSettings('4.51.0', 'rollback')
    expect(made).toMatchObject({ version: '4.52.0', target: '4.51.0', reason: 'rollback' })
    const text = readFileSync(join(backupDir(), made!.name), 'utf8')
    expect(text).not.toContain('ghp_plain')
    expect(JSON.parse(text).language).toBe('de')
    expect(await backups.listSettingsBackups()).toHaveLength(1)
  })

  it(`keep the newest ${BACKUPS_KEPT}, and one update downloaded twice uses one slot`, async () => {
    const backups = await restart(settingsWith())
    mkdirSync(backupDir(), { recursive: true })
    for (let d = 1; d <= 6; d++) {
      writeFileSync(join(backupDir(), backupFileName('4.50.1', '4.52.0', 'update', `2026-10-0${d}T00:00:00.000Z`)), '{}')
    }
    writeFileSync(join(backupDir(), 'unrelated.txt'), 'kept')
    await backups.backupSettings('4.53.0', 'update')
    await backups.backupSettings('4.53.0', 'update')
    const list = await backups.listSettingsBackups()
    expect(list).toHaveLength(BACKUPS_KEPT)
    expect(list.filter((b) => b.target === '4.53.0')).toHaveLength(1)
    expect(list.some((b) => b.createdAt.startsWith('2026-10-01'))).toBe(false)
    expect(existsSync(join(backupDir(), 'unrelated.txt'))).toBe(true)
  })

  it('restore preferences, keep what is open, and take a copy of now first', async () => {
    const backups = await restart(settingsWith({ language: 'de' }))
    const made = await backups.backupSettings('4.51.0', 'rollback')
    const s = (await call('settings:get')) as AppSettings
    await call('settings:set', { ...s, language: 'fr', tabs: [{ id: 't1', kind: 'repo', path: '/tmp/demo', name: 'demo' }] })
    expect(await handlers.get('settingsBackups:changedSince')!({}, made!.name)).toEqual(['language'])
    expect(await handlers.get('settingsBackups:restore')!({}, made!.name)).toBe('ok')
    const file = onDisk()
    expect(file.language).toBe('de')
    expect((file.tabs as { id: string }[])[0].id).toBe('t1')
    expect((await backups.listSettingsBackups()).some((b) => b.reason === 'restore')).toBe(true)
  })

  it('refuse a name that is not one of theirs', async () => {
    await restart(settingsWith())
    expect(await handlers.get('settingsBackups:restore')!({}, '../githuttbr-settings.json')).toBe('missing')
    expect(await handlers.get('settingsBackups:changedSince')!({}, '/etc/passwd')).toBeNull()
  })
})
