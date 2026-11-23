/**
 * The warning printed when Chromium's sandbox is off.
 *
 * electron-builder 26's AppImage launcher (AppRun) adds `--no-sandbox` by itself
 * whenever `unshare -Ur true` fails — on Ubuntu 24.04+, where AppArmor denies
 * unprivileged user namespaces to anything without a profile, that is every
 * AppImage launch. Nobody asked for it and nothing on screen says so, so the
 * least the app owes is a line in its log saying what it is running without.
 * Pure, for test/sandboxNotice.test.ts.
 */

type Env = Record<string, string | undefined>

export function sandboxNotice(noSandboxSwitch: boolean, env: Env = process.env): string | null {
  const disabledByEnv = !!env['ELECTRON_DISABLE_SANDBOX']
  if (!noSandboxSwitch && !disabledByEnv) return null
  const how = noSandboxSwitch ? '--no-sandbox' : 'ELECTRON_DISABLE_SANDBOX'
  const lines = [`[gitcito] warning: the Chromium sandbox is OFF (${how}).`]
  if (env['APPIMAGE']) {
    lines.push(
      '  The AppImage launcher adds --no-sandbox when unprivileged user namespaces are unavailable',
      '  (Ubuntu 24.04+ restricts them with AppArmor). To run sandboxed, install the .deb, which ships',
      '  an AppArmor profile, or allow user namespaces for this AppImage. See docs/help/security.md.'
    )
  }
  return lines.join('\n')
}
