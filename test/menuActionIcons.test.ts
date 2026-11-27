import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { MENU_ACTION_ICONS, menuActionIcon, type MenuActionId } from '../src/renderer/src/lib/menuActionIcons'

const ids = Object.keys(MENU_ACTION_ICONS) as MenuActionId[]
const toneOf = (id: MenuActionId): string => MENU_ACTION_ICONS[id].tone

describe('menu action icons', () => {
  it('draws a 15px icon of the mapped component, with the mapped tone', () => {
    const { icon, tone } = menuActionIcon('copy')
    expect(isValidElement(icon)).toBe(true)
    if (!isValidElement<{ size: number }>(icon)) return
    expect(icon.type).toBe(MENU_ACTION_ICONS.copy.Icon)
    expect(icon.props.size).toBe(15)
    expect(tone).toBe('shelf')
  })

  it('colours each action family the same way', () => {
    const family: Record<string, MenuActionId[]> = {
      ref: ['alias', 'addToGroup', 'moveToFolder', 'moveToWorkspace', 'checkout', 'createBranch', 'createTag', 'merge', 'rebase', 'cherryPick', 'revert', 'compare', 'worktree'],
      outgoing: ['push', 'createPr', 'pushAndCreatePr', 'openOnHost', 'goToRelease'],
      incoming: ['pull', 'fastForward'],
      shelf: ['favourite', 'stashApply', 'stashPop', 'pin', 'unpin', 'copy', 'copyLink', 'editMessage'],
      guard: ['reset', 'undoCommit', 'moveBranch', 'delete'],
      preview: ['rangeDiff', 'conflictRadar', 'openTerminal', 'reveal', 'openEditor']
    }
    for (const [tone, members] of Object.entries(family)) {
      for (const id of members) expect([id, toneOf(id)]).toEqual([id, tone])
    }
  })

  it('keeps the destructive tone for destructive actions only', () => {
    const guarded = ids.filter((id) => toneOf(id) === 'guard').sort()
    expect(guarded).toEqual([
      'closeOtherTabs',
      'closeTab',
      'delete',
      'moveBranch',
      'removeFromList',
      'reset',
      'undoCommit'
    ])
  })

  it('gives different actions different icons, except where they are the same gesture', () => {
    const byIcon = new Map<unknown, MenuActionId[]>()
    for (const id of ids) byIcon.set(MENU_ACTION_ICONS[id].Icon, [...(byIcon.get(MENU_ACTION_ICONS[id].Icon) ?? []), id])
    const shared = [...byIcon.values()].filter((group) => group.length > 1)
    // A stash is renamed with the same pencil as a branch, in the stash's own
    // colour; a new group and a new folder are both "a new container".
    expect(shared).toEqual([
      ['renameBranch', 'renameStash'],
      ['newGroup', 'newFolder']
    ])
  })
})
