/** Split a full commit message into composer summary + body. */
export function splitCommitMessage(message: string): { summary: string; description: string } {
  const text = message.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '')
  const nl = text.indexOf('\n')
  if (nl < 0) return { summary: text, description: '' }
  return {
    summary: text.slice(0, nl).trimEnd(),
    description: text.slice(nl + 1).replace(/^\n+/, '').replace(/\n+$/, '')
  }
}

/**
 * The inverse of `splitCommitMessage`: the summary, a blank line, then the
 * body — or the summary alone when there is no body. Trailing whitespace goes,
 * and so do blank lines leading the body (the separator is written here), but
 * the body's own indentation stays: an indented first line can be a code block.
 */
export function joinCommitMessage(summary: string, description: string): string {
  const subject = summary.trim()
  const body = description
    .replace(/\r\n/g, '\n')
    .replace(/^(?:[ \t]*\n)+/, '')
    .trimEnd()
  return body ? `${subject}\n\n${body}` : subject
}
