import { BrowserWindow, ipcMain, safeStorage, app, type WebContents } from 'electron'
import { join } from 'path'
import { readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

/**
 * Consent gate in front of the OS keychain.
 *
 * Electron's safeStorage asks the OS for an encryption key, and on macOS that
 * pops the alarming "Gitcito wants to use your confidential information stored
 * in your keychain" dialog — with no explanation of what for. Every keychain
 * touch therefore goes through here: nothing reaches safeStorage until the user
 * has seen our own window saying what is stored, what is not, and that none of
 * it leaves the machine.
 *
 * The answer lives in its own tiny file rather than in the settings JSON, so
 * reading it can never depend on the very code path it is meant to gate.
 *
 * Only safeStorage's asynchronous calls are used (Electron 45 deprecated the
 * synchronous ones; 46 removes them). They read what the synchronous calls
 * wrote, and they too answer "unavailable" — or reject — before the app is
 * ready, so the gate behaves the same. The first one, whichever it is, is
 * what asks the OS for the key.
 */
import type { KeychainConsent, KeychainReason } from '../shared/types'
import { writePrivateFile } from './privateFile'

export type { KeychainConsent, KeychainReason }

const consentPath = (): string => join(app.getPath('userData'), 'githuttbr-keychain.json')

export interface ConsentFile {
  consent: KeychainConsent
  /** Whether the user has actually seen our explanation (see adoptExistingConsent). */
  explained: boolean
}

let cached: ConsentFile | null = null
let asking: Promise<boolean> | null = null
let answer: ((granted: boolean) => void) | null = null

async function readFileState(): Promise<ConsentFile> {
  if (cached) return cached
  try {
    const parsed = JSON.parse(await readFile(consentPath(), 'utf-8')) as Partial<ConsentFile>
    const consent = parsed.consent === 'granted' || parsed.consent === 'declined' ? parsed.consent : 'unset'
    cached = { consent, explained: parsed.explained === true }
  } catch {
    cached = { consent: 'unset', explained: false }
  }
  return cached
}

async function writeFileState(next: ConsentFile): Promise<void> {
  cached = next
  await mkdir(app.getPath('userData'), { recursive: true })
  await writePrivateFile(consentPath(), JSON.stringify(next, null, 2))
}

export async function getConsent(): Promise<KeychainConsent> {
  return (await readFileState()).consent
}

/** The consent and whether the user has seen our explanation — read from our own file, never safeStorage. */
export async function getConsentState(): Promise<ConsentFile> {
  return { ...(await readFileState()) }
}

export async function setConsent(value: KeychainConsent): Promise<void> {
  await writeFileState({ consent: value, explained: true })
  if (value === 'declined') for (const listener of declinedListeners) listener()
}

/**
 * Someone who already has encrypted data on disk answered the OS prompt long
 * before this gate existed — re-asking them would look like a regression and
 * would hide their tokens until they clicked again. Adopt that as consent.
 */
export async function adoptExistingConsent(paths: string[]): Promise<void> {
  const state = await readFileState()
  if (state.consent !== 'unset') return
  // `explained: false` — they keep their access, but still get the explanation
  // once, before the system dialog can appear out of nowhere.
  if (paths.some((p) => existsSync(p))) await writeFileState({ consent: 'granted', explained: false })
}

/**
 * Linux without a secret service (GNOME Keyring, KWallet): Electron still says
 * encryption is available, but falls back to `basic_text` — a password fixed
 * in Chromium's source, so anyone who can read the file can read the tokens.
 * Not treated as "unavailable": that would lock users already on it out of
 * what they stored. It is reported, so Settings can say so, and nothing new is
 * written to it (`isKeychainWeak`).
 */
function weakStorageBackend(): boolean {
  if (process.platform !== 'linux') return false
  try {
    return safeStorage.getSelectedStorageBackend() === 'basic_text'
  } catch {
    return false
  }
}

/**
 * True when the keychain may be read but must not take anything new: consent
 * given, encryption reported available, and the backend is `basic_text`
 * (see weakStorageBackend). What the store already holds stays readable — and
 * removable — but a token typed now is kept for the session only, as when the
 * keychain is off: writing it there would only look like protection.
 * `canUseKeychain` comes first: it is what initialises safeStorage, and the
 * backend reads as `unknown` before the app is ready. `getSelectedStorageBackend`
 * is the one safeStorage call that stays synchronous — Electron 45 did not
 * deprecate it.
 */
export async function isKeychainWeak(): Promise<boolean> {
  return (await canUseKeychain()) && weakStorageBackend()
}

/** True when the keychain may be used right now, without asking anything. */
export async function canUseKeychain(): Promise<boolean> {
  if ((await getConsent()) !== 'granted') return false
  try {
    return await safeStorage.isAsyncEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * The pages (by webContents id) that have been served their settings since
 * they last started loading. Only such a page can show the question: App
 * renders its modals once the settings are loaded, and until then shows a
 * spinner. A question sent to a page still loading is never seen — and the
 * save that asked holds the settings queue, so that page's own `settings:get`
 * waits behind it for good. Set by the settings module on a successful
 * get/unlock reply; cleared when a new document starts in the main frame.
 */
const settingsReady = new Set<number>()
const watchedPages = new WeakSet<object>()

/** A get/unlock was just answered for this page: from now on it can be asked. */
export function noteSettingsServed(contents: Partial<Pick<WebContents, 'id' | 'on' | 'once'>> | undefined): void {
  if (!contents || typeof contents.id !== 'number' || typeof contents.on !== 'function') return
  const id = contents.id
  settingsReady.add(id)
  if (watchedPages.has(contents)) return
  watchedPages.add(contents)
  const page = contents as WebContents
  const forget = (): void => {
    settingsReady.delete(id)
  }
  // The same test as the question's own: a subframe or an in-page route
  // change leaves the page, and its loaded settings, where they were.
  page.on('did-start-navigation', (details: { isMainFrame: boolean; isSameDocument: boolean }) => {
    if (details.isMainFrame && !details.isSameDocument) forget()
  })
  page.on('render-process-gone', forget)
  page.once('destroyed', forget)
}

/** Whether this page can show the question now (see `settingsReady`). */
function canShowQuestion(contents: WebContents): boolean {
  if (!settingsReady.has(contents.id)) return false
  try {
    return !contents.isLoadingMainFrame()
  } catch {
    return false
  }
}

/**
 * Ask the renderer to show the explainer, once, and wait for the answer.
 * Concurrent callers share the same dialog. With no window to ask in (headless
 * runs, tests) the answer is "no" — never a silent keychain prompt.
 */
function askUser(reason: KeychainReason, adopted: boolean): Promise<boolean> {
  if (asking) return asking
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return Promise.resolve(false)

  const contents = win.webContents
  // A page reloading, or not yet past its boot spinner, would never show it:
  // answered at once as "not now", nothing recorded, asked again next time.
  if (!canShowQuestion(contents)) return Promise.resolve(false)
  asking = new Promise<{ granted: boolean; answered: boolean }>((resolve) => {
    // The page that showed the question is gone — reloaded, crashed, closed.
    // Nobody will ever answer it, and the settings queue waits behind this
    // promise: left pending, the next renderer's settings:get never returns and
    // the boot spinner spins forever. Settle it as "not now", without recording
    // a refusal the user never gave.
    const abandon = (): void => settle(false, false)
    // Only a new document in the main frame replaces the page. A subframe (the
    // PDF preview's <iframe>) or an in-page route change leaves the question on
    // screen, and settling then would answer it while the user is still reading.
    const onNavigation = (details: { isMainFrame: boolean; isSameDocument: boolean }): void => {
      if (details.isMainFrame && !details.isSameDocument) abandon()
    }
    const settle = (granted: boolean, answered: boolean): void => {
      win.removeListener('closed', abandon)
      contents.removeListener('render-process-gone', abandon)
      contents.removeListener('did-start-navigation', onNavigation)
      contents.removeListener('destroyed', abandon)
      resolve({ granted, answered })
    }
    answer = (granted) => settle(granted, true)
    contents.send('keychain:ask', { reason, adopted })
    win.once('closed', abandon)
    contents.once('render-process-gone', abandon)
    contents.on('did-start-navigation', onNavigation)
    contents.once('destroyed', abandon)
  }).then(async ({ granted, answered }) => {
    try {
      if (answered) await setConsent(granted ? 'granted' : 'declined')
    } finally {
      asking = null
      answer = null
    }
    return granted
  })
  return asking
}

/**
 * Gate for any operation that needs the keychain. Returns false when the user
 * says no — callers must degrade (keep secrets in memory, leave the vault
 * locked) rather than write anything sensitive to disk in the clear.
 */
export async function ensureKeychain(reason: KeychainReason): Promise<boolean> {
  const { consent, explained } = await readFileState()
  if (consent === 'declined') return false
  // Granted but never explained: an install that predates this gate. Show the
  // explanation before the OS dialog, so it can still be turned down.
  if (consent === 'granted' && explained) return canUseKeychain()
  if (!(await askUser(reason, consent === 'granted'))) return false
  // First real safeStorage call — the OS prompt now arrives right after our own
  // explanation, which is the whole point.
  try {
    return await safeStorage.isAsyncEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * Run when the user turns the keychain on from Settings. Registered by the
 * settings module (which imports this one, so it cannot be imported back):
 * tokens typed while the keychain was off live only in memory, and turning it
 * on is the moment to put them where they survive a restart.
 */
const grantedListeners: Array<() => Promise<void>> = []
/**
 * Run whenever consent becomes "declined" — from the explainer or from
 * Settings → Security. Registered by the settings module for the same
 * import-cycle reason: with the store out of reach, avatar lookups stop waiting
 * for it, and the windows have to hear so.
 */
const declinedListeners: Array<() => void> = []
export function onKeychainDeclined(listener: () => void): void {
  declinedListeners.push(listener)
}
export function onKeychainEnabled(listener: () => Promise<void>): void {
  grantedListeners.push(listener)
}

/**
 * Whether tokens are still held in memory only. Registered by the settings
 * module for the same import-cycle reason, so the token notice can stay up
 * until they have really reached the encrypted store.
 */
let sessionOnlyProbe: () => boolean = () => false
export function onSessionOnlyProbe(probe: () => boolean): void {
  sessionOnlyProbe = probe
}

export function registerKeychainHandlers(): void {
  ipcMain.handle('keychain:answer', (_e, granted: boolean) => {
    answer?.(!!granted)
  })
  ipcMain.handle('keychain:status', async () => {
    const { consent, explained } = await readFileState()
    return {
      consent,
      explained,
      available: consent === 'granted' ? await canUseKeychain() : null,
      // Only once consent is given: asking safeStorage is what can raise the OS prompt.
      weakBackend: consent === 'granted' ? weakStorageBackend() : false,
      sessionOnly: sessionOnlyProbe()
    }
  })
  // Settings → Security: turn it on or off after the fact.
  ipcMain.handle('keychain:set', async (_e, granted: boolean) => {
    if (!granted) {
      await setConsent('declined')
      return false
    }
    // Turning it on from Settings → Security is itself an informed choice, so
    // it counts as explained: no dialog on the next keychain use.
    await setConsent('granted')
    const usable = await canUseKeychain()
    // No catch: a failed move must reject this call. Swallowing it reported the
    // keychain as on while the tokens stayed in memory and vanished on quit.
    if (usable) for (const listener of grantedListeners) await listener()
    return usable
  })
}
