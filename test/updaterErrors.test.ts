import { describe, expect, it } from 'vitest'
import { isMissingChannelFile } from '../src/main/updaterErrors'

// What electron-updater's GitHubProvider throws for a 404 on the channel file
// (builder-util-runtime's newError: an Error with a `code`).
const providerError = (channelFile = 'latest-mac.yml'): Error => {
  const url = `https://github.com/StarleyDev/githuttbr/releases/download/v4.40.0/${channelFile}`
  const e = new Error(
    `Cannot find ${channelFile} in the latest release artifacts (${url}): HttpError: 404 \n"method: GET url: ${url}"`
  ) as Error & { code?: string }
  e.code = 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
  return e
}

describe('updater: a release without this platform’s update file', () => {
  it('is recognised by electron-updater’s error code', () => {
    expect(isMissingChannelFile(providerError())).toBe(true)
    expect(isMissingChannelFile(providerError('latest.yml'))).toBe(true)
  })

  it('is recognised by its message when the code was lost on the way', () => {
    const plain = new Error(providerError().message)
    expect(isMissingChannelFile(plain)).toBe(true)
    expect(isMissingChannelFile(new Error('Cannot find channel "latest-mac.yml" update info: HttpError: 404'))).toBe(true)
  })

  it('keeps real failures as errors', () => {
    expect(isMissingChannelFile(new Error('net::ERR_INTERNET_DISCONNECTED'))).toBe(false)
    expect(isMissingChannelFile(new Error('HttpError: 404 GitHuttBr-4.40.0-arm64.zip'))).toBe(false)
    // The yml named, but not a 404: a 500 or a parse error is a real problem.
    expect(isMissingChannelFile(new Error('Cannot find latest-mac.yml in the latest release artifacts: HttpError: 500'))).toBe(false)
    const sig = new Error('sha512 checksum mismatch') as Error & { code?: string }
    sig.code = 'ERR_CHECKSUM_MISMATCH'
    expect(isMissingChannelFile(sig)).toBe(false)
    const noVersions = new Error('No published versions on GitHub') as Error & { code?: string }
    noVersions.code = 'ERR_UPDATER_NO_PUBLISHED_VERSIONS'
    expect(isMissingChannelFile(noVersions)).toBe(false)
  })

  it('tolerates whatever was thrown', () => {
    expect(isMissingChannelFile(undefined)).toBe(false)
    expect(isMissingChannelFile(null)).toBe(false)
    expect(isMissingChannelFile('latest-mac.yml 404')).toBe(false)
    expect(isMissingChannelFile({ code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' })).toBe(true)
  })
})
