import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs script, untyped on purpose
import { scanSource } from '../scripts/check-i18n.mjs'

interface Violation {
  line: number
  kind: string
  text: string
}

const scan = (code: string, file = 'Sample.tsx'): Violation[] => scanSource(code, file)
const kinds = (code: string, file?: string): string[] => scan(code, file).map((v) => v.kind)

/**
 * The guard against synthetic sources: each shape it must catch, the
 * look-alikes it must leave alone, and the escape hatches. The tree-wide run
 * lives in i18n.test.ts; this pins down what the rules mean.
 */
describe('i18n guard — shapes it catches', () => {
  it('JSX text next to an expression', () => {
    expect(scan('const a = <div>Selected: {name}</div>\n')).toEqual([
      expect.objectContaining({ line: 1, kind: 'jsx-text', text: 'Selected:' })
    ])
  })

  it('JSX text after a self-closing tag that runs to the end of the line', () => {
    const code = ['const a = (', '  <div>', '    <Icon size={18} /> Not enough data for this view.', '  </div>', ')', ''].join('\n')
    expect(scan(code)).toEqual([expect.objectContaining({ line: 3, kind: 'jsx-text', text: 'Not enough data for this view.' })])
  })

  it('JSX text wrapped over several lines', () => {
    const code = ['const a = (', '  <p>', '    The list of recently opened', '    repositories.', '  </p>', ')', ''].join('\n')
    expect(scan(code)).toEqual([
      expect.objectContaining({ line: 3, kind: 'jsx-text', text: 'The list of recently opened repositories.' })
    ])
  })

  it('a lone lowercase word between tags', () => {
    expect(kinds('const a = <span className="badge">draft</span>\n')).toEqual(['jsx-text'])
  })

  it('a template literal rendered as a JSX child', () => {
    expect(kinds('const a = <span>{`${n} files`}</span>\n')).toEqual(['jsx-expression'])
  })

  it('a fallback literal rendered as a JSX child', () => {
    expect(kinds("const a = <h3>{label ?? 'Something went wrong'}</h3>\n")).toEqual(['jsx-expression'])
  })

  it('a UI prop holding a template literal, a ternary or a fallback', () => {
    expect(kinds('const a = <b title={`${sha}\\nRight-click for more`} />\n')).toEqual(['title'])
    expect(kinds("const a = <b title={title ?? 'Filter'} />\n")).toEqual(['title'])
    expect(kinds("const o = { submitLabel: 'Rename' }\n", 'x.ts')).toEqual(['submitLabel'])
  })

  it('a confirm message built as a template', () => {
    expect(kinds('openModal({ kind: "confirm", message: `Stop tracking ${p} in Git?` })\n', 'x.ts')).toEqual(['message'])
  })

  it('DOM text assignments', () => {
    expect(kinds("el.textContent = 'Loading preview'\n", 'x.ts')).toEqual(['dom-textContent'])
    expect(kinds('el.innerText = `Saved ${n} files`\n', 'x.ts')).toEqual(['dom-innerText'])
    expect(kinds("button.title = 'Open in browser'\n", 'x.ts')).toEqual(['dom-title'])
    expect(kinds("input.placeholder = 'Search files'\n", 'x.ts')).toEqual(['dom-placeholder'])
  })

  it('setAttribute with a readable attribute', () => {
    expect(kinds("el.setAttribute('aria-label', 'Close panel')\n", 'x.ts')).toEqual(['setAttribute-aria-label'])
    expect(kinds("el.setAttribute('title', `Open ${name}`)\n", 'x.ts')).toEqual(['setAttribute-title'])
  })

  it('text drawn onto a canvas', () => {
    expect(kinds('ctx.fillText(`${i}/${n} commits · ${f} files`, 24, 40)\n', 'x.ts')).toEqual(['fillText'])
  })

  it('a toast whose copy is the second argument', () => {
    expect(kinds("toast('success', `Saved ${file}`)\n", 'x.ts')).toEqual(['toast'])
    expect(kinds("toast('success', 'Repo settings saved')\n", 'x.ts')).toEqual(['toast'])
  })

  it('a run() label and a busy label', () => {
    expect(kinds("store.run(path, 'Popped stash', () => api.pop(path))\n", 'x.ts')).toEqual(['run-label'])
    expect(kinds("ui.setBusy(`Fetching ${name} (${i}/${n})`, 'fetch')\n", 'x.ts')).toEqual(['setBusy'])
  })

  it('a native dialog title', () => {
    expect(kinds("await window.api.selectDirectory('Choose where to clone')\n", 'x.ts')).toEqual(['selectDirectory'])
  })

  it('finished copy handed to a state setter', () => {
    expect(kinds('setCaption(capped ? `Showing ${n} of ${total} commits` : `${n} commits`)\n', 'x.ts')).toEqual([
      'setCaption',
      'setCaption'
    ])
    expect(kinds("const [name, setName] = useState('My palette')\n", 'x.ts')).toEqual(['useState'])
  })

  it('a sentence-shaped Error message, which a catch block is likely to toast', () => {
    expect(kinds("throw new Error('No branch to open a pull request from.')\n", 'x.ts')).toEqual(['error-message'])
  })
})

