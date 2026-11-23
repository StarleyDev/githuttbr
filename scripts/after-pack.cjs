/**
 * electron-builder afterPack hook: flip Electron's fuses on the packaged binary.
 *
 * Fuses are bits compiled into the Electron executable that switch whole
 * features off before any JavaScript runs. A packaged Gitcito has no use for
 * the two that let anyone who can set an environment variable or a command
 * line run code inside a signed app:
 *
 * - NODE_OPTIONS (`--require evil.js`) — off.
 * - `--inspect` / `--inspect-brk` and friends, which open a debugger — off.
 *
 * Deliberately left alone:
 *
 * - RunAsNode stays ON. resources/cli/gitcito and gitcito-textconv run
 *   out/main/cliEntry.js / textconvCli.js through the app binary with
 *   ELECTRON_RUN_AS_NODE, and the test runner (main/testRunner.ts) does the
 *   same with process.execPath. Turning it off breaks every headless verb.
 * - Cookie encryption stays OFF. It keys the cookie store with the OS keychain
 *   at every launch, while Gitcito touches the keychain only after the user
 *   opts in (main/keychain.ts); the app keeps nothing of value in cookies.
 * - Embedded asar integrity / OnlyLoadAppFromAsar stay OFF. electron-builder 26
 *   writes the integrity record for macOS (Info.plist ElectronAsarIntegrity)
 *   and Windows (an exe resource) only; Electron has no Linux record at all, so
 *   on Linux the fuse would guard nothing. Turning it on for macOS/Windows
 *   needs a signed build on those platforms to prove the app still starts,
 *   which no local Linux build can show. OnlyLoadAppFromAsar alone buys little:
 *   whoever can drop a resources/app folder can rewrite app.asar just as well.
 *
 * electron-builder's own `electronFuses` option is not used: it flips fuses
 * with the @electron/fuses it bundles, while this hook pins the version in our
 * devDependencies and keeps the choice testable (test/packagingHardening.test.ts).
 *
 * Runs before signing (electron-builder signs after afterPack), so the signed
 * binary is the fused one. An unsigned macOS build is re-signed ad hoc, since
 * flipping a fuse invalidates the ad-hoc signature arm64 refuses to run without.
 */
const path = require('node:path')

/** The Electron executable (or, on macOS, the .app bundle) inside appOutDir. */
function electronBinary(context) {
  const { appOutDir, electronPlatformName, packager } = context
  const name = packager.appInfo.productFilename
  if (electronPlatformName === 'darwin' || electronPlatformName === 'mas') return path.join(appOutDir, `${name}.app`)
  if (electronPlatformName === 'win32') return path.join(appOutDir, `${name}.exe`)
  return path.join(appOutDir, packager.executableName)
}

/** Kept apart from the hook so the fuse choice can be read (and tested) on its own. */
async function fuseConfig() {
  const { FuseVersion, FuseV1Options } = await import('@electron/fuses')
  return {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false
  }
}

async function afterPack(context) {
  const { flipFuses } = await import('@electron/fuses')
  const darwin = context.electronPlatformName === 'darwin' || context.electronPlatformName === 'mas'
  await flipFuses(electronBinary(context), { ...(await fuseConfig()), resetAdHocDarwinSignature: darwin })
}

module.exports = afterPack
module.exports.default = afterPack
module.exports.fuseConfig = fuseConfig
