---
title: External editor
category: Workspace tools
order: 95
summary: Send a repository, a file, or one line of code to the editor you actually write in.
keywords: editor vscode code cursor windsurf devin desktop zed sublime jetbrains intellij webstorm xcode open in editor line column custom command argv
---

# External editor

A Git client is where you read code; it is rarely where you fix it. The gap
between noticing a problem in a diff and having the cursor on that line in your
editor is a file search and a scroll — every time.

Point GitHuttBr at your editor once and that gap closes: right-click a line in the
file or blame view and it opens there, at that line.

## Choosing one

**Settings → General → External editor.** The dropdown lists the editors GitHuttBr
can find on this machine — it looks for each editor's command first, then, on
macOS, for the application bundle in `/Applications` and `~/Applications`. The
scan runs each time you open Settings, so an editor installed five minutes ago
shows up without restarting.

Recognised out of the box:

| Editor | Command it looks for |
|--------|----------------------|
| Visual Studio Code | `code`, `code-insiders` |
| Cursor | `cursor` |
| Windsurf | `windsurf` |
| Devin Desktop | `devin-desktop` (never a bare `devin`, which is another tool) |
| Zed | `zed` |
| Sublime Text | `subl` |
| JetBrains IDEs | `idea`, `webstorm`, `pycharm`, `rustrover`, `goland`, `clion`, `rider`, `phpstorm` |
| Xcode | `xed` |

**On Linux, an editor outside PATH.** An editor unpacked into a folder of
your choosing is often not on PATH, but it is in the application menu. GitHuttBr
also reads the menu's `.desktop` entries — in the XDG data folders
(`~/.local/share`, then `/usr/local/share` and `/usr/share`, or whatever
`XDG_DATA_HOME` and `XDG_DATA_DIRS` say) and in Flatpak's and Snap's exports —
and recognises an editor by its name or by the program its `Exec=` line starts.
An entry marked hidden or not to be displayed, or whose `TryExec=` program is
missing, does not count. For a VS Code build such as
Devin Desktop it prefers the command in `bin/` beside that program, since only
that one can jump to a line. The entries are read as text and nothing in them
is run; an entry that needs extra arguments to start the editor (a Flatpak
`flatpak run …`) is skipped, so such an install still needs its command on
PATH. On macOS, a `Devin.app` counts only when its `product.json` names Devin
Desktop, so an unrelated app of the same name is never the one opened.

## The limit worth knowing

**Jumping to a line needs the editor's command, not its icon.** A macOS `.app`
bundle is launched through `open`, which accepts a path and nothing else — so an
editor found only as a bundle opens the file at the top, and GitHuttBr says so
under the dropdown rather than pretending otherwise.

The fix is on the editor's side: VS Code's *Shell Command: Install 'code' command
in PATH*, Sublime's `subl` symlink, JetBrains' *Toolbox → Settings → Shell
scripts*. Once the command exists, pick the editor again and the line jump works.

## Where the actions appear

| Surface | What it opens |
|---------|---------------|
| Repo tab, sidebar repo, status bar | The repository folder |
| File tree, commit files, stash files, the commit composer | That file |
| The row-end icon in the file tree | That file, in one click |
| Right-click a line in the **file** view | The file, at that line |
| Right-click a line in the **blame** view | The file, at that line |
| An `.xcodeproj` or other package in the file tree | The package, in the app that owns it |

Line actions only appear where the line number still means something: a file
shown at an old commit, or a blame rewound to an earlier revision, has lines that
no longer match what is on disk, so GitHuttBr offers no jump there rather than
sending you to the wrong place.

## Xcode projects and other packages

`MyApp.xcodeproj` is a directory. Git knows that, and so did the file tree until
it started to matter: expanding it to find `project.pbxproj`, `project.xcworkspace`
and a folder per developer under `xcuserdata` is three clicks of noise for a
thing you were never going to edit by hand.

These now render with a package icon and **clicking the row opens the package**,
the way double-clicking it in Finder does. The chevron is still there, so the
one time you *do* need `project.pbxproj` — a merge conflict, almost always — you
descend into it as before.

Recognised: `.xcodeproj`, `.xcworkspace`, `.xcframework`, `.framework`, `.app`,
`.appex`, `.dSYM`, `.playground`, `.xcuserdatad`.

**Not** recognised, on purpose: `.xcassets` and `.lproj`. They are packages too,
but people edit the files inside them, so collapsing them would cost more than
it saves.

### The limits

**The package opens through the system, not through your editor.** An
`.xcodeproj` handed to a text editor opens as a folder of property lists, which
is not what anyone clicking it wanted — so GitHuttBr hands it to whatever the OS
associates with it, which on a Mac with Xcode installed is Xcode. Your editor
choice is untouched; it still governs every ordinary file.

**It is a naming convention, not a filesystem flag.** GitHuttBr matches the
extension, so a directory you happened to name `notes.app` collapses too, and on
Linux or Windows — where these are ordinary folders — clicking one opens it in
the file manager rather than in an IDE.

## A command of your own

Pick **Custom command** for anything not in the table — a wrapper script, a
remote-development launcher, a terminal editor started through your own shim.

| Field | Meaning |
|-------|---------|
| Command | The executable to run. No shell, so no `&&`, pipes or globs. |
| Name | What the menu entries call it. |
| Arguments for a file | argv template, e.g. `-g {path}:{line}:{col}` |
| Arguments for a folder | argv template, usually just `{path}` |

Templates are split on spaces and each token is substituted once — a path with a
space stays one argument, and nothing is re-parsed afterwards, so a filename can
never turn into syntax. Four placeholders: `{path}`, `{line}`, `{col}`, `{repo}`.

A placeholder with no value takes its flag with it: `--line {line} {path}` run
without a line becomes just the path, never a dangling `--line` that would eat
the filename as its argument. A template with no `{line}` in it simply means
GitHuttBr will not offer line-precise actions for that editor.

## What this is not

This is not the ["Open with" app](repo-settings.md) setting, which shows the
system picker and remembers one app for opening *anything* — an image, a PDF, a
folder in Finder. The editor is the more specific of the two, so where both are
set the editor wins on the file tree's row-end icon; both stay listed in the
right-click menu.

GitHuttBr never launches your editor by itself, and closing GitHuttBr never closes
it: the editor is started detached, as a process of its own.
