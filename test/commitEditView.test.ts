import { beforeEach, describe, expect, it, vi } from 'vitest'

// The view module pulls in the API, the repo and settings stores and the
// dictionaries; none of that is under test here, only the open/close rules.
vi.mock('../src/renderer/src/infrastructure/api', () => ({ gitApi: {}, aiApi: {} }))
vi.mock('../src/renderer/src/stores/repo', () => ({ repoActions: {}, useRepoStore: () => '' }))
vi.mock('../src/renderer/src/stores/settings', () => ({ useSettingsStore: () => undefined }))
vi.mock('../src/renderer/src/i18n', () => ({
  // The discard prompt carries a {sha} token, as the real dictionaries do.
  t: (key: string) => (key === 'commitEdit.discardConfirm' ? 'Edits to {sha} are unapplied' : key),
  useT: () => (key: string) => key,
  interp: (s: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, String(v)), s)
}))

import { useUIStore, type CommitEditDraft } from '../src/renderer/src/stores/ui'
import { openCommitEdit } from '../src/renderer/src/components/CommitEditView'

const A = { repoPath: '/repo', sha: 'a'.repeat(40), subject: 'feat: a' }
const B = { repoPath: '/repo', sha: 'b'.repeat(40), subject: 'feat: b' }
const draft = (dirty: boolean): CommitEditDraft => ({ parts: { summary: 'm', description: '' }, files: {}, selFile: '', dirty })

beforeEach(() => {
  useUIStore.setState({ commitEditView: null, modal: null })
})

describe('commit editor in the centre pane', () => {
  it('keeps a draft only for the editor that is still open', () => {
    useUIStore.getState().setCommitEditView(A)
    useUIStore.getState().saveCommitEditDraft(A.repoPath, A.sha, draft(true))
    expect(useUIStore.getState().commitEditView?.draft?.dirty).toBe(true)

    // A late save from an editor that has since been replaced must not land on
    // the new one — it would mark a clean editor dirty, or resurrect old text.
    useUIStore.getState().setCommitEditView(B)
    useUIStore.getState().saveCommitEditDraft(A.repoPath, A.sha, draft(true))
    expect(useUIStore.getState().commitEditView).toEqual(B)

    useUIStore.getState().setCommitEditView(null)
    useUIStore.getState().saveCommitEditDraft(B.repoPath, B.sha, draft(true))
    expect(useUIStore.getState().commitEditView).toBeNull()
  })

  it('keeps an emptied summary empty, with the description where it was', () => {
    useUIStore.getState().setCommitEditView(A)
    const parts = { summary: '', description: 'Why: retries duplicated orders.' }
    useUIStore.getState().saveCommitEditDraft(A.repoPath, A.sha, { parts, files: {}, selFile: '', dirty: true })
    // Kept apart, not joined into one message: joined, the description would
    // come back as the summary when the editor is shown again.
    expect(useUIStore.getState().commitEditView?.draft?.parts).toEqual(parts)
  })

  it('reopening the commit already open keeps its draft', () => {
    useUIStore.getState().setCommitEditView({ ...A, draft: draft(true) })
    openCommitEdit(A)
    expect(useUIStore.getState().commitEditView?.draft?.dirty).toBe(true)
    expect(useUIStore.getState().modal).toBeNull()
  })

  it('switches commits straight away when nothing is unapplied', () => {
    useUIStore.getState().setCommitEditView({ ...A, draft: draft(false) })
    openCommitEdit(B)
    expect(useUIStore.getState().commitEditView).toEqual(B)
    expect(useUIStore.getState().modal).toBeNull()
  })

  it('asks before another commit replaces unapplied edits', () => {
    useUIStore.getState().setCommitEditView({ ...A, draft: draft(true) })
    openCommitEdit(B)

    const modal = useUIStore.getState().modal
    expect(modal?.kind).toBe('confirm')
    expect(useUIStore.getState().commitEditView?.sha).toBe(A.sha)
    if (modal?.kind !== 'confirm') throw new Error('expected a confirm dialog')
    expect(modal.danger).toBe(true)
    expect(modal.message).toContain(A.sha.slice(0, 7))

    modal.onConfirm()
    expect(useUIStore.getState().commitEditView).toEqual(B)
  })
})
