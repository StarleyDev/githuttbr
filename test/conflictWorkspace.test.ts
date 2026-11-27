import { describe, it, expect } from 'vitest'
import {
  conflictKindOf,
  countConflictBlocks,
  pairRenames,
  parseMergeMsgConflicts,
  parseUnmergedStages,
  parseUnmergedStatus
} from '../src/shared/conflictFiles'
import {
  changedLineCount,
  conflictProgress,
  nextConflictSession,
  nextOpenFile,
  stripEntries,
  sumChoices
} from '../src/renderer/src/lib/conflictWorkspace'
import {
  assemble,
  baseRegions,
  countChoices,
  hunkChoice,
  parseHunks,
  pickHunk,
  pickSideEverywhere
} from '../src/renderer/src/lib/conflict'
import type { ConflictFileInfo } from '../src/shared/types'

const file = (path: string, kind: ConflictFileInfo['kind'], conflicts = 0): ConflictFileInfo => ({
  path,
  code: '',
  kind,
  conflicts
})

describe('reading git unmerged state', () => {
  it('maps each two-letter code to a kind, and ignores merged entries', () => {
    expect(conflictKindOf('UU')).toBe('both-modified')
    expect(conflictKindOf('DU')).toBe('deleted-by-us')
    expect(conflictKindOf('UD')).toBe('deleted-by-them')
    expect(conflictKindOf('DD')).toBe('renamed-both')
    expect(conflictKindOf('M ')).toBeNull()
  })

  it('pulls unmerged entries out of porcelain -z, skipping a rename source field', () => {
    const z = ['UU app.js', 'R  new.txt', 'old.txt', 'UD units.dart', 'M  other.txt', ''].join('\0')
    expect(parseUnmergedStatus(z)).toEqual([
      { code: 'UU', path: 'app.js' },
      { code: 'UD', path: 'units.dart' }
    ])
  })

  it('counts conflict blocks by their opening markers', () => {
    expect(countConflictBlocks('a\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> f\nb\n<<<<<<< HEAD\n')).toBe(2)
    expect(countConflictBlocks('no markers here')).toBe(0)
  })

  it('pairs a rename/rename original with the name each side gave it', () => {
    const stages = parseUnmergedStages(
      ['100644 aaa 3\tf-feat.txt', '100644 aaa 2\tf-main.txt', '100644 aaa 1\tf.txt', ''].join('\0')
    )
    const out = pairRenames(
      [file('f-feat.txt', 'added-by-them'), file('f-main.txt', 'added-by-us'), file('f.txt', 'renamed-both')],
      stages
    )
    expect(out.find((f) => f.path === 'f.txt')?.renamedTo).toEqual({ ours: 'f-main.txt', theirs: 'f-feat.txt' })
    expect(out.find((f) => f.path === 'f-main.txt')?.renameOf).toBe('f.txt')
    expect(out.find((f) => f.path === 'f-feat.txt')?.renameOf).toBe('f.txt')
  })

  it('leaves an original unpaired when the halves cannot be told apart', () => {
    const out = pairRenames(
      [file('a.txt', 'renamed-both'), file('b.txt', 'renamed-both'), file('x', 'added-by-us'), file('y', 'added-by-them')],
      []
    )
    expect(out.every((f) => !f.renamedTo && !f.renameOf)).toBe(true)
  })

  it('reads the files listed under # Conflicts: in MERGE_MSG', () => {
    const msg = "Merge branch 'feature'\n\n# Conflicts:\n#\tapp.js\n#\tunits.dart\n#\n# It looks like...\n"
    expect(parseMergeMsgConflicts(msg)).toEqual(['app.js', 'units.dart'])
    expect(parseMergeMsgConflicts("Merge branch 'x'\n")).toEqual([])
  })
})

