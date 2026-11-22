import type { Page } from 'playwright'
import { waitForBridge } from '../../examples/screenshots/harness.mjs'

export interface FirstFrame {
  /** `#root`'s innerText the first time it held any text at all. */
  text: string
  dir: string
  lang: string
}

/**
 * What the window showed on the first frame that had any copy in it.
 *
 * A MutationObserver installed before the renderer's scripts run records the
 * DOM the first time `#root` holds text. Its callback is a microtask, so it
 * sees the very DOM React committed — before the browser paints it, and
 * before any passive effect can patch it up. That is the frame a user would
 * see flash, which is what a "no English on cold start" check is about.
 *
 * Playwright cannot add an init script before Electron's first window loads,
 * so this installs it and reloads the renderer: a reload is a cold renderer
 * start (fresh JS context, the locale chunk fetched again from file://), with
 * the same settings file behind it.
 */
export async function captureFirstFrame(page: Page): Promise<FirstFrame> {
  await page.context().addInitScript(() => {
    const w = window as unknown as { __e2eFirstFrame?: FirstFrame }
    const observer = new MutationObserver(() => {
      const root = document.getElementById('root')
      const text = root?.innerText.trim()
      if (!text || w.__e2eFirstFrame) return
      w.__e2eFirstFrame = { text, dir: document.documentElement.dir, lang: document.documentElement.lang }
      observer.disconnect()
    })
    observer.observe(document, { childList: true, subtree: true, characterData: true })
  })
  await page.reload()
  await waitForBridge(page)
  await page.waitForFunction(() => '__e2eFirstFrame' in window, undefined, { timeout: 20000, polling: 100 })
  return page.evaluate(() => (window as unknown as { __e2eFirstFrame: FirstFrame }).__e2eFirstFrame)
}
