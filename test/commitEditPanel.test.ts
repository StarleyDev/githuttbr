import { describe, it, expect } from 'vitest'
import {
  buildCascadeRows,
  countUnappliedChanges,
  describeCascadeStep,
  describeEditedCommit,
  describeUnappliedChanges,
  filterEditableFiles,
  firstConflictFile,
  pickPushedBranch
} from '../src/renderer/src/lib/commitEditPanel'
import type { CommitEditAbove, CommitEditPreview } from '../src/shared/types'

describe('commit editor panel logic', () => {
  it('counts the message once and every edited file', () => {
    expect(countUnappliedChanges(false, 0)).toBe(0)
    expect(countUnappliedChanges(true, 0)).toBe(1)
    expect(countUnappliedChanges(true, 2)).toBe(3)
    expect(describeUnappliedChanges(1).key).toBe('commitEdit.unappliedOne')
    expect(describeUnappliedChanges(3)).toEqual({ key: 'commitEdit.unapplied', vars: { n: 3 } })
  })

  it('says what changes in the edited commit', () => {
    expect(describeEditedCommit(false, 0).key).toBe('commitEdit.thisCommitNone')
    expect(describeEditedCommit(true, 0).key).toBe('commitEdit.thisCommitMessage')
    expect(describeEditedCommit(false, 1).key).toBe('commitEdit.thisCommitFile')
    expect(describeEditedCommit(false, 4)).toEqual({ key: 'commitEdit.thisCommitFiles', vars: { n: 4 } })
    expect(describeEditedCommit(true, 1).key).toBe('commitEdit.thisCommitBothOne')
    expect(describeEditedCommit(true, 2)).toEqual({ key: 'commitEdit.thisCommitBoth', vars: { n: 2 } })
  })

  it('joins the commits above to the preview steps by sha', () => {
    const above: CommitEditAbove[] = [
      { sha: 'c3', subject: 'three', merge: false },
      { sha: 'c2', subject: 'two', merge: true },
      { sha: 'c1', subject: 'one', merge: false }
    ]
    expect(buildCascadeRows(above, null).every((r) => r.step === undefined)).toBe(true)
    const preview: CommitEditPreview = {
      newTip: null,
      steps: [
        { sha: 'c1', subject: 'one', status: 'clean', files: [] },
        { sha: 'c2', subject: 'two', status: 'conflict', files: ['README.md', 'a.txt'], merge: true },
        { sha: 'c3', subject: 'three', status: 'blocked', files: [] }
      ]
    }
    const rows = buildCascadeRows(above, preview)
    expect(rows.map((r) => r.step?.status)).toEqual(['blocked', 'conflict', 'clean'])
    expect(describeCascadeStep(rows[0].step)?.key).toBe('commitEdit.stepBlocked')
    expect(describeCascadeStep(rows[1].step)).toEqual({
      key: 'commitEdit.stepConflictMore',
      vars: { file: 'README.md', n: 1 }
    })
    expect(describeCascadeStep(rows[2].step)?.key).toBe('commitEdit.stepClean')
    expect(describeCascadeStep(undefined)).toBeNull()
    expect(firstConflictFile(preview)).toBe('README.md')
    expect(firstConflictFile(null)).toBeNull()
  })

  it('names the upstream in the force-push warning when it holds the commit', () => {
    expect(pickPushedBranch([], 'origin/main')).toBeNull()
    expect(pickPushedBranch(['upstream/dev', 'origin/main'], 'origin/main')).toEqual({ remote: 'origin', branch: 'main' })
    expect(pickPushedBranch(['upstream/feature/x'], 'origin/main')).toEqual({ remote: 'upstream', branch: 'feature/x' })
  })

  it('searches the snapshot for a file to add, name matches first', () => {
    const all = ['README.md', 'src/readme/index.js', 'docs/guide.md', 'src/app.js']
    const listed = new Set(['README.md'])
    expect(filterEditableFiles(all, '', listed)).toEqual(['src/readme/index.js', 'docs/guide.md', 'src/app.js'])
    expect(filterEditableFiles(all, 'readme', listed)).toEqual(['src/readme/index.js'])
    expect(filterEditableFiles(all, 'md', new Set())).toEqual(['README.md', 'docs/guide.md'])
    expect(filterEditableFiles(all, 'src', new Set(), 1)).toEqual(['src/readme/index.js'])
  })
})
