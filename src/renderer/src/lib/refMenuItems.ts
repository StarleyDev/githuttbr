import type { MenuItem } from '../stores/ui'
import { useUIStore } from '../stores/ui'
import { repoActions } from '../stores/repo'
import { refIntegrationActions, type RefActionId } from './refMenu'
import { openBranchCompare } from './branchCompare'
import { t, interp } from '../i18n'
import { menuActionIcon, type MenuActionId } from './menuActionIcons'

/**
 * The shared "what to do with this ref" block, wired to the store.
 *
 * Every surface that right-clicks a ref renders this and appends its own
 * extras, so an action added here shows up everywhere at once. The rules for
 * *which* entries are offered live in `refMenu.ts`, which is pure and tested.
 */
const REF_ACTION_ICON: Record<RefActionId, MenuActionId> = {
  merge: 'merge',
  'merge-options': 'mergeOptions',
  rebase: 'rebase',
  compare: 'compare'
}

export function refIntegrationItems(repoPath: string, ref: string, current: string): MenuItem[] {
  return refIntegrationActions(ref, current).map((action) => {
    const label = interp(t(action.labelKey), action.vars)
    const base = { ...menuActionIcon(REF_ACTION_ICON[action.id]), label, disabled: action.disabled }
    switch (action.id) {
      case 'merge':
        return { ...base, onClick: () => void repoActions.merge(repoPath, ref) }
      case 'merge-options':
        return {
          ...base,
          onClick: () => useUIStore.getState().openModal({ kind: 'merge-options', repoPath, source: ref })
        }
      case 'rebase':
        return { ...base, onClick: () => void repoActions.rebase(repoPath, ref) }
      default:
        return {
          ...base,
          onClick: () => openBranchCompare({ repoPath, branchA: ref, branchB: current || 'HEAD' })
        }
    }
  })
}
