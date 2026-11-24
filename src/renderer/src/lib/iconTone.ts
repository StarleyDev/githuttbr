/**
 * What an icon does, as far as its colour is concerned (Settings → Themes →
 * Icon colours). A role, not a hue: styles.css maps each one to a slot every
 * theme fills (`--purple`, `--green`, `--accent`, `--yellow`), so a theme that
 * repaints those slots repaints the icons with them.
 *
 * - `incoming` — what comes from a server: fetch, pull, remotes, worktrees.
 * - `outgoing` — what publishes or finishes something: push, todos, releases.
 * - `ref` — branches, tags, pull requests, submodules.
 * - `shelf` — what is set aside for later: stashes, bookmarks, pinned branches.
 * - `guard` — security: keys, credentials, the vault (`--red`).
 *
 * Menus and lists that group many entries (the Tools menu, the Settings pages)
 * give a whole group one tone, so a group reads as one family.
 *
 * An icon with no tone stays grey in every mode.
 */
export type IconTone = 'incoming' | 'outgoing' | 'ref' | 'shelf' | 'guard'

/** Give every entry of a menu group — submenus included — the group's tone,
 *  unless an entry names its own. */
export function withTone<T extends { tone?: IconTone; submenu?: T[] }>(tone: IconTone, items: T[]): T[] {
  return items.map((it) => ({
    ...it,
    tone: it.tone ?? tone,
    ...(it.submenu ? { submenu: withTone(tone, it.submenu) } : {})
  }))
}
