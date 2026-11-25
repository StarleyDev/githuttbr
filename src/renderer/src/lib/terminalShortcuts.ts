export type TerminalShortcutAction = 'toggle' | 'new' | 'close'

/**
 * Fixed terminal shortcuts. Toggle uses the physical Control key on every OS;
 * new/close use the app's usual Cmd-or-Ctrl modifier, but only while xterm owns
 * focus so they do not replace the workspace tab shortcuts elsewhere.
 */
export function terminalShortcutFromEvent(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
  terminalFocused: boolean
): TerminalShortcutAction | null {
  if (
    event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey &&
    (event.code === 'Backquote' || event.key === '`')
  ) {
    return 'toggle'
  }
  if (!terminalFocused || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 't') return 'new'
  if (key === 'w') return 'close'
  return null
}

interface TerminalGroupLike {
  id: string
  panels: { id: string }[]
  activePanelId: string
}

export interface TerminalCloseTarget {
  groupId: string
  panelId: string
  hidePanel: boolean
}

/** Resolve the focused xterm and whether removing it leaves no terminals. */
export function terminalCloseTarget(
  groups: readonly TerminalGroupLike[],
  activeGroupId: string | null
): TerminalCloseTarget | null {
  const group = groups.find((item) => item.id === activeGroupId)
  if (!group || !group.panels.some((panel) => panel.id === group.activePanelId)) return null
  const terminalCount = groups.reduce((count, item) => count + item.panels.length, 0)
  return {
    groupId: group.id,
    panelId: group.activePanelId,
    hidePanel: terminalCount === 1
  }
}

type ArrowDirection = 'Left' | 'Right' | 'Up' | 'Down'

const ARROWS: Record<string, ArrowDirection> = {
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down'
}
const arrowDirection = (name: string): ArrowDirection | null =>
  Object.hasOwn(ARROWS, name) ? ARROWS[name] : null

/**
 * What Alt+arrow sends to the shell. xterm 5 rewrote Alt+←/→ into word jumps
 * itself (ESC b / ESC f on macOS, Ctrl+arrow elsewhere) and Alt+↑/↓ into
 * Ctrl+arrow off macOS; xterm 6 dropped that and sends plain CSI 1;3 X, which
 * zsh, bash and PSReadLine leave unbound by default. Keep the old bytes so
 * word movement keeps working. Null means "let xterm handle the key".
 *
 * Rewritten in every buffer, exactly as xterm 5 did. The alternate screen is
 * not "programs that bind CSI 1;3 X": tmux lives there with no M-arrow
 * binding by default and forwards the bytes to the shell in its pane, which
 * prints `;3D`; vim maps the old CSI 1;5 D (<C-Left>, word back) and leaves
 * <M-Left> unmapped. The key is read before the code so a numpad arrow
 * (NumLock off: key ArrowLeft, code Numpad4) counts too; an IME composition
 * is never touched.
 */
export function altArrowSequence(
  event: Pick<
    KeyboardEvent,
    'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'isComposing' | 'keyCode'
  >,
  isMac: boolean
): string | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (event.isComposing || event.keyCode === 229) return null
  switch (arrowDirection(event.key) ?? arrowDirection(event.code)) {
    case 'Left':
      return isMac ? '\x1bb' : '\x1b[1;5D'
    case 'Right':
      return isMac ? '\x1bf' : '\x1b[1;5C'
    case 'Up':
      return isMac ? null : '\x1b[1;5A'
    case 'Down':
      return isMac ? null : '\x1b[1;5B'
    default:
      return null
  }
}

/**
 * Take a key away from everything else in the window. preventDefault alone
 * leaves the keydown bubbling to window listeners — the conflict resolver's
 * Alt+↑/↓ hunk jump, the custom shortcut table — so a key the terminal
 * answered would fire a second action outside it. xterm 5 stopped both.
 */
export function claimKeyEvent(event: Pick<Event, 'preventDefault' | 'stopPropagation'>): void {
  event.preventDefault()
  event.stopPropagation()
}
