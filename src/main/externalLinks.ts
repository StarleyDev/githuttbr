import { shell } from 'electron'
import { getUrlScheme, isAllowedExternalUrl } from '../shared/externalUrl'

/**
 * Hands an address to the OS only when it is a web page or a mail draft. Every
 * path that opens something outside the app goes through here: the renderer's
 * IPC call, window.open, the updater's release page. A refusal logs the scheme
 * alone — the address may carry a token, a username or a local path.
 */
export function openExternalUrl(url: unknown, from: string): boolean {
  if (!isAllowedExternalUrl(url)) {
    console.warn(`[${from}] refused to open a ${getUrlScheme(url)} address externally`)
    return false
  }
  void shell.openExternal(url as string)
  return true
}
