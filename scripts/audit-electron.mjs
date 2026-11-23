#!/usr/bin/env node
/**
 * Fail when the Electron we ship has a published advisory.
 *
 * Electron is a devDependency — electron-builder wants it there — yet it is
 * the runtime every user executes. So `npm audit --omit=dev`, the usual
 * "what ships" audit, hides it: v4.37.0 went out on an Electron with a dozen
 * advisories while that audit said "found 0 vulnerabilities". This asks the
 * full audit and looks at the packages that end up inside the app no matter
 * where package.json files them.
 *
 * Needs the network (npm's audit endpoint), so it is a CI step, not part of the
 * local gate. An optional argument names the directory whose lockfile to audit
 * (default: the current one). An audit that cannot run is a failure here, not
 * a pass: a green check that never looked is what this script exists to prevent.
 */
import { spawnSync } from 'node:child_process'

/** devDependencies that are nonetheless shipped inside the packaged app. */
const SHIPPED_DEV = ['electron']

const run = spawnSync('npm', ['audit', '--json'], {
  cwd: process.argv[2] ?? process.cwd(),
  encoding: 'utf8',
  shell: process.platform === 'win32'
})
let report
try {
  report = JSON.parse(run.stdout)
} catch {
  console.error('✖ audit-electron: npm audit produced no JSON report.')
  console.error(run.stderr || run.stdout)
  process.exit(2)
}
if (report.error) {
  console.error(`✖ audit-electron: npm audit failed — ${report.error.summary ?? JSON.stringify(report.error)}`)
  process.exit(2)
}

let failed = false
for (const name of SHIPPED_DEV) {
  const vuln = report.vulnerabilities?.[name]
  if (!vuln) {
    console.log(`✔ audit-electron: no advisories for ${name}.`)
    continue
  }
  failed = true
  console.error(`✖ audit-electron: ${name} ${vuln.range} — ${vuln.severity}`)
  for (const via of vuln.via) {
    if (typeof via === 'object') console.error(`    ${via.title} — ${via.url}`)
  }
}
process.exit(failed ? 1 : 0)
