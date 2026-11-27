/**
 * The part of a commit message below its subject, as the commit details panel
 * shows it: the description, and the trailers git keeps in the last paragraph
 * (`Co-authored-by:`, `Refs:`, `Signed-off-by:`) drawn as chips instead of
 * loose text. Pure, so the panel only renders what this returns.
 */

/** A `Key: value` line of the trailer block. */
export interface CommitTrailer {
  key: string
  value: string
}

export interface CommitBody {
  /** The description, trimmed, blank when the commit has none. */
  text: string
  trailers: CommitTrailer[]
}

/** git's trailer shape: a token without spaces, a colon, then the value. */
const TRAILER = /^([A-Za-z][A-Za-z0-9-]*):\s+(\S.*)$/

/** Keys git and the hosts write as trailers — enough on their own to count as a trailer block. */
const KNOWN_TRAILERS = new Set([
  'co-authored-by',
  'signed-off-by',
  'reviewed-by',
  'acked-by',
  'tested-by',
  'reported-by',
  'helped-by',
  'refs',
  'ref',
  'fixes',
  'closes',
  'resolves',
  'see-also',
  'change-id',
  'cherry-picked-from'
])


/**
 * Splits a full message (`git log --format=%B`) into the description and its
 * trailers. The subject is the first paragraph's first line, so a message
 * whose second line is not blank still keeps the rest as the description.
 * The last paragraph counts as trailers only when every one of its lines is
 * one, and either it follows a description or every key is a known trailer —
 * so a one-line description like "Why: duplicates" stays text.
 */
export function splitCommitBody(message: string): CommitBody {
  const lines = message.replace(/\r\n?/g, '\n').split('\n')
  const rest = lines.slice(1).join('\n').trim()
  if (!rest) return { text: '', trailers: [] }
  const paragraphs = rest.split(/\n[ \t]*\n/)
  const last = paragraphs[paragraphs.length - 1].split('\n').map((l) => l.trim())
  const trailerShaped = last.length > 0 && last.every((l) => TRAILER.test(l))
  const known = last.every((l) => KNOWN_TRAILERS.has((TRAILER.exec(l)?.[1] ?? '').toLowerCase()))
  const isTrailerBlock = trailerShaped && (paragraphs.length > 1 || known)
  if (!isTrailerBlock) return { text: rest, trailers: [] }
  const trailers = last.map((l) => {
    const m = TRAILER.exec(l) as RegExpExecArray
    return { key: m[1], value: m[2].trim() }
  })
  return { text: paragraphs.slice(0, -1).join('\n\n').trim(), trailers }
}


/** A list item, or a line indented as code or a quote: kept on its own line. */
const OWN_LINE = /^(\s*([-*+•]|\d+[.)])\s|\s{2,}|\t|>)/

/**
 * Commit messages are wrapped by hand at about 72 columns, which a narrow
 * panel turns into ragged half-lines. Lines of one paragraph are joined back
 * into one, so the panel wraps them at its own width; list items, indented
 * lines (code) and quotes keep their own lines, as written.
 */
export function reflowCommitBody(text: string): string {
  const out: string[] = []
  for (const line of text.split('\n')) {
    const previous = out.length ? out[out.length - 1] : ''
    const joins = line.trim() !== '' && previous.trim() !== '' && !OWN_LINE.test(line) && !OWN_LINE.test(previous)
    if (joins) out[out.length - 1] = `${previous.trimEnd()} ${line.trim()}`
    else out.push(line)
  }
  return out.join('\n')
}

/** Whether the trailer names a co-author — git's key, in any case. */
export function isCoAuthorTrailer(trailer: CommitTrailer): boolean {
  return trailer.key.toLowerCase() === 'co-authored-by'
}
