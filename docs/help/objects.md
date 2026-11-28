---
title: Object explorer
category: Repository & history
order: 16
summary: Walk the layer beneath the graph — commits, trees, blobs, tags and the refs that point at them. Nothing here changes anything.
keywords: objects object explorer blob tree commit tag ref plumbing cat-file ls-tree sha1 internals database rev-parse HEAD^{tree} loose packed
---

# Object explorer

Git has a reputation for being complicated. Almost all of it comes from never
seeing the model: **four kinds of object, and pointers**. Once you can click a
commit, land on its tree, and find that your file *is* a blob with a name given
to it by a tree, the porcelain stops being magic.

`⌘K` → **Object explorer**. Nothing on this page can change a byte — every call
behind it is a read.

![The commit main points at: the path from the branch, what it points to, and where a commit sits in the model](../screenshots/objects.webp)

## The four objects

| Object | Is | Knows |
|--------|----|-------|
| **blob** | The *contents* of a file | Nothing. Not its name, not its path, not its history |
| **tree** | A directory listing | Names, modes, and the sha of each child blob or tree |
| **commit** | One snapshot | Its tree, its parents, author, committer, message |
| **tag** | An annotated tag | The object it points at, the tagger, a message |

The surprise for most people is the first row. **A blob has no name.** Two files
with identical content anywhere in your history are the same blob, stored once.
The name lives in the tree that points at it — which is why git tracks content
rather than files, and why renames are detected rather than recorded.

A **ref** — `refs/heads/main`, `refs/tags/v1.0`, `HEAD` — is just a file
containing a sha. That is the whole of "branching is cheap".

## Walking

![Walked from the commit into src/: folders first, each mode spelled out](../screenshots/objects-tree.webp)

The left column lists every ref, grouped as git groups them: HEAD (with
`→ main` when it is on a branch), Branches, Tags and Remotes, each with a
count. Remotes starts folded. A square marker is a ref to a commit, a round
green one an **annotated** tag. The filter narrows every group at once. Click
a ref to land on the object it names; that row stays lit while you walk from it.

From there everything is a door:

- A **commit** shows what it **points to** — its root tree, with how many
  entries it holds, and each parent, with its subject — then its author and
  committer (*same as author* when they match) and the message.
- A **tree** is a table of name, mode, object and size, folders first. Each
  mode is spelled out: *file*, *executable*, *folder*, *symlink*, *submodule*.
  A folder says how many items it holds; a symlink, where it points.
- A **blob** shows its text with line numbers (the head of it, for anything
  large), or says plainly that it is binary. Reached through a tree, a bar
  says what it is called there — *Named src/app.ts in commit 07c6f3d, mode
  100644 (regular file)* — with a link to that file's history.
- An **annotated tag** points to the object it names and records its tagger.

![A blob, the name its tree gave it, and where it sits in the model](../screenshots/objects-blob.webp)

### The path

The band under the revision box is the **path** you walked:
`branch main → commit 07c6f3d → root → src/ → app.ts`. A commit's tree is the
**root**; a file or folder takes the name of the row you clicked. Click any
chip to go back to it. Typing a revision, picking a ref or one of the examples
beside **Open** starts a new path.

**Back** and **Forward** step through everything you opened, as in a browser:
after going back, Forward returns, until you open something new from there.
The revision box follows the walk, so `main:src/app.ts` is always there to copy.

### Colours

Each kind keeps one colour wherever it appears — badge, chip, card, row: commit
in the theme's accent, tree in its yellow, blob in blue, tag and ref in green.
Under the object's header, one sentence says what that kind *is*.

### Where you are in the model

The strip at the bottom of the pane is git's chain — **ref → commit → tree →
blob**, with **tag** between ref and commit on an annotated tag — and the kind
on screen is lit as *you are here*.

## Typing a revision

The box takes anything `git rev-parse` accepts, which is where this stops being
a browser and starts being a way to learn:

| Type this | To get |
|-----------|--------|
| `HEAD` | The current commit |
| `HEAD~3` | Three commits back |
| `HEAD^{tree}` | That commit's tree, peeled |
| `HEAD:src/app.ts` | The blob for that path, directly |
| `v1.0^{}` | What an annotated tag points at, rather than the tag object |
| `a1b2c3d` | Any object, by sha — abbreviations work |

Mode digits in a tree listing are worth knowing: `100644` a file, `100755`
executable, `040000` a subtree, `120000` a symlink, `160000` a submodule
gitlink — that last one being the whole of what a submodule stores.

## Limits worth knowing

- **Read-only, on purpose.** There is nothing here to write with. Making objects
  by hand is a `git hash-object` exercise, and belongs in a terminal.
- **Large blobs are truncated** after the first 200 KB — enough to see what it
  is, not enough to hang the window.
- **Sizes are the object's content size** as `git cat-file -s` reports it, not
  what it costs on disk after packing. For that, see
  [maintenance](maintenance.md).
- **Unreachable objects are still objects.** Paste a sha from a `git fsck`
  dangling report and it opens, which is often the fastest way to see what a
  lost commit contained before deciding whether to recover it.
- **A submodule row does not open.** Its gitlink names a commit of another
  repository, which this one does not have.
- **Counts and symlink targets have a ceiling.** A tree with more than 300
  subfolders lists them without item counts, and only the first 50 symlinks
  show their target.
- **The path ends with the dialog.** Close it and the next one starts again
  from HEAD's branch.

See also: [The graph](graph.md) · [Repository maintenance](maintenance.md) ·
[Recovery](recovery.md)
