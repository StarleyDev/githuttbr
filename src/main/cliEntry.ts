/**
 * The headless half of the `githuttbr` command.
 *
 * `resources/cli/githuttbr` sends a verb here — `doctor`, `status`, `repos`,
 * `commit-check`, `config`, `editor`, `completions` — when the answer belongs
 * in the terminal rather than in a window. The shim runs this file through the
 * app binary with `ELECTRON_RUN_AS_NODE`, i.e. as plain Node: **nothing
 * imported from here may touch electron**, or the command turns into a second
 * app instance that the single-instance lock immediately kills.
 *
 * The contract with a caller is git's contract: text on stdout, diagnostics on
 * stderr, and an exit code that means something. `githuttbr doctor` in a CI job
 * is the whole point — the guard rails a repository declares in `.githuttbr.json`
 * (or upstream's `.gitcito.json`)
 * are worth little if only the person with the GUI open ever sees them.
 */

// First import: the same environment repair as the app (see hardenEnv.ts) —
// these verbs run git inside repositories too.
import './hardenEnv'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve, isAbsolute } from 'node:path'
import { homedir } from 'node:os'
import { REPO_CONFIG_FILE, isRepoConfigEmpty, parseRepoConfig, serializeRepoConfig } from '../shared/repoConfig'
import { knownRepos, matchesRepo, resolveRepo } from '../shared/cliRepos'
import {
  findRepoConfigFile,
  readRepoConfig,
  runRepoDoctor,
  applyDoctorFix,
  suggestRepoConfig
} from './repoConfig'
import { checkCommitMessage, type CommitCheckIssue } from '../shared/commitCheck'
import type { DoctorCheck, RepoConfig } from '../shared/types'
import { PRODUCT_NAME } from '../shared/brand'
import { APP_REPO_URL } from '../shared/appRepo'
import { APP_NAME, SETTINGS_FILE, appDataDir } from './appIdentity'
import { EDITOR_KEYS, EDITOR_VALUE, editorFixCommand, isLegacyEditor } from './legacyShims'

const pexecFile = promisify(execFile)

// ─── Terminal output ────────────────────────────────────────────────────────

// Colour only when someone is actually looking. Piped into a file, a log
// collector or `grep`, escape codes are noise at best and corruption at worst.
const tty = process.stdout.isTTY === true && !process.env.NO_COLOR
const paint = (code: string, s: string): string => (tty ? `\u001b[${code}m${s}\u001b[0m` : s)
const bold = (s: string): string => paint('1', s)
const dim = (s: string): string => paint('2', s)
const red = (s: string): string => paint('31', s)
const green = (s: string): string => paint('32', s)
const yellow = (s: string): string => paint('33', s)
const cyan = (s: string): string => paint('36', s)

const out = (line = ''): void => {
  process.stdout.write(`${line}\n`)
}
const err = (line: string): void => {
  process.stderr.write(`${line}\n`)
}

const OK = green('✓')
const WARN = yellow('!')
const FAIL = red('✗')

// ─── Repository resolution ──────────────────────────────────────────────────

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await pexecFile('git', args, { cwd, timeout: 20_000, maxBuffer: 8 * 1024 * 1024 })
  return stdout.trim()
}

const gitOr = (cwd: string, args: string[], fallback = ''): Promise<string> =>
  git(cwd, args).catch(() => fallback)

/** The repository containing `dir` (default: cwd). Resolving to the top level
 *  rather than accepting the cwd verbatim is what lets every verb be run from a
 *  subdirectory, the way git itself can. */
async function repoRoot(dir?: string): Promise<string> {
  const start = resolve(dir ?? process.cwd())
  if (!existsSync(start)) {
    err(`githuttbr: no such directory: ${start}`)
    process.exit(2)
  }
  const top = await gitOr(start, ['rev-parse', '--show-toplevel'])
  if (!top) {
    err(`githuttbr: not a git repository: ${start}`)
    process.exit(2)
  }
  return top
}

// ─── Flags ──────────────────────────────────────────────────────────────────

interface Args {
  /** Positional arguments, in order, with flags removed. */
  rest: string[]
  has(flag: string): boolean
  value(flag: string): string | undefined
}

/** A deliberately small parser: long flags, `--flag` or `--flag=value`, plus a
 *  handful of single-letter aliases. Everything else is positional. */
