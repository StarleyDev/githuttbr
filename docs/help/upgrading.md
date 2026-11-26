---
title: Upgrading to 4.59
category: Start here
order: 9
summary: What changes when you update across 4.59, the release that gave GitHuttBr its own app identifier, and what to do if the update does not install by itself.
keywords: upgrade update 4.58 4.59 identity identifier app id bundle id com.huttbr.git installer uninstall reinstall download keychain safe storage prompt data folder settings deb rpm appimage
---

# Upgrading to 4.59

Every desktop app has an identifier the system knows it by: Windows names its
installed-programs entry after it, macOS checks it before installing an update,
and Linux packages declare it. Until 4.58 GitHuttBr still carried an identifier
it inherited when it started. From 4.59 it has its own, **`com.huttbr.git`**,
the reverse form of its domain, git.huttbr.com.

**Your data does not move.** Settings, profiles, tokens and the vault stay in
the same data folder (`GitHuttBr`, in `~/.config` on Linux,
`~/Library/Application Support` on macOS, `%APPDATA%` on Windows), and the
keychain entry keeps its name (*GitHuttBr Safe Storage*). Your repositories are
not touched.

## What happens on each system

| Platform | What happens |
|----------|--------------|
| **Windows** | The new installer removes the previous GitHuttBr install before copying its files, keeping your data, so **one** GitHuttBr is left in **Settings → Apps**. The automatic update runs the same installer. Only an entry named GitHuttBr is removed; no other app is touched. |
| **macOS** | Install **this one version by hand**. macOS only installs an update whose identifier matches the running app's, so any version before 4.59 cannot update to it by itself. Download it from [git.huttbr.com](https://git.huttbr.com) and drag it over the old `GitHuttBr.app`. Updates after that are automatic again. |
| **Linux** | The `.deb` package and the AppImage keep the name `githuttbr`, so the update is an ordinary upgrade. |

## If the update fails

1. Download the new version from [git.huttbr.com](https://git.huttbr.com) and
   install it by hand.
2. If that install fails too, uninstall the current GitHuttBr first, then
   install the new one. Uninstalling keeps your data folder, so settings and
   tokens are still there afterwards.
3. On Windows, if **Settings → Apps** ever shows two GitHuttBr entries, remove
   the older one: your data is kept.

## Older repository data

Up to 4.38 GitHuttBr kept a few things inside repositories under its earlier
names: stack parents, protected branches, remembered subtrees, WIP snapshots,
purge backups, local-CI verdicts and the repository config file. From 4.59
those old names are no longer read, so that data has to be recreated. For the
repository config, rename the file to `.githuttbr.json` (see
[repository config](repo-config.md)).

Three things from older versions still work, because each can only be this
app's own:

- **A secure bundle made by 4.58 or older** still opens. Bundles made by 4.59
  cannot be opened by 4.58 or older.
- **A settings export made by 4.38 or older** still imports, tokens included.
- **The bundled converter for Word, Excel, JSON and `.strings`**, when an old
  version wrote its earlier path into git config, is repointed at the current
  one, with an **Undo** (see [diff drivers](attributes.md)).

## Limits

- **macOS keychain:** the system may ask once for your login password so
  GitHuttBr can read its saved tokens. Choose **Always Allow**; denying leaves
  the tokens unreadable until you allow it in Keychain Access. On a test Mac
  updated by hand from 4.52 the question did not appear at all.
- **Windows:** the previous install is found only when its entry name starts
  with GitHuttBr (or *Git HuttBr*, the spelling up to 4.38). An entry renamed by
  hand is left in place.
- **Windows, per machine:** an install upgraded by an administrator other than
  you looks for the old per-user install under the administrator's account,
  not yours.
- **Pinned taskbar icon:** on Windows the pin may stop grouping with the app
  after the update. Unpin it and pin it again.
