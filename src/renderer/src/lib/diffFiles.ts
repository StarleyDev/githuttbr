// Split a multi-file unified diff (`git diff`, `git show`) into one entry per
// file, so a view can list the files and render only the one picked. Rendering
// a whole branch comparison as one DiffViewer is what made large ones
// unscrollable.

export type DiffFileStatus = 'A' | 'M' | 'D' | 'R' | 'C'

export interface DiffFile {
  /** Path after the change (before it, for a deletion). */
  path: string
  /** Path before a rename or copy; undefined otherwise. */
  oldPath?: string
  status: DiffFileStatus
  binary: boolean
  additions: number
  deletions: number
  /** This file's part of the diff, from its `diff --git` line on. */
  patch: string
}

const ESCAPES: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 }

/** Undo git's C-style path quoting (`"caf\303\251.txt"` → `café.txt`); a bare path is returned as is. */
export function unquoteGitPath(raw: string): string {
  if (!raw.startsWith('"') || !raw.endsWith('"') || raw.length < 2) return raw
  const body = raw.slice(1, -1)
  const bytes: number[] = []
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch !== '\\') {
      bytes.push(...new TextEncoder().encode(ch))
      continue
    }
    const next = body[i + 1] ?? ''
    const octal = /^[0-7]{3}/.exec(body.slice(i + 1))
    if (octal) {
      bytes.push(parseInt(octal[0], 8))
      i += 3
    } else if (next in ESCAPES) {
      bytes.push(ESCAPES[next])
      i += 1
    } else {
      bytes.push(92)
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

/** `a/x` → `x`; `/dev/null` → null. Quoting is undone first. */
function stripPrefix(raw: string): string | null {
  const p = unquoteGitPath(raw.trim())
  if (p === '/dev/null') return null
  return p.replace(/^[ab]\//, '')
}

/** The two paths of a `diff --git a/x b/y` line. Only used when no `---`/`+++`
 *  or rename line names the file (a binary or mode-only change), so the
 *  ambiguous unquoted-with-spaces case falls back to splitting in the middle. */
function headerPaths(line: string): { a: string; b: string } {
  const rest = line.slice('diff --git '.length)
  const quoted = /^("(?:[^"\\]|\\.)*"|\S+) ("(?:[^"\\]|\\.)*"|\S+)$/.exec(rest)
  if (quoted) return { a: stripPrefix(quoted[1]) ?? '', b: stripPrefix(quoted[2]) ?? '' }
  // Unquoted paths with spaces: `a/<p> b/<p>`, the same path twice.
  const half = (rest.length - 1) / 2
  if (Number.isInteger(half) && rest[half] === ' ') {
    return { a: stripPrefix(rest.slice(0, half)) ?? '', b: stripPrefix(rest.slice(half + 1)) ?? '' }
  }
  const at = rest.indexOf(' b/')
  return at < 0 ? { a: rest, b: rest } : { a: stripPrefix(rest.slice(0, at)) ?? '', b: stripPrefix(rest.slice(at + 1)) ?? '' }
}

export function splitDiffByFile(diff: string): DiffFile[] {
  const out: DiffFile[] = []
  const lines = diff.split('\n')
  let start = -1

  const close = (end: number): void => {
    if (start < 0) return
    const block = lines.slice(start, end)
    const header = headerPaths(block[0])
    let oldPath: string | null | undefined
    let newPath: string | null | undefined
    let renameFrom: string | undefined
    let renameTo: string | undefined
    let status: DiffFileStatus = 'M'
    let binary = false
    let additions = 0
    let deletions = 0
    let inHunk = false
    for (const line of block.slice(1)) {
      if (inHunk) {
        // Hunk bodies are prefixed, so nothing in here is a header.
        if (line.startsWith('+')) additions++
        else if (line.startsWith('-')) deletions++
        continue
      }
      if (line.startsWith('@@')) inHunk = true
      else if (line.startsWith('new file mode')) status = 'A'
      else if (line.startsWith('deleted file mode')) status = 'D'
      else if (line.startsWith('rename from ')) {
        status = 'R'
        renameFrom = unquoteGitPath(line.slice('rename from '.length))
      } else if (line.startsWith('rename to ')) renameTo = unquoteGitPath(line.slice('rename to '.length))
      else if (line.startsWith('copy from ')) {
        status = 'C'
        renameFrom = unquoteGitPath(line.slice('copy from '.length))
      } else if (line.startsWith('copy to ')) renameTo = unquoteGitPath(line.slice('copy to '.length))
      else if (line.startsWith('Binary files ') || line === 'GIT binary patch') binary = true
      else if (line.startsWith('--- ')) oldPath = stripPrefix(line.slice(4))
      else if (line.startsWith('+++ ')) newPath = stripPrefix(line.slice(4))
    }
    const path = renameTo ?? newPath ?? oldPath ?? (header.b || header.a)
    const before = renameFrom ?? (status === 'R' || status === 'C' ? header.a : undefined)
    out.push({
      path,
      ...(before && before !== path ? { oldPath: before } : {}),
      status,
      binary,
      additions,
      deletions,
      patch: block.join('\n').replace(/\n+$/, '')
    })
  }

  lines.forEach((line, i) => {
    if (line.startsWith('diff --git ')) {
      close(i)
      start = i
    }
  })
  close(lines.length)
  return out
}
