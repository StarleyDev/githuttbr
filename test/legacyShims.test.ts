import { describe, it, expect } from 'vitest'
import { isStaleTextconv, planTextconvRepoints, repointLegacyTextconv } from '../src/main/legacyShims'

// This app's builds up to 4.38 wrote their converter's absolute path into git
// config; after the rename those entries fail at the next diff. Upstream
// Gitcito ships a converter with the same file name, and its entries must
// never be flagged or rewritten.

const NEW = '/opt/GitHuttBr/resources/cli/githuttbr-textconv'

describe('isStaleTextconv', () => {
  it("flags this app's own pre-rename converter, quoted or not, on any platform", () => {
    for (const tc of [
      '"/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito-textconv"',
      "'/opt/Git HuttBr/resources/cli/gitcito-textconv' --x",
      '/opt/Git\\ HuttBr/resources/cli/gitcito-textconv',
      '/opt/githuttbr/resources/cli/gitcito-textconv',
      '"C:\\Users\\me\\AppData\\Local\\Programs\\Git HuttBr\\resources\\cli\\gitcito-textconv.cmd"',
      '"/c/Program Files/GitHuttBr/resources/cli/gitcito-textconv"'
    ]) {
      expect(isStaleTextconv(tc), tc).toBe(true)
    }
  })

  it("never flags upstream Gitcito's converter of the same name", () => {
    for (const tc of [
      '"/opt/Gitcito/resources/cli/gitcito-textconv"',
      '/opt/Gitcito/resources/cli/gitcito-textconv',
      '"/Applications/Gitcito.app/Contents/Resources/cli/gitcito-textconv"',
      '"C:\\Program Files\\Gitcito\\resources\\cli\\gitcito-textconv.cmd"',
      'C:\\Gitcito\\resources\\cli\\gitcito-textconv',
      // A bare name says nothing about whose it is.
      'gitcito-textconv'
    ]) {
      expect(isStaleTextconv(tc), tc).toBe(false)
    }
  })

  it('leaves everything else alone, including absolute paths this machine cannot see', () => {
    for (const tc of [
      `"${NEW}"`,
      '/usr/bin/pdftotext -layout - -',
      '/opt/old/bin/conv --flag',
      '"/c/Program Files/Tools/conv.exe"',
      'exiftool',
      // Only the program counts, not an argument that mentions the name.
      'sh -c "/opt/GitHuttBr/cli/gitcito-textconv x"',
      '"/opt/GitHuttBr/my-gitcito-textconv"',
      '"/opt/GitHuttBr/gitcito-textconv-old"',
      ''
    ]) {
      expect(isStaleTextconv(tc), tc).toBe(false)
    }
  })
})

describe('repointLegacyTextconv', () => {
  // input → output; null means "not ours, leave it".
  const table: [string, string | null][] = [
    ['"/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito-textconv"', `"${NEW}"`],
    ['  /opt/githuttbr/cli/gitcito-textconv  ', `"${NEW}"`],
    ['/opt/Git\\ HuttBr/resources/cli/gitcito-textconv --plain', `"${NEW}" --plain`],
    ["'/opt/Git HuttBr/resources/cli/gitcito-textconv' --a 'b c'", `"${NEW}" --a 'b c'`],
    ['"C:\\Programs\\Git HuttBr\\resources\\cli\\gitcito-textconv.cmd" --sheet=1 -', `"${NEW}" --sheet=1 -`],
    ['"/opt/Gitcito/resources/cli/gitcito-textconv"', null],
    ['C:\\Gitcito\\resources\\cli\\gitcito-textconv.exe --x', null],
    [`"${NEW}"`, null],
    ['pdftotext -layout - -', null],
    ['', null]
  ]
  for (const [input, output] of table) {
    it(`${input || '(empty)'} → ${output ?? 'untouched'}`, () => {
      expect(repointLegacyTextconv(input, NEW)).toBe(output)
    })
  }

  it('refuses a target it cannot quote, or one that is itself the old converter', () => {
    const legacy = '"/opt/Git HuttBr/cli/gitcito-textconv"'
    expect(repointLegacyTextconv(legacy, '/odd/"quoted"/githuttbr-textconv')).toBeNull()
    expect(repointLegacyTextconv(legacy, '/opt/x/gitcito-textconv')).toBeNull()
    expect(repointLegacyTextconv(legacy, '')).toBeNull()
  })
})

describe('planTextconvRepoints', () => {
  const listing = [
    'diff.word.textconv "/opt/Git HuttBr/resources/cli/gitcito-textconv"',
    'diff.pdf.textconv pdftotext -layout - -',
    'diff.my.dotted.textconv /opt/githuttbr/cli/gitcito-textconv --x',
    'diff.excel.textconv "/opt/Gitcito/resources/cli/gitcito-textconv"',
    'diff.json.textconv "/tmp/.mount_Git HuQ/resources/cli/gitcito-textconv"',
    ''
  ].join('\n')
  const mount = (tc: string): boolean => tc.includes('/tmp/.mount_')

  it("rewrites only this app's old converter, keeps arguments and dotted names, skips mounts and Gitcito's", () => {
    expect(planTextconvRepoints(listing, NEW, { blocked: false, ephemeral: mount })).toEqual([
      { name: 'word', previous: '"/opt/Git HuttBr/resources/cli/gitcito-textconv"', next: `"${NEW}"` },
      { name: 'my.dotted', previous: '/opt/githuttbr/cli/gitcito-textconv --x', next: `"${NEW}" --x` }
    ])
  })

  it('rewrites nothing when the current converter may not be persisted (an AppImage)', () => {
    expect(planTextconvRepoints(listing, NEW, { blocked: true, ephemeral: mount })).toEqual([])
  })
})
