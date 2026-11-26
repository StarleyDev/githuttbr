import { describe, it, expect } from 'vitest'
import {
  applyEditToValue,
  collectMentionNames,
  collectReferences,
  completeQuery,
  continueList,
  filterMentions,
  filterReferences,
  getAutocompleteQuery,
  insertLink,
  toggleCode,
  toggleInlineFormat,
  toggleLinePrefix,
  type MarkdownReference,
  type TextEdit,
  type TextState
} from '../src/renderer/src/lib/markdownEdit'

// A field written as one string: «…» marks the selection, ‸ a caret.
function field(s: string): TextState {
  if (s.includes('«')) {
    const selStart = s.indexOf('«')
    const value = s.replace('«', '').replace('»', '')
    return { value, selStart, selEnd: s.indexOf('»') - 1 }
  }
  const at = s.indexOf('‸')
  return { value: s.replace('‸', ''), selStart: at, selEnd: at }
}

// The field after an edit, in the same notation.
function after(state: TextState, edit: TextEdit | null): string {
  if (!edit) return 'null'
  const value = applyEditToValue(state.value, edit)
  if (edit.selStart === edit.selEnd) return value.slice(0, edit.selStart) + '‸' + value.slice(edit.selStart)
  return value.slice(0, edit.selStart) + '«' + value.slice(edit.selStart, edit.selEnd) + '»' + value.slice(edit.selEnd)
}

const run = (s: string, fn: (st: TextState) => TextEdit | null): string => {
  const st = field(s)
  return after(st, fn(st))
}

describe('markdown editor: bold and italic', () => {
  const bold = (s: string): string => run(s, (st) => toggleInlineFormat(st, 'bold', 'bold text'))
  const italic = (s: string): string => run(s, (st) => toggleInlineFormat(st, 'italic', 'italic text'))

  it('wraps the selection and keeps it selected', () => {
    expect(bold('make «this» loud')).toBe('make **«this»** loud')
    expect(italic('make «this» soft')).toBe('make _«this»_ soft')
  })

  it('unwraps when the markers are just outside the selection', () => {
    expect(bold('make **«this»** loud')).toBe('make «this» loud')
    expect(italic('make _«this»_ soft')).toBe('make «this» soft')
  })

  it('unwraps when the selection includes its markers', () => {
    expect(bold('make «**this**» loud')).toBe('make «this» loud')
  })

  it('inserts a selected placeholder when nothing is selected', () => {
    expect(bold('say ‸')).toBe('say **«bold text»**')
    expect(italic('‸')).toBe('_«italic text»_')
  })

  it('keeps spaces at the ends of the selection outside the markers', () => {
    expect(bold('a« word »b')).toBe('a **«word»** b')
  })

  it('a selection of only spaces gets a placeholder after it', () => {
    expect(bold('a«  »b')).toBe('a  **«bold text»**b')
  })

  it('does not unwrap at the very start of the text by reading before it', () => {
    expect(bold('«x»**')).toBe('**«x»****')
  })
})

describe('markdown editor: code', () => {
  const code = (s: string): string => run(s, (st) => toggleCode(st, 'code'))

  it('is inline code within one line, toggled', () => {
    expect(code('call «run()» now')).toBe('call `«run()»` now')
    expect(code('call `«run()»` now')).toBe('call «run()» now')
    expect(code('‸')).toBe('`«code»`')
  })

  it('fences the whole lines of a selection that spans lines', () => {
    expect(code('intro\nco«nst a = 1\nconst b» = 2\nend')).toBe('intro\n```\n«const a = 1\nconst b = 2»\n```\nend')
  })

  it('unfences a block whose fences are selected', () => {
    expect(code('«```\nx\ny\n```»')).toBe('«x\ny»')
  })

  it('unfences a block whose fences sit just outside the selection', () => {
    expect(code('a\n```\n«x\ny»\n```\nb')).toBe('a\n«x\ny»\nb')
  })

  it('a selection ending at the start of a line does not take that line in', () => {
    expect(code('«a\nb\n»c')).toBe('```\n«a\nb»\n```\nc')
  })
})

