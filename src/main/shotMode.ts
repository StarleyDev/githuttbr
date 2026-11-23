/**
 * Screenshot mode (`--shot`): the capture harness and the e2e suite launch the
 * built app with it to get the renderer store bridge, a fake `~/.ssh`
 * (GITCITO_SSH_DIR), a fake device SDK tree (GITCITO_DEVICE_BIN) and no GitHub
 * calls. Every one of those lets a command line or an environment variable
 * redirect the app, which is fine for automation and wrong for an installed
 * app — so it is honoured only when unpackaged (`electron out/main/index.js`,
 * which is exactly how the harness runs it). A packaged build ignores `--shot`.
 *
 * Decided once at startup by index.ts; until then, and in plain-Node tests
 * where there is no Electron app, it is off.
 */
let enabled = false

export function initShotMode(isPackaged: boolean, argv: readonly string[]): boolean {
  enabled = !isPackaged && argv.includes('--shot')
  return enabled
}

export function isShotMode(): boolean {
  return enabled
}
