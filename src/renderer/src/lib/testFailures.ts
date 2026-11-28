// The failed tests a CI log reports, read from the log's own text: vitest,
// jest and pytest each print a failure the same way every time, so the name,
// the first error line and where it happened can be picked out without the
// test runner's help. Anything else — another runner, a build error, a log cut
// short — yields nothing, and the caller shows the log alone.

export interface FailedTest {
  /** As the runner names it: `suite > test` (vitest), `suite › test` (jest), `Class::test` (pytest). */
  name: string
  /** The first line of the error, or null when the log does not show one. */
  error: string | null
  /** Where it failed, as the log writes it — often relative to the repository, sometimes absolute. */
  file: string | null
  line: number | null
}

/** More than this and the list stops being something to read: the log is there for the rest. */
const MAX_FAILURES = 20

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g
// GitHub Actions stamps every line of a downloaded log with its time.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/

/** The log as plain lines: colours, carriage returns and timestamps gone. */
export function getPlainLogLines(log: string): string[] {
  return log
    .replace(ANSI, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(TIMESTAMP, ''))
}

const ERROR_LINE = /^(?:[A-Z]\w*(?:Error|Exception)\b|Error\b|assert\b|expect\(|Expected\b)/
// `❯ src/a.test.ts:27:35` (vitest) or `at fn (src/a.test.ts:27:35)` / `at src/a.test.ts:27:35` (jest, node).
const VITEST_AT = /^\s*❯\s+(.+?):(\d+)(?::\d+)?\s*$/
const STACK_AT = /^\s*at\s+(?:.*?\()?((?:[A-Za-z]:)?[^\s():]+):(\d+)(?::\d+)?\)?\s*$/

function isOwnCode(file: string): boolean {
  return !file.includes('node_modules') && !file.startsWith('node:') && !file.startsWith('internal/')
}

/** The first location in `lines` that is the project's own code. */
function findLocation(lines: readonly string[]): { file: string; line: number } | null {
  for (const l of lines) {
    const m = VITEST_AT.exec(l) ?? STACK_AT.exec(l)
    if (m && isOwnCode(m[1])) return { file: m[1], line: Number(m[2]) }
  }
  return null
}

/** The error line: one that looks like an error, else the first line with any text. */
function findError(lines: readonly string[]): string | null {
  const texts = lines.map((l) => l.trim()).filter((l) => l && !VITEST_AT.test(l) && !STACK_AT.test(l))
  return texts.find((l) => ERROR_LINE.test(l)) ?? texts[0] ?? null
}

// ─── vitest ──────────────────────────────────────────────────────────────

// ` FAIL  src/cache.test.ts > cache > keeps the index` — the "Failed Tests" section.
const VITEST_FAIL = /^\s*FAIL\s+(\S+\.[cm]?[jt]sx?)\s+>\s+(.+?)\s*$/
const VITEST_SECTION_END = /^\s*(?:⎯{3,}|Test Files\s|Tests\s+\d|FAIL\s)/
// `✗ src/cache.test.ts (3 tests | 1 failed) 18ms` / `❯ src/cache.test.ts (3 tests | 1 failed)` — a file's line in the list.
const VITEST_FILE_ROW = /^\s*[✗×❯]\s+(\S+\.[cm]?[jt]sx?)\s+\(\d+ tests?/
// `   × keeps the index between requests 4ms` — a test's line under its file.
const VITEST_TEST_ROW = /^\s*[×✗]\s+(.+?)(?:\s+\d+(?:\.\d+)?\s?ms)?\s*$/

function parseVitestBlocks(lines: readonly string[]): FailedTest[] {
  const out: FailedTest[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = VITEST_FAIL.exec(lines[i])
    if (!m) continue
    let end = i + 1
    while (end < lines.length && !VITEST_SECTION_END.test(lines[end])) end++
    const body = lines.slice(i + 1, end)
    const at = findLocation(body)
    out.push({ name: m[2], error: findError(body), file: at?.file ?? m[1], line: at?.line ?? null })
  }
  return out
}

/** The reporter's tree, for a log without the "Failed Tests" section (cut short, or a terse reporter). */
function parseVitestRows(lines: readonly string[]): FailedTest[] {
  const out: FailedTest[] = []
  let file: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const row = VITEST_FILE_ROW.exec(lines[i])
    if (row) {
      file = row[1]
      continue
    }
    const test = VITEST_TEST_ROW.exec(lines[i])
    if (!test || !file) continue
    // The error and its location are indented under the test, up to the next row.
    const indent = lines[i].search(/\S/)
    let end = i + 1
    while (end < lines.length && end - i <= 12 && (lines[end].trim() === '' || lines[end].search(/\S/) > indent)) end++
    const body = lines.slice(i + 1, end)
    const at = findLocation(body)
    out.push({ name: test[1], error: body.length ? findError(body) : null, file: at?.file ?? file, line: at?.line ?? null })
  }
  return out
}

// ─── jest ────────────────────────────────────────────────────────────────

// `  ● cache › keeps the index between requests`
const JEST_BULLET = /^\s*●\s+(.+?)\s*$/
const JEST_FILE = /^\s*FAIL\s+(\S+\.[cm]?[jt]sx?)\s*$/
const JEST_BLOCK_END = /^\s*(?:●\s|FAIL\s|PASS\s|Test Suites:|Tests:)/

function parseJest(lines: readonly string[]): FailedTest[] {
  const out: FailedTest[] = []
  let file: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const header = JEST_FILE.exec(lines[i])
    if (header) {
      file = header[1]
      continue
    }
    const m = JEST_BULLET.exec(lines[i])
    // `● Console` is the captured console output, not a failure.
    if (!m || m[1] === 'Console') continue
    let end = i + 1
    while (end < lines.length && !JEST_BLOCK_END.test(lines[end])) end++
    // The code frame (`> 27 |   expect(…)`) is not the error, nor are its gutter lines.
    const body = lines.slice(i + 1, end).filter((l) => !/^\s*>?\s*\d+\s*\|/.test(l) && !/^\s*\|/.test(l))
    const at = findLocation(body)
    out.push({ name: m[1], error: findError(body), file: at?.file ?? file, line: at?.line ?? null })
  }
  return out
}

