import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { credentialsInEnv } from '../src/main/credentialBroker'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Repo root. */
export const ROOT = resolve(HERE, '..')
/** examples/playground — where setup-playground.sh writes the fixture repos. */
export const PLAYGROUND = resolve(ROOT, 'examples/playground')
/** The setup script that (re)generates the playground. */
export const SETUP_SCRIPT = resolve(ROOT, 'examples/setup-playground.sh')
/** Machine-readable list of scenarios written by the setup script. */
export const MANIFEST = resolve(PLAYGROUND, 'MANIFEST.tsv')

/** Absolute path to a playground repo by its scenario name. */
export const repoPath = (name: string): string => resolve(PLAYGROUND, name)

export interface ManifestEntry {
  name: string
  description: string
}

/** Parse MANIFEST.tsv (one `name<TAB>description` line per scenario). */
export function readManifest(): ManifestEntry[] {
  if (!existsSync(MANIFEST)) return []
  return readFileSync(MANIFEST, 'utf8')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split('\t')
      return { name, description: rest.join('\t') }
    })
}

/**
 * A clone or fetch environment as text, with what its credential endpoints
 * serve. The token is not in the environment any more (main/credentialBroker.ts),
 * so "which account does this sign in as" is the environment plus the endpoint.
 */
export function revealCredentialEnv(env: NodeJS.ProcessEnv | null | undefined): string {
  return JSON.stringify({ env, served: credentialsInEnv(env) })
}

/** The environment's values plus the user names and passwords its endpoints serve. */
export function credentialEnvValues(env: NodeJS.ProcessEnv | null | undefined): Array<string | undefined> {
  return [...Object.values(env ?? {}), ...credentialsInEnv(env).flatMap((c) => [c.username, c.password])]
}

/**
 * Run git with `input` on stdin, without blocking the event loop. A profile
 * credential is served by an endpoint inside this very process
 * (main/credentialBroker.ts): `execFileSync` would freeze it while git's helper
 * waits for an answer. Rejects with stderr on a non-zero exit.
 */
export function gitWithInput(args: string[], input: string, env: NodeJS.ProcessEnv, cwd?: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, { env, cwd })
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8').on('data', (d: string) => (out += d))
    child.stderr.setEncoding('utf8').on('data', (d: string) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolvePromise(out) : reject(new Error(err.trim() || `git exited ${code}`))))
    // git may exit before it reads all of stdin; its exit code tells the story.
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}
