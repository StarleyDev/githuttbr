---
title: Resolving conflicts
category: Working with changes
order: 32
summary: One screen for the whole conflicted step — every file, the common ancestor, an answer per conflict, and the finish line.
keywords: conflict resolver merge conflicts ours theirs base common ancestor resolve markers three-way modify delete rename rerere reuse recorded resolution remember replay finish continue abort
---

# Resolving conflicts

When a merge, rebase, cherry-pick or revert stops, the resolver turns the whole
step into one screen. The bar at the top says **what** stopped and **between
what** — "Merging `feature` into `main`", not just "conflict" — and how far
along you are: *2 of 5 files resolved*, with the conflicts still left across
every file.

![The conflict resolver](../screenshots/conflict-resolver.webp)

## The file strip

Under the bar, one chip per file this step stopped on:

| Chip | Means |
|---|---|
| Green with ✓ | Resolved — staged, nothing left to decide |
| Outlined | The file you are on |
| A red number | How many conflict blocks the file still holds |
| A label | A conflict with no text to merge: *deleted on one side*, *renamed on both sides*, *added on one side* |

Resolved chips come first and open ones after, each run in name order, so the
strip reads as done on the left and what is left on the right.

**Next file →** jumps to the next one still open, and marking a file resolved
moves you there on its own. **Continue** in the bar stays disabled until every
chip is green; **Abort** asks first and says what you lose.

git forgets a file the moment it is staged, so "resolved" is what GitHuttBr saw
during this step, plus the files git listed in its merge message. A file you
staged in a terminal before opening the resolver still counts; after a restart
mid-rebase, the resolved half of that one step may not.

## Why this conflicts

**Why this conflicts** in the file header lists, per side, the commits that
touched this file since the branches parted — `git log --merge`, which git has
shipped forever and nobody finds.

![The commits from each side that touched the conflicted file](../screenshots/conflict-why.webp)

Markers say what clashes. This says who changed it and why, which is usually
what actually decides the resolution. Nothing there means neither side committed
a change to this exact path — the clash came from a rename or a move.

The header also says which conflict you are on and what kind of conflict the file
is in, read from git's own status: *both sides changed the same lines*, *added on
both sides*.

## The three panes

| Pane | Is |
|---|---|
| **Yours** | The side you were on, headed by the newest commit on that side that touched the file: sha, subject, author, how long ago |
| **Base** | The version both sides started from — the common ancestor, or for a pick or a rebase step, the parent of the commit being applied. The lines each conflict replaced are shaded |
| **Incoming** | The side coming in, headed the same way as Yours |

**Show base** in the result header hides or shows the Base pane, and remembers
your choice. It is greyed out when there is no base — both sides added the file.

All panes resize, and the result header carries two view toggles:

| Toggle | What it does |
|---|---|
| **Wrap** | Folds long lines inside the side panes instead of scrolling them. The text view of the result keeps one row per line — its side markers depend on that — so it always scrolls |
| **Link scrolling** | Scrolls the panes and the result together, vertically and sideways. Their line counts differ, so the vertical position is matched by proportion |

Wrap starts off, Link scrolling starts on, and both remember their state.

## The result

The result is the file as it will be written. Each conflict sits in place as a
card with four answers on it:

| Answer | What lands in the file |
|---|---|
| **Use yours** | Your lines, and only yours |
| **Use theirs** | Their lines, and only theirs |
| **Both** | Your lines, then theirs |
| **Edit** | Both, opened in the text editor with the conflict selected, for when the answer is "both, but adjusted" |

An unanswered card previews both sides, each line tagged *← yours* or *←
theirs* and numbered with the line it lands on if picked, so you can decide
without looking up. On a file with very long lines the answers stay in view
while the code scrolls sideways under them. **Whole file: yours | theirs** in
the file header answers every conflict at once.

**Edit as text** switches the result to a plain editor for free typing, with
the file's line count in the header. Once you
have typed, the cards no longer describe what is there, so the text stays until
**Reset choices** puts everything back.

The footer counts what is left in this file; **Mark *file* as resolved** writes
the result and stages it, and is disabled until every conflict has an answer.

## Getting around

Opening a file lands you on its **first conflict**, not at the top of the file.
The ⌃ / ⌄ arrows in the result header — or <kbd>Alt+↑</kbd> /
<kbd>Alt+↓</kbd> — step through the rest, scrolling every pane to each one.

## Picking by line

The side panes still pick per **line** and per **chunk**, and their header
checkbox takes the **whole side** — for the answer no card offers, such as two
lines of yours and one of theirs. Line-level picks show up in the cards as they
happen.

## Files with nothing to merge

Some conflicts have no lines to compare: one side **deleted** a file the other
changed, or both sides **renamed** it to different names. Three panes with one
of them empty would explain nothing, so these get a card instead — who did what,
with the commit, author and age of each side.

![A file deleted on one side and changed on the other](../screenshots/conflict-deleted.webp)

| Case | Choices |
|---|---|
| Deleted on one side | **Keep the file** (with the changes the other side made), **Delete the file** (asks first), and **See what you changed** — the diff from the base, so you know what deleting throws away |
| Renamed on both sides | **Keep** one name, the other, or **both names** |

git records no link between a renamed original and its two new names, so the
card pairs them by content. When it cannot tell — several renames at once, and
the files changed too — it says so, and the new names appear as their own chips.

## Finishing