describe('the conflict workspace bookkeeping', () => {
  it('remembers files once they are resolved, and starts over on a new step', () => {
    const s1 = nextConflictSession(undefined, 'merge:abc', [file('b', 'both-modified', 2), file('a', 'both-modified', 1)], [])
    expect(s1.files).toEqual(['a', 'b'])
    // `a` resolved: git no longer lists it, the session still does.
    const s2 = nextConflictSession(s1, 'merge:abc', [file('b', 'both-modified', 2)], [])
    expect(s2).toBe(s1)
    const entries = stripEntries(s2, [file('b', 'both-modified', 2)])
    expect(entries.map((e) => [e.path, e.state])).toEqual([
      ['a', 'resolved'],
      ['b', 'open']
    ])
    expect(conflictProgress(entries)).toEqual({ total: 2, resolved: 1, left: 2 })
    // The next rebase step is its own session.
    expect(nextConflictSession(s2, 'rebase:def', [file('c', 'both-modified', 1)], []).files).toEqual(['c'])
  })

  it('folds rename halves into their original and counts a pathless conflict as one', () => {
    const files = [
      { ...file('f.txt', 'renamed-both'), renamedTo: { ours: 'm.txt', theirs: 'n.txt' } },
      { ...file('m.txt', 'added-by-us'), renameOf: 'f.txt' },
      { ...file('n.txt', 'added-by-them'), renameOf: 'f.txt' },
      file('gone.dart', 'deleted-by-us')
    ]
    const session = nextConflictSession(undefined, 'k', files, ['f.txt', 'm.txt', 'n.txt', 'gone.dart'])
    expect(session.files).toEqual(['f.txt', 'gone.dart'])
    expect(conflictProgress(stripEntries(session, files))).toEqual({ total: 2, resolved: 0, left: 2 })
  })

  it('moves to the next open file, wrapping, and says when none is left', () => {
    const entries = stripEntries(
      { key: 'k', files: ['a', 'b', 'c'], folded: [], choices: {} },
      [file('a', 'both-modified', 1), file('c', 'both-modified', 1)]
    )
    expect(nextOpenFile(entries, 'a')).toBe('c')
    expect(nextOpenFile(entries, 'c')).toBe('a')
    expect(nextOpenFile(entries, 'b')).toBe('c')
    expect(nextOpenFile(stripEntries({ key: 'k', files: ['a'], folded: [], choices: {} }, []), 'a')).toBeNull()
  })

  it('adds the answers of every file', () => {
    expect(
      sumChoices({
        a: { ours: 2, theirs: 0, both: 1, edited: 0 },
        b: { ours: 0, theirs: 1, both: 0, edited: 1 }
      })
    ).toEqual({ ours: 2, theirs: 1, both: 1, edited: 1, total: 5 })
  })

  it('counts the lines one side changed as the larger of added and removed', () => {
    expect(changedLineCount('@@ -1,2 +1,2 @@\n-a\n+b\n c')).toBe(1)
    expect(changedLineCount('@@ -1 +1,3 @@\n a\n+b\n+c')).toBe(2)
    expect(changedLineCount(null)).toBe(0)
  })
})

describe('picking from the result cards', () => {
  const text = [
    'top',
    '<<<<<<< HEAD',
    'mine',
    '=======',
    'yours truly',
    '>>>>>>> feature',
    'middle',
    'shared',
    '<<<<<<< HEAD',
    'a1',
    '=======',
    'b1',
    '>>>>>>> feature',
    'end'
  ].join('\n')
  const { hunks, oursContent } = parseHunks(text)

  it('keeps exactly one side, or both, per conflict', () => {
    let sel = pickHunk(hunks[0], 'theirs', new Set())
    expect(assemble(hunks, oursContent, sel).text.split('\n').slice(0, 2)).toEqual(['top', 'yours truly'])
    expect(hunkChoice(hunks[0], sel, true)).toBe('theirs')
    sel = pickHunk(hunks[0], 'both', sel)
    expect(hunkChoice(hunks[0], sel, true)).toBe('both')
    sel = pickHunk(hunks[0], 'ours', sel)
    expect(hunkChoice(hunks[0], sel, true)).toBe('ours')
    expect(hunkChoice(hunks[1], sel, false)).toBe('open')
  })

  it('takes one side for the whole file', () => {
    const sel = pickSideEverywhere(hunks, 'ours', pickHunk(hunks[1], 'theirs', new Set()))
    expect(hunks.map((h) => hunkChoice(h, sel, true))).toEqual(['ours', 'ours'])
  })

  it('tallies the answers, counting a hand-edited conflict as edited', () => {
    const sel = pickHunk(hunks[1], 'both', pickHunk(hunks[0], 'ours', new Set()))
    const all = new Set([0, 1])
    expect(countChoices(hunks, sel, all, new Set(), false)).toEqual({ ours: 1, theirs: 0, both: 1, edited: 0 })
    expect(countChoices(hunks, sel, all, new Set([1]), true)).toEqual({ ours: 1, theirs: 0, both: 0, edited: 1 })
    // Rewritten wholesale (an AI proposal): every conflict is a hand answer.
    expect(countChoices(hunks, sel, all, new Set(), true).edited).toBe(2)
  })

  it('places each conflict in the base between the context around it', () => {
    const base = ['top', 'original', 'middle', 'shared', 'base a', 'end'].join('\n')
    expect(baseRegions(base, oursContent, hunks)).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 5 }
    ])
  })
})
