import { useUIStore, type CompareViewState } from '../stores/ui'
import { t } from '../i18n'

type CompareTarget = Pick<CompareViewState, 'repoPath' | 'branchA' | 'branchB'>

/**
 * Open the branch comparison in the centre pane. The conflict resolver and the
 * commit editor hold work in progress and sit above it, so a comparison opened
 * behind one would be invisible: ask for that one to be closed first.
 */
export function openBranchCompare(target: CompareTarget): void {
  const ui = useUIStore.getState()
  if (ui.conflictView?.repoPath === target.repoPath || ui.commitEditView?.repoPath === target.repoPath) {
    ui.toast('info', t('compare.closeEditorFirst'))
    return
  }
  // Opened from a menu or from another dialog (the radars): that one is done.
  ui.closeModal()
  ui.setCompareView({ ...target, mode: 'all', commit: '', file: '' })
}