When the last file is resolved, the workspace does not send you looking for
**Continue**: a card sums up how the conflicts were answered, lets you edit the
merge message (prefilled from git's own), and finishes from there.

![Every conflict resolved, with the merge message and the rerere switch](../screenshots/conflict-done.webp)

- The summary counts what it saw you choose: yours, theirs, both, edited by hand.
  A file resolved outside the resolver counts as a file, not as an answer.
- A **rebase** step keeps the replayed commit's own message, so there is no
  message box for it.
- **Remember these resolutions (rerere)** is git's `rerere.enabled`, the same
  switch as in Settings. git only remembers conflicts it saw happen, so turning
  it on here takes effect from the next one.
- **Review again** closes the resolver on the staged result.

## Undo

Every resolution — a file marked resolved, a side taken, a file kept or deleted,
a rename settled — has an undo entry. Undo puts the conflict back exactly as git
left it: the markers, both sides and the base in the index, the file on disk.
**Abort** is the one thing that cannot be undone, which is why it asks.

## AI assist

With AI enabled, **Resolve with AI** proposes a merge into the result, as text.
It never applies anything on its own: you read it, edit it, and stage it. See
[AI features](ai.md).

## Xcode project files

`project.pbxproj` conflicts more than any other file in an iOS repository, and
almost never because anyone disagreed. It is one flat dictionary of objects
keyed by 24-hex ids, so adding one file writes four entries — a `PBXBuildFile`,
a `PBXFileReference`, a line in the owning group's `children`, a line in the
target's build phase. Two people adding a file each write eight entries that
land on the same handful of lines. Git sees a collision; there is nothing to
resolve.

When the conflicted file is a `project.pbxproj`, the resolver reads all three
versions as projects rather than as text and offers to **merge by structure**:
match objects by id, take every addition from both sides, union the `children`
and `files` arrays, and stop at whatever genuinely diverged. The band above the
panes says what each side added and what — if anything — is left for you.

Like the AI proposal, it lands in the result and stages nothing. You read
it before you save.

![The structural-merge band above the conflict panes, on an Xcode project file](../screenshots/conflict-pbxproj.webp)

### What it refuses to do

**It never guesses at a setting you both moved.** If you set
`MARKETING_VERSION` to `1.1` and they set it to `2.0`, that is a decision, and
it is named in the band — the setting, your value, theirs — rather than resolved
behind your back. An object it could not settle keeps *your* version exactly, so
a half-applied merge never reaches disk.

**It refuses the whole file if any of the three versions will not parse.** A
`project.pbxproj` Xcode cannot open costs more than a manual merge, so anything
it cannot read with certainty stays an ordinary text conflict, and it says so.

**It does not detect two ids minted for different objects.** Rare, since Xcode
picks ids at random — but when it happens, taking either side would silently
drop somebody's file, so it is reported instead of merged.

### Not `merge=union`

The remedy that circulates for this is `*.pbxproj merge=union` in
[`.gitattributes`](attributes.md). Avoid it. Union works while the only changes
are independent additions, and the moment two people edit the same build setting
it emits both lines and produces a file Xcode refuses to open — at a moment when
you are least likely to be reading the diff carefully. Structural merging is the
same convenience without that failure.

## Lockfiles

`Podfile.lock`, `Package.resolved`, `yarn.lock` and their cousins record a
dependency graph somebody's resolver already solved. Half of one solution
stitched to half of another is a graph nobody solved: it may not install, and if
it does, it installs something neither branch tested.

So when the conflicted file is a lockfile, the band names the tool that owns it,
offers **Keep ours** and **Keep theirs** right there, and gives you the command
that regenerates it afterwards. Taking a side is not a compromise here — it is
the whole method, and the regeneration is what makes it correct.

![The lockfile band above the conflict panes](../screenshots/conflict-lockfile.webp)

The three panes stay available, because now and then you do want to read what
changed — a checksum you recognise, a version you were expecting. Editing them
by hand is the thing this is trying to talk you out of.

## Avoiding them in the first place

[Conflict radar](conflict-radar.md) tells you which branches will conflict
before you merge any of them.

## Letting git remember (rerere)

Rebase a long-lived branch and you meet the same conflict every time. `rerere`
— *reuse recorded resolution* — is git's answer: it memorises how you settled a
conflict and replays that answer the next time the identical one appears.

**Settings → Git & sync → Remember conflict resolutions.** It writes
`rerere.enabled` to your global git config, so the command line behaves the same
way.

When git has answered for you, the resolver says so instead of showing an empty
"no conflict markers" screen, and offers **Forget this resolution** — which drops
the memory *and* brings the conflict back, so you can settle it differently.

Two things worth knowing:

- **A replayed resolution is not staged** unless you turn on *Stage a replayed
  resolution automatically*. Leave that off: the point of the pause is that a
  memorised answer can be wrong for this particular merge, and staging without
  looking is how it reaches a commit.

  This is why a replayed file **stays in Conflicted files**: git wrote the
  content but the index still holds it as unmerged, and only staging settles
  that. **Stage as-is** in the resolver, or **Mark all resolved** in the list,
  is what moves it.
- **rerere does not understand every conflict.** Add/add and delete/modify
  conflicts get no preimage, so they always come back raw. The count in Settings
  is how many it actually holds, and **Forget all** empties it.

**See also:** [Conflict radar](conflict-radar.md) · [Merging & rebasing](merging.md)
