import { describe, it, expect } from 'vitest'
import { sandboxNotice } from '../src/main/sandboxNotice'

describe('sandbox notice', () => {
  it('says nothing when the sandbox is on', () => {
    expect(sandboxNotice(false, {})).toBeNull()
    expect(sandboxNotice(false, { APPIMAGE: '/a.AppImage' })).toBeNull()
  })

  it('warns when --no-sandbox is on the command line', () => {
    expect(sandboxNotice(true, {})).toMatch(/sandbox is OFF \(--no-sandbox\)/)
  })

  it('explains the AppImage launcher and how to run sandboxed', () => {
    const msg = sandboxNotice(true, { APPIMAGE: '/a.AppImage' })!
    expect(msg).toMatch(/AppImage launcher adds --no-sandbox/)
    expect(msg).toMatch(/install the \.deb/)
  })

  it('also catches ELECTRON_DISABLE_SANDBOX', () => {
    expect(sandboxNotice(false, { ELECTRON_DISABLE_SANDBOX: '1' })).toMatch(/ELECTRON_DISABLE_SANDBOX/)
  })
})
