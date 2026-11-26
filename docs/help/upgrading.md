---
title: Upgrading, and living beside Gitcito
category: Start here
order: 9
summary: What changes when you update across 4.59, the release that gave GitHuttBr its own identity, and why it now installs next to Gitcito instead of over it.
keywords: upgrade update 4.58 4.59 identity app id bundle id com.huttbr.git installer uninstall coexist side by side gitcito keychain safe storage prompt data folder settings deb rpm appimage diff driver textconv
---

# Upgrading, and living beside Gitcito

GitHuttBr began as a fork of <code>Gitcito</code>, and until 4.58 it still
carried that app's identity: the same package id, the same Windows installer
GUID, the same macOS bundle id. On a machine that also had the real
<code>Gitcito</code>, installing GitHuttBr replaced it on Windows, removed
it on Linux and collided with it on macOS. It also copied
<code>Gitcito</code>'s settings on its first start, and kept reading what
<code>Gitcito</code> leaves in your repositories.

From 4.59 GitHuttBr is its own app. Its identity is **`com.huttbr.git`**, the
reverse form of its domain, git.huttbr.com. The two apps install side by side,
keep separate settings and leave each other's data alone.

## Updating an existing GitHuttBr

Your settings, profiles, tokens and vault stay where they are: the data folder
(`GitHuttBr`, in `~/.config` on Linux, `~/Library/Application Support` on macOS,
`%APPDATA%` on Windows) and the keychain entry (*GitHuttBr Safe Storage*) keep
their names.

| Platform | What happens |
|----------|--------------|
| **Windows** | The new installer has a new GUID, so its own "remove the previous version" step cannot see the old install. A step of its own looks for the old entry (per user and per machine) and, **only when it is named GitHuttBr**, runs its uninstaller silently, keeping your data, before installing. An entry named <code>Gitcito</code> is never touched. The auto-updater runs the same installer, so an update from inside the app works the same way. |
| **macOS** | Expect to install **this one version by hand**. The macOS updater only installs a build whose signature matches the running app's, and the bundle id is part of that match, so 4.58 will most likely refuse the update to `com.huttbr.git`: download the new build from the [releases page](https://github.com/StarleyDev/githuttbr/releases) and drag it over the old `GitHuttBr.app`. Updates after that are automatic again. On the first start the keychain item *GitHuttBr Safe Storage* still belongs to the old identity, so macOS may ask for your login password to allow access: choose **Always Allow**, or the saved tokens cannot be decrypted. |
| **Linux** | The `.deb` package and the AppImage are still called `githuttbr`, so an update is an ordinary upgrade. |

## Next to Gitcito

The packages no longer claim to replace <code>Gitcito</code>: the `.deb` and
`.rpm` declare no `replaces`, `conflicts` or `provides`, the Windows installer
and the macOS bundle have their own ids, and both apps can be installed and
running at once.

GitHuttBr does not read, rewrite or delete anything <code>Gitcito</code>
owns:

| <code>Gitcito</code>'s data | What GitHuttBr does |
|----------------|---------------------|
| Its settings folder | Nothing. It is no longer copied on the first start. |
| <code>.gitcito.json</code> in a repository | Not read. Only `.githuttbr.json` is the [repository config](repo-config.md). |
| WIP snapshots and purge backups under <code>refs/gitcito/</code> | Not listed, restored, pruned or deleted. |
| Stack parents, protected branches, subtrees (<code>gitcito.*</code> config keys) | Not read, and not unset when you change your own. |
| Local-CI verdicts under <code>refs/notes/gitcito-ci</code> | Not read. |
| Its stack markers in a pull request body | Left as they are; GitHuttBr adds its own section. |
| Its terminal command, its `core.editor` setting, its diff converter | Not flagged, fixed or removed by `githuttbr doctor` or the diff-driver list. |
| Its environment variables and launch-config block | Not set, not read. |

## What older GitHuttBr data no longer counts

The same names were used by GitHuttBr itself up to 4.58. Inside a repository
there is no telling the two apps' data apart, so what only carries the old name
there is now treated as <code>Gitcito</code>'s: **repository data written by
4.38 or older** under the old names (stack parents, protected branches,
remembered subtrees, snapshots, purge backups, local-CI verdicts, the
repository config file) is no longer read. Recreate what you still need; for
the repository config, rename the file to `.githuttbr.json`.

Three things still work, because each can only be this app's own:

- **A secure bundle made by 4.58 or older** still opens. Bundles are files you
  pick, and they now carry the GitHuttBr format name; a 4.58 or older build
  cannot open a bundle made by this one.
- **A settings export made by 4.38 or older** still imports, tokens included.
  An export is also a file you pick.
- Up to 4.38 the bundled converter for Word, Excel, JSON and `.strings` was
  written into git config as a path ending in <code>gitcito-textconv</code>
  inside the GitHuttBr install folder. Such an entry, and only one inside a
  folder named after GitHuttBr, is still repointed at the current converter
  when the app starts or opens the repository, with an **Undo** (see
  [diff drivers](attributes.md)). The same file name inside
  <code>Gitcito</code>'s own install is left alone.

## Limits

- **The Windows and macOS upgrade has not been tested on a real machine yet.**
  The installer step is checked against electron-builder's own scripts, and the
  GUID it looks for is recomputed in the test suite, but NSIS does not run here.
  Until it has been tried, an update that leaves two GitHuttBr entries in
  **Settings → Apps** is the failure to expect; removing the older one by hand
  is safe, and keeps your data.
- On Windows the old entry is found only when its name starts with GitHuttBr
  (or *Git HuttBr*, the spelling up to 4.38). An entry renamed by hand is left.
- A per-machine install upgraded by an administrator other than you looks for
  your old per-user install under the administrator's account, not yours.
- On macOS both the refused update and the keychain question are what Apple's
  rules lead us to expect, not something already seen on a real Mac. If 4.58
  does install the update by itself, nothing is lost: the by-hand step is simply
  not needed.
- On macOS the keychain question is the system's, not the app's: denying it
  leaves the tokens unreadable until you allow it in Keychain Access.
