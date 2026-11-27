---
title: Per-repository settings
category: Workspace tools
order: 94
summary: One repository's display name, profile, protected branches and tab image, plus its rules, vault and activity.
keywords: repo settings protected branches tab image icon logo picture display name alias rename profile remove from list forget analytics metrics operation log history info information gear config project configuration githuttbr.json doctor
---

# Per-repository settings

The gear next to the toolbar tools opens settings that belong to **this**
repository, not the app.

![Per-repository settings](../screenshots/repo-settings.webp)

The header says which repository you are about to change: its name, its folder,
the current branch, the main remote (`origin` when there is one) with the host
it lives on, and a few counts. The branch count comes from the list already
loaded. The vault count appears only after you open **Vault**, because reading
the vault asks the system keychain, and opening settings should not. There is
no commit count: counting a long history is a git call of its own, and a header
is not worth one.

The pages sit in a side nav, in three groups:

| Group | Page | What it holds |
|---|---|---|
| Repository | **General** | Display name, profile, protected branches, the tab image, and Remove from list |
| Repository | **Project configuration** | The [rules this repository ships](repo-config.md) in `.githuttbr.json`, and the doctor that checks them |
| Repository | **Information** | Free-form notes and fields about this repository, kept locally |
| Security | **Vault** | This repository's [vault](vault.md) entries |
| Activity | **Metrics** | What you have done in GitHuttBr, counted locally |
| Activity | **Insights** | The [history dashboard](insights.md) |
| Activity | **Operation history** | Commits over time and who made them, for the repositories you have opened |
| Activity | **Logs** | The operation log: every git command GitHuttBr ran here, with its result |

The operation log is the honest one: when something behaves oddly, it shows the
exact command and the exact error, so a bug report can carry facts rather than
adjectives.

## General

Each setting is a row: what it does on the left, the control on the right.
Nothing is stored until you press **Save**.

| Row | What it does | Stored in |
|---|---|---|
| **Display name** | The name on tabs and lists. The folder on disk is never renamed; left empty, the folder name is used | GitHuttBr's settings, this machine |
| **Profile** | The identity, tokens and AI this repository switches to when its tab is active. **Auto** follows the active profile | GitHuttBr's settings, this machine |
| **Protected branches** | Warns before committing or force-pushing directly to these branches | The repository's git config |
| **Tab image** | A small picture on the tab, below | GitHuttBr's settings, this machine |

When the repository has a `.githuttbr.json`, a banner on top of General says so
and links to **Project configuration**. Those rules travel with the repository
to everyone who clones it; the rows under the banner are yours alone.

**Remove from list…** drops the repository from [Repositories](repositories.md).
It asks first, and the question says what it does not do: the folder on disk is
not touched, and a tab you have open stays open. Opening the repository again
puts it back on the list — and so does the next start while its tab is still
open, because the list is rebuilt from the open tabs. Close the tab too to make
it stick.

## Tab image

With ten tabs open, names that start the same way — `api`, `api-gateway`,
`api-docs` — are slow to tell apart. A small picture on the tab is faster to
spot than text.

In **General**, click the image field. It lists the repository's own images —
PNG, JPEG, GIF, WebP, SVG, ICO, BMP and AVIF — each with a thumbnail, files
named like a logo or an icon first. Type to narrow it down (`logo dark` finds
`assets/logo-dark.png`), move with the arrow keys, and press Enter to pick; or
type a path by hand. The path is stored **relative to the repository root**, so
the image follows the repository wherever its folder lives.

What the tab shows is an app-wide choice, in **Settings → General → Repository
tabs show**:

| Option | The tab shows |
|---|---|
| **Image and name** (default) | The image in place of the folder icon, then the name |
| **Name only** | The folder icon and the name, as if no image were set |
| **Image only** | Just the image; the name moves into its tooltip |

Limits worth knowing:

- The list holds the files git can see — tracked and untracked, not ignored
  ones — and at most 40 at a time; type to reach the rest. An ignored image can
  still be typed by hand.
- Images over 1 MB, or ones that cannot be read, appear greyed out and cannot
  be picked: a 20-pixel icon does not need more.
- A repository **without** an image always shows its name, whichever option is
  picked — a tab with nothing on it would be unidentifiable.
- If the path is **broken** — the file was deleted, renamed, is not an image,
  or is too large — the tab quietly falls back to the name, and the General
  page shows a warning under the path. Nothing else complains.
- The image is read once per session. If you replace the file under the same
  name, open these settings again to reload it.
- The setting lives in GitHuttBr's own settings on this machine, not in the
  repository, so teammates do not inherit it.

**See also:** [Repository rules](repo-config.md) · [Security & secrets](security.md) ·
[Insights](insights.md)
