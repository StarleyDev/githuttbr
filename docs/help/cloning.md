---
title: Cloning
category: Start here
order: 2
summary: Clone from a URL or straight from your host — and narrow what comes down when the repository is enormous.
keywords: clone background cancel abort multiple several batch many repositories select all shallow depth partial filter blob none single branch submodules recursive ls-remote branch picker unshallow monorepo
---

# Cloning

**New repository → Clone**, or `⌘K` → *Clone*. Paste a URL, or sign in to
GitHub, GitLab, Bitbucket or Azure DevOps and pick from your own repositories —
the token for the chosen [profile](profiles.md) is used for the clone and then
dropped, never written into `.git/config`.

The dialog's **profile picker** decides one account for the whole job: the
host tab lists repositories as that profile, the clone signs in as it — a
self-hosted server's token is the one that profile saved for that server — and
the new repository is then bound to it, so later fetches, pull requests and CI
run as the same account. Changing the picker reloads the list. A profile with
no credential for the host clones anonymously; it never falls back to the
active profile's.

Choose a parent folder and a name; the line under the fields shows exactly where
the repository will land. A folder that already exists is refused rather than
merged into.

## Several repositories at once

Setting up a new machine, or pulling down every service a team owns, used to
mean opening this dialog once per repository. In a host tab, tick the checkbox
on each repository you want, or **Select all shown** to take everything the
filter matches. Clicking a row (not its checkbox) still picks that one alone.

With more than one ticked, the dialog clones them all into the same parent
folder, each in a folder named after the repository. The paths are listed before
you start. If two have the same name (`org-a/app` and `org-b/app`), both get
the owner in their folder name (`org-a-app`, `org-b-app`) instead of racing for
one folder.

![The GitHub tab of the clone dialog with three repositories ticked, the folders they will land in listed under the parent folder, and a Clone 3 repositories button](../screenshots/clone-multi-select.webp)

The batch goes straight to the corner tray. Three clones run at a time and the
rest wait as *Queued*; each has its own cancel. Each repository opens in a tab
as it finishes.

Limits:
- **Branch to check out** is hidden for a batch: a branch name means nothing
  across different repositories, so each one gets its default branch. The other
  Advanced options (partial, shallow, single branch, submodules) apply to all.
- Multi-select works in the host tabs only. The URL tab takes one URL.
- One failure does not stop the others. A repository whose folder already
  exists fails with its own error and the rest carry on.

## Advanced — narrowing the clone

Everything under **Advanced** is off by default: leave it alone and you get an
ordinary, complete clone. It earns its place on repositories where "complete"
means twenty minutes and several gigabytes.

![The clone dialog with Advanced open: partial, shallow, single-branch, submodules and a branch picker](../screenshots/clone-advanced.webp)

| Option | What git does | What it costs |
|--------|---------------|---------------|
| **Partial clone** | `--filter=blob:none` | Full history, no file contents. Blobs arrive on demand, so opening an old file needs the network. |
| **Shallow clone** | `--depth=N` | Only the newest N commits exist. Blame, log, bisect and range-diff stop at the cut. |
| **Only one branch** | `--single-branch` | The other branches stay on the remote until you fetch them. |
| **Clone submodules** | `--recurse-submodules` | Every submodule is checked out too — more time now, no missing directories later. |
| **Branch to check out** | `--branch <name>` | Starts on that branch instead of the remote's default. |

**Partial before shallow.** A partial clone keeps every commit — history stays
searchable, and only file contents are fetched lazily. A shallow clone actually
discards history: `git log` ends at the cut and blame cannot see past it. If you
are cloning a monorepo to work in, partial is usually the one you want.

Shallow is undoable: `git fetch --unshallow` in the [terminal](terminal.md)
fills the history back in.

### Picking the branch

Type a branch name, or press **List branches** to ask the remote what it has
(`git ls-remote --heads`) and choose from a dropdown. That is one network round
trip, made only when you press the button — nothing is queried while you type.

If the listing fails — a private URL with no token yet, a typo, no network — the
field stays a plain text box and the clone itself reports the real error.

### Two notes on the flags

- **`--depth` implies `--single-branch`.** With a shallow clone, leaving *Only
  one branch* unchecked is what asks for the other branches back
  (`--no-single-branch`), which is why the hint under it changes.
- **Cloning a local folder** normally ignores `--depth` entirely, because git
  hardlinks the object store instead of fetching. Gitcito clones through a
  `file://` URL when you ask for a shallow copy of a local repository, so the
  depth you asked for is the depth you get.

## Progress, background and cancelling

The bar reports what git reports: counting, compressing, receiving, resolving,
checking out. A stage that cannot report a total shows an indeterminate bar
rather than a fake percentage.

A big clone takes minutes, and a stray click outside the dialog used to cost
you all of it. Now closing the dialog — **Run in background**, `Esc`, the ✕ or a
click outside — only hides it: the clone keeps going and moves to a small card
in the bottom corner with the same progress bar. You can start another clone
meanwhile; each gets its own card.

![The clone tray in the bottom corner: three clones receiving, resolving and counting, a fourth queued, each with its own cancel button](../screenshots/clone-tray.webp)

Picked the wrong repository? **Cancel clone** in the dialog, or the ✕ on its
card, stops git and deletes the half-written folder. Nothing else is touched —
the folder did not exist before the clone started, which is checked up front.
A cancelled clone cannot be resumed; starting it again starts from zero.

When it finishes, the new repository opens in a tab, pinned to the profile you
cloned with, whether or not the dialog is still open.

Clones run inside the app, so quitting Gitcito stops them. The quit does not
wait for the cleanup, so the half-written folder can be left behind — delete it
before cloning there again, since the dialog refuses a folder that exists.