function parseArgs(argv: string[], aliases: Record<string, string> = {}): Args {
  const flags = new Map<string, string | true>()
  const rest: string[] = []
  for (const token of argv) {
    if (token.startsWith('--')) {
      const eq = token.indexOf('=')
      if (eq === -1) flags.set(token.slice(2), true)
      else flags.set(token.slice(2, eq), token.slice(eq + 1))
    } else if (token.startsWith('-') && token.length > 1 && aliases[token.slice(1)]) {
      flags.set(aliases[token.slice(1)], true)
    } else {
      rest.push(token)
    }
  }
  return {
    rest,
    has: (flag) => flags.has(flag),
    value: (flag) => {
      const v = flags.get(flag)
      return typeof v === 'string' ? v : undefined
    }
  }
}

// ─── githuttbr doctor ─────────────────────────────────────────────────────────

function doctorLine(check: DoctorCheck): string {
  const mark = check.status === 'ok' ? OK : check.status === 'warn' ? WARN : FAIL
  const want = check.expected ? dim(` wants ${check.expected}`) : ''
  const got = check.actual ? dim(` · found ${check.actual}`) : check.status === 'ok' ? '' : dim(' · missing')
  return `  ${mark} ${bold(check.id)}${want}${got}`
}

interface StaleEditor {
  key: string
  scope: 'global' | 'local'
  value: string
}

/** `core.editor` / `sequence.editor` still running the pre-4.39 `gitcito --wait`, where they are set. */
async function staleEditorSettings(root: string): Promise<StaleEditor[]> {
  const found: StaleEditor[] = []
  for (const scope of ['local', 'global'] as const) {
    for (const key of EDITOR_KEYS) {
      const value = await gitOr(root, ['config', `--${scope}`, '--get', key])
      if (value && isLegacyEditor(value)) found.push({ key, scope, value })
    }
  }
  return found
}

/**
 * A stale editor setting makes every `git commit` fail with "command not
 * found" — worth a line whatever the repository config asks for. A warning,
 * not a failure: it is the user's git config, not the repository's state.
 */