describe('markdown editor: link', () => {
  const link = (s: string): string => run(s, (st) => insertLink(st, 'text', 'url'))

  it('turns selected text into the label and selects the address', () => {
    expect(link('see «the docs» here')).toBe('see [the docs](«url») here')
  })

  it('turns a selected URL into the address and selects the label', () => {
    expect(link('«https://example.com/a»')).toBe('[«text»](https://example.com/a)')
  })

  it('inserts both placeholders with the label selected when nothing is selected', () => {
    expect(link('‸')).toBe('[«text»](url)')
  })

  it('unlinks a selected link back to its text', () => {
    expect(link('«[docs](https://example.com)»')).toBe('«docs»')
  })
})

describe('markdown editor: line prefixes', () => {
  const prefix = (s: string, f: Parameters<typeof toggleLinePrefix>[1]): string => run(s, (st) => toggleLinePrefix(st, f))

  it('adds a bullet to every selected line and selects them', () => {
    expect(prefix('«one\ntwo»', 'bullet')).toBe('«- one\n- two»')
  })

  it('removes the bullet when every line has it', () => {
    expect(prefix('«- one\n- two»', 'bullet')).toBe('«one\ntwo»')
  })

  it('numbers lines from 1 and skips blank ones', () => {
    expect(prefix('«a\n\nb\nc»', 'numbered')).toBe('«1. a\n\n2. b\n3. c»')
  })

  it('replaces a list marker of another kind instead of stacking', () => {
    expect(prefix('«- a\n- b»', 'numbered')).toBe('«1. a\n2. b»')
    expect(prefix('«1. a\n2. b»', 'task')).toBe('«- [ ] a\n- [ ] b»')
    expect(prefix('«- [x] a»', 'bullet')).toBe('«- a»')
  })

  it('a task line is not counted as already bulleted', () => {
    expect(prefix('«- [ ] a\n- b»', 'bullet')).toBe('«- a\n- b»')
  })

  it('a mixed selection gains the prefix where it is missing', () => {
    expect(prefix('«- a\nb»', 'bullet')).toBe('«- a\n- b»')
  })

  it('quotes every line, keeping blank lines inside the quote', () => {
    expect(prefix('«a\n\nb»', 'quote')).toBe('«> a\n>\n> b»')
    expect(prefix('«> a\n> b»', 'quote')).toBe('«a\nb»')
  })

  it('headings replace another level and toggle off the same one', () => {
    expect(prefix('ti‸tle', 'heading2')).toBe('## ti‸tle')
    expect(prefix('## ti‸tle', 'heading2')).toBe('ti‸tle')
    expect(prefix('## ti‸tle', 'heading1')).toBe('# ti‸tle')
  })

  it('keeps a caret in place within the line text', () => {
    expect(prefix('first\nsec‸ond', 'bullet')).toBe('first\n- sec‸ond')
    expect(prefix('- sec‸ond', 'numbered')).toBe('1. sec‸ond')
    expect(prefix('‸', 'task')).toBe('- [ ] ‸')
  })
})

describe('markdown editor: Enter in a list', () => {
  const enter = (s: string): string => run(s, continueList)

  it('continues a bulleted list with the same marker', () => {
    expect(enter('- one‸')).toBe('- one\n- ‸')
    expect(enter('* one‸')).toBe('* one\n* ‸')
  })

  it('increments a numbered list and keeps its delimiter', () => {
    expect(enter('1. one\n2. two‸')).toBe('1. one\n2. two\n3. ‸')
    expect(enter('9) nine‸')).toBe('9) nine\n10) ‸')
  })

  it('continues a task list with an unticked box', () => {
    expect(enter('- [x] done‸')).toBe('- [x] done\n- [ ] ‸')
  })

  it('keeps the indentation of a nested item', () => {
    expect(enter('- a\n  - b‸')).toBe('- a\n  - b\n  - ‸')
  })

  it('splits an item at the caret, the rest going to the new item', () => {
    expect(enter('- ab‸cd')).toBe('- ab\n- ‸cd')
  })

  it('ends the list on an empty item, removing its marker', () => {
    expect(enter('- a\n- ‸')).toBe('- a\n‸')
    expect(enter('- a\n- [ ] ‸')).toBe('- a\n‸')
    expect(enter('1. a\n2. ‸')).toBe('1. a\n‸')
  })

  it('leaves Enter alone outside a list, with a selection, or inside the marker', () => {
    expect(enter('plain‸')).toBe('null')
    expect(enter('- «a»')).toBe('null')
    expect(enter('-‸ a')).toBe('null')
    expect(enter('-notalist‸')).toBe('null')
  })
})

