// What a GitHub release must carry before it goes public, and what the macOS
// half must carry before it is uploaded. electron-updater reads latest*.yml and
// then downloads the files those name, so the check is "every yml is there and
// every file it names is there" — no file name is hard-coded except the ymls.
//
// Usage:
//   node scripts/release-assets.mjs gate <assets.json> <dir-with-ymls>
//       assets.json = `gh release view TAG --json assets`; the ymls downloaded
//       into <dir>. Exit 1 with the missing names when Linux or Windows is not
//       complete.
//   node scripts/release-assets.mjs mac-upload <dist-dir> <version>
//       Prints the files to upload, one per line, latest-mac.yml last. Exit 1
//       when the yml names a file the build did not produce, or another version.
//   node scripts/release-assets.mjs has-mac <assets.json>
//       Prints `yes` or `no`.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const PUBLISH_YMLS = ['latest.yml', 'latest-linux.yml']
export const MAC_YML = 'latest-mac.yml'

/**
 * The few fields of an electron-builder update file we need. It is flat YAML
 * written by js-yaml; reading `url:` and `version:` lines keeps this script
 * free of dependencies, which matters in a job that has not run npm ci.
 * @param {string} text
 * @returns {{ version: string | null; urls: string[] }}
 */
export function parseUpdateInfo(text) {
  const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2')
  let version = null
  const urls = []
  for (const line of text.split(/\r?\n/)) {
    const v = /^version:\s*(.+)$/.exec(line)
    if (v) version = unquote(v[1])
    const u = /^\s*(?:-\s*)?url:\s*(.+)$/.exec(line)
    if (u) urls.push(unquote(u[1]))
  }
  return { version, urls: [...new Set(urls)] }
}

/** @param {{ assets?: Array<{ name: string }> } | Array<{ name: string }>} payload */
export function assetNames(payload) {
  const list = Array.isArray(payload) ? payload : (payload.assets ?? [])
  return list.map((a) => a.name)
}

/**
 * Linux and Windows are complete: both ymls are attached and every file they
 * point at is attached too.
 * @param {string[]} names asset names on the release
 * @param {Record<string, string | undefined>} ymls yml name -> its text, when downloaded
 * @returns {{ ok: boolean; missing: string[] }}
 */
export function publishGate(names, ymls) {
  const have = new Set(names)
  const missing = []
  for (const y of PUBLISH_YMLS) {
    if (!have.has(y) || ymls[y] == null) {
      missing.push(y)
      continue
    }
    const { urls } = parseUpdateInfo(ymls[y] ?? '')
    if (!urls.length) missing.push(`${y} (names no file)`)
    for (const u of urls) if (!have.has(u)) missing.push(u)
  }
  return { ok: missing.length === 0, missing }
}

/** @param {string[]} names */
export function hasMac(names) {
  return names.includes(MAC_YML)
}

/**
 * The macOS files to upload from a `--publish never` build, the yml last so an
 * updater never reads a latest-mac.yml whose zip is not there yet.
 * @param {string[]} files names in the dist directory
 * @param {string | null} ymlText latest-mac.yml, or null when the build wrote none
 * @param {string} version package.json version the tag is for
 * @returns {{ ok: true; upload: string[] } | { ok: false; error: string }}
 */
export function macUploadPlan(files, ymlText, version) {
  if (ymlText == null) return { ok: false, error: `${MAC_YML} was not written by the build` }
  const info = parseUpdateInfo(ymlText)
  if (info.version !== version) {
    return { ok: false, error: `${MAC_YML} is for ${info.version ?? 'no version'}, expected ${version}` }
  }
  const have = new Set(files)
  const absent = info.urls.filter((u) => !have.has(u))
  if (absent.length) return { ok: false, error: `${MAC_YML} names files the build did not produce: ${absent.join(', ')}` }
  // Both architectures, or an Intel (or Apple silicon) user is left behind.
  for (const arch of ['arm64', 'x64']) {
    if (!info.urls.some((u) => u.endsWith(`-${arch}.zip`))) {
      return { ok: false, error: `${MAC_YML} has no ${arch} zip` }
    }
  }
  const binaries = files
    .filter((f) => f.includes(`-${version}-`) && /\.(dmg|zip)(\.blockmap)?$/.test(f))
    .sort()
  return { ok: true, upload: [...binaries, MAC_YML] }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b] = process.argv.slice(2)
  const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'))
  if (cmd === 'gate') {
    const names = assetNames(readJson(a))
    /** @type {Record<string, string | undefined>} */
    const ymls = {}
    for (const y of PUBLISH_YMLS) if (existsSync(join(b, y))) ymls[y] = readFileSync(join(b, y), 'utf8')
    const g = publishGate(names, ymls)
    if (!g.ok) {
      console.log(`missing: ${g.missing.join(', ')}`)
      process.exit(1)
    }
    console.log('complete')
  } else if (cmd === 'mac-upload') {
    const yml = join(a, MAC_YML)
    const plan = macUploadPlan(readdirSync(a), existsSync(yml) ? readFileSync(yml, 'utf8') : null, b)
    if (!plan.ok) {
      console.error(plan.error)
      process.exit(1)
    }
    for (const f of plan.upload) console.log(join(a, f))
  } else if (cmd === 'has-mac') {
    console.log(hasMac(assetNames(readJson(a))) ? 'yes' : 'no')
  } else {
    console.error('usage: release-assets.mjs gate|mac-upload|has-mac …')
    process.exit(2)
  }
}
