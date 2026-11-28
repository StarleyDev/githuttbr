---
title: Edit any commit
category: Branching & surgery
order: 46
summary: Rewrite a historical commit's files or message in place — cascade previewed first.
keywords: edit commit rewrite history amend past reword fix typo cascade replay rebase in place surgery compare with original add file what will happen unapplied changes
---

# Edit any commit

The typo is in a commit from three weeks ago. The usual fix is an interactive
rebase: stop at the commit, edit, continue, pray. GitHuttBr's fix is: right-click
the commit, **Edit this commit**, change the text, done. The pen button in the
commit details panel opens the same editor.

![Editing a historical commit](../screenshots/commit-edit.webp)

## What it does

Pick any commit that is an ancestor of `HEAD` — linear history or not. The
editor opens in the centre pane, in place of the commit graph — where the
conflict resolver and the file viewer open — and takes the full width and
height of the window. **Esc** or **×** in its header closes it. Your edits
survive switching to another repository tab and back, and closing with
unapplied edits asks first.

The header names the commit — its short hash, subject, author and age — and,
once you have changed something, a yellow pill counts the **unapplied changes**:
one for the message, one for each file you edited.

### The message card

The message gets the same tools as the [commit composer](committing.md): the
**type ▾** button before the summary, the summary with its length counter
(*56/72*) and the description below it, the style row behind the chevron
(scope, ticket key, commit style), the gitmoji picker, co-authors, AI generation from the commit's own diff and the
linter's hints. The commit's message is split when it loads — the first line
becomes the summary, the rest the description — and joined back with one blank
line when you rewrite. Turning an old `add retry` into `fix: add retry` is one
pick from the type button.

As soon as the message differs from the original, the card is marked
**edited**, the old subject stays visible under the description as
*before: …*, and **Back to original** puts both summary and description back.

### The files card

The commit's files are listed with their status letter; a dot marks each one
you have changed. Pick a file to edit it as it was in that commit. The switch
above the editor flips between **Edit** and **Compare with original**, which
shows the file's diff from what the commit holds to your edited text — the same
diff view the rest of the app uses.

**Add file** opens a file the commit did not touch, from the commit's own
snapshot: type part of its path and pick it. Once you edit it, the rewritten
commit changes that file too. It is marked with a **+** in the list.

![Comparing an edited file with the commit's original](../screenshots/commit-edit-compare.webp)

### What will happen

The panel beside the cards — under them in a narrow window — shows the chain a
rewrite touches: every commit above the edited one, from `HEAD` down, and the
edited commit itself at the bottom with what changes in it.

1. **Preview cascade** replays every commit above the edited one *in memory*
   (a chain of `merge-tree` cherry-picks — no checkout, no working tree, no
   refs). Each commit in the chain then says whether it **replays cleanly** or
   has a **conflict** in a named file, so you know **before anything moves**
   whether the edit ripples cleanly or collides with a later change. After any
   further edit the verdicts clear; **Preview again** reruns it.
2. **Rewrite history** does it for real: the same chain is built with plumbing,
   then the branch moves with `reset --keep` — your uncommitted changes are
   carried over, or the reset aborts and nothing has happened. A
   [guard snapshot](recovery.md) is taken first, and **Undo** restores the old
   chain.

When the commit is already on a remote, a yellow note names the remote branch
and says what that means: the next push has to be forced. Another note says how
many commits get new hashes.

Authorship and dates of every replayed commit are preserved; only the hashes
change — that is what rewriting history means.

## Merges in the range

![Editing a commit below two merges — the cascade replays them](../screenshots/commit-edit-merges.webp)

A merge between the commit and `HEAD` no longer disables editing. The cascade
replays a merge by reapplying its **recorded result** — the tree the merge
actually committed, conflict resolutions included — onto the rewritten parent,
so resolutions someone made by hand survive the rewrite verbatim. No rerere, no
re-merging, no worktree: the same in-memory plumbing as the rest of the
cascade, and both parent pointers are preserved. A side branch that also
contains the edited commit is rewritten and re-pointed; one that does not keeps
its identity untouched. A note in the side panel says how many merges the range
carries, and merge commits show a merge icon in the chain.

The honest caveat: a replayed merge is only as good as its recorded result. If
your edit collides with lines the merge itself resolved, the preview goes red
exactly like any other conflicting step — nothing is guessed.

## When the cascade conflicts

A later commit touched the same lines you are editing. The preview marks that
commit with the conflicting file, the commits above it as not replayed, and
**Rewrite history** stays off — nothing is half-applied, ever. Unlike a rebase,
the editor does not stop midway to let you resolve the conflict: either edit
differently, or take the conflict head-on with an
[interactive rebase](rebase.md).

## Limits

- **The commit must be an ancestor of `HEAD`.** A commit on an unmerged side
  branch has no path to your current branch to replay.
- Binary files and files over 2 MB are shown but not editable.
- A commit that is already on a remote can be edited, but your next push will
  have to be a **force push** — the editor warns before you commit to that.
- Deleted files in the commit can't be edited (there is no content to edit).
- **Add file** reaches files that already exist in the commit's snapshot; it
  cannot create a brand-new file, delete one, or touch a symlink or submodule.

**See also:** [Interactive rebase](rebase.md) · [Recovery & snapshots](recovery.md) · [Absorb](absorb.md)
