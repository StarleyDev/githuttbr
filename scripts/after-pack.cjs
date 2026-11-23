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
 * - RunAsNode stays ON. resources/cli/githuttbr and githuttbr-textconv run
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

/**
 * Where the bundled CLI shims are told to find the app executable.
 *
 * resources/cli/githuttbr and githuttbr-textconv run the app binary with
 * ELECTRON_RUN_AS_NODE, and its name differs per platform — the product name on
 * macOS and Windows, the package's executableName on Linux. Guessing it in shell
 * is how the shims ended up looking for a MacOS/Gitcito that never existed, so
 * the build writes the answer next to them: `cli/app-binary`, one line, the
 * executable relative to the resources directory.
 *
 * @returns {{ resources: string, relative: string }}
 */
function cliAppBinary(context) {
  const { appOutDir, electronPlatformName, packager } = context
  const name = packager.appInfo.productFilename
  if (electronPlatformName === 'darwin' || electronPlatformName === 'mas') {
    // <name>.app/Contents/Resources → ../MacOS/<CFBundleExecutable>, which
    // electron-builder sets to the product filename.
    return { resources: path.join(appOutDir, `${name}.app`, 'Contents', 'Resources'), relative: `../MacOS/${name}` }
  }
  if (electronPlatformName === 'win32') return { resources: path.join(appOutDir, 'resources'), relative: `../${name}.exe` }
  return { resources: path.join(appOutDir, 'resources'), relative: `../${packager.executableName}` }
}

async function writeCliAppBinary(context) {
  const fs = require('node:fs/promises')
  const { resources, relative } = cliAppBinary(context)
  const cliDir = path.join(resources, 'cli')
  // No cli/ (extraResources changed) is a broken build, not something to paper over.
  await fs.access(path.join(cliDir, 'githuttbr'))
  await fs.access(path.join(resources, relative))
  await fs.writeFile(path.join(cliDir, 'app-binary'), `${relative}\n`, { mode: 0o644 })
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
  // Before signing, like the fuses: the file is part of the sealed bundle.
  await writeCliAppBinary(context)
}

module.exports = afterPack
module.exports.default = afterPack
module.exports.fuseConfig = fuseConfig
module.exports.cliAppBinary = cliAppBinary
module.exports.writeCliAppBinary = writeCliAppBinary
