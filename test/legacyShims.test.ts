import { describe, it, expect } from 'vitest'
import {
  editorFixCommand,
  isLegacyEditor,
  isStaleTextconv,
  planTextconvRepoints,
  repointLegacyTextconv
} from '../src/main/legacyShims'

// 4.38 wrote its converter and editor command into git config by name or by
// absolute path; after the rename those settings fail at the next diff/commit.

const NEW = '/opt/GitHuttBr/resources/cli/githuttbr-textconv'

describe('isStaleTextconv', () => {
  it('flags the pre-rename converter, wherever it lives, quoted or not', () => {
    for (const tc of [
      '"/opt/Gitcito/resources/cli/gitcito-textconv"',
      '"/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito-textconv"',
      "'/opt/Git HuttBr/resources/cli/gitcito-textconv' --x",
      '/opt/Gitcito/resources/cli/gitcito-textconv',
      '/opt/Git\\ HuttBr/resources/cli/gitcito-textconv',
      '"C:\\Program Files\\Gitcito\\resources\\cli\\gitcito-textconv.cmd"',
      'C:\\Gitcito\\resources\\cli\\gitcito-textconv',
      '"/c/Program Files/Gitcito/resources/cli/gitcito-textconv"',
      'gitcito-textconv'
    ]) {
      expect(isStaleTextconv(tc), tc).toBe(true)
    }
  })

  it('leaves everything else alone — including absolute paths this machine cannot see', () => {
    for (const tc of [
      `"${NEW}"`,
      '/usr/bin/pdftotext -layout - -',
      // Gone, or MSYS / escaped Windows paths a Linux process cannot resolve:
      // judged by the "not installed" badge, never by this one.
      '/opt/old/bin/conv --flag',
      '"/c/Program Files/Tools/conv.exe"',
      '"C:\\\\Program Files\\\\Tools\\\\conv.exe"',
      'exiftool',
      // Only the program counts, not an argument that mentions the name.
      'sh -c "gitcito-textconv x"',
      'my-gitcito-textconv',
      '"/opt/x/gitcito-textconv-old"',
      ''
    ]) {
      expect(isStaleTextconv(tc), tc).toBe(false)
    }
  })
})

describe('repointLegacyTextconv', () => {
  // input → output; null means "not ours, leave it".
  const table: [string, string | null][] = [
    ['"/opt/Gitcito/resources/cli/gitcito-textconv"', `"${NEW}"`],
    ['"/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito-textconv"', `"${NEW}"`],
    ['/opt/Gitcito/resources/cli/gitcito-textconv', `"${NEW}"`],
    ['  /opt/Gitcito/cli/gitcito-textconv  ', `"${NEW}"`],
    ['/opt/Git\\ HuttBr/resources/cli/gitcito-textconv --plain', `"${NEW}" --plain`],
    ["'/opt/Git HuttBr/resources/cli/gitcito-textconv' --a 'b c'", `"${NEW}" --a 'b c'`],
    ['"/opt/Gitcito/cli/gitcito-textconv" --sheet=1 -', `"${NEW}" --sheet=1 -`],
    ['"C:\\Program Files\\Gitcito\\resources\\cli\\gitcito-textconv.cmd"', `"${NEW}"`],
    ['C:\\Gitcito\\resources\\cli\\gitcito-textconv.exe --x', `"${NEW}" --x`],
    [`"${NEW}"`, null],
    ['pdftotext -layout - -', null],
    ['exiftool', null],
    ['sh -c "gitcito-textconv x"', null],
    ['', null]
  ]
  for (const [input, output] of table) {
    it(`${input || '(empty)'} → ${output ?? 'untouched'}`, () => {
      expect(repointLegacyTextconv(input, NEW)).toBe(output)
    })
  }

  it('refuses a target it cannot quote, or one that is itself the old converter', () => {
    const legacy = '"/opt/Gitcito/cli/gitcito-textconv"'
    expect(repointLegacyTextconv(legacy, '/odd/"quoted"/githuttbr-textconv')).toBeNull()
    expect(repointLegacyTextconv(legacy, '/opt/x/gitcito-textconv')).toBeNull()
    expect(repointLegacyTextconv(legacy, '')).toBeNull()
  })
})

describe('planTextconvRepoints', () => {
  const listing = [
    'diff.word.textconv "/opt/Gitcito/resources/cli/gitcito-textconv"',
    'diff.pdf.textconv pdftotext -layout - -',
    'diff.my.dotted.textconv /opt/Gitcito/cli/gitcito-textconv --x',
    'diff.json.textconv "/tmp/.mount_GitcitQ/resources/cli/gitcito-textconv"',
    ''
  ].join('\n')
  const mount = (tc: string): boolean => tc.includes('/tmp/.mount_')

  it('rewrites only the old converter, keeps arguments and dotted names, and skips mount paths', () => {
    expect(planTextconvRepoints(listing, NEW, { blocked: false, ephemeral: mount })).toEqual([
      { name: 'word', previous: '"/opt/Gitcito/resources/cli/gitcito-textconv"', next: `"${NEW}"` },
      { name: 'my.dotted', previous: '/opt/Gitcito/cli/gitcito-textconv --x', next: `"${NEW}" --x` }
    ])
  })

  it('rewrites nothing when the current converter may not be persisted (an AppImage)', () => {
    expect(planTextconvRepoints(listing, NEW, { blocked: true, ephemeral: mount })).toEqual([])
  })
})

describe('isLegacyEditor', () => {
  it('recognises the old command, bare or by path', () => {
    expect(isLegacyEditor('gitcito --wait')).toBe(true)
    expect(isLegacyEditor('/usr/local/bin/gitcito --wait')).toBe(true)
    expect(isLegacyEditor('"C:\\Users\\me\\bin\\gitcito.cmd" --wait')).toBe(true)
  })

  it('leaves everything else alone', () => {
    expect(isLegacyEditor('githuttbr --wait')).toBe(false)
    expect(isLegacyEditor('vim')).toBe(false)
    expect(isLegacyEditor('code --wait')).toBe(false)
    expect(isLegacyEditor('my-gitcito --wait')).toBe(false)
  })

  it('suggests the exact repair at the scope it was found in', () => {
    expect(editorFixCommand('core.editor', 'global')).toBe('git config --global core.editor "githuttbr --wait"')
  })
})
