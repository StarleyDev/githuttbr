import { useEffect, useState } from 'react'
import { gitApi } from '../infrastructure/api'
import { canonicalRepoPath } from '../lib/repoAlias'

// A repository's common git dir never changes, so one `rev-parse` per path
// for the life of the window answers "is this tab a linked worktree?".
const pending = new Map<string, Promise<string | null>>()
const known = new Map<string, string | null>()

/** The main worktree's folder when `root` names another folder than `path`. */
function linkedRoot(path: string, root: string | null | undefined): string | null {
  return root && canonicalRepoPath(root) !== canonicalRepoPath(path) ? root : null
}

function resolve(path: string): Promise<string | null> {
  const key = canonicalRepoPath(path)
  let hit = pending.get(key)
  if (!hit) {
    hit = gitApi.worktreeRoot(path).then(
      (root) => {
        const linked = linkedRoot(path, root)
        known.set(key, linked)
        return linked
      },
      // A failed lookup (a drive not mounted yet) is not an answer: forget it,
      // so the next render asks again instead of the mark staying off.
      () => {
        pending.delete(key)
        return null
      }
    )
    pending.set(key, hit)
  }
  return hit
}

/** What is known before git answers: git's last answer, else the ref's tag. */
function firstGuess(path: string | undefined, tagged?: string): string | null {
  if (!path) return null
  const key = canonicalRepoPath(path)
  return known.has(key) ? (known.get(key) ?? null) : linkedRoot(path, tagged)
}

/**
 * The main repository's folder when `path` is a linked worktree, else null.
 * `tagged` is the ref's stored `worktreeRoot` (set when the worktree was opened
 * from its family): it answers at once, but git is still asked once per path —
 * a tag goes stale when the main checkout is moved (Locate…), and a worktree
 * opened from Open repository or the scanned list has none.
 */
export function useWorktreeRoot(path: string | undefined, tagged?: string): string | null {
  const [root, setRoot] = useState<string | null>(() => firstGuess(path, tagged))
  useEffect(() => {
    // A new path drops the previous one's mark as soon as it changes.
    setRoot(firstGuess(path, tagged))
    if (!path) return
    let live = true
    void resolve(path).then((r) => live && setRoot(r))
    return () => {
      live = false
    }
  }, [path, tagged])
  return root
}

/** The answer already known for `path`, for synchronous callers (menus). */
export function knownWorktreeRoot(path: string, tagged?: string): string | null {
  return firstGuess(path, tagged)
}
