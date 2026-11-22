import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MANIFEST, SETUP_SCRIPT } from '../helpers'

/**
 * Cut every git the suite spawns off from the machine's git config.
 *
 * A test that passes only because the developer (or CI) has a global
 * `user.name`, `init.defaultBranch` or `pull.rebase` fails on the next machine
 * that does not — and nobody sees it until then. Pointing GLOBAL at a file of
 * our own and turning SYSTEM off makes every machine look the same: a fresh
 * install. `user.useConfigOnly` goes one step further than a fresh install and
 * refuses to guess an identity from the hostname, which some machines can and
 * others cannot; a test that commits must say who it is.
 *
 * Workers are spawned after this runs, so they inherit the environment.
 */
function hermeticGit(): () => void {
  const dir = mkdtempSync(join(tmpdir(), 'gitcito-test-gitconfig-'))
  const file = join(dir, 'gitconfig')
  writeFileSync(file, '[user]\n\tuseConfigOnly = true\n')
  process.env.GIT_CONFIG_GLOBAL = file
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  delete process.env.GIT_CONFIG_SYSTEM
  return () => rmSync(dir, { recursive: true, force: true })
}

// Ensure the playground fixtures exist before any test runs.
//   - CI / fresh checkout: MANIFEST.tsv is absent → generate it.
//   - Local: regenerate only if missing (set PLAYGROUND_FORCE=1 to force).
// Re-running the script wipes and recreates examples/playground deterministically.
export default function setup(): () => void {
  const teardown = hermeticGit()
  const force = process.env.PLAYGROUND_FORCE === '1'
  if (!force && existsSync(MANIFEST)) return teardown
  // eslint-disable-next-line no-console
  console.log('[playground] generating fixtures via setup-playground.sh …')
  execFileSync('bash', [SETUP_SCRIPT], { stdio: 'inherit' })
  return teardown
}
