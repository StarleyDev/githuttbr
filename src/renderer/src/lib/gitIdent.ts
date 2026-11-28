/**
 * The identity lines of a raw commit or tag — `author`, `committer`, `tagger` —
 * as git stores them: `Name <email> 1764264060 -0300`. The object explorer
 * shows them as a person and a date rather than as an epoch and an offset.
 */

export interface GitIdent {
  name: string
  email: string
  /** Seconds since the epoch, as stored. */
  epoch: number
  /** The offset as stored, e.g. `-0300`. */
  tz: string
  /** The same offset in minutes east of UTC (-180 for `-0300`). */
  offsetMinutes: number
}

/** Parse `Name <email> epoch tz`; null when the line is not that shape. */
export function parseGitIdent(line: string): GitIdent | null {
  const match = /^(.*?)\s*<([^>]*)>\s+(-?\d+)\s+([+-])(\d{2})(\d{2})\s*$/.exec(line.trim())
  if (!match) return null
  const [, name, email, epoch, sign, hours, minutes] = match
  const offset = Number(hours) * 60 + Number(minutes)
  return {
    name,
    email,
    epoch: Number(epoch),
    tz: `${sign}${hours}${minutes}`,
    offsetMinutes: sign === '-' ? -offset : offset
  }
}

/** Author and committer are the same person at the same moment — the usual case. */
export function isSameIdent(a: GitIdent | null, b: GitIdent | null): boolean {
  return !!a && !!b && a.name === b.name && a.email === b.email && a.epoch === b.epoch && a.tz === b.tz
}

/**
 * The moment in the identity's own time zone — the wall clock the author saw —
 * formatted for `locale`, with the offset beside it (`−03:00`, a real minus).
 * The caller joins the two through a translated template.
 */
export function formatIdentDate(ident: GitIdent, locale: string): { date: string; zone: string } {
  const shifted = new Date((ident.epoch + ident.offsetMinutes * 60) * 1000)
  let date: string
  try {
    date = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    }).format(shifted)
  } catch {
    date = shifted.toISOString().slice(0, 16).replace('T', ' ')
  }
  const sign = ident.offsetMinutes < 0 ? '−' : '+'
  const abs = Math.abs(ident.offsetMinutes)
  const zone = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  return { date, zone }
}
