import { describe, it, expect } from 'vitest'
import { editorFixCommand, isLegacyEditor, isStaleTextconv } from '../src/main/legacyShims'

// 4.38 wrote its converter and editor command into git config by name or by
// absolute path; after the rename those settings fail at the next diff/commit.

describe('isStaleTextconv', () => {
  const present = new Set(['/opt/GitHuttBr/resources/cli/githuttbr-textconv', '/usr/bin/pdftotext'])
  const exists = (p: string): boolean => present.has(p)

  it('flags the pre-rename converter, wherever it lives', () => {
    expect(isStaleTextconv('"/opt/Gitcito/resources/cli/gitcito-textconv"', exists)).toBe(true)
    expect(isStaleTextconv('"/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito-textconv"', exists)).toBe(true)
    expect(isStaleTextconv('"C:\\Program Files\\Gitcito\\resources\\cli\\gitcito-textconv.cmd"', exists)).toBe(true)
  })

  it('flags an absolute converter path that is gone', () => {
    expect(isStaleTextconv('/opt/old/bin/conv --flag', exists)).toBe(true)
  })

  it('leaves working converters and bare commands alone', () => {
    expect(isStaleTextconv('"/opt/GitHuttBr/resources/cli/githuttbr-textconv"', exists)).toBe(false)
    expect(isStaleTextconv('/usr/bin/pdftotext -layout - -', exists)).toBe(false)
    // On PATH or not is the "not installed" badge's business, not this one's.
    expect(isStaleTextconv('exiftool', exists)).toBe(false)
    expect(isStaleTextconv('', exists)).toBe(false)
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