// ─── pytest ──────────────────────────────────────────────────────────────

// `FAILED tests/test_cache.py::TestCache::test_keeps - assert 2 == 1`
const PYTEST_SUMMARY = /^(?:FAILED|ERROR)\s+([^\s:]+\.py)::(\S+?)(?:\s+-\s+(.*))?\s*$/
// `_____________ TestCache.test_keeps _____________`
const PYTEST_HEADER = /^_{3,}\s+(?:ERROR at \w+ of\s+)?(.+?)\s+_{3,}\s*$/
// `tests/test_cache.py:27: AssertionError`
const PYTEST_AT = /^([^\s:]+\.py):(\d+):\s+\w+/
const PYTEST_SECTION = /^={3,}/

interface PytestBlock {
  name: string
  error: string | null
  locations: { file: string; line: number }[]
}

function parsePytestBlocks(lines: readonly string[]): PytestBlock[] {
  const out: PytestBlock[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = PYTEST_HEADER.exec(lines[i])
    if (!m) continue
    let end = i + 1
    while (end < lines.length && !PYTEST_HEADER.test(lines[end]) && !PYTEST_SECTION.test(lines[end])) end++
    const body = lines.slice(i + 1, end)
    const e = body.find((l) => /^E\s/.test(l))
    const locations = body.flatMap((l) => {
      const at = PYTEST_AT.exec(l)
      return at ? [{ file: at[1], line: Number(at[2]) }] : []
    })
    out.push({ name: m[1], error: e ? e.replace(/^E\s+/, '').trim() : null, locations })
  }
  return out
}

