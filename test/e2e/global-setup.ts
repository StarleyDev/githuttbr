import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ROOT } from '../helpers'
import ensurePlayground from '../setup/global-setup'

const MAIN = resolve(ROOT, 'out/main/index.js')

/** Newest modification time under `dir`, in ms. `*.generated.*` files are
 *  skipped: the build itself writes them (the licence list), so they are always
 *  newer than the bundle that read them. */
function newest(dir: string): number {
  let max = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.includes('.generated.')) continue
    const p = join(dir, entry.name)
    max = Math.max(max, entry.isDirectory() ? newest(p) : statSync(p).mtimeMs)
  }
  return max
}

// The suite drives what `npm run build` wrote to out/, not the source. A
// missing build would time out every case; a stale one is worse — it passes
// against code that is no longer there. Both stop here, with the fix in the
// message. E2E_ALLOW_STALE=1 skips the freshness check for a deliberate run
// against an older bundle.
export default function setup(): void {
  if (!existsSync(MAIN)) {
    throw new Error('out/main/index.js is missing — run `npm run build` before `npm run test:e2e`.')
  }
  if (process.env.E2E_ALLOW_STALE !== '1' && newest(resolve(ROOT, 'src')) > statSync(MAIN).mtimeMs) {
    throw new Error('src/ changed after the last build — run `npm run build` (or set E2E_ALLOW_STALE=1).')
  }
  ensurePlayground()
}
