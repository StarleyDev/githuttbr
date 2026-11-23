import { describe, it, expect } from 'vitest'
import { AUTHOR_NAME, PRODUCT_NAME, brandText } from '../src/shared/brand'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'
import { en } from '../src/renderer/src/i18n/en'
import { ptBR } from '../src/renderer/src/i18n/pt-BR'
import { ja } from '../src/renderer/src/i18n/ja'

describe('brandText', () => {
  it('is GitHuttBr, without a space', () => {
    expect(PRODUCT_NAME).toBe('GitHuttBr')
  })

  // input → output. Every row is something upstream text really contains.
  const table: [string, string][] = [
    // Prose, any position in the string.
    ["Gitcito's commit graph", "GitHuttBr's commit graph"],
    ['Open it in Gitcito.', 'Open it in GitHuttBr.'],
    ['Gitcito', 'GitHuttBr'],
    ['**Gitcito**', '**GitHuttBr**'],
    ['“Gitcito”', '“GitHuttBr”'],
    ['There is no Gitcito-flavoured network view.', 'There is no GitHuttBr-flavoured network view.'],
    ['Add MyAppDesk as co-author', `Add ${AUTHOR_NAME} as co-author`],
    // The fork's own earlier spelling.
    ['Welcome to Git HuttBr', 'Welcome to GitHuttBr'],
    ['/opt/Git HuttBr/gitcito', '/opt/GitHuttBr/githuttbr'],
    // Scripts without spaces, and right-to-left text.
    ['Gitcitoを開く', 'GitHuttBrを開く'],
    ['افتح Gitcito الآن', 'افتح GitHuttBr الآن'],
    ['פתח את Gitcito', 'פתח את GitHuttBr'],
    ['متجرGitcitoالآن', 'متجرGitHuttBrالآن'],
    // Hebrew glues a prefix on with a hyphen; German adds a genitive s.
    ['מחוץ ל-Gitcito', 'מחוץ ל-GitHuttBr'],
    ['Gitcitos eigene Lizenz', 'GitHuttBrs eigene Lizenz'],
    // The command.
    ['run `gitcito .` in a checkout', 'run `githuttbr .` in a checkout'],
    ["Install 'gitcito' command in PATH", "Install 'githuttbr' command in PATH"],
    ['`ls -l ~/.local/bin/gitcito`', '`ls -l ~/.local/bin/githuttbr`'],
    ['(gitcito repos --paths api | head -1)', '(githuttbr repos --paths api | head -1)'],
    ['`gitcito-textconv`', '`githuttbr-textconv`'],
    ['/etc/apparmor.d/local/gitcito', '/etc/apparmor.d/local/githuttbr'],
    // Environment variables.
    ['GITCITO_SSH_DIR', 'GITHUTTBR_SSH_DIR'],
    ['`GITCITO_DEVICE_ID`, `GITCITO_DEVICE_NAME`', '`GITHUTTBR_DEVICE_ID`, `GITHUTTBR_DEVICE_NAME`'],
    // Repository files, keys and refs.
    ['.gitcito.json', '.githuttbr.json'],
    ['[`.gitcito.json`](repo-config.md)', '[`.githuttbr.json`](repo-config.md)'],
    ['`gitcito.subtree.*`', '`githuttbr.subtree.*`'],
    ['gitcito.protectedbranches', 'githuttbr.protectedbranches'],
    ['branch.<name>.gitcitoparent / .gitcitobase', 'branch.<name>.githuttbrparent / .githuttbrbase'],
    ['`refs/gitcito/wip`.', '`refs/githuttbr/wip`.'],
    ['`refs/gitcito/pre-purge/<timestamp>/…`', '`refs/githuttbr/pre-purge/<timestamp>/…`'],
    ['`refs/notes/gitcito-ci`', '`refs/notes/githuttbr-ci`'],
    ['"gitcito": { "hotActions": [] }', '"githuttbr": { "hotActions": [] }'],
    // App files and folders.
    ['`gitcito-settings.json.corrupt-<date>`', '`githuttbr-settings.json.corrupt-<date>`'],
    ['(`~/Library/Logs/Gitcito/` on macOS)', '(`~/Library/Logs/GitHuttBr/` on macOS)'],
    ['~/.config/Gitcito/shell-path', '~/.config/GitHuttBr/shell-path'],
    ['Gitcito-Setup.exe', 'GitHuttBr-Setup.exe'],
    // Secure-share bundles.
    ['save workspace.gitcito', 'save workspace.githuttbr'],
    ['an encrypted `.gitcito` file', 'an encrypted `.githuttbr` file'],
    // Addresses stay exactly as they are.
    ['https://github.com/MyAppDesk/gitcito/issues', 'https://github.com/MyAppDesk/gitcito/issues'],
    ['https://myappdesk.github.io/gitcito/', 'https://myappdesk.github.io/gitcito/'],
    ['github.com/MyAppDesk/gitcito', 'github.com/MyAppDesk/gitcito'],
    ['myappdesk.github.io/gitcito', 'myappdesk.github.io/gitcito'],
    ['built from MyAppDesk/gitcito', 'built from MyAppDesk/gitcito'],
    ['git@github.com:MyAppDesk/gitcito.git', 'git@github.com:MyAppDesk/gitcito.git'],
    ['team@gitcito.dev', 'team@gitcito.dev'],
    [
      '[Gitcito](https://github.com/MyAppDesk/gitcito)',
      '[GitHuttBr](https://github.com/MyAppDesk/gitcito)'
    ],
    [
      'See <https://github.com/MyAppDesk/gitcito/releases> for Gitcito builds.',
      'See <https://github.com/MyAppDesk/gitcito/releases> for GitHuttBr builds.'
    ],
    [
      '<a href="https://myappdesk.github.io/gitcito/help/cli.html">gitcito</a>',
      '<a href="https://myappdesk.github.io/gitcito/help/cli.html">githuttbr</a>'
    ],
    // Not ours: words that merely contain the letters.
    ['gitcitoish', 'gitcitoish'],
    ['my-gitcito-fork', 'my-gitcito-fork'],
    ['GitcitoX', 'GitcitoX'],
    ['', '']
  ]

  it.each(table)('%j → %j', (input, output) => {
    expect(brandText(input)).toBe(output)
  })

  it('is idempotent', () => {
    for (const [input] of table) expect(brandText(brandText(input))).toBe(brandText(input))
  })
})

