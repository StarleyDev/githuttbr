import { describe, it, expect, afterEach } from 'vitest'
import { initShotMode, isShotMode } from '../src/main/shotMode'

describe('screenshot mode', () => {
  afterEach(() => initShotMode(true, []))

  it('is off until main decides', () => {
    expect(isShotMode()).toBe(false)
  })

  it('turns on for --shot on an unpackaged build — how the harness and e2e launch it', () => {
    expect(initShotMode(false, ['/electron', 'out/main/index.js', '--shot'])).toBe(true)
    expect(isShotMode()).toBe(true)
  })

  it('is ignored by a packaged build, so an installed app cannot be redirected by a flag', () => {
    expect(initShotMode(true, ['/opt/Gitcito/gitcito', '--shot'])).toBe(false)
    expect(isShotMode()).toBe(false)
  })

  it('needs the flag even when unpackaged', () => {
    expect(initShotMode(false, ['/electron', 'out/main/index.js'])).toBe(false)
  })
})
