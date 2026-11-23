// macOS can arrive hours after Linux and Windows publish a release. Until it
// does, the latest release has no latest-mac.yml, and electron-updater's
// GitHub provider turns the 404 into ERR_UPDATER_CHANNEL_FILE_NOT_FOUND. That
// is "nothing for this platform yet", not a broken updater: shown as an error,
// every Mac would wear a red badge on each check until the upload lands.

const CHANNEL_FILE_CODE = 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
// The provider's message, for an error that lost its code on the way (wrapped
// or re-thrown as a plain Error): the channel file by name, plus a 404.
const CHANNEL_FILE_MESSAGE = /Cannot find (?:channel ")?latest(?:-[a-z0-9]+)?\.yml\b/i

/**
 * True only when the update feed is missing this platform's channel file
 * (latest-mac.yml, latest.yml, latest-linux.yml) — a release that is published
 * but not complete for this OS yet. Network, signature and download errors are
 * not, and stay errors.
 */
export function isMissingChannelFile(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const { code, message } = err as { code?: unknown; message?: unknown }
  if (code === CHANNEL_FILE_CODE) return true
  if (typeof message !== 'string') return false
  return CHANNEL_FILE_MESSAGE.test(message) && /\b404\b/.test(message)
}
