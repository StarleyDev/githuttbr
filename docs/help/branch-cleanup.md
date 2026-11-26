---
title: Branch cleanup
category: Branching & surgery
order: 47
summary: Delete the local branches whose work already lives elsewhere — gone upstreams, merged branches — in one undoable step.
keywords: clean up cleanup prune delete remove local branches gone merged stale dead old pull request squash tidy branch list
---

# Branch cleanup

Every pull request you check out leaves a local branch behind. The PR merges,
the server deletes its branch, and the local one stays — forever. After a few
hundred reviews the branch list is mostly dead branches, and finding the live
ones means scrolling past all of them.

Branch cleanup lists the local branches whose work is already safe somewhere
else, ticks the ones with nothing to lose, and deletes them in one step you can
undo. "Somewhere else" means the remote-tracking branches as of your last fetch,
and the default branch.

![The cleanup dialog: gone, merged and squash-merged branches ticked, work that exists only here held back](../screenshots/branch-cleanup.webp)

## How it works

1. Tools → **Clean up local branches…** (or <kbd>⌘K</kbd>).
2. Press **Fetch & prune** first if the last fetch is old. Until a pruning fetch
   runs, a branch the server deleted still looks alive here.
3. If your team squash-merges pull requests, press **Check squash merges** (see
   below).
4. Check the ticks, then **Delete**. One confirmation says how many branches go
   and names every one that holds commits found nowhere else.

The deletion is one operation with one undo entry: **Undo** recreates every
deleted branch at the exact commit it pointed at, with its upstream
(`branch.<name>.remote` and `.merge`) put back. If a branch of the same name
has appeared since at another commit — the same PR checked out again — undo
leaves it alone and brings the deleted one back beside it, as
`<name>-restored-<short sha>`, and says so.

The success message and the undo entry list each branch with the commit it
pointed at (`feature/x (was abc1234)`), as `git branch -D` prints it: undo
history lives only as long as the app is open, and that line is enough to
recreate a branch by hand.

## Why a branch is listed

| Chip | Means |
|---|---|
| **Gone** | The branch tracks an upstream the server has deleted — the usual trace of a merged pull request. |
| **Merged** | Every commit on it is already in the default branch. The tooltip names the copy that holds it — `main (local, not pushed)` when only your local one does. |
| **Squash-merged** | Found by **Check squash merges**: its content is in the default branch, its individual commits are not. |
| **Stale** | No commit for the number of months you choose (3 by default). Only listed when you tick **Also list stale branches**. |
| **N commits exist only here** | Commits that are on no remote-tracking branch and not in the default branch. Deleting the branch deletes them. |
| **No commits yet** | It points exactly at the default branch's tip — probably created and never used. |

"Merged" is measured against the remote's copy of the default branch
(`origin/main`), and against your local one as well — a local `main` nobody
pulled for a month cannot hide the merges since.

## Squash merges

A squash merge puts a pull request's changes on `main` as one new commit; the
branch's own commits never arrive. To git, such a branch looks like abandoned
work: **Gone**, with *N commits exist only here*.

When gone branches with commits of their own are listed, **Check squash
merges** asks a different question: would merging this branch into `main`
change anything? It runs one in-memory `git merge-tree` for all of them — no
checkout, no index — and a branch whose merge leaves `main`'s tree exactly as it
is gets the **Squash-merged** chip and is ticked like a merged one. The
confirmation says their content is in `main` and their commits are not.

The check runs again, under the lock, at the moment of deletion: a branch that
no longer passes it is refused, not deleted.

## What is ticked, and what never is

Ticked when the dialog opens: branches that are **gone or merged** and have
**no commits of their own** — plus squash-merged ones once checked. **Select
gone + merged** puts that selection back.

Never ticked for you, and never reached by **Select all shown**: a branch with
commits that exist only here. Tick it row by row; the confirmation then turns
red and lists it with its commit count. Stale-only branches and one sitting on
the default branch's tip are not ticked either. When the selection includes
rows the list is not showing — hidden by the filter, or past the first 400 —
the confirmation says how many.

The delete accepts, per branch, exactly the number of unique commits the
confirmation showed. If a branch has more by then — or, on **Redo**, has
gained some since the undo (say a prune removed the remote copy) — it is
refused and kept, and redo reports it instead of claiming success.

Never listed at all, and refused by the delete even if asked:

- the current branch;
- a branch checked out in any worktree, or being rebased in one;
- the default branch;
- [protected branches](repo-settings.md), including `release/*` style patterns
  from the [repository config](repo-config.md).

Nothing changes on the remote. This deletes local branches only.

## Limits

- **Squash merges are invisible to git** until you check. Without **Check
  squash merges**, a squash-merged branch shows as **Gone** with *N commits
  exist only here*, and is not ticked.
- **The squash check can miss.** It answers "is this content already in
  `main`?". When `main` later changed the same lines again, or the squash was
  edited while merging, the merge would change something, and the branch stays
  unticked. It never says yes wrongly in a way that loses content: the content
  is in `main` by definition. Like the [conflict radar](conflict-radar.md), it
  writes loose tree objects that `git gc` cleans up.
- **An unfetched remote is out of date.** "Gone" comes from the last fetch.
  Without **Fetch & prune**, a branch deleted on the server an hour ago still
  looks alive, and a fresh merge is not yet in `origin/main`.
- **Stale is only a date.** Three quiet months says nothing about whether the
  work is safe, which is why stale rows are never ticked.
- **"Elsewhere" is the remote-tracking refs as of the last fetch**, not the
  server right now — and not tags. A commit only a tag holds is counted as
  unique, and a commit that sits on someone else's remote branch is not.
- The unique-commit count stops at 500 and shows *500+*. The confirmation's total
  is a floor — *at least N* — because stacked branches share commits.
- Undo restores the branch and its upstream, not its reflog or other
  `branch.<name>.*` settings.
- The dialog shows the first 400 rows of a long list; the filter finds the rest.
  **Select gone + merged** applies to every row, shown or not.

**See also:** [Branches, remotes & the sidebar](branching.md) · [Fetching, pulling & pushing](syncing.md) · [Pull requests](pull-requests.md)
