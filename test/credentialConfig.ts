import { execFileSync } from 'node:child_process'

/**
 * The `credential.*` config an environment hands git, as real git reads it —
 * `GIT_CONFIG_COUNT` or `GIT_CONFIG_PARAMETERS`, whichever the code picked —
 * with no user or system config in the way. One `key value` line per entry, in
 * the order git applies them; an empty helper is the bare key.
 */
export function credentialConfig(env: NodeJS.ProcessEnv | null | undefined): string[] {
  let out = ''
  try {
    out = execFileSync('git', ['config', '--get-regexp', '^credential\\.'], {
      env: {
        PATH: process.env.PATH,
        HOME: '/nonexistent',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        ...(env ?? {})
      },
      cwd: '/',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (e) {
    // Exit 1 is "no such key"; anything else (a key git refuses) is the finding.
    if ((e as { status?: number }).status !== 1) throw e
  }
  return out
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
}

/** Anonymous for `context`: its helpers cleared, and no helper registered after that. */
export function blanksOnly(env: NodeJS.ProcessEnv | null | undefined, context: string): boolean {
  const lines = credentialConfig(env)
  return lines.includes(`credential.${context}.helper`) && !lines.some((l) => /\.helper \S/.test(l))
}