describe('i18n guard — look-alikes it leaves alone', () => {
  it('translated copy, in every shape', () => {
    const code = [
      "const a = <div>{t('cosmos.selected')}: {name}</div>",
      "el.textContent = t('preview.loading')",
      "toast('success', interp(t('fileViewer.savedFile'), { file }))",
      "setCaption({ key: 'cosmos.captionFilesMany', vars: { n } })",
      'const b = <b title={`${t(\'a.b\')} — ${n}`} />',
      ''
    ].join('\n')
    expect(scan(code)).toEqual([])
  })

  it('templates that are punctuation around values', () => {
    expect(scan('const a = <b title={`${a} · ${b}`}>{`(${n})`}</b>\n')).toEqual([])
  })

  it('class names, CSS and identifiers', () => {
    const code = [
      'const a = <div className={`btn ghost ${active ? \'on\' : \'\'}`} style={{ border: \'1px solid var(--x)\' }} />',
      "el.setAttribute('aria-labelledby', heading.id)",
      "el.setAttribute('data-kind', 'repo group')",
      "setMode('galaxy')",
      "ctx.font = `600 ${size}px system-ui, sans-serif`",
      ''
    ].join('\n')
    expect(scan(code)).toEqual([])
  })

  it('an internal, lowercase Error message', () => {
    expect(scan('throw new Error(`unclosed <${name}>`)\n', 'x.ts')).toEqual([])
  })

  it('a commit message object, which is data rather than copy', () => {
    expect(scan("const c = { message: 'fix: handle empty repo' }\n", 'x.ts')).toEqual([])
  })

  it('acronyms and allowlisted tokens between tags', () => {
    expect(scan('const a = <option value="ssh">SSH</option>\nconst b = <kbd>esc</kbd>\n')).toEqual([])
  })

  it('JSX rules only in .tsx — `>` in a .ts file is a comparison', () => {
    expect(scan('if (a > b) return value\n', 'x.ts')).toEqual([])
  })
})

describe('i18n guard — escape hatches', () => {
  it('// i18n-ignore on the line or the line above', () => {
    expect(scan("el.textContent = 'Docker ✓' // i18n-ignore product name\n", 'x.ts')).toEqual([])
    expect(scan("// i18n-ignore a shell command\nsetCommand(`npm run ${name} now`)\n", 'x.ts')).toEqual([])
  })

  it('{/* i18n-ignore */} directly above JSX text', () => {
    const code = ['const a = (', '  <span>', '    {/* i18n-ignore git header field */}', '    author', '  </span>', ')', ''].join('\n')
    expect(scan(code)).toEqual([])
  })

  it('the allowlist', () => {
    expect(scan('const a = <span>GitHub</span>\n')).toEqual([])
  })
})
