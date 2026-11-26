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
undo.

![The cleanup dialog with gone and merged branches ticked, and squash-merged ones held back](../screenshots/branch-cleanup.webp)

## How it works

1. Tools → **Clean up local branches…** (or <kbd>⌘K</kbd>).
2. Press **Fetch & prune** first if the last fetch is old. Until a pruning fetch
   runs, a branch the server deleted still looks alive here.
3. Check the ticks, then **Delete**. One confirmation says how many branches go
   and names every one that holds commits found nowhere else.

The deletion is one operation with one undo entry: **Undo** recreates every
deleted branch at the exact commit it pointed at, with its upstream
(`branch.<name>.remote` and `.merge`) put back.

## Why a branch is listed

| Chip | Means |
|---|---|
| **Gone** | The branch tracks an upstream the server has deleted — the usual trace of a merged pull request. |
| **Merged** | Every commit on it is already in the default branch. |
| **Stale** | No commit for the number of months you choose (3 by default). Only listed when you tick **Also list stale branches**. |
| **N commits exist only here** | Commits that are on no remote-tracking branch and not in the default branch. Deleting the branch deletes them. |
| **No commits yet** | It points exactly at the default branch's tip — probably created and never used. |

"Merged" is measured against the remote's copy of the default branch
(`origin/main`), and against your local one as well — a local `main` nobody
pulled for a month cannot hide the merges since.

## What is ticked, and what never is

Ticked when the dialog opens: branches that are **gone or merged** and have
**no commits of their own**. **Select gone + merged** puts that selection back.

Never ticked for you: a branch with commits that exist only here, a stale-only
branch, and one sitting on the default branch's tip. You can still tick them;
the confirmation then turns red and lists them with their commit counts.

Never listed at all, and refused by the delete even if asked:

- the current branch;
- a branch checked out in any worktree;
- the default branch;
- [protected branches](repo-settings.md), including `release/*` style patterns
  from the [repository config](repo-config.md).

Nothing changes on the remote. This deletes local branches only.

## Limits

- **Squash merges are invisible to git.** A squash-merged PR's commits never
  reach `main` — a new commit with the same content does. Such a branch shows as
  **Gone** with *N commits exist only here*, and is not ticked. That is the
  honest reading: git cannot tell a squash merge from abandoned work.
- **An unfetched remote is out of date.** "Gone" comes from the last fetch.
  Without **Fetch & prune**, a branch deleted on the server an hour ago still
  looks alive, and a fresh merge is not yet in `origin/main`.
- **Stale is only a date.** Three quiet months says nothing about whether the
  work is safe, which is why stale rows are never ticked.
- **"Exists only here" counts remote-tracking refs, not tags.** A commit only a
  tag holds is counted as unique, and a commit that sits on someone else's
  remote branch is not.
- The unique-commit count stops at 500 and shows *500+*.
- Undo restores the branch and its upstream, not its reflog or other
  `branch.<name>.*` settings.
- The dialog shows the first 400 rows of a long list; the filter finds the rest.
  Selection and **Select gone + merged** apply to every row, shown or not.

**See also:** [Branches, remotes & the sidebar](branching.md) · [Fetching, pulling & pushing](syncing.md) · [Pull requests](pull-requests.md)