describe('translations', () => {
  it('brand the credit lines in any language', () => {
    for (const dict of [en, ptBR, ja]) {
      expect(brandText(dict['settings.coAuthor'])).toContain(AUTHOR_NAME)
      expect(brandText(dict['settings.madeBy'])).not.toContain('MyAppDesk')
    }
  })

  it('leave no displayed Gitcito, Git HuttBr or gitcito identifier outside an address, in any locale', async () => {
    const dir = join(__dirname, '../src/renderer/src/i18n')
    const files = readdirSync(dir).filter((f) => /^[a-z]{2}(-[A-Z]{2})?\.ts$/.test(f))
    expect(files.length).toBeGreaterThanOrEqual(16)
    for (const file of files) {
      const code = file.replace(/\.ts$/, '')
      const mod = (await import(join(dir, file))) as Record<string, unknown>
      const dict = Object.values(mod).find((v) => v && typeof v === 'object') as Record<string, string>
      for (const [key, value] of Object.entries(dict)) {
        expect(leftover(brandText(value)), `${code} ${key}`).toBeNull()
      }
    }
  })
})

/** The first displayed upstream name left once addresses are set aside, or null. */
function leftover(shown: string): string | null {
  const text = shown.replace(/https?:\/\/\S+|[\w.-]+\.(?:com|io)\/\S*|MyAppDesk\/gitcito|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '')
  return /.{0,40}(?:Gitcito|Git HuttBr|gitcito).{0,40}/i.exec(text)?.[0] ?? null
}

describe('the handbook, in every language', () => {
  it('shows no upstream name outside an address once branded', () => {
    const root = join(__dirname, '../docs/help')
    const pages = readdirSync(root, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('.md'))
    expect(pages.length).toBeGreaterThan(100)
    for (const page of pages) {
      expect(leftover(brandText(readFileSync(join(root, page), 'utf8'))), page).toBeNull()
    }
  })
})

describe('the upgrading page', () => {
  // The one page that has to name the old app, its folder and its command.
  // Branding would rewrite a plain spelling into the new name, so the page
  // writes the old one with an entity; this checks what a reader sees.
  const shown = (): string => {
    const md = brandText(readFileSync(join(__dirname, '../docs/help/upgrading.md'), 'utf8'))
    const html = marked.parse(md.slice(md.indexOf('\n---', 3) + 4), { async: false })
    return html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
  }

  it('names the old folder, command and files as they are on disk', () => {
    const text = shown()
    expect(text).toContain('named Gitcito')
    expect(text).toContain('.gitcito.json')
    expect(text).toContain('~/.local/bin/gitcito')
    expect(text).toContain('still runs gitcito --wait')
    expect(text).toContain('point at gitcito-textconv')
  })

  it('names the new ones as the new ones', () => {
    const text = shown()
    expect(text).toContain('set core.editor to githuttbr --wait')
    expect(text).toContain("Install 'githuttbr' command in PATH")
    expect(text).toContain('all say GitHuttBr')
    expect(text).not.toContain('named GitHuttBr')
    expect(text).not.toContain('runs githuttbr --wait')
  })
})