describe('markdown editor: autocomplete query', () => {
  const q = (s: string): ReturnType<typeof getAutocompleteQuery> => {
    const st = field(s)
    return getAutocompleteQuery(st.value, st.selStart)
  }

  it('finds an @mention being typed', () => {
    expect(q('hi @al‸')).toEqual({ trigger: '@', query: 'al', start: 3 })
    expect(q('@‸')).toEqual({ trigger: '@', query: '', start: 0 })
    expect(q('(@sam-o‸')).toEqual({ trigger: '@', query: 'sam-o', start: 1 })
  })

  it('finds a #reference by number or word', () => {
    expect(q('fixes #12‸')).toEqual({ trigger: '#', query: '12', start: 6 })
    expect(q('see #sear‸')).toEqual({ trigger: '#', query: 'sear', start: 4 })
  })

  it('ignores a trigger inside a word — an email, a heading, a hash in a URL', () => {
    expect(q('mail me@host‸')).toBeNull()
    expect(q('## ‸')).toBeNull()
    expect(q('page#top‸')).toBeNull()
  })

  it('ignores a trigger once a space ends the query', () => {
    expect(q('@sam ‸')).toBeNull()
  })

  it('ignores triggers inside code', () => {
    expect(q('```\n@Component‸')).toBeNull()
    expect(q('use `@Input‸')).toBeNull()
    expect(q('```\nx\n```\n@al‸')).toEqual({ trigger: '@', query: 'al', start: 10 })
  })
})

describe('markdown editor: filtering and completing', () => {
  it('lists mentions that start with the query before those that contain it', () => {
    expect(filterMentions(['bruno', 'alex', 'sam', 'alba', 'kalani'], 'al')).toEqual(['alex', 'alba', 'kalani'])
    expect(filterMentions(['Alex'], 'AL')).toEqual(['Alex'])
    expect(filterMentions(['a', 'b', 'c'], '', 2)).toEqual(['a', 'b'])
  })

  const refs: MarkdownReference[] = [
    { number: 7, title: 'Cache the catalog index', kind: 'issue' },
    { number: 42, title: 'Add workspace search', kind: 'pr' },
    { number: 412, title: 'Research notes', kind: 'issue' }
  ]

  it('lists references newest first, by number prefix', () => {
    expect(filterReferences(refs, '').map((r) => r.number)).toEqual([412, 42, 7])
    expect(filterReferences(refs, '4').map((r) => r.number)).toEqual([412, 42])
    expect(filterReferences(refs, '42').map((r) => r.number)).toEqual([42])
  })

  it('lists references by a title word, word starts first', () => {
    expect(filterReferences(refs, 'sea').map((r) => r.number)).toEqual([42, 412])
    expect(filterReferences(refs, 'CATALOG').map((r) => r.number)).toEqual([7])
  })

  it('replaces the query with the pick and a space', () => {
    const st = field('ping @al‸ please')
    const edit = completeQuery(st.value, st.selStart, getAutocompleteQuery(st.value, st.selStart)!, 'alex')
    // The space already after the caret is reused, not doubled.
    expect(after(st, edit)).toBe('ping @alex ‸please')
    const st2 = field('fixes #4‸')
    const edit2 = completeQuery(st2.value, st2.selStart, getAutocompleteQuery(st2.value, st2.selStart)!, '42')
    expect(after(st2, edit2)).toBe('fixes #42 ‸')
  })

  it('collects mention names once each, dropping blanks and placeholders', () => {
    expect(collectMentionNames(['sam', 'unknown', null], ['alex', 'Sam', ''], undefined, [' kim '])).toEqual(['sam', 'alex', 'kim'])
  })

  it('collects references, a PR winning over the same number as an issue', () => {
    const out = collectReferences([{ id: 42, title: 'Add workspace search' }], [
      { number: 42, title: 'Add workspace search' },
      { number: 7, title: 'Cache the catalog index' }
    ])
    expect(out).toEqual([
      { number: 42, title: 'Add workspace search', kind: 'pr' },
      { number: 7, title: 'Cache the catalog index', kind: 'issue' }
    ])
  })
})
