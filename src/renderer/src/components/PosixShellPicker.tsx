import { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores/settings'
import { useT, interp } from '../i18n'

// Settings values that name a Windows shell. The stored default is 'powershell',
// so on macOS/Linux they mean "system default" (main reads them the same way).
const WINDOWS_PRESETS = ['powershell', 'pwsh', 'cmd', 'gitbash', 'wsl']

/** The macOS/Linux terminal shell picker: the system shell ($SHELL, else the account's), every usable
 *  /etc/shells entry, or a custom path. Windows has its own preset list. */
export function PosixShellPicker(): React.JSX.Element {
  const value = useSettingsStore((s) => s.settings.terminalShell)
  const update = useSettingsStore((s) => s.update)
  const t = useT()
  const [info, setInfo] = useState<{ system: string; shells: string[] } | null>(null)
  // "Custom…" stays chosen while the path is still being typed — even when it
  // is empty, which on its own would read as the system default.
  const [custom, setCustom] = useState(false)

  useEffect(() => {
    let live = true
    window.api.term
      .shells()
      .then((r) => { if (live) setInfo(r) })
      .catch(() => undefined)
    return () => { live = false }
  }, [])

  const v = (value ?? '').trim()
  const isSystem = !v || v === 'system' || WINDOWS_PRESETS.includes(v)
  const shells = info?.shells ?? []
  // Until the list arrives, show a stored path as its own entry rather than flash "Custom…".
  const options = !isSystem && !info && !shells.includes(v) ? [...shells, v] : shells
  const selected = custom || (!isSystem && !options.includes(v)) ? 'custom' : isSystem ? 'system' : v

  return (
    <label className="settings-field terminal-shell-field">
      <span className="settings-field-label">{t('settings.terminalShell')}</span>
      <span className="settings-hint">{t('settings.terminalShellPosixHint')}</span>
      <select
        value={selected}
        onChange={(e) => {
          const next = e.target.value
          setCustom(next === 'custom')
          if (next !== 'custom') update((s) => ({ ...s, terminalShell: next }))
        }}
      >
        <option value="system">
          {info?.system
            ? interp(t('settings.terminalShellSystem'), { shell: info.system })
            : t('settings.terminalShellSystemPlain')}
        </option>
        {options.map((path) => (
          <option key={path} value={path}>
            {path}
          </option>
        ))}
        <option value="custom">{t('settings.terminalShellCustom')}</option>
      </select>
      {selected === 'custom' && (
        <input
          value={isSystem ? '' : value}
          spellCheck={false}
          placeholder={t('settings.terminalShellPosixPlaceholder')}
          onChange={(e) => update((s) => ({ ...s, terminalShell: e.target.value }))}
        />
      )}
    </label>
  )
}
