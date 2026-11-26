import { describe, it, expect } from 'vitest'
import { getLinkClickAction, getUrlScheme, isAllowedExternalUrl, isAppNavigation } from '../src/shared/externalUrl'

describe('external URL allowlist', () => {
  it('lets web pages and mail drafts out', () => {
    expect(isAllowedExternalUrl('https://example.com/pull/42')).toBe(true)
    expect(isAllowedExternalUrl('HTTP://example.com')).toBe(true)
    expect(isAllowedExternalUrl('mailto:someone@example.com')).toBe(true)
  })

  it('refuses everything that would open or mount something on the machine', () => {
    for (const url of [
      'file:///etc/passwd',
      'file://server/share/x.exe',
      '//evil.example.com/x',
      'smb://server/share',
      'vscode://file/x',
      'x-desktop-client://openRepo/x',
      'javascript:alert(1)',
      'data:text/html,hi',
      'tel:+15550100',
      'ms-settings:privacy',
      'http:no-host',
      'docs/setup.md',
      '../README.md',
      '/etc/hosts',
      '',
      '   '
    ]) {
      expect(isAllowedExternalUrl(url), url).toBe(false)
    }
    expect(isAllowedExternalUrl(undefined)).toBe(false)
    expect(isAllowedExternalUrl(42)).toBe(false)
  })

  it('logs only the scheme', () => {
    expect(getUrlScheme('file:///home/someone/secret.txt')).toBe('file:')
    expect(getUrlScheme('SMB://server/share')).toBe('smb:')
    expect(getUrlScheme('docs/setup.md')).toBe('(no scheme)')
    expect(getUrlScheme(null)).toBe('(not a string)')
  })
})

describe('main window navigation', () => {
  const packaged = 'file:///opt/app/resources/app.asar/out/renderer/index.html'

  it('stays on the packaged index.html, a fragment or a query included', () => {
    expect(isAppNavigation(packaged, packaged)).toBe(true)
    expect(isAppNavigation(`${packaged}#help`, packaged)).toBe(true)
    expect(isAppNavigation(`${packaged}?x=1`, packaged)).toBe(true)
  })

  it('refuses another local file, a web page, or a relative link resolved against the app', () => {
    expect(isAppNavigation('file:///opt/app/resources/app.asar/out/renderer/docs/setup.md', packaged)).toBe(false)
    expect(isAppNavigation('file:///etc/passwd', packaged)).toBe(false)
    expect(isAppNavigation('https://example.com/', packaged)).toBe(false)
  })

  it('stays on the dev server origin only', () => {
    const dev = 'http://localhost:5173/'
    expect(isAppNavigation('http://localhost:5173/index.html', dev)).toBe(true)
    expect(isAppNavigation('http://localhost:5174/', dev)).toBe(false)
    expect(isAppNavigation('https://example.com/', dev)).toBe(false)
    expect(isAppNavigation('not a url', dev)).toBe(false)
  })
})

describe('link clicks in the renderer', () => {
  it('opens web and mail links outside, leaves fragments, blocks the rest', () => {
    expect(getLinkClickAction('https://example.com')).toBe('external')
    expect(getLinkClickAction('mailto:a@example.com')).toBe('external')
    expect(getLinkClickAction('#writing-comments')).toBe('in-page')
    expect(getLinkClickAction('docs/setup.md')).toBe('block')
    expect(getLinkClickAction('../x')).toBe('block')
    expect(getLinkClickAction('file:///etc/passwd')).toBe('block')
    expect(getLinkClickAction('//cdn.example.com/x')).toBe('block')
    expect(getLinkClickAction('custom-app://x')).toBe('block')
  })
})
