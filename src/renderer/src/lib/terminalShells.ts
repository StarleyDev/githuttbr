/**
 * The shells a new terminal can open with, for the terminal panel's "New
 * terminal with…" menu and the Settings picker. Windows has fixed presets;
 * macOS and Linux list what main reads from /etc/shells. Pure, so the menu
 * only renders what this returns.
 */

/** Windows presets — main resolves each id to its executable. Proper nouns, not translated. */
export const WINDOWS_TERMINAL_SHELLS: { id: string; label: string }[] = [
  { id: 'powershell', label: 'PowerShell' }, // i18n-ignore proper noun
  { id: 'pwsh', label: 'PowerShell Core (pwsh)' }, // i18n-ignore proper noun
  { id: 'cmd', label: 'Command Prompt (cmd)' }, // i18n-ignore proper noun
  { id: 'gitbash', label: 'Git Bash' }, // i18n-ignore proper noun
  { id: 'wsl', label: 'WSL' } // i18n-ignore proper noun
]

export interface TerminalShellChoice {
  /** What `term:create` takes: a Windows preset id, 'system', or an absolute shell path. */
  value: string
  /** The shell's own name — `zsh`, `PowerShell`; null for the system default, which the caller words. */
  label: string | null
  /** The full path, shown beside the name when two shells share it (/bin/bash, /usr/local/bin/bash). */
  detail?: string
  /** The shell new terminals open with today (Settings → Layout & terminal). */
  isDefault: boolean
}

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/**
 * Every shell a new terminal could open with, the current default marked.
 * `setting` is Settings' `terminalShell`: '' or 'system' (and, on macOS/Linux,
 * a Windows preset left over from another machine) mean the system shell.
 */
export function terminalShellChoices(
  platform: string,
  setting: string | undefined,
  posix: { system: string; shells: string[] } | null
): TerminalShellChoice[] {
  const current = (setting ?? '').trim()
  if (platform === 'win32') {
    const chosen = WINDOWS_TERMINAL_SHELLS.some((s) => s.id === current) ? current : 'powershell'
    return WINDOWS_TERMINAL_SHELLS.map((s) => ({ value: s.id, label: s.label, isDefault: s.id === chosen }))
  }
  const usesSystem = !current || current === 'system' || WINDOWS_TERMINAL_SHELLS.some((s) => s.id === current)
  const shells = posix?.shells ?? []
  const names = shells.map(baseName)
  const choices: TerminalShellChoice[] = [{ value: 'system', label: null, isDefault: usesSystem }]
  for (const [i, path] of shells.entries()) {
    const name = names[i]
    const shared = names.filter((n) => n === name).length > 1
    choices.push({
      value: path,
      label: name,
      ...(shared ? { detail: path } : {}),
      isDefault: !usesSystem && path === current
    })
  }
  // A custom path from Settings that /etc/shells does not list still opens.
  if (!usesSystem && !shells.includes(current)) {
    choices.push({ value: current, label: baseName(current), detail: current, isDefault: true })
  }
  return choices
}
