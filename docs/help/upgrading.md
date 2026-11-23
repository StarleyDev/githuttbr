---
title: Upgrading from 4.38
category: Start here
order: 9
summary: What 4.39 carries over from version 4.38 and earlier, and the few things you redo by hand.
keywords: upgrade update 4.38 4.39 rename migrate migration data folder settings profiles tokens api keys keychain vault terminal command core.editor diff driver textconv
---

# Upgrading from 4.38

Version 4.39 renamed the app inside as well as on the label: its data folder,
its keychain entry and its terminal command now all say GitHuttBr. Most of what
you had comes along on its own. The rest is locked to the old name, and this
page lists it so nothing goes missing quietly.

<!-- The old name is written as Git&#99;ito / git&#99;ito on purpose: the app and
     the website rewrite the plain spelling to the new name, which would turn
     "the old Git&#99;ito folder" into a folder that does not exist. -->

## Copied for you

The first time 4.39 starts with no data of its own, it copies from the 4.38
data folder, named <code>Git&#99;ito</code> (in `~/.config` on Linux,
`~/Library/Application Support` on macOS, `%APPDATA%` on Windows):

| Carried over | What it holds |
|--------------|---------------|
| Settings | Profiles (without their tokens), workspaces, open tabs, preferences |
| Local Storage | Panel layout, diff toggles, zoom, recent commands and the other per-window choices |
| Repository list | Every repository the app knew about, open or not |
| Repository info and wikis | The reference notes and generated wikis kept per repository |
| Operation log and usage stats | The history behind the log and the activity charts |
| Profile pictures | Images chosen for a profile |

| Not carried over | Why |
|------------------|-----|
| Tokens, AI keys, vault secrets | Encrypted with the old keychain entry — see below |
| Keychain consent | Given to the old entry; you are asked again |
| Caches (AI model lists, avatars, release notes) | They refill on their own |

The old folder is **left untouched** — nothing is moved or deleted — so an
older install still finds it. A file 4.39 already has is never overwritten. A
note in the app says so once.

What lives in your repositories keeps working without any step: a
<code>.git&#99;ito.json</code> config, WIP snapshots, stack parents and the other
keys 4.38 wrote are still read. New ones are written under the new name.

## Bring back by hand

Tokens, AI keys and [vault](vault.md) secrets are encrypted with the OS
keychain entry, and the keychain entry follows the app's name. The new entry
cannot open what the old one sealed, so these start empty — the old encrypted
files stay in the old folder, unread.

The way back is an export made by 4.38 itself, which can still open them:

1. In 4.38, **Settings → Data → Export settings**, with **Include API keys,
   tokens & Vault secrets** ticked.
2. Here, **Settings → Data → Import settings**, and choose **Add to mine**.

Without 4.38 at hand, type the tokens and keys again; the vault refills as you
add to it. Either way you are asked about the keychain once more, since your
earlier answer was given to the old entry.

A few things outside the app still name the old command:

| What | What to do |
|------|------------|
| **The terminal command** is now `githuttbr` | Command palette → **Install 'githuttbr' command in PATH**. The old link stays until you remove it (on Linux, <code>~/.local/bin/git&#99;ito</code>) |
| **git's editor** still runs <code>git&#99;ito --wait</code> | Run `githuttbr editor install`, or set `core.editor` to `githuttbr --wait` |
| **Diff drivers** that use the bundled converter point at <code>git&#99;ito-textconv</code> | Remove the driver and add it again under [diff drivers](attributes.md) |

## Limits

- The copy runs once, and only while 4.39 has no settings of its own. It
  leaves a marker behind, so resetting 4.39's settings later starts clean rather
  than copying 4.38 again. What you change in 4.38 afterwards does not follow;
  export and import it instead.
- The panel layout comes along only when 4.39 has no Local Storage of its own
  yet: two of those databases cannot be merged, so an existing one wins.
- An export made **without** the tick carries no secrets — that is what the
  default export is for. Delete the file with secrets once it is imported:
  anyone holding it holds your tokens.