async function reportStaleEditors(root: string, fix: boolean): Promise<void> {
  const stale = await staleEditorSettings(root)
  if (!stale.length) return
  for (const s of stale) {
    if (fix) {
      try {
        await git(root, ['config', `--${s.scope}`, s.key, EDITOR_VALUE])
        out(`  ${OK} fixed ${bold(s.key)} ${dim(`(${s.scope})`)}`)
        continue
      } catch (e) {
        out(`  ${FAIL} could not fix ${bold(s.key)}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    out(`  ${WARN} ${bold(s.key)} ${dim(`(${s.scope}) runs the old command · found ${s.value}`)}`)
    out(`      ${dim('Fix:')} ${editorFixCommand(s.key, s.scope)}`)
  }
  out()
}

async function cmdDoctor(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  const root = await repoRoot(args.rest[0])
  await reportStaleEditors(root, args.has('fix'))
  const { config, path } = await readRepoConfig(root)
  if (!config?.requires) {
    out(`${dim('No requirements declared in')} ${basename(path)}${dim('.')}`)
    out(dim(`Run \`githuttbr config init\` to propose one from what this repository already contains.`))
    return 0
  }

  let checks = await runRepoDoctor(root)
  if (args.has('fix')) {
    for (const check of checks) {
      if (check.status === 'ok' || !check.fix) continue
      try {
        await applyDoctorFix(root, check.fix)
        out(`  ${OK} fixed ${bold(check.id)}`)
      } catch (e) {
        out(`  ${FAIL} could not fix ${bold(check.id)}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    checks = await runRepoDoctor(root)
  }

  out(`${bold(`Doctor · ${root}`)} ${dim(`(${basename(path)})`)}`)
  for (const check of checks) {
    out(doctorLine(check))
    if (check.why) out(`      ${dim(check.why)}`)
  }
  const failed = checks.filter((c) => c.status === 'fail')
  const warned = checks.filter((c) => c.status === 'warn')
  out()
  if (!failed.length && !warned.length) out(`${OK} ${checks.length} check${checks.length === 1 ? '' : 's'} passed.`)
  else out(`${failed.length} failing, ${warned.length} warning, ${checks.length} total.`)
  // Warnings are things the doctor could not determine, not things that are
  // wrong — failing a build on them would make the file too costly to adopt.
  return failed.length ? 1 : 0
}

// ─── githuttbr status ─────────────────────────────────────────────────────────

interface StatusCounts {
  staged: number
  unstaged: number
  untracked: number
  conflicted: number
}

function countPorcelain(porcelain: string): StatusCounts {
  const counts: StatusCounts = { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 }
  for (const line of porcelain.split('\n')) {
    if (!line) continue
    const x = line[0]
    const y = line[1]
    if (x === '?') counts.untracked++
    else if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) counts.conflicted++
    else {
      if (x !== ' ') counts.staged++
      if (y !== ' ') counts.unstaged++
    }
  }
  return counts
}

async function cmdStatus(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  const root = await repoRoot(args.rest[0])
  const [branch, upstream, porcelain, stashes, lastCommit] = await Promise.all([
    gitOr(root, ['rev-parse', '--abbrev-ref', 'HEAD'], 'HEAD'),
    gitOr(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']),
    gitOr(root, ['status', '--porcelain']),
    gitOr(root, ['stash', 'list']),
    gitOr(root, ['log', '-1', '--format=%h %s %cr'])
  ])
  const counts = countPorcelain(porcelain)
  const ahead = upstream ? await gitOr(root, ['rev-list', '--count', `${upstream}..HEAD`], '0') : '0'
  const behind = upstream ? await gitOr(root, ['rev-list', '--count', `HEAD..${upstream}`], '0') : '0'
  const { config, path: configPath } = await readRepoConfig(root)

  const tracking = upstream
    ? `${dim('→')} ${upstream}${Number(ahead) ? ` ${green(`↑${ahead}`)}` : ''}${Number(behind) ? ` ${yellow(`↓${behind}`)}` : ''}`
    : dim('no upstream')

  out(`${bold(root.split('/').pop() ?? root)}  ${dim(root)}`)
  out(`  ${cyan(branch)} ${tracking}`)
  if (lastCommit) out(`  ${dim(lastCommit)}`)

  const parts: string[] = []
  if (counts.conflicted) parts.push(red(`${counts.conflicted} conflicted`))
  if (counts.staged) parts.push(green(`${counts.staged} staged`))
  if (counts.unstaged) parts.push(yellow(`${counts.unstaged} modified`))
  if (counts.untracked) parts.push(dim(`${counts.untracked} untracked`))
  const stashCount = stashes ? stashes.split('\n').filter(Boolean).length : 0
  if (stashCount) parts.push(dim(`${stashCount} stashed`))
  out(`  ${parts.length ? parts.join(dim(' · ')) : green('clean')}`)

  if (config) {
    const protectedHere = (config.protect ?? []).some((p) => branchMatchesGlob(p, branch))
    if (protectedHere) out(`  ${WARN} ${branch} is protected by ${basename(configPath)}`)
    const checklist = config.checklist?.push ?? []
    if (checklist.length) {
      out()
      out(bold('Before you push'))
      for (const item of checklist) out(`  ${dim('•')} ${item}`)
    }
  }
  return counts.conflicted ? 1 : 0
}

/** `protect` entries are globs, matched the way the app matches them. Local to
 *  this module so the headless path does not import the shared regex builder's
 *  UI-facing neighbours. */
function branchMatchesGlob(pattern: string, branch: string): boolean {
  if (!pattern.includes('*')) return pattern === branch
  const rx = new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
  return rx.test(branch)
}

// ─── githuttbr commit-check ───────────────────────────────────────────────────

async function cmdCommitCheck(argv: string[]): Promise<number> {
  // `-m "text"` reads better in a shell than `--message=text`, and a hook is
  // handed a file path, so both shapes have to work.
  const inlineIdx = argv.findIndex((a) => a === '-m' || a === '--message')
  const args = parseArgs(argv.filter((_, i) => inlineIdx < 0 || (i !== inlineIdx && i !== inlineIdx + 1)))
  const inline = inlineIdx >= 0 ? argv[inlineIdx + 1] : args.value('message')
  const positional = args.rest

  const cwd = process.cwd()
  const root = await repoRoot(args.value('repo'))
  let raw: string
  if (inline !== undefined) {
    raw = inline
  } else {
    const file = positional[0] ?? join(root, '.git', 'COMMIT_EDITMSG')
    const path = isAbsolute(file) ? file : resolve(cwd, file)
    raw = await readFile(path, 'utf8').catch(() => '')
    if (!raw) {
      err(`githuttbr: nothing to check — no message given and ${path} is empty`)
      return 2
    }
  }

  const { config } = await readRepoConfig(root)
  const branch = await gitOr(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const issues = checkCommitMessage(raw, { config, branch })
  return reportCommitIssues(issues)
}

function reportCommitIssues(issues: CommitCheckIssue[]): number {
  if (!issues.length) {
    out(`${OK} Commit message looks good.`)
    return 0
  }
  for (const issue of issues) {
    const mark = issue.level === 'error' ? FAIL : WARN
    out(`  ${mark} ${issue.message} ${dim(`(${issue.code})`)}`)
  }
  const errors = issues.filter((i) => i.level === 'error').length
  return errors ? 1 : 0
}

// ─── githuttbr config ─────────────────────────────────────────────────────────

async function cmdConfig(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  const [sub, dir] = args.rest
  const root = await repoRoot(dir)
  // Read from whichever file the repository has — upstream's `.gitcito.json`
  // counts — and name that one; `init` only ever writes `.githuttbr.json`.
  const found = await findRepoConfigFile(root)
  const name = found ? basename(found.path) : REPO_CONFIG_FILE

  switch (sub) {
    case undefined:
    case 'show': {
      if (!found?.raw) {
        out(dim(`No ${REPO_CONFIG_FILE} in ${root}.`))
        return 0
      }
      // The name on stderr: stdout stays the file, fit to pipe back into one.
      err(dim(`${name} in ${root}`))
      out(found.raw.trimEnd())
      return 0
    }
    case 'check': {
      if (!found?.raw) {
        err(`githuttbr: no ${REPO_CONFIG_FILE} in ${root}`)
        return 2
      }
      const { config, issues } = parseRepoConfig(found.raw)
      if (!config) {
        out(`${FAIL} ${name} could not be read as a v1 config.`)
        for (const i of issues) out(`  ${FAIL} ${i.field}: ${i.code}`)
        return 1
      }
      for (const i of issues) out(`  ${WARN} ${i.field}: ${i.code} ${dim('(dropped)')}`)
      out(issues.length ? `${WARN} ${issues.length} field(s) dropped; the rest applies.` : `${OK} ${name} is valid.`)
      return 0
    }
    case 'init': {
      // A legacy file counts as existing: a new `.githuttbr.json` would shadow
      // its rules, which is an overwrite in effect if not on disk.
      if (found && !args.has('force')) {
        err(`githuttbr: ${name} already exists — pass --force to overwrite`)
        return 2
      }
      const suggested = await suggestRepoConfig(root)
      if (isRepoConfigEmpty(suggested)) {
        out(dim('Nothing to propose: no .nvmrc, submodules, LFS, hooks path or consistent commit scopes found.'))
        return 0
      }
      const text = serializeRepoConfig(suggested)
      if (args.has('dry-run')) {
        out(text)
        return 0
      }
      await writeFile(join(root, REPO_CONFIG_FILE), text, 'utf8')
      out(`${OK} Wrote ${REPO_CONFIG_FILE}`)
      if (found && name !== REPO_CONFIG_FILE) {
        out(dim(`${name} is left as it was; this app reads ${REPO_CONFIG_FILE} from now on.`))
      }
      out(dim('Review it before committing — it becomes every teammate’s rules.'))
      summarizeConfig(suggested)
      return 0
    }
    default:
      err(`githuttbr config: unknown subcommand "${sub}" (expected init, show or check)`)
      return 2
  }
}

function summarizeConfig(config: RepoConfig): void {
  if (config.protect?.length) out(`  ${dim('protect')} ${config.protect.join(', ')}`)
  if (config.requires?.node) out(`  ${dim('node')} ${config.requires.node}`)
  if (config.commit?.scopes?.length) out(`  ${dim('scopes')} ${config.commit.scopes.join(', ')}`)
}

// ─── githuttbr repos ──────────────────────────────────────────────────────────

/** Where the desktop app keeps its settings, per platform. Mirrors Electron's
 *  own `app.getPath('userData')` — which is unavailable here, because importing
 *  electron is exactly what this entry point may not do. */
function userDataDir(): string {
  return join(appDataDir(homedir()), APP_NAME)
}

function readSettings(): unknown {
  const file = join(userDataDir(), SETTINGS_FILE)
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

async function cmdRepos(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  const repos = knownRepos(readSettings())
  if (!repos.length) {
    out(dim(`No repositories yet — open one in ${PRODUCT_NAME}, or run \`githuttbr .\` in a checkout.`))
    return 0
  }
  const filter = args.rest[0]?.toLowerCase()
  const shown = filter ? repos.filter((r) => matchesRepo(r, filter)) : repos
  if (args.has('paths')) {
    // Machine-readable, for `cd "$(githuttbr repos --paths api | head -1)"`.
    for (const repo of shown) out(repo.path)
    return shown.length ? 0 : 1
  }
  // Pad name and group separately: the paths only line up if the two columns
  // before them are each fixed width.
  const nameWidth = Math.max(...shown.map((r) => r.name.length), 0)
  const groupWidth = Math.max(...shown.map((r) => (r.group ? r.group.length + 2 : 0)), 0)
  for (const repo of shown) {
    const group = (repo.group ? `[${repo.group}]` : '').padEnd(groupWidth)
    out(`  ${bold(repo.name.padEnd(nameWidth))}  ${dim(group)}  ${dim(repo.path)}`)
  }
  return shown.length ? 0 : 1
}

/** Resolve `githuttbr open <name>` against the known repositories. Exported for
 *  the shim's `--resolve` mode, which needs the path before it can call `open`. */
async function cmdResolve(argv: string[]): Promise<number> {
  const needle = argv[0]?.toLowerCase()
  if (!needle) return 2
  const hit = resolveRepo(knownRepos(readSettings()), needle)
  if (!hit) return 1
  out(hit.path)
  return 0
}

// ─── githuttbr editor ─────────────────────────────────────────────────────────

/** Wire (or unwire) Gitcito as git's message editor. `--wait` is what makes it
 *  usable there: git blocks until the file comes back, so the command has to
 *  block too. */
async function cmdEditor(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  const scope = args.has('local') ? '--local' : '--global'
  const cwd = args.has('local') ? await repoRoot() : process.cwd()
  const sub = args.rest[0] ?? 'install'

  const set = async (key: string, value?: string): Promise<void> => {
    if (value === undefined) await pexecFile('git', ['config', scope, '--unset', key], { cwd }).catch(() => undefined)
    else await pexecFile('git', ['config', scope, key, value], { cwd })
  }

  if (sub === 'uninstall') {
    await set('core.editor')
    await set('sequence.editor')
    out(`${OK} ${PRODUCT_NAME} is no longer git’s editor (${scope.slice(2)}).`)
    return 0
  }
  if (sub !== 'install') {
    err(`githuttbr editor: unknown subcommand "${sub}" (expected install or uninstall)`)
    return 2
  }
  for (const key of EDITOR_KEYS) await set(key, EDITOR_VALUE)
  out(`${OK} git will now open commit messages and rebase todos in ${PRODUCT_NAME} (${scope.slice(2)}).`)
  out(dim('Undo with `githuttbr editor uninstall`.'))
  return 0
}

// ─── githuttbr completions ────────────────────────────────────────────────────

const HEADLESS_VERBS = ['doctor', 'status', 'repos', 'commit-check', 'config', 'editor', 'completions', 'help']
const WINDOW_VERBS = [
  'open',
  'diff',
  'graph',
  'blame',
  'show',
  'search',
  'conflicts',
  'stack',
  'stash',
  'reflog',
  'todos',
  'chat',
  'settings',
  'terminal',
  'insights',
  'history',
  'ci',
  'clean',
  'bisect',
  'absorb',
  'snapshots',
  'timelapse',
  'time-machine',
  'maintenance',
  'export',
  'objects',
  'hooks',
  'lfs',
  'sparse',
  'subtree',
  'gitflow',
  'purge',
  'changelog'
]
const ALL_VERBS = [...HEADLESS_VERBS, ...WINDOW_VERBS].sort()

function completions(shell: string): number {
  const verbs = ALL_VERBS.join(' ')
  switch (shell) {
    case 'bash':
      out(`# githuttbr bash completion — add to ~/.bashrc:
#   eval "$(githuttbr completions bash)"
_githuttbr() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "\$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( \$(compgen -W "${verbs}" -- "\$cur") )
  else
    COMPREPLY=( \$(compgen -d -- "\$cur") )
  fi
}
complete -F _githuttbr githuttbr`)
      return 0
    case 'zsh':
      out(`# githuttbr zsh completion — add to ~/.zshrc:
#   eval "$(githuttbr completions zsh)"
_githuttbr() {
  if (( CURRENT == 2 )); then
    compadd ${verbs}
  else
    _files -/
  fi
}
compdef _githuttbr githuttbr`)
      return 0
    case 'fish':
      out(`# githuttbr fish completion — write to ~/.config/fish/completions/githuttbr.fish:
#   githuttbr completions fish > ~/.config/fish/completions/githuttbr.fish
complete -c githuttbr -f
complete -c githuttbr -n "__fish_use_subcommand" -a "${verbs}"
complete -c githuttbr -n "not __fish_use_subcommand" -a "(__fish_complete_directories)"`)
      return 0
    default:
      err('githuttbr completions: expected bash, zsh or fish')
      return 2
  }
}

// ─── Help & version ─────────────────────────────────────────────────────────

function appVersion(): string {
  // Inside the packaged app this resolves within app.asar; in a source checkout
  // it lands on the repository's own package.json. Both sit two levels above
  // the built `out/main/` file.
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function usage(): void {
  const h = (s: string): string => bold(s)
  out(`${h('githuttbr')} — ${PRODUCT_NAME} from the command line

${h('OPEN')}
  githuttbr [path]                 Open a repository (default: the current directory)
  githuttbr open <name|path>       Open by tab name — \`githuttbr open api\` finds it
  githuttbr [path] -n <name>       …with a display name
  githuttbr [path] -g <group>      …inside a group tab

${h('JUMP STRAIGHT TO A SURFACE')}
  githuttbr diff [path]            Working changes
  githuttbr graph [path]           The commit graph
  githuttbr show <ref>             One commit, in detail
  githuttbr blame <file> [-l N]    Blame, scrolled to a line
  githuttbr search <query>         Search the repository's code
  githuttbr conflicts | stack | stash | reflog | todos | chat | settings
  githuttbr ci | clean | bisect | absorb | snapshots | insights | terminal
                                 …and the rest — \`githuttbr help verbs\` lists them

${h('ANSWER IN THE TERMINAL')}
  githuttbr status [path]          Branch, tracking, working tree, push checklist
  githuttbr doctor [path] [--fix]  Check what ${REPO_CONFIG_FILE} requires. Exit 1 on failure
  githuttbr commit-check [file]    Lint a commit message. Exit 1 on an error
  githuttbr config init|show|check Propose, print or validate ${REPO_CONFIG_FILE}
  githuttbr repos [filter]         Repositories ${PRODUCT_NAME} knows about (--paths for scripts)

${h('SET UP')}
  githuttbr editor install         Use ${PRODUCT_NAME} for commit messages and rebase todos
  githuttbr completions <shell>    bash · zsh · fish

${h('OPTIONS')}
  -w, --wait                     Block until the opened file is closed (for git)
  -n, --name <name>              Display name for the tab
  -g, --group <group>            Group tab to open in
  -l, --line <n>                 Line to scroll to
  -h, --help                     This text
  -V, --version                  Version

${dim(`Docs: ${APP_REPO_URL}/blob/main/docs/help/cli.md`)}`)
}

function verbList(): void {
  out(bold('In the terminal'))
  out(`  ${HEADLESS_VERBS.join(', ')}`)
  out()
  out(bold('In the window'))
  out(`  ${WINDOW_VERBS.join(', ')}`)
}

// ─── Entry ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [verb, ...rest] = process.argv.slice(2)
  let code = 0
  switch (verb) {
    case 'doctor':
      code = await cmdDoctor(rest)
      break
    case 'status':
      code = await cmdStatus(rest)
      break
    case 'commit-check':
      code = await cmdCommitCheck(rest)
      break
    case 'config':
      code = await cmdConfig(rest)
      break
    case 'repos':
      code = await cmdRepos(rest)
      break
    case '--resolve':
      code = await cmdResolve(rest)
      break
    case 'editor':
      code = await cmdEditor(rest)
      break
    case 'completions':
      code = completions(rest[0] ?? '')
      break
    case 'help':
    case '--help':
    case '-h':
      if (rest[0] === 'verbs') verbList()
      else usage()
      break
    case '--version':
    case '-V':
      out(appVersion())
      break
    default:
      err(`githuttbr: unknown command "${verb}"`)
      usage()
      code = 2
  }
  process.exit(code)
}

main().catch((e) => {
  err(`githuttbr: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(2)
})