function parsePytest(lines: readonly string[]): FailedTest[] {
  // Pytest's own marker: without it, `FAILED x.py::y` is too loose to trust alone.
  if (!lines.some((l) => /^={3,} (?:FAILURES|ERRORS|short test summary info|.*\bfailed\b.*) =+/.test(l))) return []
  const blocks = parsePytestBlocks(lines)
  const summary = lines.flatMap((l) => {
    const m = PYTEST_SUMMARY.exec(l)
    return m ? [{ file: m[1], name: m[2], error: m[3]?.trim() || null }] : []
  })
  if (summary.length === 0) {
    return blocks.map((b) => {
      const at = b.locations[b.locations.length - 1]
      return { name: b.name, error: b.error, file: at?.file ?? null, line: at?.line ?? null }
    })
  }
  return summary.map((s) => {
    // The block's header writes `Class.test` where the summary writes `Class::test`.
    const block = blocks.find((b) => b.name === s.name.replace(/::/g, '.') || b.name === s.name)
    // The test's own line in its file, else the last frame — where it raised.
    const at = block?.locations.find((l) => l.file === s.file) ?? block?.locations[block.locations.length - 1]
    return { name: s.name, error: s.error ?? block?.error ?? null, file: at?.file ?? s.file, line: at?.line ?? null }
  })
}

// ─── together ────────────────────────────────────────────────────────────

/**
 * The failed tests a log reports, in the order it reports them. Empty when it
 * names none the parser recognises — the caller then shows only the log.
 */
export function getFailedTests(log: string): FailedTest[] {
  const lines = getPlainLogLines(log)
  const found =
    [parsePytest, parseJest, parseVitestBlocks, parseVitestRows]
      .map((parse) => parse(lines))
      .find((list) => list.length > 0) ?? []
  // A runner that prints a failure twice (a retry, a summary) lists it once.
  const seen = new Set<string>()
  return found
    .filter((f) => {
      const key = `${f.file ?? ''}\u0000${f.name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_FAILURES)
}

// Where CI hosts check a repository out: the runner's path, not the user's.
const WORKSPACE_PREFIXES = [
  /^\/home\/runner\/work\/[^/]+\/[^/]+\//, // GitHub Actions (Linux)
  /^\/Users\/runner\/work\/[^/]+\/[^/]+\//, // GitHub Actions (macOS)
  /^[A-Za-z]:\/a\/[^/]+\/[^/]+\//, // GitHub Actions (Windows)
  /^\/home\/vsts\/work\/\d+\/s\//, // Azure Pipelines
  /^[A-Za-z]:\/a\/\d+\/s\//, // Azure Pipelines (Windows)
  /^\/workspace\/[^/]+\/[^/]+\// // Forgejo / act runner
]

/**
 * A log's path as a path inside the repository, or null when it cannot be
 * placed there (an absolute path on the runner nothing here recognises). The
 * pull request's own files are tried first: a path that ends in one of them
 * is that file, whatever the runner's checkout was called.
 */
export function getRepoRelativePath(path: string, knownFiles: readonly string[] = []): string | null {
  const p = path.replace(/\\/g, '/').replace(/^\.\//, '')
  if (knownFiles.includes(p)) return p
  const known = knownFiles.find((f) => p.endsWith('/' + f))
  if (known) return known
  for (const prefix of WORKSPACE_PREFIXES) {
    if (prefix.test(p)) return p.replace(prefix, '')
  }
  if (p.startsWith('/') || /^[A-Za-z]:\//.test(p)) return null
  // A relative path that climbs out of the checkout is not a file in it.
  return p.split('/').includes('..') ? null : p
}

/** A line worth marking in the log: one that says a test or the job failed. */
export function isFailureLine(plain: string): boolean {
  return /^\s*(?:[✗×✕✘]\s|●\s(?!Console)|FAIL\b|FAILED\b|ERROR\s+\S+\.py::|E\s{2,}\S|##\[error\])/.test(plain)
}
